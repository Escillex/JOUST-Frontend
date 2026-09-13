"use client";

import { useEffect, useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";
import { useToast } from "../ui/Toast";
import type { ReportReason, ReportTarget } from "../../tournaments/types";

/**
 * Report / request removal / remove, for a gallery image or a tournament build
 * (todo.md obj. 4.3). Which one the viewer gets depends on who they are:
 *
 *   player     → Report           (goes to the admin queue)
 *   organizer  → Request removal  (the same report, flagged so it sorts first)
 *   admin      → Remove           (hidden at once, restorable for 30 days)
 *
 * The owner gets none of these — they can delete their own upload instead —
 * and a signed-out viewer gets nothing to click.
 */
const REASONS: [ReportReason, string][] = [
  ["OFFENSIVE", "Offensive or inappropriate"],
  ["SPAM", "Spam or advertising"],
  ["NOT_A_BUILD", "Not a build"],
  ["OTHER", "Something else"],
];

interface Props {
  targetType: ReportTarget;
  targetId: string;
  /** The signed-in viewer's roles; undefined when signed out. */
  viewerRoles?: string[];
  isOwner?: boolean;
  /** Called after an admin removal so the caller can drop the item. */
  onRemoved?: () => void;
  className?: string;
}

export default function ContentActions({ targetType, targetId, viewerRoles, isOwner, onRemoved, className }: Props) {
  const [open, setOpen] = useState(false);
  if (!viewerRoles || isOwner) return null;

  const isAdmin = viewerRoles.includes("ADMIN");
  const isStaff = isAdmin || viewerRoles.includes("ORGANIZER");
  const label = isAdmin ? "Remove" : isStaff ? "Request removal" : "Report";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          `text-[9px] font-black uppercase tracking-widest transition-colors ${
            isAdmin ? "text-[#FF4D4D]/70 hover:text-[#FF4D4D]" : "text-white/30 hover:text-white"
          }`
        }
      >
        {label}
      </button>
      {open && (
        <ActionModal
          mode={isAdmin ? "remove" : "report"}
          staff={isStaff}
          targetType={targetType}
          targetId={targetId}
          onClose={() => setOpen(false)}
          onRemoved={onRemoved}
        />
      )}
    </>
  );
}

function ActionModal({
  mode,
  staff,
  targetType,
  targetId,
  onClose,
  onRemoved,
}: {
  mode: "report" | "remove";
  staff: boolean;
  targetType: ReportTarget;
  targetId: string;
  onClose: () => void;
  onRemoved?: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState<ReportReason>("OFFENSIVE");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reasons = REASONS.filter(([r]) => r !== "NOT_A_BUILD" || targetType === "TOURNAMENT_BUILD");
  const what = targetType === "GALLERY_IMAGE" ? "gallery image" : "build";

  const submit = async () => {
    setError(null);
    if (mode === "remove" && !note.trim()) {
      setError("Give a reason — the owner is told why it was removed.");
      return;
    }
    setBusy(true);
    const res =
      mode === "remove"
        ? await authenticatedFetch(API_ENDPOINTS.MODERATION.REMOVE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetType, targetId, reason: note.trim() }),
          })
        : await authenticatedFetch(API_ENDPOINTS.REPORTS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetType, targetId, reason, ...(note.trim() ? { note: note.trim() } : {}) }),
          });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) {
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(" ") : msg || "That did not go through. Try again.");
      return;
    }
    toast(data?.message || "Done.", "success");
    onClose();
    if (mode === "remove") onRemoved?.();
  };

  const title = mode === "remove" ? `Remove this ${what}` : staff ? `Request removal of this ${what}` : `Report this ${what}`;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-[#111] border border-white/10 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
          <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
            {mode === "remove"
              ? "It is hidden immediately and can be restored from Admin → Moderation for 30 days, then it is deleted. The owner is notified with your reason."
              : staff
                ? "Admins decide on removals. Your request is marked as coming from an organizer and is reviewed first."
                : "An admin will review it. Reports are not shown to the person who posted it."}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {mode === "report" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Reason</label>
              <div className="grid grid-cols-1 gap-1.5">
                {reasons.map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReason(value)}
                    className={`text-left px-3 py-2 border text-xs transition-all ${
                      reason === value ? "border-primary bg-primary/10 text-white" : "border-white/10 text-white/60 hover:border-white/30"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {mode === "remove" ? "Reason (shown to the owner)" : "Details (optional)"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              rows={3}
              placeholder={mode === "remove" ? "e.g. Offensive imagery" : "Anything the admin should know"}
              className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary placeholder:text-white/20 resize-none"
            />
            <p className="text-[10px] text-white/25 text-right">{note.length}/300</p>
          </div>

          {error && <p className="text-xs text-[#FF4D4D]">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${
                mode === "remove" ? "bg-[#FF4D4D] text-black" : "bg-primary text-black"
              }`}
            >
              {busy ? "Sending…" : mode === "remove" ? "Remove" : staff ? "Request removal" : "Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
