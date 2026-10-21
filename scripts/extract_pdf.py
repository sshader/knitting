"""Offline PDF preprocessing: page renders, positioned words, text blocks, vector drawings.

Usage: python -I scripts/extract_pdf.py <pdf> <out_dir>
"""
import json, sys, os
import pymupdf

DIFF_DPI = 30


def visible_image_boxes(pdf_path, page_index, infos):
    """What each placed image visibly contributes: {"vb", "fill", "spread"} or None.

    Placement boxes ignore clip paths, masks, and overlap. Instead, render the
    page, delete images topmost-first, and diff successive renders: changed
    pixels are where that image showed. "fill" is the fraction of the visible
    box that changed and "spread" the std dev of those pixels' brightness, so a
    flat panel or tint reads as fill~1, spread~0.
    """
    doc = pymupdf.open(pdf_path)
    page = doc[page_index]
    W, H = page.rect.width, page.rect.height
    before = page.get_pixmap(dpi=DIFF_DPI, alpha=False)
    out = [None] * len(infos)
    deleted = set()
    for i in reversed(range(len(infos))):
        xref = infos[i]["xref"]
        if xref in deleted:
            continue
        deleted.add(xref)
        try:
            page.delete_image(xref)
        except Exception:
            continue
        after = page.get_pixmap(dpi=DIFF_DPI, alpha=False)
        w, h, n = before.width, before.height, before.n
        a, b = before.samples, after.samples
        # One xref may be placed several times; attribute changes by placement box.
        for j, info in enumerate(infos):
            if info["xref"] != xref:
                continue
            x0, y0, x1, y1 = info["bbox"]
            px0, py0 = max(0, int(x0 / W * w)), max(0, int(y0 / H * h))
            px1, py1 = min(w, int(x1 / W * w) + 1), min(h, int(y1 / H * h) + 1)
            xs, ys, lum = [], [], []
            for y in range(py0, py1):
                row = y * w * n
                for x in range(px0, px1):
                    k = row + x * n
                    if abs(a[k] - b[k]) + abs(a[k + 1] - b[k + 1]) + abs(a[k + 2] - b[k + 2]) > 24:
                        xs.append(x)
                        ys.append(y)
                        lum.append((a[k] + a[k + 1] + a[k + 2]) / 3)
            if xs:
                box = (max(xs) + 1 - min(xs)) * (max(ys) + 1 - min(ys))
                mean = sum(lum) / len(lum)
                out[j] = {"vb": [round(min(xs) / w, 4), round(min(ys) / h, 4),
                                 round((max(xs) + 1) / w, 4), round((max(ys) + 1) / h, 4)],
                          "fill": round(len(xs) / box, 2),
                          "spread": round((sum((v - mean) ** 2 for v in lum) / len(lum)) ** 0.5, 1)}
        before = after
    return out

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
                        spans.append({"t": s["text"], "blk": b["number"], "font": s["font"], "size": round(s["size"], 1),
                                      "bold": bool(s["flags"] & 16), "color": s["color"],
                                      "b": [round(s["bbox"][0]/w, 4), round(s["bbox"][1]/h, 4),
                                            round(s["bbox"][2]/w, 4), round(s["bbox"][3]/h, 4)]})
        drawings = page.get_drawings()
        rects = [{"b": [round(d["rect"].x0/w, 4), round(d["rect"].y0/h, 4),
                        round(d["rect"].x1/w, 4), round(d["rect"].y1/h, 4)],
                  "fill": d.get("fill"), "stroke": d.get("color")} for d in drawings]
        infos = page.get_image_info(xrefs=True)
        visible = visible_image_boxes(pdf_path, i, infos) if infos else []
        # "b" is the placement box; "visible" what actually shows (null if nothing did).
        images = [{"b": [round(info["bbox"][0]/w, 4), round(info["bbox"][1]/h, 4),
                         round(info["bbox"][2]/w, 4), round(info["bbox"][3]/h, 4)],
                   "visible": vis, "px": [info["width"], info["height"]]}
                  for info, vis in zip(infos, visible)]
        with open(os.path.join(out_dir, "pages", f"p{n:02}.json"), "w") as f:
            json.dump({"page": n, "width": w, "height": h, "words": words, "spans": spans,
                       "drawings": rects, "images": images}, f)
        with open(os.path.join(out_dir, "pages", f"p{n:02}.txt"), "w") as f:
            f.write(page.get_text())
        meta["pages"].append({"page": n, "chars": len(page.get_text()), "words": len(words),
                              "drawings": len(drawings), "images": len(page.get_images())})
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
