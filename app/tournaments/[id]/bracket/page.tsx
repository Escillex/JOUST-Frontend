"use client";
import React, { useState, useEffect, Suspense, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { usePolling } from "../../../utils/usePolling";
import { Match, LeaderboardEntry } from "./types";
import { getTournamentConfig } from "../../../utils/formatConfig";
import DesktopView from "./device/DesktopView";
import MobileView from "./device/MobileView";
import ScoringDrawer from "../../../components/tournaments/bracket/ScoringDrawer";
import MaximizedModal from "../../../components/tournaments/bracket/MaximizedModal";
import TerminalLogs from "../../../components/tournaments/bracket/TerminalLogs";
import LiveStandings from "../../../components/tournaments/bracket/LiveStandings";
import DeploymentFooter from "../../../components/tournaments/bracket/DeploymentFooter";
import BracketPreview from "../../../components/tournaments/bracket/BracketPreview";

const randomGuestName = () => `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

const findMatchInTournament = (t: any, matchId: string): Match | null => {
  if (!t || !t.rounds) return null;
  for (const round of t.rounds) {
    if (round.matches) {
      const found = round.matches.find((m: any) => m.id === matchId);
      if (found) return found;
    }
  }
  return null;
};

interface LogEntry { id: string; action: string; details?: string; timestamp: string; }

function BracketViewContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParam = searchParams.get("edit");
  const tournamentId = params.id as string;

  const [tournament, setTournament]     = useState<any | null>(null);
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([]);
  const [logs, setLogs]                 = useState<LogEntry[]>([]);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [isEditMode, setIsEditMode]     = useState(true);
  const [currentUser, setCurrentUser]   = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [updating, setUpdating]         = useState<string | null>(null);
  const [allUsers, setAllUsers]         = useState<any[]>([]);
  const [guestUsername, setGuestUsername]     = useState("");
  const [selectedUserId, setSelectedUserId]   = useState("");
  const [isStarting, setIsStarting]           = useState(false);
  const [isRegistering, setIsRegistering]     = useState(false);
  const [scoringMatch, setScoringMatch]       = useState<Match | null>(null);
  const [maximizedPanel, setMaximizedPanel]   = useState<"TERMINAL" | "STANDINGS" | null>(null);
  const [isMobile, setIsMobile]               = useState(false);
  const [viewMode, setViewMode]               = useState<"CARD" | "BRACKET">("BRACKET");
  const [activePlayerMatchPopup, setActivePlayerMatchPopup] = useState<Match | null>(null);
  const [activeAdminMatchNotification, setActiveAdminMatchNotification] = useState<Match | null>(null);
  const [dismissedPopups, setDismissedPopups] = useState<Set<string>>(new Set());
  const knownCompletedLogsCount = useRef<Record<string, number>>({});

  const activeAdmin = isAdmin && isEditMode;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    setViewMode(window.innerWidth < 1024 ? "CARD" : "BRACKET");
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // TEMPORARY POLLING BLOCK - TO BE REPLACED BY WEBSOCKETS
  // Rewritten to use the shared usePolling hook. The old version listed
  // seven state values as effect dependencies, so the 4-second timer was
  // destroyed and recreated on almost every render. usePolling reads the
  // latest state through a ref instead, so the timer is created once.
  // It also pauses while the browser tab is hidden.
  const hasOngoingMatches =
    tournament?.status === "ONGOING" &&
    (tournament.rounds?.flatMap((r: any) => r.matches)?.some((m: any) => m.status === "ONGOING") ?? false);

  usePolling(
    async () => {
      if (!tournament) return;
      const ongoingMatches = tournament.rounds?.flatMap((r: any) => r.matches)?.filter((m: any) => m.status === "ONGOING") || [];
      const myId = currentUser?.sub || currentUser?.id;
      const isGlobalAdmin = activeAdmin;
      
      const matchesToPoll = isGlobalAdmin
        ? ongoingMatches
        : ongoingMatches.filter((m: Match) => m.player1?.id === myId || m.player2?.id === myId || m.player1Id === myId || m.player2Id === myId);

      for (const match of matchesToPoll) {
        // Skip the match currently open in the scoring drawer: its
        // TrackerPanel already polls the same endpoint, and polling it
        // twice would double the requests for no benefit.
        if (scoringMatch?.id === match.id || dismissedPopups.has(match.id)) continue;
        if (activePlayerMatchPopup?.id === match.id || activeAdminMatchNotification?.id === match.id) continue;
        
        try {
          // Uses the shared authenticatedFetch instead of a local copy of
          // the base-URL logic, so URL handling stays in one place.
          const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.TRACKER_GET(match.id));
          if (res.ok) {
            const logs = await res.json();
            if (Array.isArray(logs)) {
              const completedCount = logs.filter((l: any) => l.completedAt).length;
              const prevCount = knownCompletedLogsCount.current[match.id];
              
              if (prevCount !== undefined && completedCount > prevCount) {
                fetchTournamentData();
              }
              knownCompletedLogsCount.current[match.id] = completedCount;

              const activeLog = logs.find((l: any) => l.trackerActive);
              if (activeLog) {
                if (isGlobalAdmin) {
                  const formatConfig = getTournamentConfig(tournament);
                  const hpThresholdMet = activeLog.mode === 'HP' && (activeLog.player1Value === 0 || activeLog.player2Value === 0);
                  const pointsThresholdMet = activeLog.mode === 'POINTS' && formatConfig?.pointsThreshold && (activeLog.player1Value >= formatConfig.pointsThreshold || activeLog.player2Value >= formatConfig.pointsThreshold);
                  
                  if (hpThresholdMet || pointsThresholdMet) {
                    setActiveAdminMatchNotification(match);
                  }
                } else {
                  setActivePlayerMatchPopup(match);
                }
              }
            }
          }
        } catch { /* silent poll fail */ }
      }
    },
    4000,
    hasOngoingMatches,
  );
  // END OF TEMPORARY POLLING BLOCK

  // TEMPORARY POLLING BLOCK - TO BE REPLACED BY WEBSOCKETS
  // General auto-refresh for the bracket. Runs "silent" so it does not
  // flash the loading state, and only refreshes the tournament and
  // leaderboard. The old version re-fetched the signed-in user and the
  // full registered-user list on every 15-second tick, even though
  // neither changes while looking at a bracket.
  usePolling(
    () => fetchTournamentData(true),
    15000,
    !!tournamentId && (tournament?.status === "ONGOING" || tournament?.status === "OPEN"),
  );
  // END OF TEMPORARY POLLING BLOCK

  useEffect(() => {
    if (!tournamentId) { router.push("/tournaments"); return; }
    // The signed-in user and the user list are loaded once here, not on
    // every refresh tick.
    fetchIdentity();
    fetchTournamentData();
  }, [tournamentId]);

  useEffect(() => {
    if (tournament?.name) {
      document.title = `Joust | ${tournament.name}`;
    }
  }, [tournament?.name]);

  const addLog = (action: string, details?: string) =>
    setLogs(prev => [{ id: Math.random().toString(36).slice(7), timestamp: new Date().toLocaleTimeString(), action, details }, ...prev]);

  // Loads who is signed in (and, for organizers, the user list used by
  // the registration panel). Split out of fetchTournamentData so it runs
  // once on page load instead of on every refresh tick.
  const fetchIdentity = async () => {
    try {
      const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
      if (!meRes.ok) return;
      const me = await safeJson(meRes);
      setCurrentUser(me);
      const auth = me?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER");
      setIsAdmin(auth);
      if (auth) {
        setIsEditMode(editParam !== "false");
        const usersRes = await authenticatedFetch(API_ENDPOINTS.AUTH.REGISTERED_USERS);
        if (usersRes.ok) setAllUsers(await safeJson(usersRes) ?? []);
      } else {
        setIsEditMode(false);
      }
    } catch { /* identity load failure is non-fatal; page still renders */ }
  };

  // "silent" refreshes (the 15-second poll) skip the loading state so
  // the page does not flicker while the user is looking at it.
  const fetchTournamentData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const tRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE(tournamentId!));
      if (tRes.ok) {
        const t = await safeJson(tRes);
        setTournament(t);
        if (!silent) addLog("TOURNAMENT DATA READY", `${t.name.toUpperCase()} STATUS: ${t.status}`);
        
        // Auto-switch to CARD view for Swiss/Round Robin
        const formatSystem = typeof t.format === 'string' ? t.format : t.format?.system;
        if (formatSystem === "SWISS" || formatSystem === "ROUND_ROBIN") {
          setViewMode("CARD");
        }

        // Keep active scoring match updated in case of game-by-game results
        setScoringMatch((prev) => {
          if (!prev) return null;
          const updatedMatch = findMatchInTournament(t, prev.id);
          return updatedMatch || prev;
        });
      }
      const lRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD(tournamentId!));
      if (lRes.ok) setLeaderboard(await safeJson(lRes) ?? []);
    } catch { addLog("ERROR", "SERVER CONNECTION FAILED"); }
    finally { if (!silent) setLoading(false); }
  };

  const handleStartTournament = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.START(tournamentId!), { method: "POST" });
      const data = await safeJson(res);
      if (res.ok) { addLog("TOURNAMENT STARTED", "MATCHES INITIALIZED"); fetchTournamentData(); }
      else { addLog("ERROR", data?.message || "START FAILED"); }
    } finally {
      setIsStarting(false);
    }
  };

  const handleJoin = async (userId: string) => {
    if (isRegistering) return false;
    setIsRegistering(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN(tournamentId!), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await safeJson(res);
      if (res.ok) { addLog("REGISTRATION", "PARTICIPANT REGISTERED"); fetchTournamentData(); return true; }
      addLog("ERROR", data?.message || "SERVER REJECTED"); return false;
    } finally {
      setIsRegistering(false);
    }
  };

  const handleAddGuest = async () => {
    if (isRegistering) return;
    if (!guestUsername || tournament?.participants.length >= tournament?.maxPlayers) { addLog("ERROR", "MAX CAPACITY REACHED"); return; }
    setIsRegistering(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN_GUEST(tournamentId!), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: guestUsername }) });
      const data = await safeJson(res);
      if (res.ok) { addLog("REGISTRATION", "GUEST ADDED"); setGuestUsername(""); fetchTournamentData(); }
      else { addLog("ERROR", data?.message || "GUEST REGISTRATION FAILED"); }
    } finally {
      setIsRegistering(false);
    }
  };


  const handleScoreMatch = async (winnerId: string | null) => {
    if (!activeAdmin || !scoringMatch || updating) return;
    const matchId = scoringMatch.id;
    const p1Name = scoringMatch.player1?.username || "TBD";
    const p2Name = scoringMatch.player2?.username || "TBD";
    const winnerName = winnerId === scoringMatch.player1?.id ? p1Name : winnerId === scoringMatch.player2?.id ? p2Name : null;
    setUpdating(matchId);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.SUBMIT(matchId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ winnerId: winnerId || undefined }) });
      const data = await safeJson(res);
      if (res.ok) {
        addLog("MATCH COMPLETED", winnerName ? `${winnerName.toUpperCase()} DEFEATED OPPONENT` : `DRAW: ${p1Name} VS ${p2Name}`);
        setScoringMatch(null); await fetchTournamentData();
      } else { addLog("ERROR", data?.message || "SUBMISSION REJECTED"); }
    } catch { addLog("ERROR", "SERVER CONNECTION LOST DURING SCORING"); }
    finally { setUpdating(null); }
  };

  const handleOpenScoring = (match: Match) => {
    if (match.winnerId || match.status === "COMPLETED") return;
    setScoringMatch(match);
  };

  if (loading && !tournament) return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse font-poppins">Syncing Brackets</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background font-questrial flex flex-col overflow-x-hidden">
      <div className="w-full px-4 md:px-8 py-12 mx-auto space-y-12">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-foreground/5 pb-8">
          <div className="flex items-center gap-6">
            <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-center text-foreground/40 hover:text-primary hover:border-primary/40 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div className="space-y-1">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-foreground font-poppins leading-none flex items-center gap-4">
                {tournament?.name}
                <span className="text-foreground/10 font-thin">/</span>
                <span className="text-primary text-xl md:text-2xl">
                  {(() => {
                    const fs = typeof tournament?.format === 'string' ? tournament.format : tournament?.format?.system;
                    return fs === "HYBRID" ? "TOP CUT" : (fs?.replace("_", " ") || "UNKNOWN");
                  })()}
                </span>
              </h1>
              <div className="flex items-center gap-3">
                <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${isAdmin ? "text-primary/60" : "text-foreground/20"}`}>
                  {isAdmin ? "SYSTEM ADMINISTRATOR" : "AUTHORIZED VIEWER"}
                </span>
                <div className="w-1 h-1 rounded-full bg-foreground/10" />
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-foreground/20">TOURNAMENT CONTROLLER v2.0</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-foreground/5 border border-white/5 p-1 rounded-xl">
              <button 
                onClick={() => { setViewMode("CARD"); addLog("UI_COMMAND", "SWITCHED TO CARD VIEW"); }}
                className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "CARD" ? 'bg-primary text-white shadow-lg' : 'text-foreground/40 hover:text-foreground'}`}
              >
                {(() => {
                  const fs = typeof tournament?.format === 'string' ? tournament.format : tournament?.format?.system;
                  return fs === "SWISS" || fs === "ROUND_ROBIN" ? "Match List" : "Card View";
                })()}
              </button>
              {(() => {
                const fs = typeof tournament?.format === 'string' ? tournament.format : tournament?.format?.system;
                const isHybrid = fs === "HYBRID";
                const hasTopCut = tournament?.rounds?.some((r: any) => r.matches?.some((m: any) => m.phase === 2));
                
                if (fs === "SWISS" || fs === "ROUND_ROBIN") return false;
                if (isHybrid && !hasTopCut) return false;
                return true;
              })() && (
                <button 
                  onClick={() => { setViewMode("BRACKET"); addLog("UI_COMMAND", "SWITCHED TO BRACKET VIEW"); }}
                  className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "BRACKET" ? 'bg-primary text-white shadow-lg' : 'text-foreground/40 hover:text-foreground'}`}
                >
                  Bracket View
                </button>
              )}
            </div>

            {(tournament?.status === "ONGOING" || tournament?.status === "COMPLETED") && (
              <a 
                href={`/tournaments/${tournamentId}/live`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hidden md:flex px-6 py-2.5 border border-primary/20 hover:border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#52b946]" />
                View All Match Status
              </a>
            )}

            {isAdmin && (
              <button
                onClick={() => {
                  const nextVal = !isEditMode;
                  setIsEditMode(nextVal);
                  addLog("UI_COMMAND", `EDIT MODE: ${nextVal ? "ENABLED" : "DISABLED"}`);
                  const url = new URL(window.location.href);
                  url.searchParams.set("edit", String(nextVal));
                  window.history.replaceState(null, "", url.toString());
                }}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                  isEditMode 
                    ? "bg-primary/10 border-primary text-primary hover:bg-primary/20" 
                    : "bg-foreground/5 border-foreground/10 text-foreground/40 hover:text-foreground"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isEditMode ? "bg-primary animate-pulse shadow-[0_0_8px_#52b946]" : "bg-foreground/20"}`} />
                {isEditMode ? "Edit Mode: ON" : "Edit Mode: OFF"}
              </button>
            )}

            {activeAdmin && tournament?.status === "OPEN" && (
              <button onClick={handleStartTournament} disabled={isStarting} className="px-8 py-3 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-primary/20 font-poppins disabled:opacity-50 disabled:pointer-events-none">
                {isStarting ? "Starting..." : "Start Tournament"}
              </button>
            )}
          </div>
        </div>

        {/* Winner Announcement (if completed) */}
        {tournament?.status === "COMPLETED" && tournament?.winner && viewMode !== "BRACKET" && (
          <motion.div 
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            className="bg-primary/5 border-[6px] border-primary/20 p-12 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rotate-45 translate-x-32 -translate-y-32 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="space-y-4 text-center md:text-left">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="flex items-center gap-4 justify-center md:justify-start"
                >
                  <div className="w-2 h-10 bg-primary" />
                  <span className="text-[12px] font-black text-primary uppercase tracking-[0.5em] font-poppins italic">CHAMPION:</span>
                </motion.div>
                <motion.h2 
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 100, damping: 12 }}
                  className="text-6xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none font-poppins italic group-hover:scale-[1.02] transition-transform duration-700"
                >
                  {tournament.winner.username || tournament.winner.guestName}
                </motion.h2>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="flex items-center gap-4 justify-center md:justify-start"
                >
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">RANK #01</span>
                  <div className="w-1 h-1 rounded-full bg-primary" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">TOURNAMENT VICTOR</span>
                </motion.div>
              </div>
              <motion.div 
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 10, delay: 0.45 }}
                className="w-32 h-32 md:w-48 md:h-48 bg-primary text-black flex items-center justify-center relative shadow-[0_0_50px_rgba(82,185,70,0.3)] shrink-0"
              >
                <div className="absolute inset-2 border-2 border-black/20" />
                <span className="text-6xl md:text-8xl font-black italic">{tournament.winner.username?.[0] || tournament.winner.guestName?.[0]}</span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Bracket Area */}
        <main className={tournament?.status === "ONGOING" || tournament?.status === "COMPLETED" ? "h-[65vh] overflow-hidden" : "min-h-[40vh]"}
        >
          {tournament?.status === "ONGOING" || tournament?.status === "COMPLETED" ? (
            isMobile ? (
              <div className="h-full overflow-y-auto no-scrollbar">
                <MobileView 
                  tournament={tournament} 
                  leaderboard={leaderboard} 
                  isAdmin={activeAdmin} 
                  updating={updating} 
                  onOpenScoring={handleOpenScoring} 
                  addLog={addLog}
                  viewMode={viewMode}
                  currentUserId={currentUser?.sub || currentUser?.id}
                />
              </div>
            ) : (
              <DesktopView 
                tournament={tournament} 
                leaderboard={leaderboard} 
                isAdmin={activeAdmin} 
                updating={updating} 
                onOpenScoring={handleOpenScoring} 
                addLog={addLog} 
                viewMode={viewMode}
                currentUserId={currentUser?.sub || currentUser?.id}
              />
            )
          ) : (
            <BracketPreview 
              tournament={tournament} 
              isAdmin={activeAdmin} 
              currentUserId={currentUser?.sub || currentUser?.id}
              tournamentId={tournamentId} 
              onRefresh={fetchTournamentData}
              addLog={addLog}
              viewMode={viewMode}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-24 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TerminalLogs logs={logs} onMaximize={() => { setMaximizedPanel("TERMINAL"); addLog("UI_COMMAND", "SYSTEM LOGS EXPANDED"); }} />
          <LiveStandings leaderboard={leaderboard} onMaximize={() => { setMaximizedPanel("STANDINGS"); addLog("UI_COMMAND", "STANDINGS EXPANDED"); }} />
          {activeAdmin && tournament?.status === "OPEN" && (
            <DeploymentFooter
              tournament={tournament}
              allUsers={allUsers}
              guestUsername={guestUsername}
              setGuestUsername={setGuestUsername}
              selectedUserId={selectedUserId}
              setSelectedUserId={setSelectedUserId}
              onAddGuest={handleAddGuest}
              onJoin={handleJoin}
            />
          )}
        </footer>
      </div>

      <MaximizedModal panel={maximizedPanel} logs={logs} leaderboard={leaderboard} onClose={() => setMaximizedPanel(null)} />
      
      {/* Player Match Popup */}
      <AnimatePresence>
        {activePlayerMatchPopup && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-black border border-primary/40 shadow-[0_0_30px_rgba(82,185,70,0.3)] p-6 max-w-sm w-full mx-4 flex flex-col items-center text-center"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse mb-3 shadow-[0_0_8px_#52b946]" />
            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-1">Your Match is Live</h3>
            <p className="text-[10px] text-white/50 uppercase tracking-widest mb-6">
              An organizer has opened the tracker for {activePlayerMatchPopup.player1?.username || "P1"} vs {activePlayerMatchPopup.player2?.username || "P2"}.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => {
                  setDismissedPopups(prev => new Set(prev).add(activePlayerMatchPopup.id));
                  setActivePlayerMatchPopup(null);
                }}
                className="flex-1 py-3 border border-white/10 hover:border-white/30 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setScoringMatch(activePlayerMatchPopup);
                  setActivePlayerMatchPopup(null);
                }}
                className="flex-1 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:bg-primary/80 transition-all shadow-lg"
              >
                Join Tracker
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Threshold Notification */}
      <AnimatePresence>
        {activeAdminMatchNotification && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed top-24 right-8 z-[60] bg-black border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.2)] p-6 max-w-sm w-full flex flex-col gap-3"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-500 block mb-1">Threshold Met</span>
                <h3 className="text-sm font-black uppercase tracking-wide text-white">
                  {activeAdminMatchNotification.player1?.username || "P1"} vs {activeAdminMatchNotification.player2?.username || "P2"}
                </h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Requires Result Verification</p>
              </div>
              <button 
                onClick={() => {
                  setDismissedPopups(prev => new Set(prev).add(activeAdminMatchNotification.id));
                  setActiveAdminMatchNotification(null);
                }} 
                className="text-white/20 hover:text-white"
              >
                ✕
              </button>
            </div>
            <button
              onClick={() => {
                setScoringMatch(activeAdminMatchNotification);
                setActiveAdminMatchNotification(null);
              }}
              className="w-full py-3 bg-amber-500 text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-amber-400 transition-all shadow-lg mt-2"
            >
              Verify Result
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ScoringDrawer 
        match={scoringMatch} 
        formatConfig={getTournamentConfig(tournament)}
        isAdmin={activeAdmin}
        currentUserId={currentUser?.sub || currentUser?.id}
        tournamentId={tournamentId}
        tournamentStatus={tournament?.status}
        onClose={() => setScoringMatch(null)} 
        onScore={handleScoreMatch}
        onMatchUpdated={fetchTournamentData}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(82,185,70,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(82,185,70,0.4); }
      `}</style>
    </div>
  );
}

export default function BracketViewPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse font-poppins">Initializing Terminal</p>
        </div>
      </div>
    }>
      <BracketViewContent />
    </Suspense>
  );
}
