"""Offline PDF preprocessing: page renders, positioned words, text blocks, vector drawings.

Usage: python -I scripts/extract_pdf.py <pdf> <out_dir>
"""
import json, sys, os
import pymupdf

def main(pdf_path, out_dir):
    os.makedirs(os.path.join(out_dir, "pages"), exist_ok=True)
    doc = pymupdf.open(pdf_path)
    meta = {"source": os.path.basename(pdf_path), "pageCount": doc.page_count,
            "metadata": doc.metadata, "toc": doc.get_toc(), "pages": []}
    for i, page in enumerate(doc):
        w, h = page.rect.width, page.rect.height
        n = i + 1
        page.get_pixmap(dpi=110).save(os.path.join(out_dir, "pages", f"p{n:02}.png"))
        # Words with bboxes normalized to 0-1 so they're render-size independent.
        words = [{"t": t, "b": [round(x0/w, 4), round(y0/h, 4), round(x1/w, 4), round(y1/h, 4)],
                  "blk": blk, "ln": ln}
                 for x0, y0, x1, y1, t, blk, ln, _ in page.get_text("words")]
        spans = []
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    if s["text"].strip():
                        spans.append({"t": s["text"], "font": s["font"], "size": round(s["size"], 1),
                                      "bold": bool(s["flags"] & 16), "color": s["color"],
                                      "b": [round(s["bbox"][0]/w, 4), round(s["bbox"][1]/h, 4),
                                            round(s["bbox"][2]/w, 4), round(s["bbox"][3]/h, 4)]})
        drawings = page.get_drawings()
        rects = [{"b": [round(d["rect"].x0/w, 4), round(d["rect"].y0/h, 4),
                        round(d["rect"].x1/w, 4), round(d["rect"].y1/h, 4)],
                  "fill": d.get("fill"), "stroke": d.get("color")} for d in drawings]
        with open(os.path.join(out_dir, "pages", f"p{n:02}.json"), "w") as f:
            json.dump({"page": n, "width": w, "height": h, "words": words, "spans": spans,
                       "drawings": rects}, f)
        with open(os.path.join(out_dir, "pages", f"p{n:02}.txt"), "w") as f:
            f.write(page.get_text())
        meta["pages"].append({"page": n, "chars": len(page.get_text()), "words": len(words),
                              "drawings": len(drawings), "images": len(page.get_images())})
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
