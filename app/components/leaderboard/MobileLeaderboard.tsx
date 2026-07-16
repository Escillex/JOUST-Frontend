"use client";
import React from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { resolveImageUrl } from "../../utils/api";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
  omw: number;
  oomw: number;
  avatarUrl?: string | null;
}

interface Props {
  entries: LeaderboardEntry[];
  loading?: boolean;
  gameLabel?: string;
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

export default function MobileLeaderboard({ entries, loading, gameLabel }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 rounded-sm animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-4">
        <div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white font-poppins">
            Leaderboard
          </h2>
          <p className="text-[8px] font-black text-primary/70 uppercase tracking-[0.3em]">
            {gameLabel || "ALL GAMES"}
          </p>
        </div>
        <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">
          {entries.length} Players
        </span>
      </div>

      {entries.map((entry, idx) => {
        // Top-3 styling and the rank number both follow the rank sent
        // by the server, not the row position. When players are tied
        // the server gives them the same rank, and counting rows would
        // hide that tie.
        const rank = entry.rank ?? idx + 1;
        const isTop3 = rank <= 3;
        const medalColor = MEDAL_COLORS[rank - 1] ?? "text-white/20";
        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className={`flex items-center gap-4 px-4 py-3 rounded-sm border transition-all ${
              isTop3
                ? "bg-primary/5 border-primary/20"
                : "bg-white/[0.03] border-white/5"
            }`}
          >
            {/* Rank */}
            <span className={`text-xl font-black italic font-poppins w-10 shrink-0 ${isTop3 ? medalColor : "text-white/20"}`}>
              #{String(rank).padStart(2, "0")}
            </span>

            {/* Avatar */}
            <div
              className={`relative w-9 h-9 rounded-sm flex items-center justify-center font-black text-sm shrink-0 overflow-hidden ${
                isTop3 ? "bg-primary text-black" : "bg-white/5 text-white/40"
              }`}
            >
              {entry.avatarUrl ? (
                <Image
                  src={resolveImageUrl(entry.avatarUrl)}
                  alt={entry.username}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                entry.username?.[0]?.toUpperCase()
              )}
            </div>

            {/* Name + sub */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black uppercase tracking-tight truncate ${isTop3 ? "text-white" : "text-white/60"}`}>
                {entry.username}
              </p>
              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                {entry.wins}W {entry.losses}L — {(entry.matchWinPct * 100).toFixed(0)}% win rate
              </p>
            </div>

            {/* Points */}
            <div className="flex flex-col items-end shrink-0">
              <span className={`text-xl font-black font-poppins ${isTop3 ? "text-primary" : "text-white/40"}`}>
                {entry.points}
              </span>
              <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">pts</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
