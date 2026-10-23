import type { DocMap, PageRole } from "../../../extract/docMap";
import { PAGE_ROLES } from "../../../extract/docMap";
import type { MapFixture } from "../../../extract/mapFixture";
import type { BBox } from "../../../extract/pageData";
import { boxStyle } from "../shared/box";
import type { PageRow } from "../shared/types";

/**
 * A page with its regions and roles. Role buttons show the model's answer
 * (outlined) and the reviewed answer (filled); clicking one corrects it.
 */
export function MapPageCard({
  p,
  map,
  regions,
  review,
  onReview,
  highlight,
  showDoc,
  onOpen,
}: {
  p: PageRow;
  map: DocMap;
  regions: [string, BBox][];
  review: MapFixture;
  onReview: (change: (r: MapFixture) => MapFixture) => void;
  highlight: { page: boolean; regions: Set<string> };
  showDoc: boolean;
  onOpen: () => void;
}) {
  const info = map.pages.find((x) => x.page === p.page);
  const reviewed = review.pages?.[p.page]?.roles;
  const roles = reviewed ?? info?.roles ?? [];
  const changed = reviewed && info && [...reviewed].sort().join() !== [...info.roles].sort().join();
  const setRoles = (next: PageRole[]) => onReview((r) => ({ ...r, pages: { ...r.pages, [p.page]: { roles: next } } }));

  return (
    <figure className={`card ${highlight.page ? "hl" : ""} ${reviewed ? (changed ? "wrong" : "ok") : ""}`}>
      <div className="page" onClick={onOpen} style={{ cursor: "zoom-in" }}>
        <img src={p.pngUrl} loading="lazy" alt={`page ${p.page}`} />
        {regions.map(([id, b]) => (
          <div key={id} className={`box region ${highlight.regions.has(id) ? "on" : ""}`} style={boxStyle(b)}>
            <span>{id}</span>
          </div>
        ))}
      </div>
      <figcaption>
        <span>p{p.page}</span>
        {showDoc && (
          <span className="muted">
            {p.doc} p{p.docPage}
          </span>
        )}
      </figcaption>
      <div className="roles">
        {PAGE_ROLES.map((r) => (
          <button
            key={r}
            className={`role ${roles.includes(r) ? "on" : ""} ${info?.roles.includes(r) ? "model" : ""}`}
            title={info?.roles.includes(r) ? "model said yes" : "model said no"}
            onClick={() => setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])}
          >
            {r}
          </button>
        ))}
        {!reviewed && info && (
          <button className="role accept" onClick={() => setRoles(info.roles)}>
            ✓ roles right
          </button>
        )}
      </div>
      <div className="small muted summary">{info?.summary}</div>
    </figure>
  );
}
