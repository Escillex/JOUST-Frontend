"use client";

import Link from "next/link";
import { useUser } from "../UserProvider";
import { GUEST_RETENTION_NOTICE } from "../../utils/guestPolicy";
import { displayNameOf } from "../../utils/api";
import type { Tournament } from "../../tournaments/types";

interface Props {
  tournament: Tournament;
  onUpdated?: () => void | Promise<void>;
  onViewResults?: () => void;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

/**
 * A deliberately compact completion moment. It belongs above the tab strip on
 * both the public tournament page and its manage page, so the result is seen
 * without turning either page into a separate celebration screen.
 */
export default function TournamentCompletionBanner({ tournament, onViewResults }: Props) {
  const { user } = useUser();
  if (tournament.status !== "COMPLETED") return null;
  const winnerName = displayNameOf(tournament.winner ?? tournament.participants.find((participant) => participant.placement === 1)?.user, tournament.winnerName || "Champion");
  const isOrganizer = user?.roles?.some((role) => role === "ORGANIZER" || role === "ADMIN");
  const hasGuests = tournament.participants.some((participant) => participant.user.isGuest);
  return (
    <section className="border border-primary/40 bg-black shadow-[5px_5px_0_rgba(82,185,70,0.16)]" aria-label="Tournament result">
      <div className="h-1 bg-primary" />
      <div className="flex flex-col gap-5 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-primary/50 bg-primary/10 text-primary" aria-hidden="true">
            <svg viewBox="0 0 48 48" className="h-7 w-7 fill-none stroke-current stroke-2"><path d="M15 8h18v10c0 7-4 12-9 12s-9-5-9-12V8Z" /><path d="M15 11H8v5c0 5 3 8 8 8M33 11h7v5c0 5-3 8-8 8M24 30v7M16 41h16M19 37h10" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-primary">Tournament complete · {formatDate(tournament.completedAt)}</p>
            <h2 className="mt-1 truncate text-xl font-black uppercase tracking-tight text-white md:text-2xl">{winnerName} won the final</h2>
            <p className="mt-1 text-xs text-white/50">The final standings and tournament history are now saved.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 md:items-end">
          <button type="button" onClick={onViewResults} className="border border-primary/60 bg-primary/10 px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary hover:text-black">View final results</button>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">Winner recorded</span>
        </div>
      </div>

      {hasGuests && (
        <div className="border-t border-primary/20 bg-primary/5 px-5 py-4 md:px-6">
          <p className="text-xs leading-relaxed text-white/70">{GUEST_RETENTION_NOTICE}</p>
          {isOrganizer && <Link href="/tournaments/manage/guests" className="mt-3 inline-block border border-primary/60 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary hover:bg-primary hover:text-black">Register a returning guest</Link>}
        </div>
      )}
    </section>
  );
}
