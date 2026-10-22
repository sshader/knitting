"""Read the cell grid of a raster chart image.

Finds the grid from the regular spacing of its lines, samples each cell, and
groups cells into classes by color and by any symbol drawn in them. Naming
the classes (which legend entry each is) is a separate step.

Usage: python -I scripts/raster_grid.py <pdf> <page> <x0,y0,x1,y1 (0-1)> <out_dir> [<cols>x<rows>]
The grid's extent is found by growing it while edge strips look like its
cells (see `grow`); a cols x rows size overrides that and fits lines to it.
Writes <out_dir>/grid.json, class-<k>.png samples, and grid-overlay.png.
"""
import json, os, sys
import numpy as np
import pymupdf

COLOR_TOL = 28  # RGB distance within one color class
SYMBOL_STD = 22  # brightness spread inside a cell that means something is drawn on it
HASH_TOL = 18  # differing bits (of 64) between symbol thumbnails of one class; tolerates 1px shifts


def load_image(pdf, page_no, bbox):
    """The embedded image placed at bbox, as an RGB array, plus its placement rect (page coords)."""
    doc = pymupdf.open(pdf)
    page = doc[page_no - 1]
    W, H = page.rect.width, page.rect.height
    want = pymupdf.Rect(bbox[0] * W, bbox[1] * H, bbox[2] * W, bbox[3] * H)
    best = max(page.get_image_info(xrefs=True), key=lambda i: (pymupdf.Rect(i["bbox"]) & want).get_area())
    pix = pymupdf.Pixmap(doc, best["xref"])
    if pix.n - pix.alpha != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
    return arr.astype(np.int16), best, (W, H)


def line_positions(profile, period):
    """Grid line positions: peaks of the line profile, chained at ~period spacing.

    Some lines are faint (on similar-colored cells): gaps of up to 3 periods
    are bridged with interpolated lines. Where the grid ends is decided later
    by `grow`, since border lines can be invisible (white cells on a white page).
    """
    p = np.convolve(profile, np.ones(3) / 3, mode="same")
    thresh = p.mean() + 0.5 * p.std()
    peaks = [i for i in range(1, len(p) - 1) if p[i] >= thresh and p[i] >= p[i - 1] and p[i] >= p[i + 1]]
    # Merge peaks within a few px (a line has an edge on each side).
    merged = []
    for x in peaks:
        if merged and x - merged[-1][-1] <= max(3, period * 0.25):
            merged[-1].append(x)
        else:
            merged.append([x])
    lines = [sum(g) / len(g) for g in merged]
    best, cur = [], []
    for x in lines:
        gap = (x - cur[-1]) / period if cur else 0
        k = round(gap)
        if cur and 1 <= k <= 3 and abs(gap - k) <= 0.25:
            base, step = cur[-1], (x - cur[-1]) / k
            cur.extend([base + step * i for i in range(1, k + 1)])
        elif cur and gap < 0.75:
            continue  # spurious peak inside a cell
        else:
            cur = [x]
        if len(cur) > len(best):
            best = list(cur)
    return best


def ridge_profile(gray, axis, d=2, min_contrast=8):
    """Per column (axis=1) or row (axis=0): fraction of the image where that
    line is a ridge, darker or lighter than the pixels d away on both sides.
    Grid lines are ridges along the whole grid; color boundaries inside the
    chart (darker on one side only), flat cells, and sparse label digits aren't.
    """
    g = gray if axis == 1 else gray.T
    mid, left, right = g[:, d:-d], g[:, :-2 * d], g[:, 2 * d:]
    darker = np.minimum(left, right) - mid
    lighter = mid - np.maximum(left, right)
    ridge = (np.maximum(darker, lighter) > min_contrast).mean(axis=0)
    return np.pad(ridge, (d, d))


