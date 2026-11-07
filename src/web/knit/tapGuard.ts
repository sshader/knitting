/**
 * Telling a slip from catching up. Two quick taps on the same button are
 * usually one too many: a bounce, or a second tap because the first didn't
 * seem to land. Three or more quick taps are deliberate, like counting up
 * rows you knit without tapping.
 */

/** Taps of the same button closer together than this are one burst. */
export const BURST_MS = 500;

export interface Burst {
  key: string;
  taps: number;
  at: number;
}

/**
 * How many times a tap should act: the first tap of a burst acts at once;
 * the second is held (0); the third acts for itself and the held one (2);
 * later ones act once each.
 */
export function onTap(burst: Burst | null, key: string, now: number): { burst: Burst; times: number } {
  const taps = burst && burst.key === key && now - burst.at <= BURST_MS ? burst.taps + 1 : 1;
  return { burst: { key, taps, at: now }, times: taps === 2 ? 0 : taps === 3 ? 2 : 1 };
}
