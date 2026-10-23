import type { Chart } from "../../../shared/schema";

/** A generated chart row ("k9 MC, k2 CC, ...") with a swatch beside each yarn name, so colorwork reads at a glance. */
export function ColoredRunText({ text, chart }: { text: string; chart?: Chart }) {
  const swatches = new Map<string, string>();
  for (const e of Object.values(chart?.legend ?? {})) if (e.color && e.swatch && !swatches.has(e.color)) swatches.set(e.color, e.swatch);
  if (swatches.size === 0) return <>{text}</>;

  const names = [...swatches.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`\\b(${names.join("|")})\\b`));
  return (
    <>
      {parts.map((part, i) =>
        swatches.has(part) ? (
          <span key={i} className="yarn">
            <span className="yarn-swatch" style={{ background: swatches.get(part) }} />
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