def fit_lines(profile, chained, n):
    """n+1 evenly spaced lines (n cells) where the profile is strongest overall.
    Spacing starts from the chained lines' average (sub-pixel: cells are rarely
    a whole number of pixels, and rounding drifts across a wide chart) and is
    searched within +-2%."""
    p = np.convolve(profile, np.ones(3) / 3, mode="same")
    base = (chained[-1] - chained[0]) / (len(chained) - 1)
    best = (-1.0, 0.0, base)
    for step in np.linspace(base * 0.98, base * 1.02, 21):
        span = step * n
        for x0 in np.arange(0, len(p) - span - 1, 0.5):
            idx = np.round(x0 + step * np.arange(n + 1)).astype(int)
            score = float(p[idx].sum())
            if score > best[0]:
                best = (score, x0, step)
    _, x0, step = best
    return [x0 + k * step for k in range(n + 1)]


def estimate_period(profile, lo=6):
    p = profile - profile.mean()
    ac = np.correlate(p, p, mode="full")[len(p) - 1:]
    ac = ac / ac[0]
    hi = len(p) // 4
    lags = range(lo, hi)
    peak = max(ac[l] for l in lags)
    # Smallest lag that is a strong local maximum (thicker lines every 5 cells make multiples strong too).
    for l in lags:
        if ac[l] >= 0.35 * peak and ac[l] >= ac[l - 1] and ac[l] >= ac[l + 1]:
            return l
    return max(lags, key=lambda l: ac[l])


def cluster(items, close):
    """Greedy clustering: each item joins the first cluster whose representative is close."""
    reps, labels = [], []
    for it in items:
        for k, r in enumerate(reps):
            if close(it, r):
                labels.append(k)
                break
        else:
            reps.append(it)
            labels.append(len(reps) - 1)
    return labels, reps


TIGHT = 14  # RGB distance for "same fill" when deciding whether a strip belongs to the grid


def sample_cell(img, box):
    """A cell's fill color and, if something is drawn on it, an 8x8 thumbnail of the drawing."""
    x0, y0, x1, y1 = box
    mx, my = (x1 - x0) * 0.25, (y1 - y0) * 0.25
    patch = img[int(y0 + my):int(y1 - my), int(x0 + mx):int(x1 - mx)]
    if patch.size == 0:
        return None
    # Fill color from most of the cell (a symbol can cover the center): the
    # most common coarse color bin, where anti-aliased fills spread over
    # neighboring shades but solid symbol strokes don't, then its median.
    bx, by = (x1 - x0) * 0.12, (y1 - y0) * 0.12
    pixels = img[int(y0 + by):int(y1 - by), int(x0 + bx):int(x1 - bx)].reshape(-1, 3)
    q = (pixels // 48).astype(np.int32)
    keys = q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2]
    vals, counts = np.unique(keys, return_counts=True)
    color = np.median(pixels[keys == vals[np.argmax(counts)]], axis=0)
    g = patch.mean(axis=2)
    symbol = None
    if g.std() > SYMBOL_STD:
        ri = np.linspace(0, g.shape[0] - 1, 8).astype(int)
        ci = np.linspace(0, g.shape[1] - 1, 8).astype(int)
        symbol = (g[np.ix_(ri, ci)] < np.median(g) - 20).flatten()
    return color, symbol


def boxes(xs, ys):
    return [[(xs[c], ys[r], xs[c + 1], ys[r + 1]) for c in range(len(xs) - 1)] for r in range(len(ys) - 1)]


