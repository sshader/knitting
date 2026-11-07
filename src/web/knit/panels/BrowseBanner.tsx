import { useKnit } from "../KnitContext";

/** While reading ahead (or back): how far from your place, and a way to move your place here. */
export function BrowseBanner() {
  const { steps, index, place, browsing, knitFromHere } = useKnit();
  if (!browsing) return null;
  const away = index - place;
  const n = Math.abs(away);
  return (
    <div className="browse-banner">
      <span>
        🔖 {away === 0 ? "This is your place" : `Reading ${n} ${n === 1 ? "step" : "steps"} ${away > 0 ? "ahead" : "back"}`}
        {away !== 0 && <span className="muted"> · you're on {steps[place]?.label}</span>}
      </span>
      {away !== 0 && (
        <button className="quiet" onClick={knitFromHere}>
          Knit from here
        </button>
      )}
    </div>
  );
}
