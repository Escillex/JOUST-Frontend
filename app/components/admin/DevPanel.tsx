"use client";
import { useEffect, useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";
import { useToast } from "../ui/Toast";

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
  // Feedback now goes through toasts instead of alert() popups.
  // alert() blocks the whole page and is not allowed in this project.
  const { toast } = useToast();
  const [selectedTournament, setSelectedTournament] = useState("");
  const [guestCount, setGuestCount] = useState(10);
  const [loading, setLoading] = useState(false);
  // Tracks which tournament row is being deleted, so its button can
  // show progress and repeated clicks are ignored.
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        toast(`Generated ${guestCount} guests`, "success");
        onRefresh();
      } else {
        const err = await res.json();
        toast(err.message || "Failed to add guests", "error");
      }
    } catch {
      toast("Could not reach the server", "error");
    } finally {
      setLoading(false);
    }
  };

  const [expiryDays, setExpiryDays] = useState(30);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState("");

  // Debug mode is a per-viewer preference in localStorage (`joust_debug_mode`),
  // read by the bracket page to surface insta-win / random-advance shortcuts.
  // Mirrored here rather than re-implemented: same key, so flipping it in either
  // place moves the same switch — two sources of truth would drift immediately.
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    try { setDebugMode(localStorage.getItem("joust_debug_mode") === "1"); } catch { /* storage unavailable */ }
  }, []);

  const toggleDebugMode = () => {
    const next = !debugMode;
    setDebugMode(next);
    try { localStorage.setItem("joust_debug_mode", next ? "1" : "0"); } catch { /* ignore */ }
  };

  // `override` is null when nothing is forcing a mode and the stored setting
  // applies; the endpoint reports it so the panel reflects reality after a
  // restart rather than showing a stale toggle.
  const [twoFactorMode, setTwoFactorMode] = useState<string | null>(null);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);

  // Bulk guest creation is opt-in and persisted server-side (unlike debug mode,
  // which is a per-browser preference). The server refuses the endpoint outright
  // when it is off, so this toggle reflects a real restriction rather than
  // hiding a button.
  const [bulkGuests, setBulkGuests] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    authenticatedFetch(API_ENDPOINTS.ADMIN.TWO_FACTOR)
      .then(safeJson)
      .then((d) => setTwoFactorMode(d?.override ?? null))
      .catch(() => {});
    authenticatedFetch(API_ENDPOINTS.ADMIN.SETTINGS)
      .then(safeJson)
      .then((list) => {
        const at = (name: string) =>
          Array.isArray(list) ? list.find((x: any) => x.name === name)?.value ?? null : null;
        setBulkGuests(at("DEV_BULK_GUESTS") === "true");
        setBackupEnabled(at("BACKUP_ENABLED") === "true");
        setBackupCron(at("BACKUP_CRON") ?? "0 3 * * *");
        setRetention(at("BACKUP_RETENTION") ?? "14");
        setAllowRestore(at("BACKUP_ALLOW_RESTORE") === "true");
      })
      .catch(() => {});
  }, []);

  // Backup policy. These live here rather than on the Backups tab because this
  // is where the project keeps switches that change how the system behaves;
  // the Backups tab is for the snapshots themselves.
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupCron, setBackupCron] = useState("0 3 * * *");
  const [retention, setRetention] = useState("14");
  const [allowRestore, setAllowRestore] = useState(false);
  const [policyBusy, setPolicyBusy] = useState<string | null>(null);

  const writeSetting = async (name: string, value: string) => {
    setPolicyBusy(name);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.SETTINGS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, value }),
      });
      if (!res.ok) {
        const err = await safeJson(res);
        toast(err?.message || "Could not save the setting", "error");
        return false;
      }
      return true;
    } catch {
      toast("Could not reach the server", "error");
      return false;
    } finally {
      setPolicyBusy(null);
    }
  };

  const SCHEDULES: { label: string; cron: string }[] = [
    { label: "Daily 3am", cron: "0 3 * * *" },
    { label: "Every 6h", cron: "0 */6 * * *" },
    { label: "Weekly", cron: "0 3 * * 0" },
  ];

  const toggleBulkGuests = async () => {
    setBulkBusy(true);
    try {
      const next = !bulkGuests;
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.SETTINGS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "DEV_BULK_GUESTS", value: String(next) }),
      });
      if (res.ok) {
        setBulkGuests(next);
        toast(
          next ? "Bulk guest generation allowed" : "Bulk guest generation blocked",
          "success",
        );
      } else {
        const err = await safeJson(res);
        toast(err?.message || "Could not change the setting", "error");
      }
    } catch {
      toast("Could not reach the server", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSetTwoFactor = async (mode: "all" | "staff" | "off") => {
    setTwoFactorBusy(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN.TWO_FACTOR, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await safeJson(res);
      if (res.ok) setTwoFactorMode(mode);
      else alert(data?.message ?? "Could not change enforcement.");
    } finally {
      setTwoFactorBusy(false);
    }
  };

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
        toast(`Guest expiration period updated to ${expiryDays} days`, "success");
      } else {
        const err = await res.json();
        toast(err.message || "Failed to update expiration period", "error");
      }
    } catch {
      toast("Could not reach the server", "error");
    } finally {
      setLoading(false);
    }
  };

  // No confirm() popup (project rule). The button shows a per-row
  // "Deleting..." state instead, and the result is reported by a toast.
  const handleDeleteTournament = async (id: string, name: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.DEV.DELETE_TOURNAMENT(id), {
        method: "DELETE"
      });
      if (res.ok) {
        toast(`Tournament "${name}" deleted`, "success");
        onRefresh();
      } else {
        const err = await res.json();
        toast(err.message || "Failed to delete tournament", "error");
      }
    } catch {
      toast("Could not reach the server", "error");
    } finally {
      setDeletingId(null);
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

        {/* The switch is the gate, not a hint: with it off the server refuses
            POST .../batch-guests outright, so disabling the button below only
            keeps the UI honest about what will happen. */}
        <div className="relative z-10 mb-8 space-y-3">
          <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
            Bulk Guest Creation
          </label>
          <button
            onClick={toggleBulkGuests}
            disabled={bulkBusy}
            className={`w-full px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border flex items-center justify-center gap-3 disabled:opacity-50 ${
              bulkGuests
                ? "bg-primary text-background border-primary"
                : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${bulkGuests ? "bg-background animate-pulse" : "bg-neutral-600"}`} />
            {bulkBusy ? "Saving..." : bulkGuests ? "Allowed" : "Blocked"}
          </button>
          <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">
            {bulkGuests
              ? "Generated placeholder entrants can be minted in bulk right now. Turn this off when you are finished testing."
              : "Off by default — this is the bulk generator only. Adding a walk-in guest to a roster is an ordinary organizer action and is never affected by this switch."}
          </p>
        </div>

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
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">Quantity To Generate</label>
            <div className="flex gap-4">
              <input 
                type="number"
                value={guestCount}
                onChange={(e) => setGuestCount(parseInt(e.target.value))}
                className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
              />
              <button 
                onClick={handleBatchAdd}
                disabled={loading || !selectedTournament || !bulkGuests}
                className="px-8 py-3 bg-primary text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
              >
                {loading ? "Generating..." : "Generate Guests"}
              </button>
            </div>
            {!bulkGuests && (
              <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">
                Allow bulk guest creation above to use this. Adding guests one at a time on a roster still works.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-none relative group overflow-hidden">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-amber-500 mb-8 flex items-center gap-4">
          <span className="h-px w-8 bg-amber-500/30"></span>
          System Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          {/* Turning the second factor down for debugging. In-memory on the
              server, so a restart puts it back — the toggle says so, because an
              admin who forgets they disabled it is the whole risk here. */}
          <div className="space-y-4 md:col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Two-Factor Enforcement
            </label>
            <div className="flex gap-2">
              {(["all", "staff", "off"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleSetTwoFactor(mode)}
                  disabled={twoFactorBusy}
                  className={`flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border ${
                    twoFactorMode === mode
                      ? mode === "off"
                        ? "bg-[#FF4D4D] text-background border-[#FF4D4D]"
                        : "bg-primary text-background border-primary"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600"
                  }`}
                >
                  {mode === "all" ? "Everyone" : mode === "staff" ? "Staff Only" : "Disabled"}
                </button>
              ))}
            </div>
            {twoFactorMode === "off" ? (
              <p className="text-[9px] font-black text-[#FF4D4D] uppercase tracking-widest">
                ⚠ Sign-in requires only a password right now. Resets to the configured mode on server restart.
              </p>
            ) : (
              <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">
                {twoFactorMode
                  ? "Overriding the stored setting until the server restarts."
                  : "Using the stored setting from Admin → Settings. Overrides here last until restart and are refused in production."}
              </p>
            )}
          </div>

          <div className="space-y-4 md:col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Bracket Debug Mode
            </label>
            <button
              onClick={toggleDebugMode}
              className={`w-full px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border flex items-center justify-center gap-3 ${
                debugMode
                  ? "bg-amber-500 text-background border-amber-500"
                  : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${debugMode ? "bg-background animate-pulse" : "bg-neutral-600"}`} />
              {debugMode ? "Debug Mode: ON" : "Debug Mode: OFF"}
            </button>
            <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">
              {debugMode
                ? "Insta-win and random-advance shortcuts are showing on brackets. This browser only."
                : "Unlocks insta-win / auto-resolve on tournament brackets. Admin-only, stored per browser — not a server setting."}
            </p>
          </div>

          {/* Backup policy. The snapshots themselves live on the BACKUPS tab;
              what belongs here is how often they are taken, how many survive,
              and whether restoring is permitted at all. */}
          <div className="space-y-4 md:col-span-2 border-t border-neutral-800 pt-8">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Scheduled Backups
            </label>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const next = !backupEnabled;
                  if (await writeSetting("BACKUP_ENABLED", String(next))) {
                    setBackupEnabled(next);
                    toast(next ? "Scheduled backups on" : "Scheduled backups off", "success");
                  }
                }}
                disabled={policyBusy === "BACKUP_ENABLED"}
                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border ${
                  backupEnabled
                    ? "bg-primary text-background border-primary"
                    : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                {backupEnabled ? "On" : "Off"}
              </button>
              {SCHEDULES.map((s) => (
                <button
                  key={s.cron}
                  onClick={async () => {
                    if (await writeSetting("BACKUP_CRON", s.cron)) {
                      setBackupCron(s.cron);
                      toast(`Backups scheduled ${s.label.toLowerCase()}`, "success");
                    }
                  }}
                  disabled={policyBusy === "BACKUP_CRON"}
                  className={`flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border ${
                    backupCron === s.cron
                      ? "bg-neutral-800 border-neutral-600 text-white"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">
              {backupEnabled
                ? `Running on "${backupCron}". Takes effect immediately — no restart.`
                : "Nothing is scheduled. Manual backups still work from the Backups tab."}
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Backups Kept (Rolling)
            </label>
            <div className="flex gap-4">
              <input
                type="number"
                min={1}
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
              />
              <button
                onClick={async () => {
                  if (await writeSetting("BACKUP_RETENTION", String(Math.max(1, Number(retention) || 14)))) {
                    toast(`Keeping the newest ${retention} backups`, "success");
                  }
                }}
                disabled={policyBusy === "BACKUP_RETENTION"}
                className="px-8 py-3 bg-amber-500 text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
              >
                Apply
              </button>
            </div>
            <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">
              Oldest roll off first. Pinned and aliased backups are never deleted.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Allow Restore
            </label>
            <button
              onClick={async () => {
                const next = !allowRestore;
                if (await writeSetting("BACKUP_ALLOW_RESTORE", String(next))) {
                  setAllowRestore(next);
                  toast(next ? "Restoring allowed" : "Restoring blocked", "success");
                }
              }}
              disabled={policyBusy === "BACKUP_ALLOW_RESTORE"}
              className={`w-full px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border flex items-center justify-center gap-3 disabled:opacity-50 ${
                allowRestore
                  ? "bg-[#FF4D4D] text-background border-[#FF4D4D]"
                  : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${allowRestore ? "bg-background animate-pulse" : "bg-neutral-600"}`} />
              {allowRestore ? "Allowed" : "Blocked"}
            </button>
            <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest italic">
              {allowRestore
                ? "⚠ A restore can overwrite this database right now. Turn it off when you are done."
                : "Off by default. A restore replaces every row in the database, so it must be allowed explicitly."}
            </p>
          </div>

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
                      disabled={!!deletingId}
                      className="text-[10px] font-black uppercase tracking-widest text-red-500 opacity-0 group-hover/row:opacity-100 hover:bg-red-500 hover:text-white border border-red-500/30 px-4 py-1.5 transition-all disabled:opacity-40"
                    >
                      {deletingId === t.id ? "Deleting..." : "Delete"}
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
