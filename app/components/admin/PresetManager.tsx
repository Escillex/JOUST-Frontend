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
  gameName?: string;
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
  const [gameName, setGameName] = useState("");
  const [isNewGame, setIsNewGame] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editGameValue, setEditGameValue] = useState("");

  // Config fields
  const [bestOf, setBestOf] = useState(1);
  const [allowDraw, setAllowDraw] = useState(false);
  // How the field is placed into the bracket. RANDOM draws the field at random,
  // which is what an event does unless the organizer has deliberately arranged
  // the order; MANUAL honours the seed order set on the roster before start.
  const [seedingMode, setSeedingMode] = useState<"RANDOM" | "MANUAL">("RANDOM");
  const [swissRounds, setSwissRounds] = useState(3);
  const [swissPointsWin, setSwissPointsWin] = useState(3);
  const [swissPointsDraw, setSwissPointsDraw] = useState(1);
  const [swissPointsLoss, setSwissPointsLoss] = useState(0);
  const [pointsThreshold, setPointsThreshold] = useState(0);
  const [startingHp, setStartingHp] = useState(0);

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

  const handleCreate = async () => {
    if (!name) return setError("Name is required");
    
    const config = {
      bestOf,
      allowDraw,
      seedingMode,
      swissRounds: system === "SWISS" ? swissRounds : null,
      swissPointsForWin: swissPointsWin,
      swissPointsForDraw: swissPointsDraw,
      swissPointsForLoss: swissPointsLoss,
      pointsThreshold,
      startingHp,
      placementPointsChampion: placementChampion,
      placementPoints2nd: placement2nd,
      placementPoints3rd: placement3rd,
      placementPointsTopCut: placementTopCut,
      placementPointsParticipation: placementParticipation,
    };

    try {
      const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          system,
          config,
          gameName: gameName || null,
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
    }
  };

  const handleUpdateGame = async (id: string) => {
    setError("");
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.DETAILS(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName: editGameValue || null }),
      });
      if (res.ok) {
        setEditingGameId(null);
        fetchTemplates();
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Failed to update game designation");
      }
    } catch (err) {
      setError("Network error while updating game designation");
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSystem("SINGLE_ELIMINATION");
    setGameName("");
    setIsNewGame(false);
    setBestOf(1);
    setAllowDraw(false);
    setSeedingMode("RANDOM");
    setPointsThreshold(0);
    setStartingHp(0);
    setPlacementChampion(10);
    setPlacement2nd(7);
    setPlacement3rd(5);
    setPlacementTopCut(3);
    setPlacementParticipation(1);
    setError("");
  };

  const gameOptions = useMemo(
    () =>
      Array.from(
        new Set(templates.map(t => t.gameName).filter((g): g is string => !!g))
      ).sort(),
    [templates]
  );

  const labelCls = "text-[10px] font-black text-white/40 uppercase tracking-widest mb-1 block";
  const deeperLabelCls = "text-[10px] font-black text-white/20 uppercase tracking-widest mb-1 block";
  const inputCls = "w-full bg-background border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-all cursor-pointer hover:bg-white/[0.02]";

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Technical Presets</h3>
        <button 
          onClick={() => {
            if (isCreating) resetForm();
            setIsCreating(!isCreating);
          }}
          className="px-4 py-1.5 bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
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
              <label className={labelCls}>Game Designation</label>
              {isNewGame || gameOptions.length === 0 ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gameName}
                    onChange={e => setGameName(e.target.value.toUpperCase())}
                    placeholder="e.g. BEYBLADE"
                    className={inputCls}
                    autoFocus={isNewGame}
                  />
                  {gameOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setIsNewGame(false); setGameName(""); }}
                      className="px-3 border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest hover:border-white/30 hover:text-white transition-all shrink-0"
                    >
                      LIST
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={gameName}
                  onChange={e => {
                    if (e.target.value === "__NEW__") {
                      setIsNewGame(true);
                      setGameName("");
                    } else {
                      setGameName(e.target.value);
                    }
                  }}
                  className={inputCls}
                >
                  <option value="" className="bg-background text-white">None (General)</option>
                  {gameOptions.map(g => (
                    <option key={g} value={g} className="bg-background text-white">{g}</option>
                  ))}
                  <option value="__NEW__" className="bg-background text-primary">+ Define new game…</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional technical details" className={inputCls} />
          </div>

          <div className={`space-y-8 transition-all duration-700 ${system === "HYBRID" ? "opacity-20 grayscale blur-sm pointer-events-none" : "opacity-100"}`}>
            <div className="grid grid-cols-2 gap-12 pt-4 border-t border-white/5">
              <div className="space-y-4">
                <div className="text-[9px] font-black text-white/[0.08] uppercase tracking-widest border-b border-white/5 pb-2">Structure</div>
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
                      className={`flex-1 h-9 text-[9px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                        seedingMode === "RANDOM"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background border-white/10 text-white/40 hover:text-white"
                      }`}
                    >
                      Random Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeedingMode("MANUAL")}
                      className={`flex-1 h-9 text-[9px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                        seedingMode === "MANUAL"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background border-white/10 text-white/40 hover:text-white"
                      }`}
                    >
                      Manual Seeding
                    </button>
                  </div>
                  <p className="text-[9px] text-white/30 leading-relaxed">
                    {seedingMode === "RANDOM"
                      ? "The field is drawn at random when the tournament starts. Any seed order set on the roster is ignored."
                      : "The bracket follows the seed order arranged on the roster. Unseeded entrants are placed last."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-[9px] font-black text-white/10 uppercase tracking-widest border-b border-white/5 pb-2">Advanced</div>
                <div className="flex items-center space-x-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="enableThreshold" 
                    checked={pointsThreshold > 0} 
                    onChange={e => {
                      if (e.target.checked) {
                        setPointsThreshold(1);
                      } else {
                        setPointsThreshold(0);
                      }
                    }} 
                    className="mr-2 cursor-pointer accent-primary" 
                  />
                  <label htmlFor="enableThreshold" className="text-[10px] font-black text-white/60 uppercase tracking-widest cursor-pointer select-none">Points Threshold</label>
                </div>
                {pointsThreshold > 0 && (
                  <div className="animate-in slide-in-from-top-1 duration-300">
                    <input 
                      type="number" 
                      value={pointsThreshold} 
                      onChange={e => setPointsThreshold(Math.max(1, Number(e.target.value)))} 
                      min={1}
                      className={inputCls} 
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="enableHpSystem" 
                    checked={startingHp > 0} 
                    onChange={e => {
                      if (e.target.checked) {
                        setStartingHp(100);
                      } else {
                        setStartingHp(0);
                      }
                    }} 
                    className="mr-2 cursor-pointer accent-primary" 
                  />
                  <label htmlFor="enableHpSystem" className="text-[10px] font-black text-white/60 uppercase tracking-widest cursor-pointer select-none">HP-Based Match</label>
                </div>
                {startingHp > 0 && (
                  <div className="animate-in slide-in-from-top-1 duration-300">
                    <input 
                      type="number" 
                      value={startingHp} 
                      onChange={e => setStartingHp(Math.max(1, Number(e.target.value)))} 
                      min={1}
                      className={inputCls} 
                    />
                  </div>
                )}

                 {/* Deliberately NOT extended to HYBRID here, unlike
                     CreateTournamentForm: this whole section is wrapped in a
                     `pointer-events-none` block when system === "HYBRID" (see
                     the container above), so a toggle added here would be a
                     control nobody can reach. HYBRID phase-1 draws are set on
                     the per-tournament form instead. Tracked as plan item 4.7. */}
                 {(system === "SWISS" || system === "ROUND_ROBIN") && (
                  <div className="space-y-1.5 pt-2">
                    <label className={deeperLabelCls}>Allow Draws</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowDraw(false)}
                        className={`flex-1 h-9 text-[9px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                          !allowDraw
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-white/10 text-white/40 hover:text-white"
                        }`}
                      >
                        Force Win
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowDraw(true)}
                        className={`flex-1 h-9 text-[9px] font-black uppercase tracking-widest border transition-all rounded-[4px] ${
                          allowDraw
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-white/10 text-white/40 hover:text-white"
                        }`}
                      >
                        Permit Draws
                      </button>
                    </div>
                    {allowDraw && (bestOf > 1 || pointsThreshold > 0) && (
                      /* Inert combination: the backend rejects a winnerless
                         submit for a series or a threshold-scored match, so the
                         Draw control would never appear during scoring. */
                      <p className="text-[9px] text-[#FFB020] leading-relaxed">
                        Inert with {bestOf > 1 ? "a best-of series" : "point-threshold scoring"} — set Best Of to 1
                        {pointsThreshold > 0 ? " and clear the threshold" : ""} for draws to be offered.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {system === "SWISS" && (
              <div className="grid grid-cols-4 gap-6 pt-6 border-t border-white/5 bg-primary/5 -mx-8 px-8 py-6">
                <div>
                  <label className={labelCls}>Swiss Rounds</label>
                  <input type="number" value={swissRounds} onChange={e => setSwissRounds(Number(e.target.value))} className={inputCls} />
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
            onClick={handleCreate}
            className="w-full py-3 bg-primary text-black font-black text-[10px] uppercase tracking-[0.3em] hover:brightness-110 transition-all"
          >
            Deploy Preset Logic
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
               <div className="flex items-start justify-between mb-4">
                 <div>
                   <h4 className="text-xs font-black text-white uppercase tracking-widest">{tpl.name}</h4>
                   <span className="text-[8px] font-black text-primary/60 uppercase tracking-[0.2em]">{tpl.system.replace(/_/g, " ")}</span>
                 </div>
                  <button onClick={() => handleDelete(tpl.id)} disabled={deletingId === tpl.id} className="text-[10px] text-white/40 hover:text-red-500 transition-colors relative z-20 p-2 -m-2 disabled:opacity-30 disabled:pointer-events-none">{deletingId === tpl.id ? "…" : "✕"}</button>
               </div>
               
               <p className="text-[9px] text-white/40 leading-relaxed italic mb-4 line-clamp-2">
                 {tpl.description || "No technical specification provided."}
               </p>
             </div>

             <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex flex-col relative z-20">
                    <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Designation</span>
                    {editingGameId === tpl.id ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          autoFocus
                          value={editGameValue}
                          onChange={e => setEditGameValue(e.target.value.toUpperCase())}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleUpdateGame(tpl.id);
                            if (e.key === "Escape") setEditingGameId(null);
                          }}
                          placeholder="GENERAL"
                          list="preset-game-options"
                          className="w-24 bg-background border border-white/10 px-1.5 py-0.5 text-[8px] font-bold text-primary focus:outline-none focus:border-primary"
                        />
                        <button onClick={() => handleUpdateGame(tpl.id)} className="text-[10px] text-primary hover:text-white px-1">✓</button>
                        <button onClick={() => setEditingGameId(null)} className="text-[10px] text-white/40 hover:text-white px-1">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingGameId(tpl.id); setEditGameValue(tpl.gameName || ""); }}
                        title="Edit game designation"
                        className="text-[8px] font-bold text-primary text-left hover:underline decoration-primary/40 underline-offset-2"
                      >
                        {tpl.gameName || "GENERAL"} <span className="text-white/30">✎</span>
                      </button>
                    )}
                    <datalist id="preset-game-options">
                      {gameOptions.map(g => <option key={g} value={g} />)}
                    </datalist>
                  </div>
                 <div className="flex flex-col text-right">
                   <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Best Of</span>
                   <span className="text-[8px] font-bold text-white/60">{tpl.config?.bestOf || 1} wins</span>
                 </div>
               </div>
          </div>
        ))}
      </div>
    </div>
  );
}
