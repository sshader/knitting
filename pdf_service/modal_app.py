"""Hosts service.py on Modal.

  pip install modal && modal setup                 # once: account and token
  modal secret create knitting-pdf PDF_SERVICE_TOKEN=<a long random string>
  modal deploy pdf_service/modal_app.py            # from the repo root; prints the URL

Then set the same token and the printed URL on the Convex deployment:
  npx convex env set PDF_SERVICE_URL=https://...modal.run
  npx convex env set PDF_SERVICE_TOKEN=<the same string>
"""
import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements("pdf_service/requirements.txt")
    .env({"KNITTING_SCRIPTS": "/root/scripts"})
    .add_local_file("scripts/extract_pdf.py", "/root/scripts/extract_pdf.py")
    .add_local_file("scripts/render_crops.py", "/root/scripts/render_crops.py")
    .add_local_file("scripts/raster_grid.py", "/root/scripts/raster_grid.py")
    .add_local_file("pdf_service/service.py", "/root/service.py")
)

app = modal.App("knitting-pdf", image=image)


# Chart-heavy PDFs can take a few minutes to extract.
@app.function(secrets=[modal.Secret.from_name("knitting-pdf")], timeout=900, memory=2048)
@modal.asgi_app()
def web():
    from service import app as service

    return service
