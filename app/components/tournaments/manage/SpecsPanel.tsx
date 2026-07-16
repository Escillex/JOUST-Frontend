import React, { useState, useEffect } from "react";
import { Tournament } from "../../../tournaments/types";
import { getTournamentConfig } from "../../../utils/formatConfig";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import ImageUpload from "../../ui/ImageUpload";
import { useImageUpload } from "../../../utils/useImageUpload";

const inputCls = "w-full h-10 bg-[#1B1B1B] border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-[#52B946] transition-colors rounded";

interface EditState {
  name: string;
  description: string;
  formatId: string;
  maxPlayers: number;
  prizePool: string | number;
  isPrivate: boolean;
}

interface FormatOption {
  id: string;
  name: string;
  gameName?: string | null;
}

interface Props {
  tournament: Tournament;
  tournamentId: string;
  isEditing: boolean;
  editState: EditState;
  formatOptions: FormatOption[];
  onToggleEdit: () => void;
  onEditChange: (field: keyof EditState, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onOpenRegistration: () => void;
  onStartTournament: () => void;
  fetchData: () => void;
  setMessage: (msg: string) => void;
}

export default function SpecsPanel({ tournament, tournamentId, isEditing, editState, formatOptions, onToggleEdit, onEditChange, onSubmit, onOpenRegistration, onStartTournament, fetchData, setMessage }: Props) {
  const { upload, remove, uploading } = useImageUpload();
  const stages = ["UPCOMING", "OPEN", "ONGOING", "COMPLETED"];

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!tournament.guestCleanupAt) {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      const diff = new Date(tournament.guestCleanupAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
        fetchData();
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament.guestCleanupAt]);

