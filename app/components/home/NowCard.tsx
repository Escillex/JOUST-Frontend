"use client";
import Link from "next/link";
import GameIcon from "../ui/GameIcon";
import { DashboardEntry, entryAction, opponentName } from "../../home/types";

/**
 * The one thing worth acting on, at the top of the phone screen.
 *
 * The hub's doors are navigation; this is not. It is the reason the page is
 * worth opening at all, so it sits above them and changes with your state —
 * a live match reads red and urgent, a quiet day reads green and informative.
 * Without it the phone home would be a menu, which is the trap a hub layout
 * falls into.
 */
export default function NowCard({ entry }: { entry: DashboardEntry | null }) {
  if (!entry) {
    return (
      <div className="border border-white/12 bg-surface p-5 flex flex-col gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 font-poppins">
          Nothing on
        </span>
        <p className="text-base font-black uppercase tracking-tight text-white font-poppins">
          You are not entered in a tournament
        </p>
        <Link
          href="/tournaments"
          className="mt-1 inline-flex w-fit items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] bg-primary text-black hover:bg-white transition-colors font-poppins"
        >
          Find one <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  const action = entryAction(entry);
  const live = action.tone === "live";
  const m = entry.myMatch;

  return (
    <div
      className={`border p-5 flex flex-col gap-2.5 ${
        live
          ? "border-[#FF4D4D]/60 bg-gradient-to-b from-[#FF4D4D]/15 to-[#FF4D4D]/[0.03]"
          : "border-primary/45 bg-gradient-to-b from-primary/12 to-primary/[0.02]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-black uppercase tracking-widest border font-poppins ${
            live ? "bg-[#FF4D4D] border-[#FF4D4D] text-white" : "border-primary/50 text-primary"
          }`}
        >
          {live && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          {live ? "Live now" : action.label}
        </span>
        {entry.game && <GameIcon game={entry.game} size="chip" />}
        <span className="ml-auto text-[11px] text-white/55 truncate max-w-[45%]" title={entry.name}>
          {entry.name}
        </span>
      </div>

      <p className="text-xl font-black uppercase tracking-tight text-white font-poppins leading-tight">
        {m && !m.isBye ? `vs ${opponentName(m.opponent)}` : m?.isBye ? "Bye this round" : entry.name}
      </p>

      <p className="text-xs text-white/60">
        {[
          entry.round?.label,
          entry.standing?.position ? `you are ${entry.standing.position} of ${entry.fieldSize}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || action.label}
      </p>

      <div className="flex flex-wrap items-center gap-2 mt-1">
        <Link
          href={`/tournaments/${entry.id}`}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] font-poppins transition-colors ${
            live ? "bg-[#FF4D4D] text-white hover:bg-white hover:text-black" : "bg-primary text-black hover:bg-white"
          }`}
        >
          {m && m.status !== "COMPLETED" && !m.isBye ? "Open match" : "View bracket"}{" "}
          <span aria-hidden>→</span>
        </Link>
        <Link
          href={`/tournaments/${entry.id}?tab=standings`}
          className="inline-flex items-center px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] border border-white/20 text-white/70 hover:text-primary hover:border-primary transition-colors font-poppins"
        >
          Standings
        </Link>
      </div>
    </div>
  );
}
