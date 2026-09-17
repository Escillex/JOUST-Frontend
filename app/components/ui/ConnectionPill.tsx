"use client";

/** Tells the viewer whether the page is being pushed updates or has fallen back
 *  to polling. Without this the two are indistinguishable, which makes a
 *  dropped socket invisible until the data visibly goes stale.
 *
 *  Reads "Connected", not "Live": once the tournament status badge stopped
 *  saying LIVE (2026-09-16), a pill saying LIVE next to it looked like a claim
 *  about the tournament rather than about the socket. */
export default function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-2 py-1 text-[9px] font-black uppercase tracking-widest border ${
        connected
          ? "border-primary/30 text-primary/70"
          : "border-white/10 text-white/30"
      }`}
      title={
        connected
          ? "Receiving updates as they happen"
          : "Reconnecting - updates are still arriving, just less often"
      }
    >
      <span className={`w-1.5 h-1.5 ${connected ? "bg-primary" : "bg-white/30"}`} />
      {connected ? "Connected" : "Reconnecting"}
    </span>
  );
}
