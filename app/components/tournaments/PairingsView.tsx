"use client";
import { useMemo, useState, useEffect } from "react";
import ScoringDrawer from "./bracket/ScoringDrawer";
import type { Match as BracketMatch } from "../../tournaments/[id]/bracket/types";
import { getTournamentConfig, getTournamentSystem } from "../../utils/formatConfig";
import Image from "next/image";
import Link from "next/link";
import type { Tournament } from "../../tournaments/types";
import { displayNameOf, profileHref, resolveImageUrl } from "../../utils/api";
import { roundLabel } from "../../utils/tournamentStatus";

/**
 * The pairings for a round — the primary view for every system
 * (docs/tournament-views-plan.md).
 *
 * Reads `tournament.rounds`, so unlike `BracketPreview` it shows what is
 * actually being played rather than a hypothetical seeding. Your own match is
 * lifted out and pinned above the round, because "what do I do now" is the
 * question a player opens this page with.
 */

interface MatchLike {
  id: string;
  status?: string;
  isBye?: boolean;
  player1?: { id?: string; username?: string; displayName?: string | null; slug?: string | null; avatarUrl?: string | null } | null;
  player2?: { id?: string; username?: string; displayName?: string | null; slug?: string | null; avatarUrl?: string | null } | null;
  player1Id?: string | null;
  player2Id?: string | null;
  player1Score?: number;
  player2Score?: number;
  winnerId?: string | null;
  p1Name?: string | null;
  p2Name?: string | null;
}

interface RoundLike {
  id?: string;
  roundNumber: number;
  matches?: MatchLike[];
}

interface Props {
  tournament: Tournament;
  currentUserId?: string;
  /** Staff see per-match entry points; players do not. */
  canManage?: boolean;
  /** Called after a result is recorded so the page can refetch. */
  onRefresh?: () => void | Promise<void>;
  /** Platform-admin debug mode, forwarded to the drawer for its insta-win. */
  debugMode?: boolean;
}

// Defined once in utils/tournamentStatus, so the header line and the round rail
// cannot name the same round two different ways.
export { roundLabel } from "../../utils/tournamentStatus";

function nameOf(
  side: MatchLike["player1"],
  fallback: string | null | undefined,
): string {
  if (side) return displayNameOf(side as never);
  return fallback || "TBD";
}

function Face({ side, label }: { side: MatchLike["player1"]; label: string }) {
  return (
    <span className="relative w-7 h-7 shrink-0 border border-white/10 bg-background flex items-center justify-center text-[10px] font-black text-primary overflow-hidden">
      {side?.avatarUrl ? (
        <Image
          src={resolveImageUrl(side.avatarUrl)}
          alt=""
          aria-hidden
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        label[0]?.toUpperCase() || "?"
      )}
    </span>
  );
}

function Side({
  side,
  fallback,
  won,
  lost,
  score,
}: {
  side: MatchLike["player1"];
  fallback: string | null | undefined;
  won: boolean;
  lost: boolean;
  score: number | null;
}) {
  const label = nameOf(side, fallback);
  const tone = won ? "text-primary" : lost ? "text-white/40" : "text-white";
  return (
    <span className="flex items-center gap-2.5 px-3 py-2.5 min-w-0">
      <Face side={side} label={label} />
      {side?.id ? (
        <Link
          href={profileHref(side as never)}
          className={`text-[13px] font-black uppercase tracking-tight truncate font-poppins hover:text-primary transition-colors ${tone}`}
        >
          {label}
        </Link>
      ) : (
        <span className={`text-[13px] font-black uppercase tracking-tight truncate font-poppins ${tone}`}>
          {label}
        </span>
      )}
      <span
        className={`ml-auto text-base font-black tabular-nums font-poppins ${
          won ? "text-primary" : "text-white/70"
        }`}
      >
        {score === null ? "—" : score}
      </span>
    </span>
  );
}

