"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getNetworkSnapshot,
  getServerNetworkSnapshot,
  subscribeNetworkStatus,
} from "../../utils/networkStatus";

/** Tells the viewer when the data on screen is no longer being refreshed.
 *
 *  Without this, a dropped connection looks identical to a quiet tournament:
 *  the last-known bracket just sits there looking authoritative. On venue Wi-Fi
 *  that is the difference between "nothing has happened yet" and "three matches
 *  have been reported and you cannot see any of them".
 *
 *  Connectivity comes from the shared network store, which combines the browser
 *  online/offline events with whether requests are actually succeeding — see
 *  `utils/networkStatus.ts` for why both are needed.
 *
 *  Dismissible, but the dismissal only applies to the outage it was dismissed
 *  for. A new disconnection announces itself again, so a stale screen can never
 *  end up looking current permanently. */
export default function OfflineBanner() {
  const { online, outageId } = useSyncExternalStore(
    subscribeNetworkStatus,
    getNetworkSnapshot,
    getServerNetworkSnapshot,
  );

  const [dismissedOutage, setDismissedOutage] = useState<number | null>(null);

  if (online || dismissedOutage === outageId) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] w-full border-b border-amber-500/40 bg-amber-500/10 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse bg-amber-400" />
        <p className="flex-1 text-[10px] font-black uppercase tracking-widest text-amber-200/90">
          No connection — showing last known data
        </p>
        <button
          type="button"
          onClick={() => setDismissedOutage(outageId)}
          className="shrink-0 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200/50 transition-colors hover:text-amber-200"
          aria-label="Dismiss connection warning"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
