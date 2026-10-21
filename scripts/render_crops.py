"""Render page regions to PNG.

Usage: python -I scripts/render_crops.py <pdf> <requests.json>
requests.json: [{"page": 3, "bbox": [x0, y0, x1, y1] (0-1), "out": "path.png", "maxPx": 400?}, ...]
maxPx caps the longer side (lower DPI) for cheap thumbnails.
"""
import json, sys
import pymupdf

DPI = 150
PAD = 0.01

def main(pdf_path, requests_path):
    doc = pymupdf.open(pdf_path)
    for r in json.load(open(requests_path)):
        page = doc[r["page"] - 1]
        W, H = page.rect.width, page.rect.height
        x0, y0, x1, y1 = r["bbox"]
        clip = pymupdf.Rect(max(0, x0 - PAD) * W, max(0, y0 - PAD) * H, min(1, x1 + PAD) * W, min(1, y1 + PAD) * H)
        dpi = DPI
        if r.get("maxPx"):
            dpi = min(DPI, int(r["maxPx"] * 72 / max(clip.width, clip.height)))
        page.get_pixmap(dpi=max(dpi, 20), clip=clip).save(r["out"])

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
