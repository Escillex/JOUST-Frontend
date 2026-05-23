"use client";

import React from "react";
import { motion } from "motion/react";
import Link from "next/link";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  points: number;
  matchWinPct: number;
  wins: number;
  losses: number;
}

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  idx: number;
}

export default function LeaderboardCard({ entry, idx }: LeaderboardCardProps) {
  // Determine specialized styling for Top 3 using theme variables
  const isRank1 = entry.rank === 1;
  const isRank2 = entry.rank === 2;
  const isRank3 = entry.rank === 3;
  const isTop3 = isRank1 || isRank2 || isRank3;

  let rankColor = "var(--color-foreground)";
  let borderColor = "rgba(var(--color-foreground), 0.1)";
  let bgColor = "rgba(var(--color-primary), 0.02)";
  let glowOpacity = "0";

  if (isRank1) {
    rankColor = "var(--color-rank-1)";
    borderColor = "var(--color-rank-1)";
    bgColor = "rgba(var(--color-rank-1), 0.1)";
    glowOpacity = "0.4";
  } else if (isRank2) {
    rankColor = "var(--color-rank-2)";
    borderColor = "rgba(var(--color-primary), 0.5)";
    bgColor = "rgba(var(--color-primary), 0.05)";
    glowOpacity = "0.2";
  } else if (isRank3) {
    rankColor = "var(--color-rank-3)";
    borderColor = "rgba(var(--color-primary-dark), 0.5)";
    bgColor = "rgba(var(--color-primary-dark), 0.05)";
    glowOpacity = "0.1";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: Math.min(idx * 0.05, 0.3) }}
      className={`group relative w-full mb-4 ${isTop3 ? 'z-10' : 'z-0'}`}
    >
      <Link 
        href={`/profile/${entry.userId}`}
        className="flex items-center gap-4 md:gap-8 border transition-all duration-500 p-4 md:p-6 relative overflow-hidden rounded-none"
        style={{ 
          borderColor: isTop3 ? borderColor : undefined,
          backgroundColor: isTop3 ? bgColor : undefined,
        }}
      >
        {/* Rank Number */}
        <div className="flex-none w-12 md:w-16 flex items-center justify-center">
          <span 
            className={`text-xl md:text-3xl font-black font-poppins transition-colors ${isRank1 ? 'neon-glow' : ''}`}
            style={{ color: isTop3 ? rankColor : "rgba(237, 237, 237, 0.2)" }}
          >
            #{entry.rank.toString().padStart(2, '0')}
          </span>
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h4 className={`text-lg md:text-2xl font-black uppercase tracking-tight truncate group-hover:translate-x-2 transition-transform duration-500 font-poppins ${isTop3 ? 'text-foreground' : 'text-foreground/80'}`}>
            {entry.username}
          </h4>
          <div className="flex items-center gap-3 mt-1">
             <div className="h-px w-4 bg-primary/20" style={{ backgroundColor: isTop3 ? rankColor : undefined }} />
             <span className="text-[9px] font-black uppercase tracking-[0.3em] text-foreground/30">
               {isRank1 ? 'Grand Master' : isTop3 ? 'Elite Player' : 'Active Player'}
             </span>
          </div>
        </div>

        {/* Performance Visualization (Desktop Only) */}
        <div className="hidden lg:flex flex-none items-center gap-12 w-80">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black uppercase tracking-widest text-foreground/30 mb-1">Points</span>
            <span className={`text-sm font-black ${isTop3 ? 'text-primary' : 'text-foreground/80'}`}>{entry.points}</span>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex justify-between items-center px-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-foreground/30">Ratio</span>
              <span className="text-[9px] font-black text-primary">{(entry.matchWinPct * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1 bg-foreground/5 overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 whileInView={{ width: `${entry.matchWinPct * 100}%` }}
                 transition={{ duration: 1, delay: 0.5 }}
                 className="h-full bg-primary shadow-[0_0_10px_var(--color-primary-glow)]"
                 style={{ backgroundColor: isRank1 ? 'var(--color-rank-1)' : isRank2 ? 'var(--color-rank-2)' : isRank3 ? 'var(--color-rank-3)' : 'var(--color-primary)' }}
               />
            </div>
          </div>
        </div>

        {/* Mobile Stats Summary */}
        <div className="lg:hidden flex flex-col items-end">
          <span className="text-lg font-black text-primary">{(entry.matchWinPct * 100).toFixed(0)}%</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-foreground/20">{entry.wins}W - {entry.losses}L</span>
        </div>

        {/* Decorative ID Fragment / Glow */}
        {isTop3 && (
          <div 
            className="absolute -right-12 -top-12 w-24 h-24 blur-[40px] pointer-events-none"
            style={{ backgroundColor: rankColor, opacity: glowOpacity }}
          />
        )}
        <div className="absolute top-0 right-0 w-1 h-0 group-hover:h-full bg-primary transition-all duration-700 shadow-[0_0_10px_var(--color-primary-glow)]" />
      </Link>
    </motion.div>
  );
}
