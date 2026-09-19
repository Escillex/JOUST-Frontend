"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import ScoringDrawer from "./bracket/ScoringDrawer";
import type { Match as BracketMatch } from "../../tournaments/[id]/bracket/types";
import { getTournamentConfig, getTournamentSystem, getTieBreakerOrder, tieBreakerLabel, canSeparateTiebreakers, identicalTiebreakersWarning } from "../../utils/formatConfig";
import Image from "next/image";
import Link from "next/link";
import type { Tournament } from "../../tournaments/types";
import { displayNameOf, profileHref, resolveImageUrl, authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { roundLabel } from "../../utils/tournamentStatus";
import { useToast } from "../ui/Toast";

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
  reportedWinnerId?: string | null;
  p1Name?: string | null;
  p2Name?: string | null;
  phase?: number;
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
  const isAwaitingVerification = !done && !!match.reportedWinnerId && !match.winnerId;
  const p1 = match.player1;
  const p2 = match.player2;
  const s1 = done || live ? (match.player1Score ?? 0) : null;
  const s2 = done || live ? (match.player2Score ?? 0) : null;
  const p1Won = done && !!match.winnerId && match.winnerId === (p1?.id ?? match.player1Id);
  const p2Won = done && !!match.winnerId && match.winnerId === (p2?.id ?? match.player2Id);
  const p1ReportedWon = isAwaitingVerification && match.reportedWinnerId === (p1?.id ?? match.player1Id);
  const p2ReportedWon = isAwaitingVerification && match.reportedWinnerId === (p2?.id ?? match.player2Id);

  return (
    <div
      className={`flex flex-col border bg-component-background transition-all ${
        mine
          ? "border-primary/55"
          : isAwaitingVerification
            ? "border-amber-400/60 shadow-[0_0_15px_rgba(251,191,36,0.1)]"
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
            done
              ? "text-primary"
              : isAwaitingVerification
                ? "text-amber-400"
                : live
                  ? "text-[#FF4D4D]"
                  : "text-[#e8c53d]"
          }`}
        >
          {isAwaitingVerification ? (
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 align-middle animate-pulse"
            />
          ) : live ? (
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF4D4D] mr-1.5 align-middle animate-pulse"
            />
          ) : null}
          {done
            ? "Full time"
            : isAwaitingVerification
              ? "Awaiting verification"
              : live
                ? "Being played"
                : "Pending"}
        </span>
      </div>

      <Side side={p1} fallback={match.p1Name} won={p1Won || p1ReportedWon} lost={done && p2Won} score={s1} />
      <span className="border-t border-white/5" />
      <Side side={p2} fallback={match.p2Name} won={p2Won || p2ReportedWon} lost={done && p1Won} score={s2} />

      {(canManage || mine) && !match.isBye && (
        <div className="px-3 py-2 border-t border-white/5">
          {/* Opens the per-match drawer. Staff get scoring; a player of this
              match gets in too — the shared coin/dice/timer, their own tracker
              slot, and (when the tournament allows player scoring) the win
              controls, whose deciding result waits for the organizer's review.
              Gating this on `canManage` alone left the player controls the API
              still honours with no way in the interface to reach them. */}
          <button
            type="button"
            onClick={onOpen}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] font-poppins transition-colors ${
              done
                ? "border border-white/15 text-white/60 hover:text-white hover:border-white/35"
                : isAwaitingVerification
                  ? canManage
                    ? "bg-amber-400 text-black hover:bg-white"
                    : "border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black"
                  : canManage
                    ? "bg-primary text-black hover:bg-white"
                    : "border border-primary/60 text-primary hover:bg-primary hover:text-black"
            }`}
          >
            {canManage
              ? done
                ? "Edit result"
                : isAwaitingVerification
                  ? "Verify result"
                  : live
                    ? "Enter result"
                    : "Start match"
              : done
                ? "View result"
                : isAwaitingVerification
                  ? "Review match"
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
  const openMatchRef = useRef<MatchLike | undefined>(undefined);
  
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

  // Open from the URL — the live viewer links into a specific match
  // (`?matchId=…`). Deliberately does not read or depend on `openMatchId`: a
  // drawer opened by clicking a card has no matchId in the URL, so the old
  // `matchIdParam !== openMatchId` comparison saw `null !== <id>` on the very
  // next render and set the id straight back to null — the drawer flashed open
  // and closed instantly.
  useEffect(() => {
    const matchIdParam = searchParams.get("matchId");
    if (!matchIdParam) return;
    setOpenMatchId(matchIdParam);
    const roundIdx = rounds.findIndex((r) =>
      r.matches?.some((m) => m.id === matchIdParam),
    );
    if (roundIdx >= 0) setIndex(roundIdx);
  }, [searchParams, rounds]);

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

  // Tie detection on tournament completion pause
  const [standings, setStandings] = useState<any[]>([]);
  const [isResolvingTie, setIsResolvingTie] = useState(false);
  const { toast } = useToast();

  const allMatchesFinished = useMemo(() => {
    return rounds.length > 0 && rounds.every((r) =>
      (r.matches ?? []).length > 0 && (r.matches ?? []).every((m) => m.status === "COMPLETED"),
    );
  }, [rounds]);

  useEffect(() => {
    if (tournament.status === "ONGOING" && allMatchesFinished) {
      authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD(tournament.id))
        .then(safeJson)
        .then((data) => {
          if (Array.isArray(data)) setStandings(data);
        })
        .catch(() => {});
    } else {
      setStandings([]);
    }
  }, [tournament.status, tournament.id, allMatchesFinished]);

  const isFirstPlaceTie =
    tournament.status === "ONGOING" &&
    allMatchesFinished &&
    standings.length > 1 &&
    standings[0]?.points > 0 &&
    standings[0]?.points === standings[1]?.points;

  const tieBreakerOrder = getTieBreakerOrder(tournament);
  const tieBreakerNames = tieBreakerOrder.map(tieBreakerLabel).join(" → ");

  // When the top two are identical on EVERY configured tiebreaker, "applying
  // tiebreakers" cannot produce an honest winner — the server refuses it. Hide
  // the Apply button and point the organizer at the extra round instead.
  const tiebreakersIdentical =
    isFirstPlaceTie &&
    standings.length > 1 &&
    !canSeparateTiebreakers(standings[0], standings[1], tieBreakerOrder);

  const handleResolveTie = async (action: "EXTEND_ROUND" | "APPLY_TIEBREAKERS") => {
    setIsResolvingTie(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.RESOLVE_TIE(tournament.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        toast(data?.message || (action === "EXTEND_ROUND" ? "Tiebreaker round generated" : "Tie resolved"), "success");
        await onRefresh?.();
      } else {
        toast(data?.message || "Failed to resolve tie", "error");
      }
    } catch {
      toast("Error resolving tie", "error");
    } finally {
      setIsResolvingTie(false);
    }
  };

  const handleCompleteTournament = async () => {
    setIsResolvingTie(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.COMPLETE(tournament.id), {
        method: "PATCH",
      });
      const data = await safeJson(res);
      if (res.ok) {
        toast("Tournament marked as completed", "success");
        await onRefresh?.();
      } else {
        toast(data?.message || "Failed to complete tournament", "error");
      }
    } catch {
      toast("Error completing tournament", "error");
    } finally {
      setIsResolvingTie(false);
    }
  };

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
  // We keep a fallback ref to the last resolved match so that background
  // refreshes or array recomputations do not briefly drop openMatch to undefined
  // and trigger entrance/exit animations (closing and reopening the modal).
  const foundMatch = openMatchId
    ? rounds.flatMap((r) => r.matches ?? []).find((m) => m.id === openMatchId)
    : undefined;

  if (foundMatch) {
    openMatchRef.current = foundMatch;
  } else if (!openMatchId) {
    openMatchRef.current = undefined;
  }

  const openMatch = openMatchId ? (foundMatch ?? openMatchRef.current) : undefined;

  const isMine = (m: MatchLike) =>
    !!currentUserId &&
    ((m.player1?.id ?? m.player1Id) === currentUserId ||
      (m.player2?.id ?? m.player2Id) === currentUserId);

  const myMatch = matches.find(isMine);

  return (
    <div className="flex flex-col gap-5">
      {/* ── TIE DETECTED / READY FOR COMPLETION BANNER ──────────────────────── */}
      {isFirstPlaceTie && (
        <div className="border border-amber-400/50 bg-amber-400/10 p-5 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400 block">
              ● Final Round Complete · Tie for 1st Place
            </span>
            <p className="text-sm font-black uppercase tracking-tight text-white font-poppins">
              {displayNameOf(standings[0] as never, standings[0]?.username)} and {displayNameOf(standings[1] as never, standings[1]?.username)} are tied at {standings[0]?.points} points
            </p>
            <p className="text-[11px] text-white/60">
              {tiebreakersIdentical ? (
                <span className="text-amber-300 font-bold">
                  {identicalTiebreakersWarning(tieBreakerOrder)}
                </span>
              ) : canManage
                ? "Tournament auto-completion is paused. Apply secondary tiebreakers or extend with an extra round to finalize."
                : "Awaiting organizer tiebreak resolution to declare the final champion."}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {!tiebreakersIdentical && (
                <button
                  type="button"
                  onClick={() => handleResolveTie("APPLY_TIEBREAKERS")}
                  disabled={isResolvingTie}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-white text-black text-[10px] font-black uppercase tracking-widest font-poppins transition-colors disabled:opacity-50"
                >
                  {isResolvingTie ? "Resolving…" : `Apply Tiebreakers (${tieBreakerNames})`}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleResolveTie("EXTEND_ROUND")}
                disabled={isResolvingTie}
                className="px-4 py-2.5 border border-amber-400/60 hover:bg-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-widest font-poppins transition-colors disabled:opacity-50"
              >
                Add Tiebreaker Round
              </button>
            </div>
          )}
        </div>
      )}

      {/* All finished and no tie, but tournament still ONGOING — organizer prompt */}
      {!isFirstPlaceTie && allMatchesFinished && tournament.status === "ONGOING" && canManage && (
        <div className="border border-primary/40 bg-primary/10 p-5 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary block">
              ● All Matches Completed
            </span>
            <p className="text-sm font-black uppercase tracking-tight text-white font-poppins">
              Ready to finalize tournament
            </p>
            <p className="text-[11px] text-white/60">
              All rounds are concluded. Click below to finalize the standings and declare the champion.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCompleteTournament}
            disabled={isResolvingTie}
            className="px-5 py-2.5 bg-primary hover:bg-white text-black text-[10px] font-black uppercase tracking-widest font-poppins transition-colors disabled:opacity-50 shrink-0"
          >
            {isResolvingTie ? "Finalizing…" : "Finalize Tournament"}
          </button>
        </div>
      )}
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

      {myMatch && (() => {
        const isMyMatchAwaiting = myMatch.status !== "COMPLETED" && !!myMatch.reportedWinnerId && !myMatch.winnerId;
        return (
          <div className={`border p-5 flex flex-col gap-2 ${
            isMyMatchAwaiting
              ? "border-amber-400/50 bg-gradient-to-b from-amber-400/10 to-amber-400/[0.02]"
              : "border-primary/45 bg-gradient-to-b from-primary/10 to-primary/[0.02]"
          }`}>
            <span className={`text-[9px] font-black uppercase tracking-[0.25em] font-poppins ${
              isMyMatchAwaiting ? "text-amber-400" : "text-primary"
            }`}>
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
              {isMyMatchAwaiting && (
                <span className="text-amber-400">
                  {" · "}
                  score reported · awaiting verification
                </span>
              )}
              {!isMyMatchAwaiting && myMatch.status === "ONGOING" && <span className="text-[#FF4D4D]"> · being played</span>}
              {!isMyMatchAwaiting && myMatch.status === "PENDING" && <span className="text-[#e8c53d]"> · not started</span>}
            </p>
            {!myMatch.isBye && (
              <button
                type="button"
                onClick={() => setOpenMatchId(myMatch.id)}
                className={`self-start mt-1 inline-flex items-center gap-1.5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] font-poppins transition-colors ${
                  isMyMatchAwaiting
                    ? "bg-amber-400 text-black hover:bg-white"
                    : "bg-primary text-black hover:bg-white"
                }`}
              >
                {myMatch.status === "COMPLETED"
                  ? "View result"
                  : isMyMatchAwaiting
                    ? "Review match"
                    : "Open match"}{" "}
                <span aria-hidden>→</span>
              </button>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {matches.map((m, i) => (
          <MatchCard
            key={m.id}
            match={m}
            index={i}
            canManage={canManage}
            mine={!!myMatch && m.id === myMatch.id}
            onOpen={() => {
              setOpenMatchId(m.id);
            }}
          />
        ))}
      </div>

      {openMatch && (canManage || isMine(openMatch)) && (
        <ScoringDrawer
          match={openMatch as unknown as BracketMatch}
          formatConfig={getTournamentConfig(tournament, openMatch.phase) ?? undefined}
          system={getTournamentSystem(tournament) ?? undefined}
          tournamentId={tournament.id}
          tournamentStatus={tournament.status}
          currentUserId={currentUserId}
          // Staff score; a player of the match gets the player side, which
          // carries the shared utilities, their tracker slot and — under the
          // default scoreSubmissionRule — the win controls, with the deciding
          // result held for an organizer's review.
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