  const handleCancelCleanup = async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.CANCEL_CLEANUP(tournamentId), { method: "PATCH" });
    if (res.ok) { setMessage("Cleanup halted."); fetchData(); }
    else { setMessage("Failed to halt cleanup."); }
  };

  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const handleStatusChange = async (target: string) => {
    if (isChangingStatus) return;
    const current = tournament.status;
    if (current === "UPCOMING" && target === "OPEN") {
      onOpenRegistration();
    } else if (current === "OPEN" && target === "ONGOING") {
      onStartTournament();
    } else if (current === "ONGOING" && target === "COMPLETED") {
      setIsChangingStatus(true);
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.COMPLETE(tournamentId!), { method: "PATCH" });
        const data = await safeJson(res);
        if (res.ok) { setMessage("Tournament completed!"); fetchData(); }
        else { setMessage(data?.message || "Failed to complete tournament"); }
      } finally {
        setIsChangingStatus(false);
      }
    } else {
      setMessage("Cannot reverse tournament status");
    }
  };

  const handleBannerUpload = async (file: File) => {
    const url = await upload(API_ENDPOINTS.IMAGES.UPLOAD_BANNER(tournamentId), file);
    if (url) {
      setMessage("Banner updated successfully");
      fetchData();
    }
  };

  const handleBannerDelete = async () => {
    const ok = await remove(API_ENDPOINTS.IMAGES.DELETE_BANNER(tournamentId));
    if (ok) {
      setMessage("Banner removed");
      fetchData();
    }
  };

  return (
    <div className="bg-[#000000] border border-white/20 p-4 md:p-6 rounded">
      <div className="mb-8">
        <label className="text-xs font-semibold text-[#888888] mb-2 block">Tournament Image</label>
        <ImageUpload
          currentUrl={tournament.bannerUrl}
          onUpload={handleBannerUpload}
          onDelete={handleBannerDelete}
          uploading={uploading}
          aspectRatio="aspect-[21/9]"
          label="UPDATE IMAGE"
        />
      </div>

      <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Specifications</h3>
        <button onClick={onToggleEdit} className="text-xs font-semibold text-[#52B946] hover:brightness-90 transition-colors">
          {isEditing ? "Cancel" : "Edit Settings"}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#888888] block">Format Preset</label>
            <select 
              value={editState.formatId} 
              onChange={e => onEditChange("formatId", e.target.value)} 
              className={inputCls}
            >
              <option value="">Select a format</option>
              {formatOptions.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.gameName || "GENERAL"})</option>
              ))}
            </select>
          </div>

          <div className={`space-y-6 transition-opacity ${!editState.formatId ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#888888] block">Tournament Name</label>
              <input value={editState.name} onChange={e => onEditChange("name", e.target.value)} className={inputCls} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#888888] block">Description</label>
              <textarea 
                value={editState.description} 
                onChange={e => onEditChange("description", e.target.value)} 
                className={`${inputCls} h-24 py-3 resize-none`} 
                placeholder="Optional tournament details or lore"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#888888] block">Capacity</label>
                <input type="number" value={editState.maxPlayers} onChange={e => onEditChange("maxPlayers", Number(e.target.value))} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#888888] block">Prize Pool</label>
                <input type="number" value={editState.prizePool} onChange={e => onEditChange("prizePool", editState.prizePool === "" ? "" : Number(e.target.value))} className={inputCls} />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10">
              <label className="text-xs font-semibold text-[#888888] block">System Status</label>
              <select
                value={tournament.status}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={isChangingStatus}
                className={`${inputCls} disabled:opacity-50`}
              >
                {stages.map(s => {
                  const currentIdx = stages.indexOf(tournament.status);
                  const thisIdx = stages.indexOf(s);
                  const isDisabled = thisIdx < currentIdx || thisIdx > currentIdx + 1;
                  return <option key={s} value={s} disabled={isDisabled}>{s}{s === tournament.status ? " (CURRENT)" : ""}</option>;
                })}
              </select>
            </div>

            <button type="submit" className="w-full h-10 bg-[#52B946] text-black font-semibold text-sm rounded hover:brightness-90 transition-colors">
              Save Specifications
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-y-4 gap-x-4">
            {[
              { label: "Name", value: tournament.name },
              { label: "Description", value: tournament.description || "N/A" },
              { label: "Game", value: (typeof tournament.format === 'object' ? tournament.format?.gameName : null) || "GENERAL" },
              { label: "Format", value: (typeof tournament.format === 'object' ? tournament.format?.name : null) || "NONE SET" },
              { label: "System", value: (typeof tournament.format === 'object' ? tournament.format?.system : null) === "HYBRID" ? "TOP CUT" : ((typeof tournament.format === 'object' ? tournament.format?.system : null)?.replace("_", " ") || "NONE") },
              { label: "Capacity", value: `${tournament.participants.length} / ${tournament.maxPlayers}` },
              { label: "Status", value: tournament.status, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="space-y-1">
                <p className="text-xs font-semibold text-[#888888]">{label}</p>
                <p className={`text-sm ${highlight ? "text-[#52B946]" : "text-white"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Placement Points Table */}
          {(() => {
            if (!tournament.config && typeof tournament.format !== 'object') return null;
            const cfg = getTournamentConfig(tournament) as any;
            const champion = cfg?.placementPointsChampion ?? 10;
            const second = cfg?.placementPoints2nd ?? 7;
            const third = cfg?.placementPoints3rd ?? 5;
            const topCut = cfg?.placementPointsTopCut ?? 3;
            const participation = cfg?.placementPointsParticipation ?? 1;
            const isHybrid = (typeof tournament.format === 'object' ? tournament.format?.system : null) === 'HYBRID';
            const rows = [
              { label: "Champion", pts: champion },
              { label: "1st Runner-Up", pts: second },
              { label: "2nd Runner-Up", pts: third },
              ...(isHybrid ? [{ label: "Top Cut", pts: topCut }] : []),
              { label: "Participation", pts: participation },
            ];
            return (
              <div className="pt-6 border-t border-white/10">
                <p className="text-xs font-semibold text-[#888888] mb-3">Placement Points</p>
                <div className="space-y-1">
                  {rows.map(r => (
                    <div key={r.label} className="flex items-center justify-between py-1.5 px-3 rounded bg-[#1B1B1B] border border-white/5">
                      <span className="text-xs text-white">{r.label}</span>
                      <span className="text-xs font-black text-[#52B946]">{r.pts} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}



       {timeLeft !== null && timeLeft > 0 && (
        <div className="mt-6 p-4 bg-[#1B1B1B] border border-[#FF4D4D]/20 rounded flex flex-col items-center gap-4">
           <div className="text-center">
             <p className="text-xs font-semibold text-[#FF4D4D] mb-1">Guest Data Cleanup Warning</p>
             <p className="text-xl font-mono text-[#FF4D4D]">
               {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
             </p>
           </div>
           <button 
             onClick={handleCancelCleanup}
             className="w-full py-2 bg-[#1B1B1B] border border-[#FF4D4D]/50 text-[#FF4D4D] font-semibold text-xs rounded hover:bg-[#FF4D4D]/10 transition-colors"
           >
             Halt Cleanup
           </button>
        </div>
      )}
    </div>
  );
}