function MatchCard({
  match,
  index,
  canManage,
  mine,
  onOpen,
}: {
  match: MatchLike;
  index: number;
  canManage?: boolean;
  /** This is the viewer's own match — they get in too, as a player. */
  mine: boolean;
  onOpen: () => void;
}) {
  const done = match.status === "COMPLETED";
  const live = match.status === "ONGOING";
  const p1 = match.player1;
  const p2 = match.player2;
  const s1 = done || live ? (match.player1Score ?? 0) : null;
  const s2 = done || live ? (match.player2Score ?? 0) : null;
  const p1Won = done && !!match.winnerId && match.winnerId === (p1?.id ?? match.player1Id);
  const p2Won = done && !!match.winnerId && match.winnerId === (p2?.id ?? match.player2Id);

  return (
    <div
      className={`flex flex-col border bg-component-background ${
        mine
          ? "border-primary/55"
          : live
            ? "border-[#FF4D4D]/50"
            : done
              ? "border-white/10"
              : "border-[#e8c53d]/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5">
        <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">
          {match.isBye ? "Bye" : `Match ${index + 1}`}
        </span>
        <span
          className={`text-[9px] font-black uppercase tracking-widest font-poppins ${
            done ? "text-primary" : live ? "text-[#FF4D4D]" : "text-[#e8c53d]"
          }`}
        >
          {live && (
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF4D4D] mr-1.5 align-middle animate-pulse"
            />
          )}
          {done ? "Full time" : live ? "Being played" : "Pending"}
        </span>
      </div>

      <Side side={p1} fallback={match.p1Name} won={p1Won} lost={done && p2Won} score={s1} />
      <span className="border-t border-white/5" />
      <Side side={p2} fallback={match.p2Name} won={p2Won} lost={done && p1Won} score={s2} />

      {(canManage || mine) && !match.isBye && (
        <div className="px-3 py-2 border-t border-white/5">
          {/* Opens the per-match drawer. Staff get scoring; a player of this
              match gets the same drawer read-only, which is where the shared
              coin/dice/timer and their own half of the score tracker live.
              Gating this on `canManage` alone left the player controls the API
              still honours with no way in the interface to reach them. */}
          <button
            type="button"
            onClick={onOpen}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] font-poppins transition-colors ${
              done
                ? "border border-white/15 text-white/60 hover:text-white hover:border-white/35"
                : canManage
                  ? "bg-primary text-black hover:bg-white"
                  : "border border-primary/60 text-primary hover:bg-primary hover:text-black"
            }`}
          >
            {canManage
              ? done
                ? "Edit result"
                : live
                  ? "Enter result"
                  : "Start match"
              : done
                ? "View result"
                : "Open match"}{" "}
            <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  );
}

import { useSearchParams, useRouter, usePathname } from "next/navigation";

