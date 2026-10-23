import type { Verdict } from "../../../extract/mapFixture";

/** ✓ / ✗ for one reviewed item; clicking the active one clears it. A ✗ asks what's wrong. */
export function ReviewButtons({ label, v, onChange }: { label?: string; v?: Verdict; onChange: (v: Verdict | undefined) => void }) {
  return (
    <span className="review" onClick={(e) => e.stopPropagation()}>
      {label && <span className="small">{label}</span>}
      <button className={v?.ok === true ? "on good" : ""} onClick={() => onChange(v?.ok === true ? undefined : { ok: true })}>
        ✓
      </button>
      <button className={v?.ok === false ? "on bad" : ""} onClick={() => onChange(v?.ok === false ? undefined : { ok: false })}>
        ✗
      </button>
      {v?.ok === false && <input placeholder="what's wrong?" value={v.note ?? ""} onChange={(e) => onChange({ ok: false, note: e.target.value || undefined })} />}
    </span>
  );
}
