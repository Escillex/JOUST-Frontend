"use client";
import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { usePolling } from "../../../utils/usePolling";
import { getRawTournamentConfig } from "../../../utils/formatConfig";
import { Tournament, FormatConfig } from "../../types";
import ControlRoomHeader from "../../../components/tournaments/manage/ControlRoomHeader";
import RosterPanel from "../../../components/tournaments/manage/RosterPanel";
import SpecsPanel from "../../../components/tournaments/manage/SpecsPanel";
import FormatRulesPanel from "../../../components/tournaments/manage/FormatRulesPanel";
import DeploymentPanel from "../../../components/tournaments/manage/DeploymentPanel";
import RoundControlPanel from "../../../components/tournaments/manage/RoundControlPanel";

const randomGuestName = () => `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

function ControlRoomContent() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [allUsers, setAllUsers]     = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [message, setMessage]       = useState("");

  const [isEditing, setIsEditing]           = useState(false);
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [formatConfig, setFormatConfig]     = useState<FormatConfig>({});
  const [formatDefinitions, setFormatDefinitions] = useState<any[]>([]);
  const [formats, setFormats] = useState<any[]>([]);
  const [editState, setEditState] = useState({ name: "", description: "", formatId: "", maxPlayers: 0, prizePool: "" as number | "", isPrivate: false });

  const [guestUsername, setGuestUsername]     = useState("");
  const [batchGuestCount, setBatchGuestCount] = useState<number | "">("");
  const [selectedUserId, setSelectedUserId]   = useState("");
  const [batchLoading, setBatchLoading]       = useState(false);
  const [isStarting, setIsStarting]           = useState(false);
  const [isAddingGuest, setIsAddingGuest]     = useState(false);
  const [isInviting, setIsInviting]           = useState(false);

  useEffect(() => {
    if (!tournamentId) { router.push("/tournaments/manage"); return; }
    fetchData();
    fetchFormatDefinitions();
  }, [tournamentId]);

  // temporary polling block
  // Background refresh through the shared usePolling hook: it pauses
  // while the tab is hidden and stops entirely once the tournament is
  // COMPLETED (a finished tournament's data no longer changes, so
  // polling it was wasted traffic).
  usePolling(
    () => fetchData(true),
    10000,
    !!tournament && tournament.status !== "COMPLETED",
  );
  // end of temporary polling block

  useEffect(() => {
    if (tournament?.name) {
      document.title = `Joust | ${tournament.name}`;
    }
  }, [tournament?.name]);

  const fetchFormatDefinitions = async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.BASE);
    if (res.ok) { const data = await safeJson(res); setFormatDefinitions(data?.formats ?? []); }
  };

  const fetchFormats = async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.BASE);
    if (res.ok) { const data = await safeJson(res); setFormats(data ?? []); }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!silent) {
        const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
        if (!meRes.ok) { router.push("/auth"); return; }
        const me = await safeJson(meRes);
        if (!me?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER")) { router.push("/tournaments"); return; }

        const usersRes = await authenticatedFetch(API_ENDPOINTS.AUTH.REGISTERED_USERS);
        if (usersRes.ok) setAllUsers(await safeJson(usersRes) ?? []);

        await fetchFormats();
      }

      const tRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE(tournamentId!));
      if (tRes.ok) {
        const t = await safeJson(tRes);
        setTournament(t);
        if (!silent) {
          setEditState({
            name: t.name,
            description: t.description || "",
            formatId: t.formatId || "",
            maxPlayers: t.maxPlayers,
            prizePool: t.prizePool || "",
            isPrivate: t.isPrivate || false,
          });
          setFormatConfig(getRawTournamentConfig(t));
        }
      } else if (!silent) { setMessage("Tournament not found"); }
    } catch { 
      if (!silent) setMessage("Failed to load data"); 
    }
    finally { 
      if (!silent) setLoading(false); 
    }
  };

  const handleUpdateTournament = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage("Saving changes...");

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
        prizePool: editState.prizePool === "" ? null : Number(editState.prizePool),
        isPrivate: editState.isPrivate,
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
        setMessage("Tournament settings and rules successfully saved!");
        setIsEditing(false);
        setIsEditingRules(false);
        fetchData();
      } else {
        const data = await safeJson(res);
        setMessage(data?.message || "Update failed");
      }
    } catch (err: any) {
      setMessage(err.message || "An error occurred during update");
    }
  };

  const handleAddGuest = async () => {
    if (isAddingGuest) return;
    if (!guestUsername || !tournament || tournament.participants.length >= tournament.maxPlayers) {
      setMessage("Tournament at maximum capacity"); return;
    }
    setIsAddingGuest(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN_GUEST(tournamentId!), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: guestUsername }),
      });
      const data = await safeJson(res);
      if (res.ok) { setMessage("Guest Registered"); setGuestUsername(""); fetchData(); }
      else { setMessage(data?.message || "Guest failed"); }
    } finally {
      setIsAddingGuest(false);
    }
  };

  const handleBatchAddGuests = async () => {
    if (!tournament || !batchGuestCount || Number(batchGuestCount) <= 0) return;
    const countToAdd = Math.min(Number(batchGuestCount), tournament.maxPlayers - tournament.participants.length);
    if (countToAdd <= 0) { setMessage("Tournament at maximum capacity"); return; }
    setBatchLoading(true);
    setMessage(`Generating ${countToAdd} guest(s)...`);
    let added = 0;
    for (let i = 0; i < countToAdd; i++) {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN_GUEST(tournamentId!), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: randomGuestName() }),
      });
      if (res.ok) added++;
    }
    setBatchLoading(false);
    setBatchGuestCount("");
    setMessage(`${added} guest(s) added successfully.`);
    await fetchData();
  };

  const handleJoin = async (userId: string) => {
    if (isInviting) return;
    setIsInviting(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.JOIN(tournamentId!), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }),
      });
      const data = await safeJson(res);
      if (res.ok) { setMessage("Participant Registered"); fetchData(); }
      else { setMessage(data?.message || "Registration failed"); }
    } finally {
      setIsInviting(false);
    }
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
      setMessage("Failed to reorder roster");
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
      setMessage("Participant Removed");
      fetchData();
    } else {
      const data = await safeJson(res);
      setMessage(data?.message || "Removal failed");
    }
  };

  const handleOpenRegistration = async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.UPDATE_STATUS(tournamentId!), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "OPEN" }),
    });
    if (res.ok) { setMessage("Registration opened!"); fetchData(); }
    else { const d = await safeJson(res); setMessage(d?.message || "Failed to open registration"); }
  };

  const handleStartTournament = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.START(tournamentId!), { method: "POST" });
      if (res.ok) { setMessage("Tournament started!"); fetchData(); }
      else { const d = await safeJson(res); setMessage(d?.message || "Failed to start tournament"); }
    } finally {
      setIsStarting(false);
    }
  };

  const handleSaveRules = async () => {
    setLoading(true);
    await handleUpdateTournament();
    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen w-full bg-[#1B1B1B] flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-white/10 border-t-white/50 rounded-full animate-spin" />
        <p className="text-sm text-white/50">Loading Dashboard...</p>
      </div>
    </div>
  );

  if (!tournament) return (
    <div className="min-h-screen flex items-center justify-center text-white/50 bg-[#1B1B1B] font-sans text-sm">Tournament Not Found</div>
  );

  const system = typeof tournament.format === "string"
    ? tournament.format
    : tournament.format?.system;

  return (
    <div className="min-h-screen w-full bg-[#1B1B1B] font-sans overflow-x-hidden text-[#E0E0E0]">
      <div className="w-full px-4 md:px-8 py-8 max-w-[1600px] mx-auto">
        <ControlRoomHeader
          tournament={tournament}
          tournamentId={tournamentId!}
          onBack={() => router.push("/tournaments/manage")}
          onViewBracket={() => router.push(`/tournaments/${tournamentId}/bracket`)}
          onOpenTournament={handleOpenRegistration}
          onStartTournament={handleStartTournament}
          onRefresh={fetchData}
        />

        {message && (
          <div className="mb-6 p-3 bg-[#000000] border border-white/20 rounded-[4px] text-white text-center text-sm font-semibold animate-in fade-in slide-in-from-top-2">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <RosterPanel 
            tournament={tournament} 
            onReorder={handleReorder} 
            onRemove={handleRemoveParticipant} 
          />

          <div className="lg:col-span-4 space-y-6">
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
              setMessage={setMessage}
            />
            <FormatRulesPanel
              tournament={tournament}
              formatDefinitions={formatDefinitions}
              isEditing={isEditingRules}
              formatConfig={formatConfig}
              onToggleEdit={() => setIsEditingRules(true)}
              onDiscard={() => { setIsEditingRules(false); setFormatConfig(getRawTournamentConfig(tournament)); }}
              onRuleChange={(k, v) => setFormatConfig(p => ({ ...p, [k]: v }))}
              onSave={handleSaveRules}
            />
            {tournament.status === "ONGOING" && (system === "SWISS" || system === "ROUND_ROBIN") && (
              <RoundControlPanel
                tournament={tournament}
                fetchData={fetchData}
                setMessage={setMessage}
              />
            )}
            <DeploymentPanel
              tournament={tournament}
              allUsers={allUsers}
              guestUsername={guestUsername}
              setGuestUsername={setGuestUsername}
              batchGuestCount={batchGuestCount}
              setBatchGuestCount={setBatchGuestCount}
              selectedUserId={selectedUserId}
              setSelectedUserId={setSelectedUserId}
              onAddGuest={handleAddGuest}
              onBatchAddGuests={handleBatchAddGuests}
              onInvitePlayer={() => selectedUserId && handleJoin(selectedUserId)}
              batchLoading={batchLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ControlRoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-[#1B1B1B] flex items-center justify-center font-sans">
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