def grow(img, xs, ys, gx, gy):
    """Extend the grid outward one row or column at a time.

    A strip belongs to the grid if (nearly) all its cells look like cells
    already inside it (same fill, same symbol), and it either has a line on
    its outer side or isn't just page background. That takes in edge rows
    whose border is invisible (black cells against a white page) and all-white
    rows that do have a border, and stops at number labels and blank margins.
    """
    h, w = img.shape[:2]
    border = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]])
    bg = np.median(border, axis=0)
    samples = [s for row in boxes(xs, ys) for b in row for s in [sample_cell(img, b)] if s]
    fills = []  # [color, has_plain, [symbol thumbnails]]
    for color, symbol in samples:
        f = next((f for f in fills if np.linalg.norm(f[0] - color) < COLOR_TOL), None)
        if not f:
            f = [color, False, []]
            fills.append(f)
        if symbol is None:
            f[1] = True
        elif not any(int((symbol != t).sum()) <= HASH_TOL for t in f[2]):
            f[2].append(symbol)

    def known(cell):
        if not cell:
            return False
        color, symbol = cell
        for f_color, has_plain, symbols in fills:
            if np.linalg.norm(f_color - color) >= TIGHT:
                continue
            if symbol is None and has_plain:
                return True
            if symbol is not None and any(int((symbol != t).sum()) <= HASH_TOL for t in symbols):
                return True
        return False

    smooth = lambda p: np.convolve(p, np.ones(3) / 3, mode="same")
    sx, sy = smooth(gx), smooth(gy)
    strength = {"x": float(np.median([sx[int(round(x))] for x in xs])), "y": float(np.median([sy[int(round(y))] for y in ys]))}

    def try_strip(side):
        horizontal = side in ("top", "bottom")
        lines, prof, axis = (ys, sy, "y") if horizontal else (xs, sx, "x")
        step = (lines[-1] - lines[0]) / (len(lines) - 1)
        guess = lines[-1] + step if side in ("bottom", "right") else lines[0] - step
        lo, hi = int(guess - step * 0.25), int(guess + step * 0.25) + 1
        limit = h if horizontal else w
        if lo < 0 or hi >= limit:
            return None
        new = lo + int(np.argmax(prof[lo:hi]))
        a, b = (lines[-1], new) if side in ("bottom", "right") else (new, lines[0])
        cells = [sample_cell(img, (x0, a, x1, b)) for x0, x1 in zip(xs, xs[1:])] if horizontal else [
            sample_cell(img, (a, y0, b, y1)) for y0, y1 in zip(ys, ys[1:])]
        match = sum(known(c) for c in cells) / len(cells)
        non_bg = sum(1 for c in cells if c and np.linalg.norm(c[0] - bg) >= TIGHT) / len(cells)
        line = prof[new] / strength[axis] if strength[axis] else 0
        return new if match >= 0.9 and (line >= 0.25 or non_bg >= 0.3) else None

    grew = True
    while grew:
        grew = False
        for side in ("top", "bottom", "left", "right"):
            new = try_strip(side)
            if new is None:
                continue
            grew = True
            if side == "top":
                ys = [new] + ys
            elif side == "bottom":
                ys = ys + [new]
            elif side == "left":
                xs = [new] + xs
            else:
                xs = xs + [new]
    return xs, ys


