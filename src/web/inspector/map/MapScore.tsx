import type { DocMap } from "../../../extract/docMap";
import { scoreMap, type MapFixture } from "../../../extract/mapFixture";

export function MapScore({ map, review }: { map: DocMap; review: MapFixture }) {
  const s = scoreMap(map, review);
  if (s.pages.total + s.items.total === 0) return <p className="meta">Not reviewed yet</p>;
  return (
    <p className="meta">
      Reviewed: page roles {s.pages.right}/{s.pages.total} right · sections/charts/meta {s.items.right}/{s.items.total} marked right
    </p>
  );
}
