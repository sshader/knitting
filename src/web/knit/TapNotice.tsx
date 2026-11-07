import type { HeldTap } from "./useTapGuard";

/** "Two quick taps, counted once", with a way to count both. */
export function TapNotice({ held }: { held: HeldTap | null }) {
  if (!held) return null;
  return (
    <div className="tap-notice" role="status">
      <span>Two quick taps — counted once</span>
      <button className="primary" onClick={held.keep}>
        It was two
      </button>
      <button className="quiet" onClick={held.dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
