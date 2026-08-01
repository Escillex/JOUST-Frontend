import { NETWORK_STATUS_EVENT, isBackendReachable } from "./api";

/** Connectivity as an external store, so components can read it with
 *  `useSyncExternalStore` instead of mirroring browser events into local state.
 *
 *  Why a store rather than `useState` + listeners: connectivity lives outside
 *  React, and copying it in during an effect means the first render is always a
 *  lie (it claims "online" before anything has checked) and every correction is
 *  a synchronous setState in an effect, which cascades renders. Subscribing
 *  reads the true value on the very first render instead.
 *
 *  `outageId` exists so a dismissed warning can come back. Dismissal is scoped
 *  to the outage it was dismissed for, so a *new* disconnection re-announces
 *  itself rather than being silently swallowed by an earlier dismissal. */
export interface NetworkSnapshot {
  online: boolean;
  /** Increments on every transition into an offline state. */
  outageId: number;
}

// Snapshots are cached and only replaced on an actual transition.
// useSyncExternalStore compares by reference and would loop forever if this
// returned a fresh object each call.
let snapshot: NetworkSnapshot = { online: true, outageId: 0 };

const SERVER_SNAPSHOT: NetworkSnapshot = { online: true, outageId: 0 };

const listeners = new Set<() => void>();
let listening = false;

/** Both conditions matter: the device must have a connection AND the backend
 *  must be answering. `navigator.onLine` alone is true on a captive portal, on
 *  a Wi-Fi that has stopped routing, and when the backend itself is down. */
function computeOnline(): boolean {
  const deviceOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  return deviceOnline && isBackendReachable();
}

function refresh() {
  const online = computeOnline();
  if (online === snapshot.online) return;
  snapshot = {
    online,
    outageId: online ? snapshot.outageId : snapshot.outageId + 1,
  };
  listeners.forEach((listener) => listener());
}

export function subscribeNetworkStatus(listener: () => void) {
  listeners.add(listener);

  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener(NETWORK_STATUS_EVENT, refresh);
    // Pick up a state that had already changed before anything subscribed —
    // for example a request that failed during the initial page load.
    refresh();
  }

  return () => {
    listeners.delete(listener);
  };
}

export function getNetworkSnapshot(): NetworkSnapshot {
  return snapshot;
}

/** The server cannot know the client's connectivity, so it renders the
 *  optimistic case and the client corrects it on hydration. */
export function getServerNetworkSnapshot(): NetworkSnapshot {
  return SERVER_SNAPSHOT;
}
