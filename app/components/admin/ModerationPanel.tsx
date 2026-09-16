"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_ENDPOINTS, authenticatedFetch, profileHref, safeJson } from "../../utils/api";
import type { ModerationItem, ReportTarget } from "../../tournaments/types";
import BuildView from "../content/BuildView";
import { useToast } from "../ui/Toast";

/**
 * The admin moderation queue (todo.md obj. 4.3): gallery images and tournament
 * builds that players reported or organizers asked to have removed.
 *
 * Only admins remove. A removal hides the item at once and keeps it for 30
 * days — the Removed view is where a mistake is undone — then the hourly job
 * deletes it for good. Organizer requests sort first.
 */
const REASON_TEXT: Record<string, string> = {
  OFFENSIVE: "Offensive",
  SPAM: "Spam",
  NOT_A_BUILD: "Not a build",
  OTHER: "Other",
};

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

export default function ModerationPanel({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const { toast } = useToast();
  const [view, setView] = useState<"open" | "removed">("open");
  const [items, setItems] = useState<ModerationItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    authenticatedFetch(API_ENDPOINTS.MODERATION.QUEUE(view)).then(async (res) => {
      const body = await safeJson(res);
      if (!alive) return;
      if (res.ok && Array.isArray(body)) {
        setItems(body);
        setFailed(false);
        if (view === "open") onCountChange?.(body.length);
      } else {
        setFailed(true);
      }
    });
    return () => { alive = false; };
  }, [view, tick, onCountChange]);

  // Switching views clears the list so one view's rows never show under the other's heading.
  const switchView = (v: "open" | "removed") => {
    if (v === view) return;
    setItems(null);
    setView(v);
  };

  const act = async (
    path: string,
    target: { targetType: ReportTarget; targetId: string },
    extra: Record<string, string> = {},
  ) => {
    const res = await authenticatedFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Only the target — the queue row carries display fields the DTO would reject.
      body: JSON.stringify({ targetType: target.targetType, targetId: target.targetId, ...extra }),
    });
    const body = await safeJson(res);
    if (!res.ok) {
      toast(body?.message || "That did not go through.", "error");
      return false;
    }
    toast(body?.message || "Done.", "success");
    load();
    return true;
  };

  return (
    <div className="bg-background border border-white/10 p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1.5">
          {(["open", "removed"] as const).map((v) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                view === v ? "bg-primary text-black border-primary" : "border-white/10 text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              {v === "open" ? "Reported" : "Removed (30-day hold)"}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="h-9 px-4 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:border-white/30"
        >
          Refresh
        </button>
      </div>

      {failed ? (
        <p className="text-xs text-[#FF4D4D]">Could not load the queue. Check the connection and refresh.</p>
      ) : !items ? (
        <p className="text-xs text-white/60 py-8 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-white/60 py-8 text-center">
          {view === "open" ? "Nothing reported. The queue is clear." : "Nothing has been removed in the last 30 days."}
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <QueueItem
              key={`${item.targetType}:${item.targetId}`}
              item={item}
              view={view}
              onRemove={(reason) => act(API_ENDPOINTS.MODERATION.REMOVE, item, { reason })}
              onDismiss={() => act(API_ENDPOINTS.MODERATION.DISMISS, item)}
              onRestore={() => act(API_ENDPOINTS.MODERATION.RESTORE, item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueItem({
  item,
  view,
  onRemove,
  onDismiss,
  onRestore,
}: {
  item: ModerationItem;
  view: "open" | "removed";
  onRemove: (reason: string) => Promise<boolean>;
  onDismiss: () => Promise<boolean>;
  onRestore: () => Promise<boolean>;
}) {
  const staffRequest = item.reports.some((r) => r.fromStaff);
  // Seed the reason from the first report, so the common case is one click.
  const first = item.reports[0];
  const [reason, setReason] = useState(first ? REASON_TEXT[first.reason] + (first.note ? `: ${first.note}` : "") : "");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  const what = item.targetType === "GALLERY_IMAGE" ? "Gallery image" : "Tournament build";

  return (
    <div className={`border p-4 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 ${staffRequest && view === "open" ? "border-violet-400/40" : "border-white/10"}`}>
      <div className="min-w-0">
        <BuildView build={item.preview} alt={`${what} by ${item.owner.name}`} compact />
        {item.preview.caption && <p className="text-[10px] text-white/60 mt-2">{item.preview.caption}</p>}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest border border-white/15 text-white/60 px-1.5 py-0.5">{what}</span>
          {staffRequest && view === "open" && (
            <span className="text-[10px] font-bold uppercase tracking-widest border border-violet-400/40 text-violet-400 px-1.5 py-0.5">
              Organizer request
            </span>
          )}
        </div>
        <p className="text-sm text-white">
          By{" "}
          <Link href={profileHref(item.owner)} className="font-semibold hover:text-primary">
            {item.owner.name}
          </Link>{" "}
          <span className="text-white/60">·</span>{" "}
          {item.context.kind === "tournament" && item.context.id ? (
            <Link href={`/tournaments/${item.context.id}`} className="text-white/60 hover:text-primary">
              {item.context.name}
            </Link>
          ) : (
            <span className="text-white/60">{item.context.name}</span>
          )}
        </p>

        {view === "open" ? (
          <>
            <ul className="space-y-1">
              {item.reports.map((r, i) => (
                <li key={i} className="text-[11px] text-white/60">
                  <span className={r.fromStaff ? "text-violet-400 font-semibold" : "text-white/80 font-semibold"}>{r.reporterName}</span>
                  {" — "}
                  {REASON_TEXT[r.reason] ?? r.reason}
                  {r.note ? `: “${r.note}”` : ""}
                  <span className="text-white/25"> · {when(r.createdAt)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                placeholder="Reason, shown to the owner"
                className="flex-1 h-9 bg-black border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-primary placeholder:text-white/60"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void run(() => onRemove(reason.trim()))}
                  disabled={busy || !reason.trim()}
                  className="h-9 px-4 bg-[#FF4D4D] text-black text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
                >
                  Remove
                </button>
                <button
                  onClick={() => void run(onDismiss)}
                  disabled={busy}
                  className="h-9 px-4 border border-white/15 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:text-white disabled:opacity-40"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-white/60">
              Removed {when(item.removedAt)}
              {item.removedByName ? ` by ${item.removedByName}` : ""}
              {item.removalReason ? ` — “${item.removalReason}”` : ""}
            </p>
            <p className="text-[10px] text-white/60">Deleted permanently on {when(item.purgeAt)}.</p>
            <button
              onClick={() => void run(onRestore)}
              disabled={busy}
              className="h-9 px-4 border border-primary/40 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-black disabled:opacity-40"
            >
              Restore
            </button>
          </>
        )}
      </div>
    </div>
  );
}
