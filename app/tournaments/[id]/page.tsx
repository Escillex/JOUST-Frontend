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
import {
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
import { useToast } from "../../components/ui/Toast";
import TournamentBuildsPanel from "../../components/tournaments/TournamentBuildsPanel";
import GameIcon from "../../components/ui/GameIcon";
import ProfileAvatar from "../../components/profile/ProfileAvatar";
import { describeStatus, formatWhen } from "../../utils/tournamentStatus";
import { actionFor } from "../../utils/tournamentAction";

type TabId = "overview" | "players" | "bracket" | "builds";
const TAB_IDS: TabId[] = ["overview", "players", "bracket", "builds"];

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
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [respondingToInvite, setRespondingToInvite] = useState(false);

  // The open tab lives in the URL, so a player can be sent straight to the
  // roster or the bracket and Back returns where it should.
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = TAB_IDS.includes(tabParam as TabId) ? (tabParam as TabId) : "overview";
  const setTab = (tab: TabId) => {
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : `/tournaments/${tournamentId}`, { scroll: false });
  };

  // Only organizers can be invited to co-manage, so this request is skipped for
  // everyone else rather than fired on every tournament page view.
  const loadInvitation = useCallback(async (me: { roles?: string[] } | null) => {
    const canBeInvited = me?.roles?.some((r) => r === "ORGANIZER" || r === "ADMIN");
    if (!canBeInvited) return;
    const res = await authenticatedFetch(API_ENDPOINTS.ORGANIZERS.MY_INVITATIONS);
    if (!res.ok) return;
    const invitations = await safeJson(res);
    const mine = Array.isArray(invitations)
      ? invitations.find((i: { tournamentId: string }) => i.tournamentId === tournamentId)
      : null;
    setPendingInviteId(mine?.id ?? null);
  }, [tournamentId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
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

    } catch (error) {
      console.error("Fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, loadInvitation]);

  useEffect(() => {
    if (tournamentId) {
      fetchData();
    } else {
      router.push("/tournaments");
    }
  }, [tournamentId, fetchData, router]);

  useEffect(() => {
    if (tournament?.name) {
      document.title = `Joust | ${tournament.name}`;
    }
  }, [tournament?.name]);

  const respondToInvitation = async (accept: boolean) => {
    if (!pendingInviteId || respondingToInvite) return;
    setRespondingToInvite(true);
    try {
      const endpoint = accept
        ? API_ENDPOINTS.ORGANIZERS.ACCEPT(pendingInviteId)
        : API_ENDPOINTS.ORGANIZERS.DECLINE(pendingInviteId);
      const res = await authenticatedFetch(endpoint, { method: "PATCH" });
      if (res.ok) {
        setPendingInviteId(null);
        toast(accept ? "You now co-manage this tournament" : "Invitation declined", "success");
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
        router.push(`/tournaments/${tournamentId}/lobby`);
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
  const status = describeStatus(tournament, isJoined);
  const when = formatWhen(tournament.date);
  const system = typeof tournament.format === "object" ? tournament.format?.system : null;
  const action = actionFor({ tournament, userId: myId, isJoined });
  const canManage = tournament.canManage;
  const started = tournament.status === "ONGOING" || tournament.status === "COMPLETED";

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "players", label: `Players · ${tournament.participants.length}` },
    { id: "bracket", label: "Bracket" },
    { id: "builds", label: "Builds" },
  ];

  const cfg = getTournamentConfig(tournament) as any;
  const isHybrid = system === "HYBRID";
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
                {tournament.prizePool} <span aria-hidden>↗</span>
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

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border ${
                    status.tone === "now"
                      ? "bg-[#FF4D4D] border-[#FF4D4D] text-white"
                      : isJoined
                        ? "bg-primary border-primary text-black"
                        : status.tone === "open"
                          ? "border-primary text-primary"
                          : "border-component-border text-white/70"
                  }`}
                >
                  {status.tone === "now" && (
                    <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                  {status.tone === "open" && !isJoined && <span aria-hidden>● </span>}
                  {status.label}
                </span>

                {tournament.game && (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 border border-component-border text-[10px] font-black uppercase tracking-widest text-white">
                    <GameIcon game={tournament.game} size="chip" />
                    {tournament.game.name}
                  </span>
                )}
              </div>

              <p className="text-sm text-white/70">
                {when ?? "Date to be announced"}
                {tournament.venue && <span className="text-white/50"> · {tournament.venue}</span>}
              </p>
            </div>

            {/* The action block: one button, one reason. */}
            <div className="flex flex-col gap-2 lg:w-80 shrink-0">
              {action.join ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="h-14 w-full bg-primary text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-primary-light transition-colors disabled:opacity-50"
                >
                  {joining ? "Joining…" : action.label}
                </button>
              ) : action.disabled ? (
                <div className="h-14 w-full flex items-center justify-center bg-component-background border-2 border-component-border text-white/40 font-black text-xs uppercase tracking-[0.2em] text-center px-4">
                  {action.label}
                </div>
              ) : (
                <Link
                  href={action.href ?? "#"}
                  className={`h-14 w-full flex items-center justify-center font-black text-xs uppercase tracking-[0.2em] transition-colors ${
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
                <p className="text-xs text-white/60 text-center">{action.helper}</p>
              )}

              {(canManage || started) && (
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-1">
                  {/* Gated on canManage, which the server computes — holding the
                      ORGANIZER role says nothing about THIS tournament. */}
                  {canManage && (
                    <Link
                      href={`/tournaments/${tournamentId}/manage`}
                      className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-primary transition-colors"
                    >
                      Manage
                    </Link>
                  )}
                  {started && (
                    <>
                      <Link
                        href={`/tournaments/${tournamentId}/report`}
                        className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-primary transition-colors"
                      >
                        Report
                      </Link>
                      <Link
                        href={`/tournaments/${tournamentId}/bracket`}
                        className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-primary transition-colors"
                      >
                        Full bracket
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex overflow-x-auto border-b border-component-border -mx-5 px-5 md:mx-0 md:px-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`shrink-0 px-5 py-4 text-[11px] font-black uppercase tracking-widest transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-white/50 hover:text-white"
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

          {activeTab === "bracket" && (
            <motion.div
              key="bracket"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col gap-4"
            >
              {tournament.status === "OPEN" || tournament.status === "UPCOMING" ? (
                <div className="py-20 text-center border-2 border-dashed border-white/10">
                  <p className="text-sm text-white/50">
                    The bracket is drawn when the tournament starts.
                  </p>
                </div>
              ) : (
                <>
                  <BracketPreview
                    tournament={tournament}
                    tournamentId={tournamentId}
                    isAdmin={false}
                    currentUserId={myId}
                    onRefresh={fetchData}
                    addLog={() => {}}
                    viewMode="BRACKET"
                  />
                  <Link
                    href={`/tournaments/${tournamentId}/bracket`}
                    className="self-start text-[11px] font-black uppercase tracking-widest text-primary hover:text-primary-light transition-colors"
                  >
                    Open full bracket →
                  </Link>
                </>
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