def main(pdf, page_no, bbox, out_dir, size=None):
    os.makedirs(out_dir, exist_ok=True)
    img, info, (W, H) = load_image(pdf, int(page_no), [float(v) for v in bbox.split(",")])
    gray = img.mean(axis=2)
    gx, gy = ridge_profile(gray, axis=1), ridge_profile(gray, axis=0)
    px, py = estimate_period(gx), estimate_period(gy)
    xs, ys = line_positions(gx, px), line_positions(gy, py)
    if size:  # manual override: fit to a known cols x rows
        want_cols, want_rows = (int(v) for v in size.lower().split("x"))
        xs, ys = fit_lines(gx, xs, want_cols), fit_lines(gy, ys, want_rows)
    else:
        xs, ys = grow(img, xs, ys, gx, gy)
        # Detected lines sit on whole pixels; cells rarely are, and the error
        # drifts across a wide chart. Refit evenly spaced lines to the count.
        xs, ys = fit_lines(gx, xs, len(xs) - 1), fit_lines(gy, ys, len(ys) - 1)
    cols, rows = len(xs) - 1, len(ys) - 1

    cells, colors, hashes = [], [], []
    for r, row in enumerate(boxes(xs, ys)):
        for c, box in enumerate(row):
            sampled = sample_cell(img, box)
            if not sampled:
                continue
            cells.append((r, c, box))
            colors.append(sampled[0])
            hashes.append(sampled[1])

    color_lab, color_reps = cluster(colors, lambda a, b: np.linalg.norm(a - b) < COLOR_TOL)
    sym_items = [h for h in hashes if h is not None]
    sym_lab_list, _ = cluster(sym_items, lambda a, b: int((a != b).sum()) <= HASH_TOL)
    sym_iter = iter(sym_lab_list)
    sym_lab = [None if h is None else next(sym_iter) for h in hashes]

    keys, grid = {}, [[" "] * cols for _ in range(rows)]
    classes = []
    for (r, c, box), cl, sl in zip(cells, color_lab, sym_lab):
        k = (cl, sl)
        if k not in keys:
            keys[k] = len(keys)
            x0, y0, x1, y1 = (int(v) for v in box)
            # Cell plus a little of its neighbors, enlarged so a model can see the symbol.
            px_, py_ = int((x1 - x0) * 0.3), int((y1 - y0) * 0.3)
            crop = img[max(0, y0 - py_):y1 + py_ + 1, max(0, x0 - px_):x1 + px_ + 1].astype(np.uint8)
            scale = max(1, 96 // max(crop.shape[:2]))
            crop = np.ascontiguousarray(np.kron(crop, np.ones((scale, scale, 1), dtype=np.uint8)))
            sample = os.path.join(out_dir, f"class-{keys[k]}.png")
            pymupdf.Pixmap(pymupdf.csRGB, crop.shape[1], crop.shape[0], crop.tobytes(), 0).save(sample)
            classes.append({"id": keys[k], "rgb": [int(v) for v in color_reps[cl]], "symbol": sl is not None, "count": 0, "sample": sample, "example": [rows - r, cols - c]})
        classes[keys[k]]["count"] += 1
        grid[r][c] = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"[keys[k]]

    # Grid box on the page (0-1), assuming an unrotated placement.
    ih, iw = img.shape[:2]
    pb = info["bbox"]
    to_page = lambda x, y: [round((pb[0] + x / iw * (pb[2] - pb[0])) / W, 4), round((pb[1] + y / ih * (pb[3] - pb[1])) / H, 4)]
    rotated = abs(info["transform"][1]) > 1e-3 or abs(info["transform"][2]) > 1e-3
    out = {
        "image": {"xref": info["xref"], "px": [iw, ih], "rotated": rotated},
        "periodPx": [px, py],
        "cols": cols,
        "rows": rows,
        "gridPx": [xs[0], ys[0], xs[-1], ys[-1]],
        "gridBox": to_page(xs[0], ys[0]) + to_page(xs[-1], ys[-1]),
        "classes": classes,
        # Bottom row first (chart row 1), left to right as drawn.
        "cells": ["".join(row) for row in reversed(grid)],
    }
    # Debug overlay: detected grid lines in red.
    dbg = img.astype(np.uint8).copy()
    for x in xs:
        dbg[int(ys[0]):int(ys[-1]) + 1, int(round(x))] = [255, 0, 0]
    for y in ys:
        dbg[int(round(y)), int(xs[0]):int(xs[-1]) + 1] = [255, 0, 0]
    dbg = np.ascontiguousarray(dbg)
    pymupdf.Pixmap(pymupdf.csRGB, dbg.shape[1], dbg.shape[0], dbg.tobytes(), 0).save(os.path.join(out_dir, "grid-overlay.png"))

    with open(os.path.join(out_dir, "grid.json"), "w") as f:
        json.dump(out, f, indent=1, default=lambda o: o.tolist())
    print(f"{cols} x {rows} cells (period {px}x{py}px), {len(classes)} classes:",
          ", ".join(f"{c['id']}:rgb{tuple(c['rgb'])}{'+sym' if c['symbol'] else ''}x{c['count']}" for c in classes))


if __name__ == "__main__":
    main(*sys.argv[1:6])
