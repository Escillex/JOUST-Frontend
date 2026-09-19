"use client";
import { useState, useEffect, useMemo } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { TournamentFormat } from "../../tournaments/types";

interface Template {
  id: string;
  name: string;
  description?: string;
  system: TournamentFormat;
  config: any;
  isBuiltin: boolean;
  /** DEPRECATED column. Kept only to label legacy rows honestly. */
  gameName?: string;
  /** The real relation — every /tournament-formats read already includes it. */
  game?: { id: string; name: string } | null;
  createdAt: string;
}

export default function PresetManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState<TournamentFormat>("SINGLE_ELIMINATION");
  const [gameId, setGameId] = useState("");
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editGameValue, setEditGameValue] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<{ id: string, step: number } | null>(null);

  // Config fields
  const [bestOf, setBestOf] = useState(1);
  const [allowDraw, setAllowDraw] = useState(false);
  // How the field is placed into the bracket. RANDOM draws the field at random,
  // which is what an event does unless the organizer has deliberately arranged
  // the order; MANUAL honours the seed order set on the roster before start.
  const [seedingMode, setSeedingMode] = useState<"RANDOM" | "MANUAL">("RANDOM");
  const [swissRounds, setSwissRounds] = useState(3);
  const [swissRoundsMode, setSwissRoundsMode] = useState<"AUTO" | "MANUAL">("MANUAL");
  const [swissPointsWin, setSwissPointsWin] = useState(3);
  const [swissPointsDraw, setSwissPointsDraw] = useState(1);
  const [swissPointsLoss, setSwissPointsLoss] = useState(0);
  const [topCutSize, setTopCutSize] = useState(8);
  const [phase2BestOf, setPhase2BestOf] = useState(3);
  const [hybridRoundsMode, setHybridRoundsMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [pointsThreshold, setPointsThreshold] = useState(0);
  const [startingHp, setStartingHp] = useState(0);

  // Niche / Advanced Rules
  const [tieBreakerOrder, setTieBreakerOrder] = useState("");
  const [scoreSubmissionRule, setScoreSubmissionRule] = useState("SELF_REPORT_ALLOWED");
  const [utilitiesEnabled, setUtilitiesEnabled] = useState(true);
  const [utilityCoinWho, setUtilityCoinWho] = useState("STAFF_AND_PARTICIPANTS");
  const [utilityDiceWho, setUtilityDiceWho] = useState("STAFF_AND_PARTICIPANTS");
  const [utilityTimerWho, setUtilityTimerWho] = useState("STAFF");

  const currentTiebreakers = tieBreakerOrder.split(',').map(s => s.trim()).filter(Boolean);
  const toggleTiebreaker = (val: string) => {
    let newTiebreakers = [...currentTiebreakers];
    if (newTiebreakers.includes(val)) {
      newTiebreakers = newTiebreakers.filter(t => t !== val);
    } else {
      newTiebreakers.push(val);
    }
    setTieBreakerOrder(newTiebreakers.join(', '));
  };
  
  const TIEBREAKER_OPTIONS = [
    { value: "omw", label: "Opponents' Match Win % (OMW)" },
    { value: "gw", label: "Game Win % (GW)" },
    { value: "oomw", label: "Opponents' Opponents (OOMW)" },
    { value: "ogw", label: "Opponents' Game Win % (OGW)" },
    { value: "matchWinPct", label: "Match Win %" },
    { value: "wins", label: "Total Wins" },
    { value: "losses", label: "Total Losses" }
  ];

  // Placement points
  const [placementChampion, setPlacementChampion] = useState(10);
  const [placement2nd, setPlacement2nd] = useState(7);
  const [placement3rd, setPlacement3rd] = useState(5);
  const [placementTopCut, setPlacementTopCut] = useState(3);
  const [placementParticipation, setPlacementParticipation] = useState(1);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.BASE);
      if (res.ok) {
        const data = await safeJson(res);
        setTemplates(data || []);
      }
    } catch (err) {
      setError("Failed to load presets");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name) return setError("Name is required");

    const isHybrid = system === "HYBRID";
    const resolvedSwissRounds =
      isHybrid
        ? (hybridRoundsMode === "AUTO" ? null : Math.max(1, swissRounds))
        : (system === "SWISS" ? (swissRoundsMode === "AUTO" ? null : Math.max(1, swissRounds)) : null);

    const baseRules: Record<string, any> = {
      bestOf,
      allowDraw,
      swissRounds: resolvedSwissRounds,
      swissPointsForWin: swissPointsWin,
      swissPointsForDraw: swissPointsDraw,
      swissPointsForLoss: swissPointsLoss,
      pointsThreshold,
      startingHp,
      tieBreakerOrder: tieBreakerOrder || null,
      scoreSubmissionRule,
      utilitiesEnabled,
      utilityCoinWho,
      utilityDiceWho,
      utilityTimerWho,
      placementPointsChampion: placementChampion,
      placementPoints2nd: placement2nd,
      placementPoints3rd: placement3rd,
      placementPointsTopCut: placementTopCut,
      placementPointsParticipation: placementParticipation,
    };

    const config = isHybrid
      ? {
          ...baseRules,
          seedingMode,
          phase1: baseRules,
          phase2: {
            ...baseRules,
            topCutSize: Math.max(2, topCutSize),
            bestOf: phase2BestOf,
          },
        }
      : {
          ...baseRules,
          seedingMode,
        };

    try {
      const isUpdating = !!editingPresetId;
      const url = isUpdating ? API_ENDPOINTS.PRESETS.DETAILS(editingPresetId) : API_ENDPOINTS.PRESETS.BASE;
      const method = isUpdating ? "PATCH" : "POST";
      const res = await authenticatedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          system,
          config,
          gameId: gameId || null,
        })
      });

      if (res.ok) {
        setIsCreating(false);
        resetForm();
        fetchTemplates();
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Creation failed");
      }
    } catch (err) {
      setError("Network error while saving preset");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    setDeletingId(id);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.DELETE(id), {
        method: "DELETE"
      });
      if (res.ok) {
        fetchTemplates();
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Failed to delete preset");
      }
    } catch (err) {
      setError("Failed to delete preset");
    } finally {
      setDeletingId(null);
      setDeleteState(null);
    }
  };

  const handleUpdateGame = async (id: string) => {
    setError("");
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.DETAILS(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: editGameValue || null }),
      });
      if (res.ok) {
        setEditingGameId(null);
        fetchTemplates();
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Could not change the game");
      }
    } catch (err) {
      setError("Could not reach the server.");
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSystem("SINGLE_ELIMINATION");
    setGameId("");
    setBestOf(1);
    setAllowDraw(false);
    setSeedingMode("RANDOM");
    setSwissRounds(3);
    setSwissRoundsMode("MANUAL");
    setSwissPointsWin(3);
    setSwissPointsDraw(1);
    setSwissPointsLoss(0);
    setTopCutSize(8);
    setPhase2BestOf(3);
    setHybridRoundsMode("AUTO");
    setPointsThreshold(0);
    setStartingHp(0);
    setTieBreakerOrder("");
    setScoreSubmissionRule("SELF_REPORT_ALLOWED");
    setUtilitiesEnabled(true);
    setUtilityCoinWho("STAFF_AND_PARTICIPANTS");
    setUtilityDiceWho("STAFF_AND_PARTICIPANTS");
    setUtilityTimerWho("STAFF");
    setPlacementChampion(10);
    setPlacement2nd(7);
    setPlacement3rd(5);
    setPlacementTopCut(3);
    setPlacementParticipation(1);
    setError("");
    setEditingPresetId(null);
  };

  const handleEditClick = (tpl: any) => {
    setError("");
    setEditingPresetId(tpl.id);
    setName(tpl.name || "");
    setDescription(tpl.description || "");
    const sys = tpl.system || "SINGLE_ELIMINATION";
    setSystem(sys);
    setGameId(tpl.gameId || "");

    const raw = tpl.config || {};
    const isHybrid = sys === "HYBRID";
    const c = isHybrid ? (raw.phase1 ?? raw) : raw;

    setBestOf(c.bestOf ?? 1);
    setAllowDraw(c.allowDraw ?? false);
    setSeedingMode((raw.seedingMode ?? c.seedingMode) === "MANUAL" ? "MANUAL" : "RANDOM");

    const rawSwissRounds = isHybrid ? (raw.phase1?.swissRounds ?? raw.swissRounds) : raw.swissRounds;
    if (rawSwissRounds == null) {
      setSwissRounds(3);
      setHybridRoundsMode("AUTO");
      setSwissRoundsMode("AUTO");
    } else {
      setSwissRounds(Number(rawSwissRounds));
      setHybridRoundsMode("MANUAL");
      setSwissRoundsMode("MANUAL");
    }

    setSwissPointsWin(c.swissPointsForWin ?? 3);
    setSwissPointsDraw(c.swissPointsForDraw ?? 1);
    setSwissPointsLoss(c.swissPointsForLoss ?? 0);

    setTopCutSize(raw.phase2?.topCutSize ?? raw.topCutSize ?? 8);
    setPhase2BestOf(raw.phase2?.bestOf ?? c.bestOf ?? 3);

    setPointsThreshold(c.pointsThreshold ?? 0);
    setStartingHp(c.startingHp ?? 0);
    setTieBreakerOrder(c.tieBreakerOrder || "");
    setScoreSubmissionRule(c.scoreSubmissionRule || "SELF_REPORT_ALLOWED");
    setUtilitiesEnabled(c.utilitiesEnabled ?? true);
    setUtilityCoinWho(c.utilityCoinWho || "STAFF_AND_PARTICIPANTS");
    setUtilityDiceWho(c.utilityDiceWho || "STAFF_AND_PARTICIPANTS");
    setUtilityTimerWho(c.utilityTimerWho || "STAFF");
    setPlacementChampion(c.placementPointsChampion ?? 10);
    setPlacement2nd(c.placementPoints2nd ?? 7);
    setPlacement3rd(c.placementPoints3rd ?? 5);
    setPlacementTopCut(c.placementPointsTopCut ?? 3);
    setPlacementParticipation(c.placementPointsParticipation ?? 1);

    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // The options are the real Game catalog. They used to be derived from
  // `templates.map(t => t.gameName)` — the deprecated column that nothing has
  // written since games became first-class — so the list was always empty and
  // the field silently degraded to a free-text box that wrote the dead column
  // again. Same failure that made the leaderboard game tabs unreachable.
  useEffect(() => {
    authenticatedFetch(API_ENDPOINTS.GAMES.BASE)
      .then(async (r) => (r.ok ? await safeJson(r) : null))
      .then((list) => { if (Array.isArray(list)) setGames(list); })
      .catch(() => undefined);
  }, []);

  const labelCls = "text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 block";
  const deeperLabelCls = "text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 block";
  const inputCls = "w-full bg-background border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-all cursor-pointer hover:bg-white/[0.02]";

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Presets</h3>
        <button 
          onClick={() => {
            if (isCreating) resetForm();
            setIsCreating(!isCreating);
          }}
          className="px-4 py-1.5 bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
        >
          {isCreating ? "CANCEL" : "+ CREATE PRESET"}
        </button>
      </div>

      {isCreating && (
        <div className="bg-white/5 border border-white/10 p-8 space-y-8 animate-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Preset Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard 1v1" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>System Engine</label>
              <select value={system} onChange={e => setSystem(e.target.value as any)} className={inputCls}>
                <option value="SINGLE_ELIMINATION" className="bg-background text-white">Single Elimination</option>
                <option value="DOUBLE_ELIMINATION" className="bg-background text-white">Double Elimination</option>
                <option value="SWISS" className="bg-background text-white">Swiss System</option>
                <option value="ROUND_ROBIN" className="bg-background text-white">Round Robin</option>
                <option value="HYBRID" className="bg-background text-white">Top Cut (Multi-Phase)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Game</label>
              <select
                value={gameId}
                onChange={e => {
                  const newGameId = e.target.value;
                  setGameId(newGameId);
                  // Infer tracking defaults when the organizer manually selects a game
                  const g = games.find((x: any) => x.id === newGameId);
                  if (g) {
                    const trackingMode = (g as any).trackingMode;
                    const config = (g as any).defaultConfig || {};
                    if (trackingMode === "HP") {
                      setStartingHp(config.startingHp ?? 100);
                      setPointsThreshold(0);
                    } else if (trackingMode === "POINTS") {
                      setStartingHp(0);
                      setPointsThreshold(config.pointsThreshold ?? 1);
                    } else {
                      setStartingHp(0);
                      setPointsThreshold(0);
                    }
                  } else {
                    // Reset if "No game" is selected
                    setStartingHp(0);
                    setPointsThreshold(0);
                  }
                }}
                className={inputCls}
              >
                <option value="" className="bg-background text-white">No game</option>
                {games.map(g => (
                  <option key={g.id} value={g.id} className="bg-background text-white">{g.name}</option>
                ))}
              </select>
              {games.length === 0 && (
                // Creating a game from inside the preset form is how half-made
                // catalog entries happen; Catalog > Games is one tab away.
                <p className="text-[10px] text-white/60 mt-1.5 leading-relaxed">
                  No games in the catalog yet. Add one under Catalog &rsaquo; Games.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional technical details" className={inputCls} />
          </div>

          {system === "HYBRID" ? (
            /* Option B: Compact Unified Flow for Top Cut (HYBRID) */
            <div className="space-y-6 pt-4 border-t border-white/5 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/5 pb-2">
                <div className="text-[10px] font-black text-white/[0.2] uppercase tracking-[0.25em]">
                  Top Cut Structure & Rules (Multi-Phase)
                </div>
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
                  Phase 1 (Swiss) &rarr; Phase 2 (Knockout)
                </span>
              </div>

              {/* 5-Column Compact Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 p-3 sm:p-4 bg-white/[0.02] border border-white/10 rounded">
                {/* Column 1: Swiss Rounds with Auto/Manual Toggle */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={deeperLabelCls + " !mb-0 text-blue-400"}>Phase 1 Rounds</label>
                    <button
                      type="button"
                      onClick={() => setHybridRoundsMode(hybridRoundsMode === "AUTO" ? "MANUAL" : "AUTO")}
                      className="text-[9px] text-blue-400 font-bold hover:underline"
                    >
                      {hybridRoundsMode === "AUTO" ? "[Fixed]" : "[Auto]"}
                    </button>
                  </div>
                  {hybridRoundsMode === "AUTO" ? (
                    <div className="w-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono text-[10px] flex items-center justify-between px-3 py-2 rounded-[4px] h-[38px]">
                      <span>Automatic</span>
                      <span className="text-[8px] bg-blue-500/30 px-1 py-0.5 rounded font-bold">&lceil;log&sup2;N&rceil;</span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={swissRounds}
                      onChange={e => setSwissRounds(Math.max(1, Number(e.target.value)))}
                      min={1}
                      max={20}
                      className={inputCls + " font-mono border-blue-500/40"}
                    />
                  )}
                  <span className="text-[9px] text-white/40 block">
                    {hybridRoundsMode === "AUTO" ? "Calculated at start" : "Fixed round count"}
                  </span>
                </div>

                {/* Column 2: Cut Size */}
                <div className="space-y-1.5">
                  <label className={deeperLabelCls + " !mb-0 text-emerald-400"}>Cut Size</label>
                  <select
                    value={topCutSize}
                    onChange={e => setTopCutSize(Number(e.target.value))}
                    className={inputCls + " font-mono border-emerald-500/30 text-emerald-300 font-bold focus:border-emerald-400 h-[38px]"}
                  >
                    <option value={4} className="bg-background text-white">Top 4</option>
                    <option value={8} className="bg-background text-white">Top 8</option>
                    <option value={16} className="bg-background text-white">Top 16</option>
                    <option value={32} className="bg-background text-white">Top 32</option>
                  </select>
                  <span className="text-[9px] text-white/40 block">Qualifiers to playoff</span>
                </div>

                {/* Column 3: Phase 1 Best Of */}
                <div className="space-y-1.5">
                  <label className={deeperLabelCls + " !mb-0"}>Phase 1 Best Of</label>
                  <input
                    type="number"
                    value={bestOf}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (val < 1) setBestOf(1);
                      else if (val % 2 === 0) setBestOf(val + 1);
                      else setBestOf(val);
                    }}
                    min={1}
                    step={2}
                    className={inputCls + " font-mono h-[38px]"}
                  />
                  <span className="text-[9px] text-white/40 block">Swiss match series</span>
                </div>

                {/* Column 4: Phase 2 Best Of */}
                <div className="space-y-1.5">
                  <label className={deeperLabelCls + " !mb-0"}>Phase 2 Best Of</label>
                  <input
                    type="number"
                    value={phase2BestOf}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (val < 1) setPhase2BestOf(1);
                      else if (val % 2 === 0) setPhase2BestOf(val + 1);
                      else setPhase2BestOf(val);
                    }}
                    min={1}
                    step={2}
                    className={inputCls + " font-mono h-[38px]"}
                  />
                  <span className="text-[9px] text-white/40 block">Playoff match series</span>
                </div>

                {/* Column 5: Allow Draws in Swiss */}
                <div className="space-y-1.5">
                  <label className={deeperLabelCls + " !mb-0"}>Swiss Draws</label>
                  <div className="flex gap-1 h-[38px]">
                    <button
                      type="button"
                      onClick={() => setAllowDraw(true)}
                      className={`flex-1 text-[9px] font-black uppercase tracking-wider rounded border transition-all ${
                        allowDraw
                          ? "bg-white/10 text-white border-white/30"
                          : "bg-transparent text-white/40 hover:text-white border-white/5"
                      }`}
                    >
                      Permit
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowDraw(false)}
                      className={`flex-1 text-[9px] font-black uppercase tracking-wider rounded border transition-all ${
                        !allowDraw
                          ? "bg-white/10 text-white border-white/30"
                          : "bg-transparent text-white/40 hover:text-white border-white/5"
                      }`}
                    >
                      Force
                    </button>
                  </div>
                  <span className="text-[9px] text-white/40 block">Phase 1 only</span>
                </div>
              </div>

              {/* Swiss Points Scoring Weights */}
              <div className="p-4 bg-blue-500/[0.03] border border-blue-500/20 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                    Swiss Phase Scoring Weights
                  </div>
                  <span className="text-[9px] text-white/40 uppercase tracking-widest">
                    Used to rank Swiss leaderboard
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={deeperLabelCls}>Win Points</label>
                    <input
                      type="number"
                      value={swissPointsWin}
                      onChange={e => setSwissPointsWin(Math.max(0, Number(e.target.value)))}
                      min={0}
                      className={inputCls + " font-mono"}
                    />
                  </div>
                  <div>
                    <label className={deeperLabelCls}>Draw Points</label>
                    <input
                      type="number"
                      value={swissPointsDraw}
                      onChange={e => setSwissPointsDraw(Math.max(0, Number(e.target.value)))}
                      min={0}
                      className={inputCls + " font-mono"}
                    />
                  </div>
                  <div>
                    <label className={deeperLabelCls}>Loss Points</label>
                    <input
                      type="number"
                      value={swissPointsLoss}
                      onChange={e => setSwissPointsLoss(Math.max(0, Number(e.target.value)))}
                      min={0}
                      className={inputCls + " font-mono"}
                    />
                  </div>
                </div>
              </div>

              {/* Seeding & Utilities for Hybrid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className={deeperLabelCls}>Swiss Phase Seeding</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSeedingMode("RANDOM")}
                      className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                        seedingMode === "RANDOM"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background border-white/10 text-white/60 hover:text-white"
                      }`}
                    >
                      Random Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeedingMode("MANUAL")}
                      className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                        seedingMode === "MANUAL"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background border-white/10 text-white/60 hover:text-white"
                      }`}
                    >
                      Manual Seeding
                    </button>
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed">
                    {seedingMode === "RANDOM"
                      ? "Round 1 pairs players at random. Subsequent rounds pair by Swiss match points."
                      : "Round 1 honours manual seed order. Subsequent rounds pair by Swiss match points."}
                  </p>
                </div>

                <details className="group border border-white/10 rounded overflow-hidden">
                  <summary className="text-[10px] font-black text-white/60 uppercase tracking-widest bg-white/5 p-3 cursor-pointer select-none hover:text-white transition-colors flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                    <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    Advanced Utilities & Reporting
                  </summary>
                  <div className="p-4 space-y-4 bg-black/40">
                    <div>
                      <label className={deeperLabelCls}>Score Reporting</label>
                      <select value={scoreSubmissionRule} onChange={e => setScoreSubmissionRule(e.target.value)} className={inputCls}>
                        <option value="SELF_REPORT_ALLOWED" className="bg-background text-white">Players Can Self-Report</option>
                        <option value="STAFF_ONLY" className="bg-background text-white">Staff Only</option>
                      </select>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          ) : (
            /* Standard Single-Phase Form (Single Elim, Double Elim, Swiss, Round Robin) */
            <div className="space-y-6 md:space-y-8 transition-all duration-700 opacity-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 pt-4 border-t border-white/5">
                <div className="space-y-4">
                  <div className="text-[10px] font-black text-white/[0.08] uppercase tracking-widest border-b border-white/5 pb-2">Structure</div>
                  <div>
                    <label className={deeperLabelCls}>Best Of</label>
                    <input 
                      type="number" 
                      value={bestOf} 
                      onChange={e => {
                        const val = Number(e.target.value);
                        if (val < 1) {
                          setBestOf(1);
                        } else if (val % 2 === 0) {
                          setBestOf(val + 1);
                        } else {
                          setBestOf(val);
                        }
                      }} 
                      min={1}
                      step={2}
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className={deeperLabelCls}>Seeding</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSeedingMode("RANDOM")}
                        className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                          seedingMode === "RANDOM"
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        Random Draw
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeedingMode("MANUAL")}
                        className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                          seedingMode === "MANUAL"
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        Manual Seeding
                      </button>
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      {seedingMode === "RANDOM"
                        ? "The field is drawn at random when the tournament starts. Any seed order set on the roster is ignored."
                        : "The bracket follows the seed order arranged on the roster. Unseeded entrants are placed last."}
                    </p>
                  </div>
                </div>

                <details className="group border border-white/10 rounded overflow-hidden">
                  <summary className="text-[10px] font-black text-white/60 uppercase tracking-widest bg-white/5 p-3 cursor-pointer select-none hover:text-white transition-colors flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                    <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    Advanced Rules & Utilities
                  </summary>
                  
                  <div className="p-4 space-y-4 bg-black/40">
                    {/* Numeric Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-black/40 border border-white/5 p-3 rounded space-y-2">
                        <label htmlFor="enableThreshold" className="flex items-center text-[10px] font-black text-white/60 uppercase tracking-widest cursor-pointer select-none group/tt">
                          <input 
                            type="checkbox" 
                            id="enableThreshold" 
                            checked={pointsThreshold > 0} 
                            onChange={e => setPointsThreshold(e.target.checked ? 1 : 0)} 
                            className="mr-2 cursor-pointer accent-primary" 
                          />
                          Points Threshold
                          <span className="ml-2 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-white/40 text-white/60 text-[9px] cursor-help transition-colors group-hover/tt:border-white group-hover/tt:text-white" title="Match ends immediately when a player reaches this score">?</span>
                        </label>
                        {pointsThreshold > 0 && (
                          <div className="animate-in slide-in-from-top-1 duration-300">
                            <input type="number" value={pointsThreshold} onChange={e => setPointsThreshold(Math.max(1, Number(e.target.value)))} min={1} className={inputCls} />
                          </div>
                        )}
                      </div>

                      <div className="bg-black/40 border border-white/5 p-3 rounded space-y-2">
                        <label htmlFor="enableHpSystem" className="flex items-center text-[10px] font-black text-white/60 uppercase tracking-widest cursor-pointer select-none group/tt">
                          <input 
                            type="checkbox" 
                            id="enableHpSystem" 
                            checked={startingHp > 0} 
                            onChange={e => setStartingHp(e.target.checked ? 100 : 0)} 
                            className="mr-2 cursor-pointer accent-primary" 
                          />
                          HP-Based Match
                          <span className="ml-2 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-white/40 text-white/60 text-[9px] cursor-help transition-colors group-hover/tt:border-white group-hover/tt:text-white" title="Players start with HP and lose it. Match ends when a player hits 0">?</span>
                        </label>
                        {startingHp > 0 && (
                          <div className="animate-in slide-in-from-top-1 duration-300">
                            <input type="number" value={startingHp} onChange={e => setStartingHp(Math.max(1, Number(e.target.value)))} min={1} className={inputCls} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Score Submission Rule */}
                    <div className="bg-black/40 border border-white/5 p-3 rounded">
                      <label className={deeperLabelCls}>
                        Score Submission Rule
                        <span className="ml-2 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-white/40 text-white/60 text-[9px] cursor-help transition-colors hover:border-white hover:text-white" title="Determines who is allowed to submit match scores.">?</span>
                      </label>
                      <select
                        value={scoreSubmissionRule}
                        onChange={e => setScoreSubmissionRule(e.target.value)}
                        className={inputCls}
                      >
                        <option value="SELF_REPORT_ALLOWED" className="bg-background text-white">Self-Report Allowed</option>
                        <option value="ORGANIZER_ONLY" className="bg-background text-white">Organizer Only</option>
                      </select>
                    </div>

                    {/* Tiebreakers */}
                    <div className="bg-black/40 border border-white/5 p-3 rounded">
                      <label className={deeperLabelCls}>
                        Tiebreakers
                        <span 
                          className="ml-2 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-white/40 text-white/60 text-[9px] cursor-help transition-colors hover:border-white hover:text-white"
                          title="Select multiple tiebreakers to define the resolution order when players have tied scores."
                        >
                          ?
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {TIEBREAKER_OPTIONS.map(opt => {
                          const idx = currentTiebreakers.indexOf(opt.value);
                          const isSelected = idx !== -1;
                          return (
                            <label key={opt.value} className="flex items-center space-x-2 text-[10px] font-black text-white/60 uppercase tracking-widest cursor-pointer group/tb hover:text-white transition-colors">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleTiebreaker(opt.value)}
                                className="hidden"
                              />
                              <div className={`w-4 h-4 flex items-center justify-center border transition-all ${isSelected ? "border-primary bg-primary/20 text-primary" : "border-white/20 bg-background group-hover/tb:border-white/40"}`}>
                                {isSelected ? (idx + 1) : ""}
                              </div>
                              <span className="truncate">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-white/40 italic leading-relaxed mt-2">Click to toggle. The number indicates the tiebreaker order.</p>
                    </div>

                    {/* Utilities */}
                    <div className="bg-black/40 border border-white/5 p-3 rounded">
                      <label className={deeperLabelCls}>
                        Match Utilities (Coin Flip, Dice)
                        <span className="ml-2 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-white/40 text-white/60 text-[9px] cursor-help transition-colors hover:border-white hover:text-white" title="Enable digital coin flips and dice rolls in the match lobby.">?</span>
                      </label>
                      <select
                        value={utilitiesEnabled ? "ENABLED" : "DISABLED"}
                        onChange={e => setUtilitiesEnabled(e.target.value === "ENABLED")}
                        className={inputCls}
                      >
                        <option value="ENABLED" className="bg-background text-white">Enabled</option>
                        <option value="DISABLED" className="bg-background text-white">Disabled</option>
                      </select>
                      
                      {utilitiesEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-in slide-in-from-top-1 duration-300">
                          <div>
                            <label className={deeperLabelCls}>Coin Flip — Who</label>
                            <select value={utilityCoinWho} onChange={e => setUtilityCoinWho(e.target.value)} className={inputCls}>
                              <option value="STAFF_AND_PARTICIPANTS" className="bg-background text-white">Staff and Participants</option>
                              <option value="STAFF_ONLY" className="bg-background text-white">Staff Only</option>
                            </select>
                          </div>
                          <div>
                            <label className={deeperLabelCls}>Dice Roll — Who</label>
                            <select value={utilityDiceWho} onChange={e => setUtilityDiceWho(e.target.value)} className={inputCls}>
                              <option value="STAFF_AND_PARTICIPANTS" className="bg-background text-white">Staff and Participants</option>
                              <option value="STAFF_ONLY" className="bg-background text-white">Staff Only</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Allow Draws (Moved to the bottom so it flows well, but kept its constraints) */}
                    {(system === "SWISS" || system === "ROUND_ROBIN") && (
                      <div className="bg-black/40 border border-white/5 p-3 rounded">
                        <label className={deeperLabelCls}>
                          Allow Draws
                          <span className="ml-2 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-white/40 text-white/60 text-[9px] cursor-help transition-colors hover:border-white hover:text-white" title="Determines whether players can report a drawn match.">?</span>
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAllowDraw(false)}
                            className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                              !allowDraw
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-background border-white/10 text-white/60 hover:text-white"
                            }`}
                          >
                            Force Win
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllowDraw(true)}
                            className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                              allowDraw
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-background border-white/10 text-white/60 hover:text-white"
                            }`}
                          >
                            Permit Draws
                          </button>
                        </div>
                        {allowDraw && (bestOf > 1 || pointsThreshold > 0) && (
                          <p className="text-[10px] text-[#FFB020] leading-relaxed mt-2">
                            Inert with {bestOf > 1 ? "a best-of series" : "point-threshold scoring"} — set Best Of to 1
                            {pointsThreshold > 0 ? " and clear the threshold" : ""} for draws to be offered.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              </div>

              {system === "SWISS" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-6 border-t border-white/5 bg-primary/5 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-6">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className={labelCls + " !mb-0"}>Swiss Rounds</label>
                      <button
                        type="button"
                        onClick={() => setSwissRoundsMode(swissRoundsMode === "AUTO" ? "MANUAL" : "AUTO")}
                        className="text-[9px] text-blue-400 font-bold hover:underline"
                      >
                        {swissRoundsMode === "AUTO" ? "[Fixed]" : "[Auto]"}
                      </button>
                    </div>
                    {swissRoundsMode === "AUTO" ? (
                      <div className="w-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono text-[10px] flex items-center justify-between px-3 py-2 rounded-[4px] h-[38px]">
                        <span>Automatic</span>
                        <span className="text-[8px] bg-blue-500/30 px-1 py-0.5 rounded font-bold">&lceil;log&sup2;N&rceil;</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={swissRounds}
                        onChange={e => setSwissRounds(Math.max(1, Number(e.target.value)))}
                        min={1}
                        max={20}
                        className={inputCls}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Points Per Win</label>
                    <input type="number" value={swissPointsWin} onChange={e => setSwissPointsWin(Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Points Per Draw</label>
                    <input type="number" value={swissPointsDraw} onChange={e => setSwissPointsDraw(Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Points Per Loss</label>
                    <input type="number" value={swissPointsLoss} onChange={e => setSwissPointsLoss(Number(e.target.value))} className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Placement Points */}
          <div className="grid grid-cols-5 gap-4 pt-6 border-t border-white/5">
            <div>
              <label className={labelCls}>Champion</label>
              <input type="number" value={placementChampion} onChange={e => setPlacementChampion(Number(e.target.value))} min={0} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>1st Runner-Up</label>
              <input type="number" value={placement2nd} onChange={e => setPlacement2nd(Number(e.target.value))} min={0} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>2nd Runner-Up</label>
              <input type="number" value={placement3rd} onChange={e => setPlacement3rd(Number(e.target.value))} min={0} className={inputCls} />
            </div>
            <div className={`${system !== 'HYBRID' ? 'opacity-30 pointer-events-none' : ''}`}>
              <label className={labelCls}>Top Cut</label>
              <input type="number" value={placementTopCut} onChange={e => setPlacementTopCut(Number(e.target.value))} min={0} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Participation</label>
              <input type="number" value={placementParticipation} onChange={e => setPlacementParticipation(Number(e.target.value))} min={0} className={inputCls} />
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full py-3 bg-primary text-black font-black text-[10px] uppercase tracking-[0.3em] hover:brightness-110 transition-all"
          >
            {editingPresetId ? "Update preset" : "Save preset"}
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest">
          ERROR: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(tpl => (
          <div key={tpl.id} className="bg-background border border-white/5 p-6 group hover:border-white/20 transition-all flex flex-col justify-between min-h-[160px] relative overflow-hidden">
             {/* Diagonal accent */}
             <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 -rotate-45 translate-x-12 -translate-y-12 pointer-events-none" />
             
             <div className="relative z-10">
               <div className="flex items-start justify-between mb-4 gap-4">
                 <div className="flex-1">
                   <h4 className="text-xs font-black text-white uppercase tracking-widest leading-tight">{tpl.name}</h4>
                   <span className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mt-1 block">{tpl.system.replace(/_/g, " ")}</span>
                 </div>
                 <div className="flex items-center gap-1 relative z-20 shrink-0">
                   <button onClick={() => handleEditClick(tpl)} className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-colors px-2 py-1 border border-transparent hover:border-white/10 rounded">
                     Edit
                   </button>
                   {deleteState?.id === tpl.id ? (
                     deleteState.step === 1 ? (
                       <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">
                         <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest mr-1">Sure?</span>
                         <button onClick={() => setDeleteState({ id: tpl.id, step: 2 })} className="text-[10px] font-black text-red-400 hover:text-red-300 transition-colors px-1">
                           Yes
                         </button>
                         <button onClick={() => setDeleteState(null)} className="text-[10px] font-black text-white/40 hover:text-white transition-colors px-1">
                           No
                         </button>
                       </div>
                     ) : (
                       <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 rounded px-2 py-0.5">
                         <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest mr-1">Positive?</span>
                         <button onClick={() => handleDelete(tpl.id)} disabled={deletingId === tpl.id} className="text-[10px] font-black text-red-400 hover:text-red-300 transition-colors px-1">
                           {deletingId === tpl.id ? "…" : "Delete"}
                         </button>
                         <button onClick={() => setDeleteState(null)} disabled={deletingId === tpl.id} className="text-[10px] font-black text-white/40 hover:text-white transition-colors px-1">
                           Cancel
                         </button>
                       </div>
                     )
                   ) : (
                     <button onClick={() => setDeleteState({ id: tpl.id, step: 1 })} className="text-[10px] font-black text-white/40 hover:text-red-500 uppercase tracking-widest transition-colors px-2 py-1 border border-transparent hover:border-red-500/20 rounded">
                       Delete
                     </button>
                   )}
                 </div>
               </div>
               
               <p className="text-[10px] text-white/60 leading-relaxed italic mb-4 line-clamp-2">
                 {tpl.description || "No technical specification provided."}
               </p>
             </div>

             <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex flex-col relative z-20">
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Game</span>
                    {editingGameId === tpl.id ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <select
                          autoFocus
                          value={editGameValue}
                          onChange={e => setEditGameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Escape") setEditingGameId(null); }}
                          className="w-32 bg-background border border-white/10 px-1.5 py-0.5 text-[10px] font-bold text-primary focus:outline-none focus:border-primary"
                        >
                          <option value="" className="bg-background">No game</option>
                          {games.map(g => (
                            <option key={g.id} value={g.id} className="bg-background">{g.name}</option>
                          ))}
                        </select>
                        <button onClick={() => handleUpdateGame(tpl.id)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-white px-1">Save</button>
                        <button onClick={() => setEditingGameId(null)} className="text-[10px] text-white/60 hover:text-white px-1">×</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingGameId(tpl.id); setEditGameValue(tpl.game?.id || ""); }}
                        title="Change the game"
                        className="text-[10px] font-bold text-primary text-left hover:underline decoration-primary/40 underline-offset-2"
                      >
                        {tpl.game?.name
                          ?? (tpl.gameName ? `${tpl.gameName} (legacy)` : "No game")}{" "}
                        <span className="text-white/60">Edit</span>
                      </button>
                    )}
                  </div>
                 <div className="flex flex-col text-right">
                   <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Best Of</span>
                   <span className="text-[10px] font-bold text-white/60">{tpl.config?.bestOf || 1} wins</span>
                 </div>
               </div>
          </div>
        ))}
      </div>
    </div>
  );
}
