"use client";
import { useState } from "react";
import { API_ENDPOINTS, authenticatedFetch } from "../../utils/api";

interface Tournament {
  id: string;
  name: string;
  status: string;
}

interface Props {
  tournaments: Tournament[];
  onRefresh: () => void;
}

export default function DevPanel({ tournaments, onRefresh }: Props) {
  const [selectedTournament, setSelectedTournament] = useState("");
  const [guestCount, setGuestCount] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleBatchAdd = async () => {
    if (!selectedTournament) return;
    setLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.DEV.BATCH_GUESTS(selectedTournament), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: guestCount }),
      });
      if (res.ok) {
        alert(`Successfully added ${guestCount} guests.`);
        onRefresh();
      } else {
        const err = await res.json();
        alert(`Error: ${err.message}`);
      }
    } catch (e) {
      alert("Failed to connect to dev server");
    } finally {
      setLoading(false);
    }
  };

  const [expiryDays, setExpiryDays] = useState(30);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState("");

  const handleBackfillGameStats = async () => {
    setBackfillLoading(true);
    setBackfillResult("");
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.DEV.BACKFILL_GAME_STATS, {
        method: "POST",
      });
      const data = await res.json();
      setBackfillResult(data?.message || (res.ok ? "Rebuild complete." : "Rebuild failed."));
    } catch {
      setBackfillResult("Network error during rebuild.");
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleUpdateExpiry = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.DEV.GUEST_EXPIRY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: expiryDays }),
      });
      if (res.ok) {
        alert(`Guest expiration period updated to ${expiryDays} days.`);
      } else {
        const err = await res.json();
        alert(`Error: ${err.message}`);
      }
    } catch (e) {
      alert("Failed to connect to dev server");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTournament = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE tournament "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.DEV.DELETE_TOURNAMENT(id), {
        method: "DELETE"
      });
      if (res.ok) {
        alert("Tournament deleted.");
        onRefresh();
      } else {
        const err = await res.json();
        alert(`Error: ${err.message}`);
      }
    } catch (e) {
      alert("Failed to connect to dev server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-none relative group overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
          <span className="text-6xl font-black italic tracking-tighter">DEV</span>
        </div>
        
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-8 flex items-center gap-4">
          <span className="h-px w-8 bg-primary/30"></span>
          Player Simulation Tools
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">Target Tournament</label>
            <select 
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
            >
              <option value="">Select a tournament...</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">Quantity</label>
            <div className="flex gap-4">
              <input 
                type="number"
                value={guestCount}
                onChange={(e) => setGuestCount(parseInt(e.target.value))}
                className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
              />
              <button 
                onClick={handleBatchAdd}
                disabled={loading || !selectedTournament}
                className="px-8 py-3 bg-primary text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
              >
                {loading ? "Adding..." : "Add Guests"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-none relative group overflow-hidden">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-amber-500 mb-8 flex items-center gap-4">
          <span className="h-px w-8 bg-amber-500/30"></span>
          System Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">Guest Expiration (Days)</label>
            <div className="flex gap-4">
              <input 
                type="number"
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
              />
              <button 
                onClick={handleUpdateExpiry}
                disabled={loading}
                className="px-8 py-3 bg-amber-500 text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
              >
                Apply Period
              </button>
            </div>
            <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">Default: 30 days. Resets on server restart.</p>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">Per-Game Leaderboard Stats</label>
            <button
              onClick={handleBackfillGameStats}
              disabled={backfillLoading}
              className="w-full px-8 py-3 bg-neutral-950 border border-primary/40 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-background disabled:opacity-50 transition-all active:scale-95"
            >
              {backfillLoading ? "Rebuilding..." : "Rebuild From History"}
            </button>
            <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">
              {backfillResult || "Recomputes game-specific standings from all past tournaments."}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-none relative group overflow-hidden">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-red-500 mb-8 flex items-center gap-4">
          <span className="h-px w-8 bg-red-500/30"></span>
          System Management
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="py-4 px-2">Tournament Name</th>
                <th className="py-4 px-2">Status</th>
                <th className="py-4 px-2 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {tournaments.map(t => (
                <tr key={t.id} className="hover:bg-red-500/5 transition-colors group/row">
                  <td className="py-4 px-2 font-bold">{t.name}</td>
                  <td className="py-4 px-2">
                    <span className="text-[9px] px-2 py-0.5 bg-neutral-800 text-neutral-400 uppercase tracking-widest">{t.status}</span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <button 
                      onClick={() => handleDeleteTournament(t.id, t.name)}
                      className="text-[10px] font-black uppercase tracking-widest text-red-500 opacity-0 group-hover/row:opacity-100 hover:bg-red-500 hover:text-white border border-red-500/30 px-4 py-1.5 transition-all"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {tournaments.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-neutral-600 italic">No tournaments found in system history.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
