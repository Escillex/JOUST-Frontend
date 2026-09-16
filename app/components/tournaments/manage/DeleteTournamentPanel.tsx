"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../../utils/api";

/**
 * Deleting a tournament — the way back from one created by mistake, or opened
 * on the wrong day. There was no way to remove one at all before.
 *
 * A finished tournament is not offered: its results are in players' profiles
 * and its points are already counted, which deleting would not undo. The name
 * is typed out rather than confirmed in a dialog (Core Rule 5), because this
 * takes the rounds and matches with it.
 */
export default function DeleteTournamentPanel({
  tournamentId,
  name,
  status,
  participants,
  onMessage,
}: {
  tournamentId: string;
  name: string;
  status: string;
  participants: number;
  onMessage: (text: string, kind: "success" | "error") => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "COMPLETED") return null;
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  const remove = async () => {
    setBusy(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.DELETE(tournamentId), { method: "DELETE" });
      const data = await safeJson(res);
      if (res.ok) {
        onMessage(data?.message || "Tournament deleted", "success");
        router.push("/tournaments/manage");
      } else {
        onMessage(data?.message || "Could not delete this tournament", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-component-background border border-[#FF4D4D]/35 p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 max-w-xl">
          <h3 className="text-[13px] font-black uppercase tracking-[0.12em] text-[#FF4D4D] font-poppins">Delete tournament</h3>
          <p className="text-xs leading-relaxed text-white/60">
            Removes it for good, with its {participants} entrant{participants === 1 ? "" : "s"}, rounds and matches.
            {status === "ONGOING" ? " This one is running — everything played so far goes with it." : ""} It cannot be
            undone.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-11 px-5 border border-[#FF4D4D]/50 text-[#FF4D4D] text-[11px] font-bold uppercase tracking-[0.12em] font-poppins hover:bg-[#FF4D4D] hover:text-white transition-colors"
          >
            Delete tournament
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[#FF4D4D]/25 pt-4">
          <label htmlFor="confirm-tournament" className="text-[13px] font-semibold font-poppins text-white">
            Type the tournament’s name, {name}
          </label>
          <input
            id="confirm-tournament"
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
            className="w-full md:max-w-sm h-11 bg-background border border-component-border px-3 text-sm text-white focus:outline-none focus:border-[#FF4D4D] placeholder:text-white/40"
          />
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={remove}
              disabled={busy || !matches}
              className="h-11 px-5 border border-[#FF4D4D]/50 text-[#FF4D4D] text-[11px] font-bold uppercase tracking-[0.12em] font-poppins hover:bg-[#FF4D4D] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#FF4D4D] transition-colors"
            >
              {busy ? "Deleting…" : "Delete for good"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setTyped(""); }}
              className="h-11 px-5 border border-component-border text-white/85 text-[11px] font-bold uppercase tracking-[0.12em] font-poppins hover:border-primary/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
