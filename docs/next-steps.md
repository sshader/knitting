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

## 1. Integrate charts into sections (next)

Sections reference chart rows ("work rounds 2-48 of the chart", "Round 50:
decrease round = chart row 50"); charts generate each row's instructions. The
knitter should see one step per row with both.

1. Hand-write the expected result for a couple of rows in Lucky Stars and
   Moonbun (`fixtures/steps/`) and preview it in the inspector: the step's
   section instruction, the generated chart row, stitch count, the chart with
   that row highlighted, and the PDF source.
2. Iterate on that format until it reads right.
3. Then build the expander (sections + charts + size/options -> steps) to
   reproduce the fixtures, and run it over whole patterns.

Open questions for the expander: chart repeats per size (from stitch counts),
rows that continue a chart "as set", overlays (AT THE SAME TIME) on chart
rows, written-out rows shown alongside generated ones.

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
