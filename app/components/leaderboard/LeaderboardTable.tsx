"use client";
import { GlobalLeaderboardEntry } from "../../tournaments/types";
import React from "react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { resolveImageUrl } from "../../utils/api";


interface LeaderboardTableProps {
  entries: GlobalLeaderboardEntry[];
  loading?: boolean;
  variant?: "default" | "bento";
  limit?: number;
  gameLabel?: string;
}

export default function LeaderboardTable({ entries, loading, variant = "default", limit, gameLabel }: LeaderboardTableProps) {
  const displayEntries = React.useMemo(() => 
    limit ? (entries || []).slice(0, limit) : (entries || []),
  [entries, limit]);

  if (loading) {
    return (
      <div className="w-full space-y-4 animate-pulse">
        {[...Array(variant === "bento" ? 3 : 8)].map((_, i) => (
          <div key={i} className="h-16 bg-background border-2 border-white/10" />
        ))}
      </div>
    );
  }

  // Specialized Bento View (No Table, no scrollbars)
  if (variant === "bento") {
    return (
      <div className="h-full flex flex-col bg-surface border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-surface shrink-0">
           <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-primary font-poppins italic">LEADERBOARD</h3>
           <div className="text-[8px] font-black text-white/30 uppercase tracking-widest font-poppins">LIVE FEED</div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="divide-y-2 divide-white/5">
            {displayEntries.map((entry, idx) => (
              <motion.div 
                key={entry.userId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5 flex items-center justify-between group hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Show the rank number sent by the server, not the row
                      position. When players are tied, the server gives them
                      the same rank, and counting rows would hide that. */}
                  <span className={`text-2xl font-black italic font-poppins tracking-tighter ${entry.rank <= 3 ? 'text-primary' : 'text-white/20'}`}>
                    #{String(entry.rank ?? idx + 1).padStart(2, '0')}
                  </span>
                  <div className="relative w-12 h-12 bg-surface border border-white/10 flex items-center justify-center font-black text-xs text-primary overflow-hidden shrink-0">
                    {entry.avatarUrl ? (
                      <Image 
                        src={resolveImageUrl(entry.avatarUrl)}
                        alt={entry.username} 
                        fill 
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      entry.username?.[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <Link href={`/profile/${entry.userId}`} className="text-sm font-black uppercase tracking-tight text-white font-poppins italic hover:text-primary transition-colors truncate">
                      {entry.username}
                    </Link>
                    <span className="text-[7px] font-black text-white/20 uppercase tracking-widest truncate">
                      ID // {entry.userId.slice(0, 6)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xl font-black text-white font-poppins">{entry.points}</span>
                  <span className="text-[7px] font-black text-primary uppercase tracking-widest">POINTS</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default Full Table View
  return (
    <div className="bg-surface border border-white/5 shadow-[16px_16px_0px_0px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Integrated Header (Image 2 moved to Image 3) */}
      <div className="p-10 border-b border-white/5 flex flex-col md:flex-row md:items-end justify-between gap-8 bg-surface">
        <div className="space-y-1">
          <h2 className="text-6xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none font-poppins italic">
            LEADERBOARD
          </h2>
          <p className="text-primary text-[10px] font-black uppercase tracking-[0.5em]">
            TOP COMPETITORS // {gameLabel || "ALL GAMES"}
          </p>
        </div>
        <div className="flex flex-col items-end">
           <div className="text-white/20 text-[10px] font-black uppercase tracking-widest mb-1">DATA STATUS</div>
           <div className="px-4 py-1.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
             {entries.length} ENTRIES LOADED
           </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto selection:bg-primary selection:text-black no-scrollbar">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-surface/50 border-b border-white/5">
              <th className="py-6 px-10 text-[10px] font-black text-white/40 uppercase tracking-[0.5em] font-poppins italic">RANK</th>
              <th className="py-6 px-10 text-[10px] font-black text-white/40 uppercase tracking-[0.5em] font-poppins italic">COMPETITOR</th>
              <th className="py-6 px-10 text-[10px] font-black text-white/40 uppercase tracking-[0.5em] font-poppins italic text-center">POINTS</th>
              <th className="py-6 px-10 text-[10px] font-black text-white/40 uppercase tracking-[0.5em] font-poppins italic text-center">W / L / D</th>
              {/* The OMW / OOMW column stays removed, but not for the reason
                  originally noted here. The global leaderboard does not send 0
                  for these: `leaderboard.service.ts:312-313` fills BOTH fields
                  with the player's own `winRate`. That is worse than a zero —
                  it is a plausible-looking number that is not opponent
                  match-win at all, so rendering it would state something false.
                  Per-tournament standings do compute the real values; only this
                  global view substitutes. Restoring the column depends on 7.2. */}
              <th className="py-6 px-10 text-[10px] font-black text-white/40 uppercase tracking-[0.5em] font-poppins italic text-right">WIN RATE</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-white/10">
            {displayEntries.map((entry, idx) => (
              <motion.tr 
                key={entry.userId} 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.03 }}
                className="group hover:bg-primary/5 transition-colors bg-background"
              >
                <td className="py-8 px-10">
                  {/* Server rank instead of row position — see comment on
                      the compact layout above. Tied players share a rank. */}
                  <span className={`text-5xl font-black tracking-tighter font-poppins italic ${entry.rank <= 3 ? 'text-primary' : 'text-white/10'}`}>
                    #{String(entry.rank ?? idx + 1).padStart(2, '0')}
                  </span>
                </td>
                <td className="py-8 px-10">
                  <div className="flex items-center gap-8">
                    <div className="relative w-16 h-16 bg-surface border-2 border-white/10 group-hover:border-primary flex items-center justify-center font-black text-2xl text-primary transition-all overflow-hidden shrink-0">
                      {entry.avatarUrl ? (
                        <Image 
                          src={resolveImageUrl(entry.avatarUrl)}
                          alt={entry.username} 
                          fill 
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        entry.username?.[0]?.toUpperCase() || "U"
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/profile/${entry.userId}`} className="text-2xl font-black uppercase tracking-tight text-white hover:text-primary transition-colors block font-poppins italic truncate">
                        {entry.username}
                      </Link>
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] font-poppins block truncate">
                        VERIFIED ID // {entry.userId.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-8 px-10 text-center">
                  <span className="text-4xl font-black text-white tracking-tighter font-poppins">
                    {entry.points}
                  </span>
                </td>
                <td className="py-8 px-10 text-center">
                  <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-surface border border-white/10">
                    <span className="text-sm font-black text-primary">{entry.wins}</span>
                    <span className="text-[10px] font-black text-white/20">/</span>
                    <span className="text-sm font-black text-white/40">{entry.losses}</span>
                    <span className="text-[10px] font-black text-white/20">/</span>
                    <span className="text-sm font-black text-white/40">{entry.draws}</span>
                  </div>
                </td>
                <td className="py-8 px-10 text-right">
                  <span className={`text-4xl font-black font-poppins italic ${entry.rank <= 3 ? "text-primary" : "text-white"}`}>
                    {(entry.matchWinPct * 100).toFixed(0)}%
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
