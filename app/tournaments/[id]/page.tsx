"use client";
import { Skeleton, SkeletonStatus } from "../../components/ui/Skeleton";
import dynamic from "next/dynamic";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  authenticatedFetch,
  API_ENDPOINTS,
  safeJson,
  resolveImageUrl,
  displayNameOf,
  profileHref,
} from "../../utils/api";
import { Tournament } from "../types";
import { usePolling } from "../../utils/usePolling";
import { useTournamentSocket } from "../../utils/useTournamentSocket";
import {
  getTieBreakerOrder,
  getTournamentConfig,
  systemExplanation,
  systemLabel,
} from "../../utils/formatConfig";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
// Lazy-loaded: BracketPreview pulls in @xyflow/react, which is by far the
// largest dependency in the app. Loading it up front made every visitor to a
// tournament page download the whole bracket renderer even when they never
// opened the Bracket tab. ssr is disabled because the canvas measures the DOM.
const BracketPreview = dynamic(
  () => import("../../components/tournaments/bracket/BracketPreview"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] flex items-center justify-center">
        <SkeletonStatus label="Loading bracket" />
        <Skeleton className="w-full h-full" />
      </div>
    ),
  },
);

/**
 * The REAL bracket, drawn from the rounds that are being played —
 * `BracketPreview` above is only the pre-start seeding preview, which is why
 * this tab used to insist the bracket had not been drawn yet on tournaments
 * that were finished. Same lazy treatment: it is the same ReactFlow dependency.
 */
const EliminationLayout = dynamic(
  () => import("./bracket/Formats/EliminationLayout"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] flex items-center justify-center">
        <SkeletonStatus label="Loading bracket" />
        <Skeleton className="w-full h-full" />
      </div>
    ),
  },
);
import { useToast } from "../../components/ui/Toast";
import TournamentBuildsPanel from "../../components/tournaments/TournamentBuildsPanel";
import PairingsView from "../../components/tournaments/PairingsView";
import StandingsTable from "../../components/tournaments/StandingsTable";
import type { LeaderboardEntry } from "./bracket/types";
import GameIcon from "../../components/ui/GameIcon";
import ProfileAvatar from "../../components/profile/ProfileAvatar";
import TournamentCompletionBanner from "../../components/tournaments/TournamentCompletionBanner";
import { formatWhen, stateLine } from "../../utils/tournamentStatus";
import { actionFor } from "../../utils/tournamentAction";

type TabId = "overview" | "players" | "pairings" | "standings" | "bracket" | "builds";
const TAB_IDS: TabId[] = [
  "overview",
  "players",
  "pairings",
  "standings",
  "bracket",
  "builds",
];

