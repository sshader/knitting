/** How long ago `time` was, briefly: "5s ago", "3m ago", "2h ago", "4d ago". */
export function timeAgo(time: number, now: number): string {
  const s = Math.max(0, Math.floor((now - time) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
