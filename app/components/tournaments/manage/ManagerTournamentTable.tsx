"use client";
import React from "react";
import Link from "next/link";
import { Tournament } from "../../../tournaments/types";
import { profileHref } from "../../../utils/api";

/** Owner in bold, co-organizers italic and collapsed behind a count until asked
 *  for. A tournament can have several, and printing every name on every row
 *  turns the column into the widest thing in the table for information most
 *  rows do not need. Collapsed shows who is responsible; one click shows who
 *  else can act. */
function Staff({ t, compact = false }: { t: Tournament; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const owner = t.createdBy;
  const co = (t.organizers ?? []).map((o) => o.user).filter(Boolean);

  if (!owner && co.length === 0) {
    return <span className="text-xs text-[#888888]">—</span>;
  }

  return (
    <div className={`flex flex-col ${compact ? "gap-1 items-end" : "gap-1.5"}`}>
      <div className="flex items-center gap-2 min-w-0">
        {owner ? (
          // Weight carries the role instead of a label: bold owner, italic
          // co-organizers. Two tags per row was more chrome than information.
          <Link href={profileHref(owner)} className="text-sm font-bold text-white truncate hover:text-primary transition-colors">
            {owner.username}
          </Link>
        ) : (
          <span className="text-xs text-[#888888]">No owner</span>
        )}
        {co.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} ${co.length} co-organizer${co.length === 1 ? "" : "s"}`}
            className="shrink-0 flex items-center gap-1 px-1.5 h-5 rounded border border-white/15 text-[10px] font-semibold text-white/60 hover:text-white hover:border-white/40 transition-colors"
          >
            +{co.length}
            <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
          </button>
        )}
      </div>

      {open && co.length > 0 && (
        <ul className={`flex flex-col gap-0.5 ${compact ? "items-end" : "pl-1"}`}>
          {co.map((u) => (
            <li key={u.id ?? u.username} className="min-w-0">
              <Link href={profileHref(u)} className="block text-xs italic text-[#B0B0B0] truncate hover:text-primary transition-colors">
                {u.username}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ManagerTournamentTableProps {
  tournaments: Tournament[];
  onComplete: (id: string) => void;
  completingId?: string | null;
}

export default function ManagerTournamentTable({ tournaments, onComplete, completingId }: ManagerTournamentTableProps) {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block w-full bg-background border border-white/20 rounded overflow-hidden font-sans">
        <table className="w-full text-left border-collapse">
          <thead className="bg-background border-b border-white/20">
            <tr>
              <th className="p-4 text-xs font-semibold text-[#888888]">Tournament Name</th>
              <th className="p-4 text-xs font-semibold text-[#888888]">Game Context</th>
              <th className="p-4 text-xs font-semibold text-[#888888]">Organizers</th>
              <th className="p-4 text-xs font-semibold text-[#888888]">Status</th>
              <th className="p-4 text-xs font-semibold text-[#888888]">Format</th>
              <th className="p-4 text-xs font-semibold text-[#888888]">Capacity</th>
              <th className="p-4 text-xs font-semibold text-[#888888] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {tournaments.map((t) => (
              <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{t.name}</span>
                    <span className="text-xs text-[#888888] font-mono mt-0.5">ID: {t.id}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm text-[#E0E0E0]">{t.game?.name || (typeof t.format === 'object' ? t.format?.gameName : null) || "Not set"}</span>
                </td>
                <td className="p-4 max-w-[220px]">
                  <Staff t={t} />
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                    t.status === "OPEN" ? "bg-primary/10 text-primary border border-primary/30" :
                    t.status === "ONGOING" ? "bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/30" :
                    "bg-white/10 text-white/50 border border-white/20"
                  }`}>
                    {t.status}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-[#E0E0E0] capitalize">
                    {((t.format && typeof t.format === 'object') ? t.format.system : "Unknown")?.replace("_", " ")}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{t.participants?.length} / {t.maxPlayers}</span>
                    <div className="w-24 h-1.5 bg-white/10 mt-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all" 
                        style={{ width: `${((t.participants?.length || 0) / t.maxPlayers) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link 
                      href={`/tournaments/${t.id}/lobby`}
                      className="px-3 py-1.5 bg-background hover:bg-white/10 border border-white/20 text-white text-xs font-semibold rounded transition-colors"
                    >
                      Lobby
                    </Link>
                    <Link 
                      href={`/tournaments/${t.id}/manage`}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 text-xs font-semibold rounded transition-colors"
                    >
                      Manage
                    </Link>
                    {t.status !== "COMPLETED" && (
                      <button
                        onClick={() => onComplete(t.id)}
                        disabled={!!completingId}
                        className="px-3 py-1.5 bg-[#FF4D4D]/10 hover:bg-[#FF4D4D] text-[#FF4D4D] hover:text-white border border-[#FF4D4D]/20 text-xs font-semibold rounded transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {completingId === t.id ? "Finalizing..." : "Finalize"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {tournaments.length === 0 && (
              <tr>
                <td colSpan={7} className="p-20 text-center">
                  <p className="text-sm font-semibold text-[#888888]">No tournaments found</p>
                  <Link href="/tournaments/create" className="mt-4 inline-block text-primary text-sm font-semibold hover:underline">
                    + Create Your First Tournament
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="flex flex-col gap-4 lg:hidden font-sans">
        {tournaments.map((t) => (
          <div key={t.id} className="bg-[#000000] border border-white/20 rounded p-4 flex flex-col gap-4">
             <div className="flex justify-between items-start gap-4">
               <div className="flex flex-col">
                 <span className="text-base font-semibold text-white leading-tight">{t.name}</span>
                 <span className="text-xs text-[#888888] font-mono mt-1">ID: {t.id}</span>
               </div>
               <span className={`shrink-0 px-2 py-0.5 text-xs font-semibold rounded ${
                 t.status === "OPEN" ? "bg-primary/10 text-primary border border-primary/30" :
                 t.status === "ONGOING" ? "bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/30" :
                 "bg-white/10 text-white/50 border border-white/20"
               }`}>
                 {t.status}
               </span>
             </div>

             <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
               <span className="text-xs text-[#888888] shrink-0">Organizers</span>
               <div className="min-w-0 text-right"><Staff t={t} compact /></div>
             </div>

             <div className="grid grid-cols-3 gap-2 border-y border-white/10 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#888888]">Game</span>
                  <span className="text-sm text-white truncate">{t.game?.name || (typeof t.format === 'object' ? t.format?.gameName : null) || "Not set"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#888888]">Format</span>
                  <span className="text-sm text-white truncate capitalize">{((t.format && typeof t.format === 'object') ? t.format.system : "Unknown")?.replace("_", " ")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#888888]">Capacity</span>
                  <span className="text-sm font-semibold text-white">{t.participants?.length} / {t.maxPlayers}</span>
                </div>
             </div>

             <div className="flex items-center gap-2 pt-1">
                <Link href={`/tournaments/${t.id}/lobby`} className="flex-1 text-center px-2 py-2 bg-background border border-white/20 text-white text-xs font-semibold rounded transition-colors">
                  Lobby
                </Link>
                <Link href={`/tournaments/${t.id}/manage`} className="flex-1 text-center px-2 py-2 bg-primary/10 text-primary border border-primary/20 text-xs font-semibold rounded transition-colors">
                  Manage
                </Link>
                {t.status !== "COMPLETED" && (
                  <button onClick={() => onComplete(t.id)} disabled={!!completingId} className="flex-1 text-center px-2 py-2 bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/20 text-xs font-semibold rounded transition-colors disabled:opacity-50 disabled:pointer-events-none">
                    {completingId === t.id ? "Finalizing..." : "Finalize"}
                  </button>
                )}
             </div>
          </div>
        ))}
        {tournaments.length === 0 && (
          <div className="p-8 text-center bg-[#000000] border border-white/20 rounded">
             <p className="text-sm font-semibold text-[#888888] mb-4">No tournaments found</p>
             <Link href="/tournaments/create" className="px-6 py-2.5 bg-background text-white border border-white/20 text-sm font-semibold rounded transition-colors hover:bg-white/10">
                Create First Tournament
             </Link>
          </div>
        )}
      </div>
    </>
  );
}
