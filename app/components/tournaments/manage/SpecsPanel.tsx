import React, { useState, useEffect } from "react";
import { Tournament } from "../../../tournaments/types";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import ImageUpload from "../../ui/ImageUpload";
import { useImageUpload } from "../../../utils/useImageUpload";

const inputCls = "w-full h-12 bg-background border border-foreground/10 px-4 text-xs text-foreground focus:outline-none focus:border-primary transition-all rounded-xl appearance-none";

interface EditState {
  name: string;
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
    if (!confirm("Stop automated guest purge? Accounts will be preserved indefinitely.")) return;
    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.CANCEL_CLEANUP(tournamentId), { method: "PATCH" });
    if (res.ok) { setMessage("Cleanup halted."); fetchData(); }
    else { setMessage("Failed to halt cleanup."); }
  };

  const handleStatusChange = async (target: string) => {
    const current = tournament.status;
    if (current === "UPCOMING" && target === "OPEN") {
      if (!confirm("Open registration?")) return;
      onOpenRegistration();
    } else if (current === "OPEN" && target === "ONGOING") {
      if (!confirm("Initiate combat?")) return;
      onStartTournament();
    } else if (current === "ONGOING" && target === "COMPLETED") {
      if (!confirm("Mark as completed?")) return;
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.COMPLETE(tournamentId!), { method: "PATCH" });
      const data = await safeJson(res);
      if (res.ok) { setMessage("Tournament completed!"); fetchData(); }
      else { setMessage(data?.message || "Failed"); }
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
    if (!confirm("Remove tournament banner?")) return;
    const ok = await remove(API_ENDPOINTS.IMAGES.DELETE_BANNER(tournamentId));
    if (ok) {
      setMessage("Banner removed");
      fetchData();
    }
  };

  return (
    <div className="bg-[#1B1B1B] backdrop-blur-md border border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl transition-all duration-500">
      <div className="mb-10">
        <label className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.2em] font-poppins ml-1 mb-3 block">Tournament Image</label>
        <ImageUpload
          currentUrl={tournament.bannerUrl}
          onUpload={handleBannerUpload}
          onDelete={handleBannerDelete}
          uploading={uploading}
          aspectRatio="aspect-[21/9]"
          label="UPDATE IMAGE"
        />
      </div>

      <div className="flex justify-between items-center mb-10 pb-6 border-b border-white/5">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/60 font-poppins">Tournament Details</h3>
        <button onClick={onToggleEdit} className="text-[10px] font-black uppercase text-primary hover:brightness-110 tracking-widest font-poppins transition-all">
          {isEditing ? "Cancel Editing" : "Edit Tournament"}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={onSubmit} className="space-y-10">
          {/* Hierarchical Step 1 */}
          <div className="p-6 bg-primary/[0.03] border border-primary/20 rounded-2xl">
            <div className="space-y-3">
              <label className="text-[9px] font-black text-primary/60 uppercase tracking-[0.2em] font-poppins ml-1">Tournament Format</label>
              <div className="relative">
                <select 
                  value={editState.formatId} 
                  onChange={e => onEditChange("formatId", e.target.value)} 
                  className={`${inputCls} !border-primary/20 !bg-transparent focus:!border-primary !text-primary font-black uppercase text-[10px] tracking-widest h-14`}
                >
                  <option value="" className="bg-[#1B1B1B] text-white/40">Select a format</option>
                  {formatOptions.map(f => (
                    <option key={f.id} value={f.id} className="bg-[#1B1B1B] text-white">{f.name.toUpperCase()} ({f.gameName || "GENERAL"})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Locked Section */}
          <div className={`space-y-8 transition-all duration-700 ${!editState.formatId ? "opacity-10 grayscale blur-sm pointer-events-none translate-y-4" : "opacity-100 translate-y-0"}`}>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.2em] font-poppins ml-1">Tournament Name</label>
              <input value={editState.name} onChange={e => onEditChange("name", e.target.value)} className={`${inputCls} bg-transparent border-white/10`} />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.2em] font-poppins ml-1">Capacity</label>
                <input type="number" value={editState.maxPlayers} onChange={e => onEditChange("maxPlayers", Number(e.target.value))} className={`${inputCls} bg-transparent border-white/10`} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.2em] font-poppins ml-1">Prize (₱)</label>
                <input type="number" value={editState.prizePool} onChange={e => onEditChange("prizePool", editState.prizePool === "" ? "" : Number(e.target.value))} className={`${inputCls} bg-transparent border-white/10`} />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/[0.05]">
              <p className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.2em] font-poppins ml-1">Current Status</p>
              <select
                value={tournament.status}
                onChange={e => handleStatusChange(e.target.value)}
                className={`${inputCls} !bg-transparent !border-white/10 cursor-pointer`}
              >
                {stages.map(s => {
                  const currentIdx = stages.indexOf(tournament.status);
                  const thisIdx = stages.indexOf(s);
                  const isDisabled = thisIdx < currentIdx || thisIdx > currentIdx + 1;
                  return <option key={s} value={s} disabled={isDisabled}>{s}{s === tournament.status ? " (CURRENT)" : ""}</option>;
                })}
              </select>
            </div>

            <button type="submit" className="w-full h-14 bg-primary text-black font-black text-xs uppercase tracking-[0.3em] rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-primary/20">
              Save Tournament Changes
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-y-10 gap-x-6">
          {[
            { label: "Tournament Name", value: tournament.name },
            { label: "Game", value: (typeof tournament.format === 'object' ? tournament.format?.gameName : null) || "GENERAL" },
            { label: "Format", value: (typeof tournament.format === 'object' ? tournament.format?.name : null) || "NONE SET" },
            { label: "Bracket Type",      value: (typeof tournament.format === 'object' ? tournament.format?.system : null) === "HYBRID" ? "TOP CUT" : ((typeof tournament.format === 'object' ? tournament.format?.system : null)?.replace("_", " ") || "NONE") },
            { label: "Capacity",    value: `${tournament.participants.length} / ${tournament.maxPlayers}` },
            { label: "Status",      value: tournament.status, highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="space-y-1.5">
              <p className="text-[8px] font-black text-foreground/20 uppercase tracking-[0.2em] font-poppins">{label}</p>
              <p className={`text-[11px] font-black uppercase tracking-tight ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
            </div>
          ))}
        </div>
      )}



       {timeLeft !== null && timeLeft > 0 && (
        <div className="mt-10 p-6 bg-primary/5 border border-primary/20 rounded-[2rem] flex flex-col items-center gap-6 animate-pulse">
           <div className="text-center">
             <p className="text-[8px] font-black text-primary/60 uppercase tracking-[0.3em] font-poppins mb-2">Guest Account Cleanup</p>
             <p className="text-3xl font-black text-primary font-mono tracking-tighter">
               {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
             </p>
           </div>
           <button 
             onClick={handleCancelCleanup}
             className="w-full py-4 bg-primary text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:brightness-110 transition-all font-poppins"
           >
             Cancel Cleanup
           </button>
        </div>
      )}
    </div>
  );
}