export default function PairingsView({
  tournament,
  currentUserId,
  canManage,
  onRefresh,
  debugMode = false,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // The match whose drawer is open. Held by id rather than by object so it
  // survives a refetch replacing the tournament — otherwise recording a result
  // closed the drawer under the organiser mid-series.
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  
  const rounds = useMemo(() => {
    const list = ((tournament as unknown as { rounds?: RoundLike[] }).rounds ?? [])
      .filter((r) => (r.matches?.length ?? 0) > 0)
      .slice()
      .sort((a, b) => a.roundNumber - b.roundNumber);
    return list;
  }, [tournament]);

  // Open on the round still being played, not on round 1 — an organiser opening
  // this mid-event wants the round with work left in it.
  const defaultIndex = useMemo(() => {
    const unfinished = rounds.findIndex((r) =>
      (r.matches ?? []).some((m) => m.status !== "COMPLETED"),
    );
    return unfinished >= 0 ? unfinished : Math.max(0, rounds.length - 1);
  }, [rounds]);

  const [index, setIndex] = useState(defaultIndex);

  // Sync openMatchId from URL query
  useEffect(() => {
    const matchIdParam = searchParams.get("matchId");
    if (matchIdParam !== openMatchId) {
      setOpenMatchId(matchIdParam);
      if (matchIdParam) {
        const roundIdx = rounds.findIndex(r => r.matches?.some(m => m.id === matchIdParam));
        if (roundIdx >= 0) {
          setIndex(roundIdx);
        }
      }
    }
  }, [searchParams, rounds, openMatchId]);

  // Clear matchId from URL when drawer is closed
  const handleDrawerClose = () => {
    setOpenMatchId(null);
    if (searchParams.has("matchId")) {
      const next = new URLSearchParams(Array.from(searchParams.entries()));
      next.delete("matchId");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  };
  const round = rounds[Math.min(index, rounds.length - 1)];

  if (rounds.length === 0) {
    return (
      <div className="border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
        <p className="text-sm text-white/55">
          Pairings appear here as soon as the tournament starts.
        </p>
      </div>
    );
  }

  const matches = round?.matches ?? [];
  const reported = matches.filter((m) => m.status === "COMPLETED").length;
  // Re-resolved from the latest data every render, so the drawer shows the
  // match as it is now rather than as it was when it was clicked.
  const openMatch = openMatchId
    ? rounds.flatMap((r) => r.matches ?? []).find((m) => m.id === openMatchId)
    : undefined;

  const isMine = (m: MatchLike) =>
    !!currentUserId &&
    ((m.player1?.id ?? m.player1Id) === currentUserId ||
      (m.player2?.id ?? m.player2Id) === currentUserId);

  const myMatch = matches.find(isMine);

  return (
    <div className="flex flex-col gap-5">
      {/* Round rail: done, current, later — the shape of the event at a glance. */}
      <div className="flex items-center gap-2 flex-wrap">
        {rounds.map((r, i) => {
          const complete = (r.matches ?? []).every((m) => m.status === "COMPLETED");
          const here = i === Math.min(index, rounds.length - 1);
          return (
            <button
              key={r.id ?? r.roundNumber}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={here ? "true" : undefined}
              className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest font-poppins border transition-colors ${
                here
                  ? "bg-primary border-primary text-black"
                  : complete
                    ? "border-primary/40 text-primary hover:border-primary"
                    : "border-white/10 text-white/50 hover:text-white hover:border-white/30"
              }`}
            >
              {roundLabel(r.roundNumber)}
            </button>
          );
        })}
        <span className="ml-auto text-[10px] font-mono text-white/40">
          {reported} of {matches.length} reported
        </span>
      </div>

      {myMatch && (
        <div className="border border-primary/45 bg-gradient-to-b from-primary/10 to-primary/[0.02] p-5 flex flex-col gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-primary font-poppins">
            Your match
          </span>
          <p className="text-xl font-black uppercase tracking-tight text-white font-poppins leading-tight">
            {myMatch.isBye
              ? "Bye this round"
              : `${nameOf(myMatch.player1, myMatch.p1Name)} vs ${nameOf(myMatch.player2, myMatch.p2Name)}`}
          </p>
          <p className="text-xs text-white/60">
            {roundLabel(round.roundNumber)}
            {myMatch.status === "COMPLETED" && (
              <span className="text-white/45">
                {" · "}
                reported {myMatch.player1Score ?? 0}–{myMatch.player2Score ?? 0}
              </span>
            )}
            {myMatch.status === "ONGOING" && <span className="text-[#FF4D4D]"> · being played</span>}
            {myMatch.status === "PENDING" && <span className="text-[#e8c53d]"> · not started</span>}
          </p>
          {!myMatch.isBye && (
            <button
              type="button"
              onClick={() => setOpenMatchId(myMatch.id)}
              className="self-start mt-1 inline-flex items-center gap-1.5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] font-poppins bg-primary text-black hover:bg-white transition-colors"
            >
              {myMatch.status === "COMPLETED" ? "View result" : "Open match"}{" "}
              <span aria-hidden>→</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {matches.map((m, i) => (
          <MatchCard
            key={m.id}
            match={m}
            index={i}
            canManage={canManage}
            mine={!!myMatch && m.id === myMatch.id}
            onOpen={() => setOpenMatchId(m.id)}
          />
        ))}
      </div>

      {openMatch && (canManage || isMine(openMatch)) && (
        <ScoringDrawer
          match={openMatch as unknown as BracketMatch}
          formatConfig={getTournamentConfig(tournament) ?? undefined}
          system={getTournamentSystem(tournament) ?? undefined}
          tournamentId={tournament.id}
          tournamentStatus={tournament.status}
          currentUserId={currentUserId}
          // Staff score; a player of the match gets the read-only side, which
          // still carries the shared utilities and their own tracker slot.
          isAdmin={!!canManage}
          debugMode={debugMode}
          onClose={handleDrawerClose}
          onScore={() => {
            handleDrawerClose();
            void onRefresh?.();
          }}
          onMatchUpdated={() => void onRefresh?.()}
        />
      )}
    </div>
  );
}
