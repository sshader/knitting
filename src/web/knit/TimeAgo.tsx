import { useEffect, useState } from "react";
import { timeAgo } from "./relativeTime";

/** "5s ago", kept current: every second for the first minute, then every minute. */
export function TimeAgo({ time, className }: { time: number; className?: string }) {
  const [now, setNow] = useState(Date.now);
  const recent = now - time < 60_000;
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), recent ? 1000 : 60_000);
    return () => window.clearInterval(timer);
  }, [time, recent]);
  return (
    <time className={className} dateTime={new Date(time).toISOString()} title={new Date(time).toLocaleString()}>
      {timeAgo(time, now)}
    </time>
  );
}