function TournamentViewContent() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [user, setUser] = useState<{ sub: string; id?: string; roles?: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [pendingParticipantInviteId, setPendingParticipantInviteId] = useState<string | null>(null);
  const [respondingToInvite, setRespondingToInvite] = useState(false);
  /** The ranking table's rows. Fetched separately from the tournament because
   *  the standings are computed, not stored on it. */
  const [standings, setStandings] = useState<LeaderboardEntry[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(true);

  // The open tab lives in the URL, so a player can be sent straight to the
  const tabParam = searchParams.get("tab");
  const requestedTab: TabId | null = TAB_IDS.includes(tabParam as TabId) ? (tabParam as TabId) : null;
  const setTab = (tab: TabId) => {
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    next.set("tab", tab);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : `/tournaments/${tournamentId}`, { scroll: false });
  };

  // Co-organizer invitations are role-gated; player invitations are available
  // to every signed-in account, so both inboxes are checked here.
  const loadInvitation = useCallback(async (me: { roles?: string[] } | null) => {
    const canBeInvited = me?.roles?.some((r) => r === "ORGANIZER" || r === "ADMIN");
    if (canBeInvited) {
      const res = await authenticatedFetch(API_ENDPOINTS.ORGANIZERS.MY_INVITATIONS);
      if (res.ok) {
        const invitations = await safeJson(res);
        const mine = Array.isArray(invitations)
          ? invitations.find((i: { tournamentId: string }) => i.tournamentId === tournamentId)
          : null;
        setPendingInviteId(mine?.id ?? null);
      }
    }
    const playerRes = await authenticatedFetch(API_ENDPOINTS.PARTICIPANT_INVITATIONS.LIST);
    if (playerRes.ok) {
      const invitations = await safeJson(playerRes);
      const mine = Array.isArray(invitations)
        ? invitations.find((i: { tournamentId: string }) => i.tournamentId === tournamentId)
        : null;
      setPendingParticipantInviteId(mine?.id ?? null);
    }
  }, [tournamentId]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!silent) {
        const [meRes, tRes] = await Promise.all([
          authenticatedFetch(API_ENDPOINTS.AUTH.ME),
          authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE(tournamentId!))
        ]);

        if (meRes.ok) {
          const data = await safeJson(meRes);
          if (data) setUser(data);
          await loadInvitation(data);
        }
        if (tRes.ok) {
          const data = await safeJson(tRes);
          if (data) setTournament(data);
        }
      } else {
        const tRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE(tournamentId!));
        if (tRes.ok) {
          const data = await safeJson(tRes);
          if (data) setTournament(data);
        }
      }

    } catch (error) {
      console.error("Fetch failed:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tournamentId, loadInvitation]);

  // Standings are only meaningful once something has been played, so this does
  // not run for an OPEN tournament — and a failure leaves the table empty
  // rather than taking the page down (Core Rule 8).
  //
  // Keyed on the ROUND COUNT rather than the tournament object: `fetchData`
  // hands back a fresh object on every poll, which would otherwise refetch the
  // standings on a timer for no reason. A new round is the thing that changes
  // them.
  const tournamentStatus = tournament?.status;
  const roundCount = ((tournament as unknown as { rounds?: unknown[] })?.rounds ?? []).length;

  useEffect(() => {
    if (!tournamentId) return;
    if (!tournamentStatus || tournamentStatus === "OPEN" || tournamentStatus === "UPCOMING") return;
    let alive = true;
    authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD(tournamentId))
      .then(safeJson)
      .then((rows) => {
        if (alive && Array.isArray(rows)) setStandings(rows);
      })
      .catch(() => {})
      // Only ever set false: a refetch keeps the table that is already on
      // screen instead of flashing a skeleton over good data.
      .finally(() => {
        if (alive) setStandingsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tournamentId, tournamentStatus, roundCount]);

  useEffect(() => {
    if (tournamentId) {
      fetchData();
    } else {
      router.push("/tournaments");
    }
  }, [tournamentId, fetchData, router]);

  const { connected } = useTournamentSocket(tournamentId, {
    onTournamentUpdate: () => fetchData(true),
  });

  // temporary polling block - fallback behind the WebSocket connection
  usePolling(
    () => fetchData(true),
    connected ? 60000 : 10000,
    !!tournament && tournament.status !== "COMPLETED",
  );
  // end of temporary polling block

  useEffect(() => {
    if (tournament?.name) {
      document.title = `Joust | ${tournament.name}`;
    }
  }, [tournament?.name]);

  const respondToInvitation = async (accept: boolean, kind: "organizer" | "participant" = "organizer") => {
    const invitationId = kind === "organizer" ? pendingInviteId : pendingParticipantInviteId;
    if (!invitationId || respondingToInvite) return;
    setRespondingToInvite(true);
    try {
      const endpoint = accept
        ? kind === "organizer"
          ? API_ENDPOINTS.ORGANIZERS.ACCEPT(invitationId)
          : API_ENDPOINTS.PARTICIPANT_INVITATIONS.ACCEPT(invitationId)
        : kind === "organizer"
          ? API_ENDPOINTS.ORGANIZERS.DECLINE(invitationId)
          : API_ENDPOINTS.PARTICIPANT_INVITATIONS.DECLINE(invitationId);
      const res = await authenticatedFetch(endpoint, { method: "PATCH" });
      if (res.ok) {
        if (kind === "organizer") setPendingInviteId(null);
        else setPendingParticipantInviteId(null);
        toast(
          accept
            ? kind === "organizer" ? "You now co-manage this tournament" : "You joined the tournament"
            : "Invitation declined",
          "success",
        );
        // Accepting changes what this viewer may do, so the tournament is
        // refetched to pick up its new canManage.
        if (accept) await fetchData();
      } else {
        const err = await safeJson(res);
        toast(err?.message || "Could not respond to the invitation", "error");
      }
    } finally {
      setRespondingToInvite(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
        router.push("/auth");
        return;
    }
    setJoining(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN(tournamentId!), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: (user as any).id || (user as any).sub }),
      });
      if (res.ok) {
        await fetchData();
        toast("Successfully joined the tournament!", "success");
      } else {
        // Toast instead of alert(): alert() blocks the whole page and
        // is not allowed in this project.
        const err = await safeJson(res) || { message: "Failed to join the tournament" };
        toast(err.message || "Failed to join the tournament", "error");
      }
    } catch {
      toast("Could not reach the server", "error");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    setLeaving(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEAVE(tournamentId!), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: (user as any).id || (user as any).sub }),
      });
      if (res.ok) {
        await fetchData();
        toast("Successfully left the tournament", "success");
      } else {
        const err = await safeJson(res) || { message: "Failed to leave the tournament" };
        toast(err.message || "Failed to leave the tournament", "error");
      }
    } catch {
      toast("Could not reach the server", "error");
    } finally {
      setLeaving(false);
    }
  };

  if (loading && !tournament) {
    return (
      <div className="min-h-screen w-full bg-background font-questrial overflow-x-hidden">
        {/* The blocks below are decorative; this announces the load to screen
            readers, which otherwise get silence while the page fills in. */}
        <SkeletonStatus label="Loading tournament" />
        <div className="w-full max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-16 flex flex-col gap-8">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-3/4 max-w-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-14 w-full md:w-80" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7"><Skeleton className="h-64 w-full" /></div>
            <div className="lg:col-span-5"><Skeleton className="h-64 w-full" /></div>
          </div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-white text-lg">This tournament doesn&apos;t exist or has been removed.</p>
        <Link
          href="/tournaments"
          className="px-6 py-3 border-2 border-primary text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-colors"
        >
          Browse tournaments
        </Link>
      </div>
    );
  }

  const myId = user?.sub || (user as any)?.id;
  const isJoined = tournament.participants.some(p => p.userId === myId);
  const when = formatWhen(tournament.date);
  const system = tournament.system ?? (typeof tournament.format === "object" ? tournament.format?.system : null);
  const action = actionFor({ tournament, userId: myId, isJoined });
  const canManage = tournament.canManage;
  const started = tournament.status === "ONGOING" || tournament.status === "COMPLETED";

  // Rounds exist from the moment a tournament starts, which is also when
  // pairings and standings start to mean anything.
  const hasRounds = ((tournament as unknown as { rounds?: unknown[] }).rounds ?? []).length > 0;
  // Swiss and round robin are not trees; their structure is the standings
  // table, so they get no Bracket tab at all.
  const isTree = system === "SINGLE_ELIMINATION" || system === "DOUBLE_ELIMINATION" || system === "HYBRID";

  const tabs: { id: TabId; label: string }[] = [
    ...(isTree ? [{ id: "bracket" as TabId, label: "Bracket" }] : []),
    ...(hasRounds ? [{ id: "pairings" as TabId, label: "Match Table" }] : []),
    ...(hasRounds ? [{ id: "standings" as TabId, label: "Standings" }] : []),
    { id: "overview", label: "Overview" },
    { id: "players", label: `Players · ${tournament.participants.length}` },
    { id: "builds", label: "Builds" },
  ];

  const defaultTab = tabs[0]?.id || "overview";
  const activeTab: TabId = (requestedTab && tabs.some((t) => t.id === requestedTab)) ? requestedTab : defaultTab;

  const cfg = getTournamentConfig(tournament) as any;
  const isHybrid = system === "HYBRID";
  const tournamentRounds = tournament.rounds ?? [];
  const hasTopCutMatches = isHybrid && tournamentRounds.some((round) =>
    round.matches.some((match) => match.phase === 2),
  );
  const swissRoundNumbers = tournamentRounds
    .filter((round) => round.matches.some((match) => match.phase === 1))
    .map((round) => round.roundNumber);
  const currentSwissRound = swissRoundNumbers.length > 0
    ? Math.max(...swissRoundNumbers)
    : null;
  const configuredSwissRounds = getTournamentConfig(tournament, 1).swissRounds;
  const totalSwissRounds = configuredSwissRounds ?? Math.max(
    1,
    Math.ceil(Math.log2(Math.max(2, tournament.participants.length))),
  );
  const topCutSize = getTournamentConfig(tournament, 2).topCutSize ?? 8;
  const points = [
    `1st ${cfg?.placementPointsChampion ?? 10}`,
    `2nd ${cfg?.placementPoints2nd ?? 7}`,
    `3rd ${cfg?.placementPoints3rd ?? 5}`,
    ...(isHybrid ? [`Top cut ${cfg?.placementPointsTopCut ?? 3}`] : []),
    `Played ${cfg?.placementPointsParticipation ?? 1}`,
  ].join(" · ");

  const details: { label: string; value: React.ReactNode; note?: string | null }[] = [
    ...(tournament.game
      ? [{
          label: "Game",
          value: (
            <span className="inline-flex items-center gap-2">
              <GameIcon game={tournament.game} size="chip" />
              {tournament.game.name}
            </span>
          ),
        }]
      : []),
    {
      label: "Format",
      value: systemLabel(system) ?? "Not set",
      note: systemExplanation(system),
    },
    { label: "Date", value: when ?? "To be announced" },
    { label: "Venue", value: tournament.venue || "Not specified" },
    {
      label: "Seats",
      value: `${tournament.participants.length} of ${tournament.maxPlayers} taken`,
    },
    {
      label: "Prize",
      value: tournament.prizePool
        ? (tournament.prizeImageUrl
            // The text IS the link to the picture of the prize — "Trophy" means
            // more when you can see which trophy.
            ? <a
                href={resolveImageUrl(tournament.prizeImageUrl, "")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary-light transition-colors"
              >
                {tournament.prizePool} <span aria-hidden>→</span>
              </a>
            : tournament.prizePool)
        : "None",
    },
    ...(tournament.createdBy
      ? [{
          label: "Organizer",
          value: (
            <Link href={profileHref(tournament.createdBy)} className="text-primary hover:text-primary-light transition-colors">
              {displayNameOf(tournament.createdBy)}
            </Link>
          ),
        }]
      : []),
    { label: "Points", value: points },
  ];

  const activeParticipants = tournament.participants.filter(p => p.status !== "FORFEITED");
  const withdrawn = tournament.participants.filter(p => p.status === "FORFEITED");

  return (
    <div className="min-h-screen w-full bg-background text-white font-poppins selection:bg-primary selection:text-black overflow-x-hidden">
      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-14 flex flex-col gap-8">

        {pendingInviteId && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between border border-primary/30 bg-primary/5 px-6 py-5">
            <span className="text-[11px] font-black uppercase tracking-widest text-primary">
              You have been invited to co-manage this tournament
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => respondToInvitation(true)}
                disabled={respondingToInvite}
                className="px-6 py-2 text-[10px] font-black uppercase tracking-widest bg-primary text-black disabled:opacity-40"
              >
                {respondingToInvite ? "Working…" : "Accept"}
              </button>
              <button
                onClick={() => respondToInvitation(false)}
                disabled={respondingToInvite}
                className="px-6 py-2 text-[10px] font-black uppercase tracking-widest border border-white/20 text-white/60 hover:text-white disabled:opacity-40"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {pendingParticipantInviteId && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between border border-primary/30 bg-primary/5 px-6 py-5">
            <span className="text-[11px] font-black uppercase tracking-widest text-primary">
              You have been invited to join this tournament
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => respondToInvitation(true, "participant")}
                disabled={respondingToInvite}
                className="px-6 py-2 text-[10px] font-black uppercase tracking-widest bg-primary text-black disabled:opacity-40"
              >
                {respondingToInvite ? "Working…" : "Accept"}
              </button>
              <button
                onClick={() => respondToInvitation(false, "participant")}
                disabled={respondingToInvite}
                className="px-6 py-2 text-[10px] font-black uppercase tracking-widest border border-white/20 text-white/60 hover:text-white disabled:opacity-40"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* HEADER — what it is, when, and the one thing you can do, all before
            any tab is chosen. The name used to be the fourth thing on the page,
            below the fold on a phone. */}
        <header className="flex flex-col gap-5">
          <Link
            href="/tournaments"
            className="text-xs text-white/50 hover:text-white transition-colors w-fit"
          >
            ‹ Tournaments
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <div className="flex flex-col gap-3 min-w-0">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none break-words">
                {tournament.name}
              </h1>

              {/* No LIVE badge (agreed 2026-09-16). The badge was a flag, and a
                  flag goes stale — a finished tournament still read LIVE on the
                  bracket page. This line is computed from the rounds and the
                  results, so it cannot disagree with them. "You're in" stays a
                  chip because it is about the viewer, not the tournament. */}
              <div className="flex flex-wrap items-center gap-2">
                {isJoined && tournament.status !== "COMPLETED" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border bg-primary border-primary text-black">
                    You&rsquo;re in
                  </span>
                )}

                {tournament.game && (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 border border-component-border text-[10px] font-black uppercase tracking-widest text-white">
                    <GameIcon game={tournament.game} size="chip" />
                    {tournament.game.name}
                  </span>
                )}
              </div>

              <p className="text-sm text-white/80 font-medium">{stateLine(tournament)}</p>

              <p className="text-sm text-white/70">
                {when ?? "Date to be announced"}
                {tournament.venue && <span className="text-white/50"> · {tournament.venue}</span>}
              </p>
            </div>

            {/* The action block: only show large button if joining or full */}
            <div className="flex flex-col gap-2 lg:w-80 shrink-0">
              {(!started || action.join || action.disabled) && (
                <>
                  {action.join ? (
                    <button
                      onClick={handleJoin}
                      disabled={joining}
                      className="h-10 lg:h-14 w-full bg-primary text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-primary-light transition-colors disabled:opacity-50"
                    >
                      {joining ? "Joining…" : action.label}
                    </button>
                  ) : action.disabled ? (
                    <div className="h-10 lg:h-14 w-full flex items-center justify-center bg-component-background border-2 border-component-border text-white/40 font-black text-xs uppercase tracking-[0.2em] text-center px-4">
                      {action.label}
                    </div>
                  ) : (
                    <Link
                      href={action.href ?? "#"}
                      className={`h-10 lg:h-14 w-full flex items-center justify-center font-black text-xs uppercase tracking-[0.2em] transition-colors ${
                        action.tone === "primary"
                          ? "bg-primary text-black hover:bg-primary-light"
                          : action.tone === "neutral"
                            ? "bg-white text-black hover:bg-primary"
                            : "border-2 border-primary text-primary hover:bg-primary hover:text-black"
                      }`}
                    >
                      {action.label}
                    </Link>
                  )}

                  {action.helper && (
                    <p className="text-xs text-white/60 text-center mb-1">{action.helper}</p>
                  )}
                </>
              )}

              {(canManage || (isJoined && !started)) && (
                <div className="flex gap-2 w-full mt-1">
                  {canManage && (
                    <Link
                      href={`/tournaments/${tournamentId}/manage?tab=settings`}
                      className="flex-1 h-10 flex items-center justify-center border border-white/20 bg-white/5 text-white font-black text-[10px] uppercase tracking-[0.1em] hover:bg-white hover:text-black transition-colors"
                    >
                      Manage Tournament
                    </Link>
                  )}
                  {isJoined && !started && (
                    <button
                      onClick={handleLeave}
                      disabled={leaving}
                      className="flex-1 h-10 flex items-center justify-center border border-[#FF4D4D]/50 text-[#FF4D4D] font-black text-[10px] uppercase tracking-[0.1em] hover:bg-[#FF4D4D] hover:text-black transition-colors disabled:opacity-50"
                    >
                      {leaving ? "Leaving…" : "Leave"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <TournamentCompletionBanner
          tournament={tournament}
          onViewResults={() => setTab("standings")}
          onUpdated={() => fetchData(true)}
        />

        {/* Desktop Tab Row / Mobile Grid Navigator */}
        <div className="grid grid-cols-3 gap-2 md:flex md:gap-0 md:overflow-x-auto md:border-b md:border-component-border md:-mx-5 md:px-5 lg:mx-0 lg:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex flex-col items-center justify-center h-12 md:h-auto md:flex-row md:shrink-0 md:px-5 md:py-4 text-[11px] font-black uppercase tracking-widest transition-colors ${
                activeTab === tab.id
                  ? "border-2 md:border-0 md:border-b-2 border-primary bg-primary/10 md:bg-transparent text-primary"
                  : "border md:border-0 md:border-b-2 border-white/10 md:border-transparent bg-component-background md:bg-transparent text-white/70 hover:bg-white/5 md:hover:bg-transparent md:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16"
            >
              <div className="lg:col-span-7 flex flex-col gap-8">
                <div className="relative aspect-video w-full overflow-hidden border-2 border-component-border">
                  {/* /placeholder.png has "PLACEHOLDER — NO IMAGE SET" drawn
                      into the artwork, which reads as broken rather than as
                      empty. A tournament without a banner gets a quiet ground. */}
                  {tournament.bannerUrl ? (
                    <Image
                      src={resolveImageUrl(tournament.bannerUrl, "")}
                      alt=""
                      aria-hidden
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-zinc-900"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 14px)",
                      }}
                    />
                  )}
                </div>

                {tournament.description && (
                  <p className="text-base md:text-lg text-white/75 leading-relaxed whitespace-pre-wrap">
                    {tournament.description}
                  </p>
                )}
              </div>

              {/* Details: a plain list. This replaces three panels that expanded
                  after a one-second hover, rotated one line every three seconds,
                  and called themselves "Live" while showing the page's first
                  fetch — with no keyboard path to any of it. */}
              <div className="lg:col-span-5 flex flex-col">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 pb-2 border-b-2 border-component-border">
                  Details
                </h2>
                <dl className="flex flex-col">
                  {details.map((row) => (
                    <div
                      key={row.label}
                      className="flex flex-col gap-1 py-3 border-b border-component-border"
                    >
                      <div className="flex justify-between items-baseline gap-4">
                        <dt className="text-xs text-white/50 shrink-0">{row.label}</dt>
                        <dd className="text-sm text-white text-right min-w-0 break-words">{row.value}</dd>
                      </div>
                      {row.note && <p className="text-xs text-white/50">{row.note}</p>}
                    </div>
                  ))}
                </dl>
              </div>
            </motion.div>
          )}

          {activeTab === "players" && (
            <motion.div
              key="players"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col gap-8"
            >
              {tournament.participants.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-white/10">
                  <p className="text-sm text-white/50">Nobody has registered yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  {activeParticipants.map((p: any) => {
                    const isMe = p.userId === myId;
                    return (
                      <div
                        key={p.userId}
                        className={`flex items-center gap-3 py-3 border-b border-component-border ${isMe ? "bg-primary/5" : ""}`}
                      >
                        <ProfileAvatar
                          name={displayNameOf(p.user)}
                          avatarUrl={p.user?.avatarUrl}
                          accent={isMe}
                          className="w-8 h-8 text-xs rounded-full"
                        />
                        {p.user?.isGuest ? (
                          <span className="flex-1 text-sm truncate">{displayNameOf(p.user)}</span>
                        ) : (
                          <Link
                            href={profileHref({ slug: p.user?.slug, id: p.userId })}
                            className="flex-1 text-sm truncate hover:text-primary transition-colors"
                          >
                            {displayNameOf(p.user)}
                          </Link>
                        )}
                        {isMe && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">You</span>
                        )}
                        {/* Only when the organizer actually set one — the old
                            page fell back to the array index, inventing seeds
                            that the bracket would then contradict. */}
                        {!isMe && p.seed != null && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                            Seed {p.seed}
                          </span>
                        )}
                        {!isMe && p.seed == null && p.user?.isGuest && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                            Guest
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {withdrawn.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-white/40">
                    Withdrew · {withdrawn.length}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                    {withdrawn.map((p: any) => (
                      <div
                        key={p.userId}
                        className="flex items-center gap-3 py-3 border-b border-component-border opacity-50"
                      >
                        <ProfileAvatar
                          name={displayNameOf(p.user)}
                          avatarUrl={p.user?.avatarUrl}
                          className="w-8 h-8 text-xs rounded-full"
                        />
                        <span className="flex-1 text-sm truncate">{displayNameOf(p.user)}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                          Forfeited
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "pairings" && (
            <motion.div
              key="pairings"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <PairingsView
                tournament={tournament}
                currentUserId={myId}
                canManage={!!tournament.canManage}
                // A player starting their own match, or a result being
                // recorded, must resurface — without this the drawer keeps the
                // stale PENDING state and Start Match appears to do nothing.
                onRefresh={() => fetchData(true)}
              />
            </motion.div>
          )}

          {activeTab === "standings" && (
            <motion.div
              key="standings"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <StandingsTable
                entries={standings}
                tieBreakerOrder={getTieBreakerOrder(tournament)}
                fieldSize={tournament.participants.length}
                currentUserId={myId}
                loading={standingsLoading}
              />
            </motion.div>
          )}

          {activeTab === "bracket" && (
            <motion.div
              key="bracket"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col gap-4"
            >
              {/* Branch on whether rounds EXIST, not on the seeding mode.
                  `BracketPreview` is a pre-start seeding preview and returns a
                  "drawn when the tournament starts" note whenever seeding is
                  random — which is the default. Rendering it for ONGOING and
                  COMPLETED tournaments meant every started tournament, in every
                  system, told its players the bracket had not been drawn yet,
                  forever, including finished ones with a champion. */}
              {isHybrid && !hasTopCutMatches ? (
                <div className="min-h-[420px] border border-white/10 bg-[#0c0c0c] px-5 py-12 md:px-12 flex items-center justify-center">
                  <div className="w-full max-w-2xl flex flex-col items-center text-center">
                    <div className="relative w-16 h-16 mb-6 flex items-center justify-center" aria-hidden>
                      <span className="w-12 h-12 rounded-full border-2 border-primary/30" />
                      <span className="absolute w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_15px_rgba(82,185,70,0.8)]" />
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary mb-2">
                      Phase 1: Swiss Stage {hasRounds ? "In Progress" : "Upcoming"}
                    </p>
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                      Waiting for Swiss Rounds to be Over
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55">
                      The Top Cut bracket will appear here automatically once the Swiss rounds are complete and the final standings are locked.
                    </p>

                    <dl className="mt-8 grid w-full max-w-md grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                      <div className="border border-white/10 bg-white/[0.03] p-4">
                        <dt className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40">Current stage</dt>
                        <dd className="mt-1 text-xs font-black uppercase text-white">
                          {currentSwissRound === null
                            ? "Swiss rounds not started"
                            : `Swiss Round ${Math.min(currentSwissRound, totalSwissRounds)} of ${totalSwissRounds}`}
                        </dd>
                      </div>
                      <div className="border border-white/10 bg-white/[0.03] p-4">
                        <dt className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40">Cut criteria</dt>
                        <dd className="mt-1 text-xs font-black uppercase text-primary">
                          Top {topCutSize} advance
                        </dd>
                      </div>
                    </dl>

                    {hasRounds && (
                      <div className="mt-8 flex w-full max-w-md flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => setTab("pairings")}
                          className="flex-1 h-11 border border-primary bg-primary text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:border-white transition-colors"
                        >
                          View Match Table
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab("standings")}
                          className="flex-1 h-11 border border-white/15 bg-white/5 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:border-primary hover:text-primary transition-colors"
                        >
                          View Standings
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : !hasRounds ? (
                /* Before the start there are no rounds to draw, so this is the
                   one place `BracketPreview` belongs: with manual seeding it
                   previews the intended first round, and with a random draw it
                   says so itself. */
                <div className="h-[420px] border border-white/10 bg-component-background">
                  <BracketPreview
                    tournament={tournament}
                    tournamentId={tournamentId}
                    isAdmin={false}
                    currentUserId={myId}
                    onRefresh={fetchData}
                    addLog={() => {}}
                    viewMode="BRACKET"
                  />
                </div>
              ) : (
                /* Full-bleed on a phone (agreed 2026-09-17, option 4B): the
                   canvas was 348px wide inside the page gutter and showed three
                   of fifteen matches. It now runs edge to edge at 70vh — the
                   same escape the tab strip above uses — and clears the fixed
                   bottom navigation. Tall on desktop because at a legible zoom
                   a double-elimination bracket is taller than 600px and the
                   round captions were the part getting clipped. */
                <div className="-mx-5 md:mx-0 mb-20 md:mb-0 h-[70vh] md:h-[min(78vh,880px)] md:min-h-[520px] border-y md:border border-white/10 bg-component-background">
                  <EliminationLayout
                    tournament={tournament}
                    leaderboard={standings}
                    // Read-only here: scoring lives on the manage page, and
                    // the tree has never offered it even to admins.
                    isAdmin={false}
                    updating={null}
                    onOpenScoring={() => {}}
                    addLog={() => {}}
                    currentUserId={myId}
                  />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "builds" && (
            <motion.div
              key="builds"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <TournamentBuildsPanel
                tournamentId={tournamentId}
                tournamentStatus={tournament.status}
                viewerId={myId}
                viewerRoles={user ? ((user as any).roles ?? []) : undefined}
                isActiveEntrant={tournament.participants.some(
                  (p: any) => p.userId === myId && p.status !== "FORFEITED" && !p.user?.isGuest,
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function TournamentViewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SkeletonStatus label="Loading tournament" />
      </div>
    }>
      <TournamentViewContent />
    </Suspense>
  );
}
