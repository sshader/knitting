# Next steps

Where the extraction pipeline stands and what's next. Focus patterns for now:
Lucky Stars, Moonbun, Wilde.

## Pipeline so far

| Stage | What | Status |
| --- | --- | --- |
| 0 · Triage | Chart regions and forms, page routing, in code | Reviewed on 10 patterns (`fixtures/triage`) |
| 1 · Map | Page roles, sizes/options, sections with start anchors, charts | Text-mode input; 3 focus patterns re-run after reading-order fixes |
| 2 · Sections | Row-level nodes per section, cached pattern prefix | 3 focus patterns, all checks passing |
| 3 · Charts | Grid in code, one naming call per pattern, row generator | Lucky Stars (both sizes), Moonbun; raster only |

## 1. Integrate charts into sections

Done for Lucky Stars and Moonbun: `src/shared/expand.ts` turns sections +
charts into one step per row for a size and options, reproducing the
hand-written steps in `fixtures/steps` (tested). Shaping drawn as no-stitch
cells is read off the row below (decreases inline, e.g. Lucky Stars round 50's
CDDs), and stitch counts carry through chart rows (repeats = stitches before /
stitches a row consumes). Preview: inspector "Steps", Generated mode.

Still to do here:
- **Open-ended repeats** ("until it measures 3 cm") are one step; the knitting
  view needs to loop on them, and overlays inside them ("dec every 10 rnds")
  only land on the first pass.
- **Counts stated only in notes** ("you should have 64 sts" for sleeves) aren't
  picked up; sleeves show no count.
- **Several charts in one row** (Wilde's panels) are only named alongside the
  first chart, not merged into one row's instructions.
- Decrease names default to k2tog / CDD by stitches consumed; patterns that use
  other names (ssk, sk2p) need them from the legend or the pattern text.

## 2. Rotated charts (Wilde)

Wilde's per-size charts are drawn sideways. Detect the rotation (image
placement transform, row-number orientation, aspect) and rotate the image to
the standard orientation (row 1 at the bottom) before finding the grid.
Wilde also has cables: symbols spanning several cells (`span`), which the
grouping and the row generator need to handle.

## 3. Vector and font charts (Tove, Lopi, dot-top, Wavelength)

Grid and labels are exact in the PDF: cells from filled rectangles or glyph
positions, row/column numbers from the text layer. Should need no image work,
and legend swatches can often be matched without the model.

## Smaller follow-ups

- **Trim stage 2 output** (~40% fewer output tokens): optional fields instead of
  ""/[] placeholders, shorter field names, lower effort for simple sections.
  Later: convert size notation in code instead of having the model retype it.
- **Section boundary duplicates**: a line at a section boundary can be extracted
  by both sections (Moonbun "All sizes: Knit chart."); drop the repeat when merging.
- **Batch API** for bulk imports / re-runs only; single uploads stay interactive.
- Reviewed fixtures for stages 1-3 (the inspector saves them; few recorded yet).

## Later

- Knitting view and projects (position, progress, events) on Convex.
- Modifications and downstream suggestions.
