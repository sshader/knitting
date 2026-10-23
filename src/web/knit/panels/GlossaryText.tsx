import { useKnit } from "../KnitContext";

/**
 * Instruction text with the pattern's abbreviations underlined; hovering
 * (or long-pressing) one shows what it means. Single letters like "k" are
 * left alone, since every knitter knows them and they'd underline everywhere.
 */
export function GlossaryText({ text }: { text: string }) {
  const { glossary } = useKnit();
  const terms = new Map((glossary?.abbreviations ?? []).filter((a) => a.abbrev.length > 1).map((a) => [a.abbrev.toLowerCase(), a.meaning]));
  if (terms.size === 0) return <>{text}</>;

  const escaped = [...terms.keys()].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "giu"));
  return (
    <>
      {parts.map((part, i) => {
        const meaning = terms.get(part.toLowerCase());
        return meaning ? (
          <abbr key={i} title={meaning}>
            {part}
          </abbr>
        ) : (
          part
        );
      })}
    </>
  );
}
