"use client";
import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { usePolling } from "../../../utils/usePolling";
import { useTournamentSocket } from "../../../utils/useTournamentSocket";
import { getRawTournamentConfig, ruleView, writeRuleValue, RawConfig } from "../../../utils/formatConfig";
import OddFieldStartModal, { byeWarningFor, ByeWarning } from "../../../components/tournaments/OddFieldStartModal";
import { Tournament } from "../../types";
import { useToast } from "../../../components/ui/Toast";
import { Skeleton, SkeletonPanel, SkeletonStatus } from "../../../components/ui/Skeleton";
import { useUser } from "../../../components/UserProvider";
import ControlRoomHeader from "../../../components/tournaments/manage/ControlRoomHeader";
import RosterPanel from "../../../components/tournaments/manage/RosterPanel";
import StaffPanel from "../../../components/tournaments/manage/StaffPanel";
import BuildsReviewPanel from "../../../components/tournaments/manage/BuildsReviewPanel";
import SpecsPanel from "../../../components/tournaments/manage/SpecsPanel";
import FormatRulesPanel from "../../../components/tournaments/manage/FormatRulesPanel";
import AddParticipantsPanel from "../../../components/tournaments/manage/AddParticipantsPanel";
import DeleteTournamentPanel from "../../../components/tournaments/manage/DeleteTournamentPanel";
import InvitePlayerModal from "../../../components/tournaments/manage/InvitePlayerModal";
import RoundControlPanel from "../../../components/tournaments/manage/RoundControlPanel";
import ManageSection from "../../../components/tournaments/manage/ManageSection";
import PairingsView from "../../../components/tournaments/PairingsView";
import TournamentCompletionBanner from "../../../components/tournaments/TournamentCompletionBanner";
import { uniqueGuestNames } from "../../../utils/guestName";

type ManageTab = "rounds" | "players" | "settings" | "builds";
const MANAGE_TABS: ManageTab[] = ["rounds", "players", "settings", "builds"];

function ControlRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [allUsers, setAllUsers]     = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  // When the tournament data on screen was last successfully refreshed. The
  // organizer acts on this data, so a silent poll failure must be visible.
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Feedback is shown through the fixed-position toast system instead of
  // the old banner at the top of the page: the banner was invisible when
  // the organizer was scrolled down at the panel they were acting on,
  // which made failed saves look like "nothing happened".
  const { toast } = useToast();
  // Read the signed-in user from the shared provider rather than firing another
  // /auth/me: the staff panel only needs to know whether this is the creator.
  const { user: currentUser } = useUser();

  const [isEditing, setIsEditing]           = useState(false);
  const [isEditingRules, setIsEditingRules] = useState(false);
  // The RAW stored config, not the resolved view. On a hybrid these differ: the
  // engine reads through `phase1`, so the editor renders ruleView(formatConfig)
  // and writes back through writeRuleValue (plan 9.6).
  const [formatConfig, setFormatConfig]     = useState<RawConfig>({});
  const [formatDefinitions, setFormatDefinitions] = useState<any[]>([]);
  const [formats, setFormats] = useState<any[]>([]);
  const [editState, setEditState] = useState({ name: "", description: "", formatId: "", maxPlayers: 0, prizePool: "", isPrivate: false, slug: "" });

  const [guestUsername, setGuestUsername]     = useState("");
  const [isAddingGuest, setIsAddingGuest]     = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [batchGuestCount, setBatchGuestCount] = useState<number | "">("");
  const [batchLoading, setBatchLoading]       = useState(false);
  const [isStarting, setIsStarting]           = useState(false);
  // Set when Start is pressed on an odd Swiss/round-robin field: holds the data
  // for the bye warning so the organizer confirms before starting.
  const [oddWarning, setOddWarning]           = useState<{ warning: ByeWarning; byeResult: string } | null>(null);
  // userId currently being forfeited or replaced, so that row can show a busy
  // state and no two roster actions can overlap.
  const [actingOn, setActingOn]               = useState<string | null>(null);
  /** The same per-viewer flag Admin → Dev Tools writes (`joust_debug_mode`).
   *  Round Control offers coin tosses and force-resolve, which are testing
   *  affordances rather than organiser workflow, so it hides behind this. */
  const [debugMode, setDebugMode] = useState(false);
  useEffect(() => {
    try { setDebugMode(localStorage.getItem("joust_debug_mode") === "1"); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    if (!tournamentId) { router.push("/tournaments/manage"); return; }
    fetchData();
    fetchFormatDefinitions();
  }, [tournamentId]);

  // Real-time refresh: when a match is submitted, the bracket advances, or a
  // participant joins/leaves, refresh the manage view immediately.
  const { connected } = useTournamentSocket(tournamentId, {
    onTournamentUpdate: () => fetchData(true),
  });

  // temporary polling block - fallback behind the WebSocket connection
  // Background refresh through the shared usePolling hook: it pauses while the
  // tab is hidden and stops entirely once the tournament is COMPLETED. While
  // the socket is connected it drops to a slow 60s safety-net tick (the socket
  // drives freshness); when the socket drops it returns to the fast 10s rate.
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

  // One request feeding both pieces of state. These were two separate functions
  // hitting the SAME endpoint, and the definitions one read `data?.formats` —
  // but GET /tournament-formats returns a bare array, so that was always
  // undefined and formatDefinitions was permanently []. That is the second,
  // independent reason the rules editor rendered nothing, on top of the missing
  // configFields catalog (plan 4.3 / 7.9): fixing only one would not have
  // brought the panel back.
  const fetchFormats = async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.BASE);
    if (res.ok) {
      const data = await safeJson(res);
      const list = Array.isArray(data) ? data : [];
      setFormats(list);
      setFormatDefinitions(list);
    }
  };

  const fetchFormatDefinitions = fetchFormats;

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!silent) {
        const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
        if (!meRes.ok) { router.push("/auth"); return; }
        const me = await safeJson(meRes);
        if (!me?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER")) { router.push("/tournaments"); return; }

        // /auth/registered-users is ADMIN-only, so every non-admin organizer got a 403
        // here and the picker below stayed empty. /auth/users is ORGANIZER|ADMIN; it
        // includes guests, so they are filtered out to keep the same meaning.
        const usersRes = await authenticatedFetch(API_ENDPOINTS.AUTH.USERS);
        if (usersRes.ok) {
          const everyone = (await safeJson(usersRes)) ?? [];
          setAllUsers(everyone.filter((u: { isGuest?: boolean }) => !u.isGuest));
        }

        await fetchFormats();
      }

      const tRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE(tournamentId!));
      if (tRes.ok) {
        const t = await safeJson(tRes);
        // The role check above only proves they are an organizer at all. This is
        // the real gate: holding ORGANIZER does not grant rights over somebody
        // else's tournament, and every endpoint on this page would reject them.
        if (t && t.canManage === false) {
          toast("You do not have permission to manage this tournament", "error");
          router.push("/tournaments");
          return;
        }
        setTournament(t);
        setLastUpdated(new Date());
        if (!silent) {
          setEditState({
            name: t.name,
            description: t.description || "",
            formatId: t.formatId || "",
            maxPlayers: t.maxPlayers,
            prizePool: t.prizePool || "",
            isPrivate: t.isPrivate || false,
            slug: t.slug || "",
          });
          setFormatConfig(getRawTournamentConfig(t));
        }
      } else if (!silent) { toast("Tournament not found", "error"); }
    } catch {
      if (!silent) toast("Failed to load data", "error");
    }
    finally { 
      if (!silent) setLoading(false); 
    }
  };

  const handleUpdateTournament = async (e?: React.FormEvent) => {
    e?.preventDefault();

    try {
      // Rule edits are stored on the tournament itself, never on the shared preset
      const currentConfig = getRawTournamentConfig(tournament);
      const hasConfigChanges = JSON.stringify(formatConfig) !== JSON.stringify(currentConfig);
      const formatChanged = !!editState.formatId && editState.formatId !== tournament?.formatId;

      const body: any = {
        name: editState.name,
        description: editState.description || undefined,
        formatId: editState.formatId,
        maxPlayers: Number(editState.maxPlayers),
        prizePool: editState.prizePool.trim() || null,
        isPrivate: editState.isPrivate,
        // The invite-link name is normalized to the allowed characters
        // (lowercase letters, numbers, dashes) before sending, so typing
        // "Summer Cup" simply becomes "summer-cup" instead of a 400 error.
        // An empty string tells the backend to remove the custom name.
        slug: editState.slug
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40),
      };
      if (hasConfigChanges) {
        body.config = formatConfig;
      } else if (formatChanged) {
        // Switching presets without editing rules: clear the override so the new preset applies
        body.config = null;
      }

      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE(tournamentId!), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast("Tournament settings and rules successfully saved", "success");
        setIsEditing(false);
        setIsEditingRules(false);
        fetchData();
      } else {
        const data = await safeJson(res);
        toast(data?.message || "Update failed", "error");
      }
    } catch (err: any) {
      toast(err.message || "An error occurred during update", "error");
    }
  };

  const handleAddGuest = async () => {
    if (isAddingGuest) return;
    const requestedName = guestUsername.trim();
    if (!requestedName || !tournament || tournament.participants.length >= tournament.maxPlayers) {
      toast("Tournament at maximum capacity", "error"); return;
    }
    const existingGuest = tournament.participants.find(
      (participant) => participant.user.isGuest &&
        participant.user.username.trim().toLocaleLowerCase() === requestedName.toLocaleLowerCase(),
    );
    if (existingGuest) {
      toast(`${existingGuest.user.username} is already on this roster`, "error");
      return;
    }
    setIsAddingGuest(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN_GUEST(tournamentId!), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: requestedName }),
      });
      const data = await safeJson(res);
      if (res.ok) { 
        toast("Guest registered", "success"); 
        setGuestUsername(""); 
        setIsGuestModalOpen(false); 
        fetchData(); 
      }
      else { toast(data?.message || "Guest registration failed", "error"); }
    } finally {
      setIsAddingGuest(false);
    }
  };

  const handleBatchAddGuests = async () => {
    if (!tournament || !batchGuestCount || Number(batchGuestCount) <= 0) return;
    const countToAdd = Math.min(Number(batchGuestCount), tournament.maxPlayers - tournament.participants.length);
    if (countToAdd <= 0) { toast("Tournament at maximum capacity", "error"); return; }
    setBatchLoading(true);
    // Generate all the names up front so they are distinct from one another and
    // from the players already on the roster — independent random draws could
    // otherwise hand two guests the same "Adjective Animal" pair.
    const existingNames = tournament.participants.map((p) => p.user.username);
    const names = uniqueGuestNames(countToAdd, existingNames);
    let added = 0;
    for (let i = 0; i < countToAdd; i++) {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN_GUEST(tournamentId!), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: names[i] }),
      });
      if (res.ok) added++;
    }
    setBatchLoading(false);
    setBatchGuestCount("");
    toast(`${added} guest(s) added`, added > 0 ? "success" : "error");
    await fetchData();
  };

  const handleReorder = async (activeUserId: string, newIndex: number) => {
    if (!tournament) return;
    const oldIndex = tournament.participants.findIndex(p => p.userId === activeUserId);
    if (oldIndex === -1 || oldIndex === newIndex) return;

    // Optimistic UI update could go here, but for simplicity we'll just wait for the backend
    setLoading(true);

    const newParticipants = [...tournament.participants];
    const [moved] = newParticipants.splice(oldIndex, 1);
    newParticipants.splice(newIndex, 0, moved);

    // Update all seeds from 1 to N
    try {
      for (let i = 0; i < newParticipants.length; i++) {
        const p = newParticipants[i];
        if (p.seed !== i + 1) {
          await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.UPDATE_SEED(tournamentId!, p.userId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seed: i + 1 }),
          });
        }
      }
      await fetchData();
    } catch (e) {
      toast("Failed to reorder roster", "error");
    } finally {
      setLoading(false);
    }
  };
  // Manual-seeding convenience: assign a fresh random seed order to the current
  // roster, then let the organizer hand-tweak by dragging. Reuses UPDATE_SEED —
  // the same path handleReorder writes — so there is no new contract. Only
  // meaningful under manual seeding (a random-draw tournament re-randomizes at
  // start regardless); the button that calls this is gated accordingly.
  const handleShuffleSeeds = async () => {
    if (!tournament || tournament.participants.length < 2) return;
    setLoading(true);
    // Fisher–Yates over the participant ids, then write seeds 1..N in that order.
    const order = tournament.participants.map(p => p.userId);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    try {
      for (let i = 0; i < order.length; i++) {
        await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.UPDATE_SEED(tournamentId!, order[i]), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seed: i + 1 }),
        });
      }
      await fetchData();
      toast("Roster order randomized", "success");
    } catch {
      toast("Failed to randomize roster", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEAVE(tournamentId!), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      toast("Participant removed", "success");
      fetchData();
    } else {
      const data = await safeJson(res);
      toast(data?.message || "Removal failed", "error");
    }
  };

  // Forfeit removes a player from a live tournament (their opponents win by
  // walkover and the bracket advances); replace swaps a substitute into a slot
  // the player has not yet played from. Both run directly with a per-row busy
  // state instead of a confirmation dialog, and the realtime emit on the backend
  // refreshes every other open view.
  const handleForfeit = async (userId: string) => {
    if (actingOn) return;
    setActingOn(userId);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.FORFEIT(tournamentId!, userId), { method: "POST" });
      if (res.ok) { toast("Player forfeited", "success"); await fetchData(true); }
      else { const d = await safeJson(res); toast(d?.message || "Could not forfeit player", "error"); }
    } finally {
      setActingOn(null);
    }
  };

  const handleReplace = async (userId: string, body: { substituteUserId?: string; guestName?: string }) => {
    if (actingOn) return;
    setActingOn(userId);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.REPLACE(tournamentId!, userId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { toast("Player replaced", "success"); await fetchData(true); }
      else { const d = await safeJson(res); toast(d?.message || "Could not replace player", "error"); }
    } finally {
      setActingOn(null);
    }
  };

  const handleOpenRegistration = async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.UPDATE_STATUS(tournamentId!), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "OPEN" }),
    });
    if (res.ok) { toast("Registration opened", "success"); fetchData(); }
    else { const d = await safeJson(res); toast(d?.message || "Failed to open registration", "error"); }
  };

  // The actual start call. Split from the gate below so the confirm modal can
  // trigger it directly, bypassing the odd-field check the organizer has just
  // acknowledged.
  const doStartTournament = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setOddWarning(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.START(tournamentId!), { method: "POST" });
      if (res.ok) { toast("Tournament started", "success"); fetchData(); }
      else { const d = await safeJson(res); toast(d?.message || "Failed to start tournament", "error"); }
    } finally {
      setIsStarting(false);
    }
  };

  // Gate: warn before starting any field that hands out byes — an odd points
  // system (one player unpaired every round) or an elimination bracket that is not
  // a power of two (first-round byes). byeWarningFor decides which; the wording
  // reflects the kind, and for points systems how the format scores a bye.
  const handleStartTournament = () => {
    if (isStarting) return;
    const count = tournament?.participants?.length ?? 0;
    const sys = typeof tournament?.format === "string" ? tournament.format : tournament?.format?.system;
    const warning = byeWarningFor(sys, count);
    if (warning) {
      const byeResult = String((ruleView(formatConfig) as any)?.byeResult ?? "WIN");
      setOddWarning({ warning, byeResult });
      return;
    }
    void doStartTournament();
  };

  const handleSaveRules = async () => {
    setLoading(true);
    await handleUpdateTournament();
    setLoading(false);
  };

  // Renders the console's own chrome immediately and skeletons only where the
  // data goes, instead of hiding the whole screen behind a spinner. The back
  // button in particular has to be reachable during a slow load — otherwise an
  // organizer on bad Wi-Fi has no way out of this page but the browser's own
  // back control.
  if (loading) return (
    <div className="min-h-screen w-full bg-background font-sans overflow-x-hidden text-[#E0E0E0]">
      <div className="w-full px-4 md:px-8 py-8 max-w-[1600px] mx-auto">
        <SkeletonStatus label="Loading tournament management" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 pb-6 border-b border-white/20">
          <div className="space-y-4">
            <button
              onClick={() => router.push("/tournaments/manage")}
              className="text-xs text-[#888888] hover:text-white transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              Back to Dashboard
            </button>
            <div className="space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 flex flex-col gap-6">
            <SkeletonPanel rows={6} />
            <SkeletonPanel rows={3} />
          </div>
          <div className="lg:col-span-8 flex flex-col gap-6">
            <SkeletonPanel rows={4} />
            <SkeletonPanel rows={5} />
          </div>
        </div>
      </div>
    </div>
  );

  if (!tournament) return (
    <div className="min-h-screen flex items-center justify-center text-white/50 bg-background font-sans text-sm">Tournament Not Found</div>
  );

  const system = typeof tournament.format === "string"
    ? tournament.format
    : tournament.format?.system;

  // Three tabs, not eight stacked panels (docs/tournament-views-plan.md §4).
  // Rounds is the default once a tournament is running, because entering a
  // result is the only reason to open this page mid-event — it used to be
  // fifth down a single scroll, under the roster and two placeholder images.
  const tabParam = searchParams.get("tab") as ManageTab | null;
  const running = tournament.status === "ONGOING";
  // Rounds exist from the moment a tournament starts and outlive it. Keying
  // this tab off ONGOING alone meant a COMPLETED tournament showed the
  // *pre-start seeding roster* — offering to shuffle seeds, remove entrants and
  // forfeit players on an event that had already finished — and gave no way to
  // see the results at all. Same mistake the Bracket tab made with
  // `BracketPreview`; same fix: branch on whether rounds exist.
  const hasRounds = ((tournament as unknown as { rounds?: unknown[] }).rounds ?? []).length > 0;
  const manageTab: ManageTab = MANAGE_TABS.includes(tabParam as ManageTab)
    ? (tabParam as ManageTab)
    : hasRounds
      ? "rounds"
      : "players";
  const setManageTab = (tab: ManageTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen w-full bg-background font-sans overflow-x-hidden text-[#E0E0E0]">
      {oddWarning && (
        <OddFieldStartModal
          warning={oddWarning.warning}
          byeResult={oddWarning.byeResult}
          isStarting={isStarting}
          onCancel={() => setOddWarning(null)}
          onConfirm={() => void doStartTournament()}
        />
      )}
      {isGuestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="bg-[#1B1B1B] border border-white/20 rounded max-w-md w-full p-6 space-y-4 shadow-[0_0_40px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-semibold text-white mb-4">Add Guest Participant</h3>
            <input
              autoFocus
              placeholder="Guest Username"
              value={guestUsername}
              onChange={e => setGuestUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddGuest()}
              className="h-10 bg-background border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-primary transition-colors rounded w-full"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsGuestModalOpen(false)}
                disabled={isAddingGuest}
                className="flex-1 h-10 text-xs font-semibold border border-white/20 text-[#B0B0B0] hover:text-white transition-colors rounded disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGuest}
                disabled={isAddingGuest || !guestUsername.trim()}
                className="flex-1 h-10 text-xs font-semibold bg-primary text-black rounded hover:brightness-90 transition-colors disabled:opacity-50"
              >
                {isAddingGuest ? "Adding…" : "Add Guest"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isInviteModalOpen && tournament && (
        <InvitePlayerModal
          tournament={tournament}
          tournamentId={tournamentId!}
          onClose={() => setIsInviteModalOpen(false)}
          onInvited={fetchData}
        />
      )}
      <div className="w-full px-4 md:px-8 py-8 max-w-[1600px] mx-auto">
        <ControlRoomHeader
          tournament={tournament}
          tournamentId={tournamentId!}
          onBack={() => router.push("/tournaments/manage")}
          onViewBracket={() => router.push(`/tournaments/${tournamentId}?tab=bracket`)}
          onOpenTournament={handleOpenRegistration}
          onStartTournament={handleStartTournament}
          onAddGuest={() => setIsGuestModalOpen(true)}
          onInvitePlayer={() => setIsInviteModalOpen(true)}
          onRefresh={fetchData}
          connected={connected}
          lastUpdated={lastUpdated}
          onCompleteTournament={
            tournament.status === "ONGOING" &&
            hasRounds &&
            (tournament.rounds ?? []).every((r) =>
              (r.matches ?? []).length > 0 && (r.matches ?? []).every((m) => m.status === "COMPLETED"),
            )
              ? async () => {
                  try {
                    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.COMPLETE(tournamentId!), {
                      method: "PATCH",
                    });
                    const data = await safeJson(res);
                    if (res.ok) {
                      toast("Tournament completed", "success");
                      await fetchData();
                    } else {
                      toast(data?.message || "Failed to complete tournament", "error");
                    }
                  } catch {
                    toast("Error completing tournament", "error");
                  }
                }
              : undefined
          }
        />

        <TournamentCompletionBanner
          tournament={tournament}
          onViewResults={() => setManageTab("rounds")}
          onUpdated={() => fetchData(true)}
        />

        {/* Builds only appears when the tournament actually asks for builds —
            an empty review panel is not a destination. */}
        <div className="flex flex-wrap gap-1 border-b border-white/10 mt-6 mb-6">
          {(
            [
              ["rounds", hasRounds ? "Rounds" : "Seeding"],
              ["players", `Players · ${tournament.participants.length}`],
              ["settings", "Settings"],
              ...(tournament.buildsRequired
                ? ([["builds", "Builds"]] as [ManageTab, string][])
                : []),
            ] as [ManageTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setManageTab(id)}
              aria-current={manageTab === id ? "page" : undefined}
              className={`px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] border-b-2 transition-colors ${
                manageTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-white/45 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {manageTab === "rounds" && (
          <div className="flex flex-col gap-6">
            {hasRounds ? (
              <>
                {/* The normal path: a card per match, each opening the scoring
                    drawer. Recording a result is a per-match job. */}
                {/* Read-only once the tournament is over: the placements and
                    leaderboard points are already awarded, so re-scoring a
                    settled match would silently disagree with them. Seeing what
                    happened is the job here. */}
                <PairingsView
                  tournament={tournament}
                  currentUserId={currentUser?.sub || currentUser?.id}
                  canManage={running}
                  debugMode={debugMode}
                  onRefresh={() => fetchData(true)}
                />

                {/* Round Control is bulk machinery — coin tosses and
                    force-resolve — so it sits behind the same debug flag the
                    bracket page used for its shortcuts, not in front of the
                    organiser who just wants to record a score. */}
                {debugMode && running && (
                  <div>
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#e8c53d] mb-3">
                      Round control · debug mode
                    </h2>
                    <RoundControlPanel
                      tournament={tournament}
                      fetchData={fetchData}
                      setMessage={toast}
                    />
                  </div>
                )}
              </>
            ) : (
              <RosterPanel
                tournament={tournament}
                allUsers={allUsers}
                onReorder={handleReorder}
                onShuffle={handleShuffleSeeds}
                onRemove={handleRemoveParticipant}
                onForfeit={handleForfeit}
                onReplace={handleReplace}
                actingOn={actingOn}
              />
            )}
          </div>
        )}

        {manageTab === "settings" && (
          <div className="flex flex-col gap-3 max-w-4xl">
            <ManageSection
              title="Format and rules"
              summary={system ?? undefined}
              defaultOpen
            >
              <FormatRulesPanel
                tournament={tournament}
                formatDefinitions={formatDefinitions}
                isEditing={isEditingRules}
                formatConfig={ruleView(formatConfig)}
                onToggleEdit={() => setIsEditingRules(true)}
                onDiscard={() => { setIsEditingRules(false); setFormatConfig(getRawTournamentConfig(tournament)); }}
                onRuleChange={(k, v) => setFormatConfig(p => writeRuleValue(p, k, v))}
                onSave={handleSaveRules}
              />
            </ManageSection>

            <ManageSection title="Details" summary="Name, date, venue, prize, artwork">
              <SpecsPanel
                tournament={tournament}
                tournamentId={tournamentId!}
                isEditing={isEditing}
                editState={editState}
                formatOptions={formats}
                onToggleEdit={() => setIsEditing(v => !v)}
                onEditChange={(field, value) => setEditState(prev => ({ ...prev, [field]: value }))}
                onSubmit={handleUpdateTournament}
                onOpenRegistration={handleOpenRegistration}
                onStartTournament={handleStartTournament}
                fetchData={fetchData}
                setMessage={toast}
              />
            </ManageSection>

            <ManageSection title="Co-organisers" summary="Who else can run this">
              <StaffPanel
                tournamentId={tournamentId!}
                isCreator={
                  !!tournament.createdById &&
                  tournament.createdById === (currentUser?.sub || currentUser?.id)
                }
              />
            </ManageSection>

            <ManageSection title="Delete this tournament" tone="danger">
              <DeleteTournamentPanel
                tournamentId={tournamentId!}
                name={tournament.name}
                status={tournament.status}
                participants={tournament.participants?.length ?? 0}
                onMessage={toast}
              />
            </ManageSection>
          </div>
        )}

        {manageTab === "builds" && (
          <BuildsReviewPanel
            tournamentId={tournamentId!}
            status={tournament.status}
            refreshKey={`${tournament.status}:${tournament.participants.map(p => `${p.userId}/${p.status}`).join(",")}`}
            setMessage={toast}
          />
        )}

        <div className={manageTab === "players" ? "flex flex-col gap-6" : "hidden"}>
          <RosterPanel
            tournament={tournament}
            allUsers={allUsers}
            onReorder={handleReorder}
            onShuffle={handleShuffleSeeds}
            onRemove={handleRemoveParticipant}
            onForfeit={handleForfeit}
            onReplace={handleReplace}
            actingOn={actingOn}
          />

          {/* Bulk guest creation is the one add-control that has no header
              entry point. A single guest is the header's Add Guest modal and a
              registered player is the header's Invite Player button, so they
              are deliberately not duplicated here. */}
          <AddParticipantsPanel
            tournament={tournament}
            batchGuestCount={batchGuestCount}
            setBatchGuestCount={setBatchGuestCount}
            onBatchAddGuests={handleBatchAddGuests}
            batchLoading={batchLoading}
          />
        </div>
      </div>
    </div>
  );
}

export default function ControlRoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-background flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-white/10 border-t-white/50 rounded-full animate-spin" />
          <p className="text-sm text-white/50">Loading Dashboard...</p>
        </div>
      </div>
    }>
      <ControlRoomContent />
    </Suspense>
  );
}
