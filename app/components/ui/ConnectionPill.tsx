"use client";

/** Tells the viewer whether the page is being pushed live updates or has fallen
 *  back to polling. Without this the two are indistinguishable, which makes a
 *  dropped socket invisible until the data visibly goes stale. */
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
          ? "Receiving live updates"
          : "Reconnecting - updates are still arriving, just less often"
      }
    >
      <span className={`w-1.5 h-1.5 ${connected ? "bg-primary" : "bg-white/30"}`} />
      {connected ? "Live" : "Reconnecting"}
    </span>
  );
}
