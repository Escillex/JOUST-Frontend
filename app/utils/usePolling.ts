"use client";
import { useEffect, useRef } from "react";

// temporary polling block
// Shared helper for every screen that refreshes data on a timer.
// This exists so all polling behaves the same way:
// - it stops when `enabled` is false (for example when a tournament is
//   COMPLETED and the data can no longer change)
// - it pauses while the browser tab is hidden, so background tabs stop
//   sending requests, and runs one refresh immediately when the tab
//   becomes visible again
// - it always runs one fetch right away on mount, so the screen is not
//   empty while waiting for the first timer tick
// The whole file is a temporary bridge until the planned WebSocket
// migration replaces HTTP polling.
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean = true,
) {
  // Keep the latest callback in a ref so the timer does not need to be
  // torn down and recreated every time the component re-renders.
  // The ref is updated inside an effect because React does not allow
  // writing to refs while rendering.
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;

    fnRef.current();

    const tick = () => {
      // Skip the request while the tab is not visible.
      if (typeof document !== "undefined" && document.hidden) return;
      fnRef.current();
    };

    const id = setInterval(tick, intervalMs);

    // When the user comes back to the tab, refresh immediately instead
    // of waiting for the next timer tick.
    const onVisible = () => {
      if (!document.hidden) fnRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}
// end of temporary polling block
