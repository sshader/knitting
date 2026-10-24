"""The pipeline's PDF work as a web service, for Convex to call.

Each endpoint takes a link to the PDF (a Convex storage URL), runs one of the
scripts in ../scripts on it, and returns the files it wrote as a zip:

  POST /extract {pdf_url}                          pages/pNN.{json,png,txt}, meta.json (extract_pdf.py)
  POST /crops   {pdf_url, requests: [{page, bbox, maxPx?}]}   crop-0.png, crop-1.png, ... (render_crops.py)
  POST /grid    {pdf_url, page, bbox}              grid.json, chart.png, class-K.png (render_crops.py + raster_grid.py)

Pages are 1-based within this PDF. Requests need "Authorization: Bearer
$PDF_SERVICE_TOKEN". Stateless: nothing is kept between requests.
"""
import io, json, os, sys, tempfile, urllib.request, zipfile

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

SCRIPTS = os.environ.get("KNITTING_SCRIPTS", os.path.join(os.path.dirname(__file__), "..", "scripts"))
sys.path.insert(0, SCRIPTS)
import extract_pdf, raster_grid, render_crops  # noqa: E402

app = FastAPI()


def authorized(authorization: str = Header(default="")):
    token = os.environ.get("PDF_SERVICE_TOKEN")
    if not token or authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="bad token")


class Extract(BaseModel):
    pdf_url: str


class Crop(BaseModel):
    page: int
    bbox: list[float]
    maxPx: int | None = None


class Crops(BaseModel):
    pdf_url: str
    requests: list[Crop]


class Grid(BaseModel):
    pdf_url: str
    page: int
    bbox: list[float]


def download(url, path):
    with urllib.request.urlopen(url) as r, open(path, "wb") as f:
        f.write(r.read())


def zipped(folder):
    """Every file under folder, by its path relative to it."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(folder):
            for name in files:
                full = os.path.join(root, name)
                z.write(full, os.path.relpath(full, folder))
    return Response(buf.getvalue(), media_type="application/zip")


@app.post("/extract", dependencies=[Depends(authorized)])
def extract(req: Extract):
    with tempfile.TemporaryDirectory() as tmp:
        pdf, out = os.path.join(tmp, "in.pdf"), os.path.join(tmp, "out")
        download(req.pdf_url, pdf)
        extract_pdf.main(pdf, out)
        return zipped(out)


@app.post("/crops", dependencies=[Depends(authorized)])
def crops(req: Crops):
    with tempfile.TemporaryDirectory() as tmp:
        pdf, out = os.path.join(tmp, "in.pdf"), os.path.join(tmp, "out")
        os.makedirs(out)
        download(req.pdf_url, pdf)
        spec = os.path.join(tmp, "crops.json")
        with open(spec, "w") as f:
            json.dump([{**r.model_dump(exclude_none=True), "out": os.path.join(out, f"crop-{i}.png")} for i, r in enumerate(req.requests)], f)
        render_crops.main(pdf, spec)
        return zipped(out)


@app.post("/grid", dependencies=[Depends(authorized)])
def grid(req: Grid):
    with tempfile.TemporaryDirectory() as tmp:
        pdf, out = os.path.join(tmp, "in.pdf"), os.path.join(tmp, "out")
        os.makedirs(out)
        download(req.pdf_url, pdf)
        spec = os.path.join(tmp, "crop.json")
        with open(spec, "w") as f:
            json.dump([{"page": req.page, "bbox": req.bbox, "out": os.path.join(out, "chart.png"), "maxPx": 1600}], f)
        render_crops.main(pdf, spec)
        raster_grid.main(pdf, req.page, ",".join(str(v) for v in req.bbox), out)
        # Sample paths in grid.json point into the temp folder; make them relative to the zip.
        with open(os.path.join(out, "grid.json")) as f:
            g = json.load(f)
        for k in g["classes"]:
            k["sample"] = os.path.basename(k["sample"])
        with open(os.path.join(out, "grid.json"), "w") as f:
            json.dump(g, f)
        return zipped(out)
