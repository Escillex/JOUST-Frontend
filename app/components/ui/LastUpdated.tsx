"use client";

import { useEffect, useState } from "react";

/** How old data has to be before we stop presenting it as current. Comfortably
 *  longer than the 60s slow-tick fallback, so a healthy connection never trips
 *  it, but short enough that a genuinely stuck view is called out quickly. */
const STALE_AFTER_MS = 90_000;

/** How often the age is re-evaluated. */
const TICK_MS = 10_000;

/** Shows when the data on screen was last refreshed, and says so louder once it
 *  is old.
 *
 *  A plain timestamp is not enough on its own: nobody reads "Updated 14:02" and
 *  works out that it is now 14:09. The component therefore samples the clock on
 *  a timer and switches to an explicit age once the data crosses
 *  STALE_AFTER_MS, which is the only thing that distinguishes "quiet
 *  tournament" from "this screen stopped receiving updates minutes ago". */
export default function LastUpdated({
  lastUpdated,
  className = "",
}: {
  lastUpdated: Date | null;
  className?: string;
}) {
  // The current time is held in state rather than read during render, because
  // reading the clock while rendering is an impure render. It is sampled in the
  // interval callback instead, which is allowed to observe the outside world.
  // 0 means "not sampled yet", which correctly reads as not-stale: nothing can
  // be stale within the first tick of being displayed.
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!lastUpdated) return null;

  // Derived from state and props only, so this stays a pure render. Because the
  // subtraction is recomputed rather than stored, a fresh `lastUpdated` clears
  // the stale state immediately instead of waiting for the next tick.
  const ageMs = now === 0 ? 0 : now - lastUpdated.getTime();
  const stale = ageMs > STALE_AFTER_MS;
  const ageMinutes = Math.floor(ageMs / 60_000);

  return (
    <span
      className={`text-[8px] font-black uppercase tracking-widest ${
        stale ? "text-amber-300/80" : "text-white/20"
      } ${className}`}
      title={`Last refreshed at ${lastUpdated.toLocaleTimeString()}`}
    >
      {stale
        ? `Stale — ${ageMinutes < 1 ? "under a minute" : `${ageMinutes} min`} old`
        : `Updated ${lastUpdated.toLocaleTimeString()}`}
    </span>
  );
}
