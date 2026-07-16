"use client";
import React from "react";
import Link from "next/link";
import { Tournament } from "../../../tournaments/types";

interface ManagerTournamentTableProps {
  tournaments: Tournament[];
  onComplete: (id: string) => void;
  completingId?: string | null;
}

export default function ManagerTournamentTable({ tournaments, onComplete, completingId }: ManagerTournamentTableProps) {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block w-full bg-[#1B1B1B] border border-white/20 rounded overflow-hidden font-sans">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1B1B1B] border-b border-white/20">
            <tr>
              <th className="p-4 text-xs font-semibold text-[#888888]">Tournament Name</th>
              <th className="p-4 text-xs font-semibold text-[#888888]">Game Context</th>
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
                    <span className="text-sm font-semibold text-white group-hover:text-[#52B946] transition-colors">{t.name}</span>
                    <span className="text-xs text-[#888888] font-mono mt-0.5">ID: {t.id}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm text-[#E0E0E0]">{(typeof t.format === 'object' ? t.format?.gameName : null) || "General"}</span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                    t.status === "OPEN" ? "bg-[#52B946]/10 text-[#52B946] border border-[#52B946]/30" :
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
                        className="h-full bg-[#52B946] transition-all" 
                        style={{ width: `${((t.participants?.length || 0) / t.maxPlayers) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link 
                      href={`/tournaments/${t.id}/lobby`}
                      className="px-3 py-1.5 bg-[#1B1B1B] hover:bg-white/10 border border-white/20 text-white text-xs font-semibold rounded transition-colors"
                    >
                      Lobby
                    </Link>
                    <Link 
                      href={`/tournaments/${t.id}/manage`}
                      className="px-3 py-1.5 bg-[#52B946]/10 hover:bg-[#52B946] text-[#52B946] hover:text-black border border-[#52B946]/20 text-xs font-semibold rounded transition-colors"
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
                <td colSpan={6} className="p-20 text-center">
                  <p className="text-sm font-semibold text-[#888888]">No tournaments found</p>
                  <Link href="/tournaments/create" className="mt-4 inline-block text-[#52B946] text-sm font-semibold hover:underline">
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
                 t.status === "OPEN" ? "bg-[#52B946]/10 text-[#52B946] border border-[#52B946]/30" :
                 t.status === "ONGOING" ? "bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/30" :
                 "bg-white/10 text-white/50 border border-white/20"
               }`}>
                 {t.status}
               </span>
             </div>

             <div className="grid grid-cols-3 gap-2 border-y border-white/10 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#888888]">Game</span>
                  <span className="text-sm text-white truncate">{(typeof t.format === 'object' ? t.format?.gameName : null) || "General"}</span>
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
                <Link href={`/tournaments/${t.id}/lobby`} className="flex-1 text-center px-2 py-2 bg-[#1B1B1B] border border-white/20 text-white text-xs font-semibold rounded transition-colors">
                  Lobby
                </Link>
                <Link href={`/tournaments/${t.id}/manage`} className="flex-1 text-center px-2 py-2 bg-[#52B946]/10 text-[#52B946] border border-[#52B946]/20 text-xs font-semibold rounded transition-colors">
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
             <Link href="/tournaments/create" className="px-6 py-2.5 bg-[#1B1B1B] text-white border border-white/20 text-sm font-semibold rounded transition-colors hover:bg-white/10">
                Create First Tournament
             </Link>
          </div>
        )}
      </div>
    </>
  );
}
