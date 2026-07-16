"use client";
import React from "react";
import { motion } from "motion/react";

interface UserRankProps {
  stats: {
    username: string;
    rank: number;
    points: number;
    wins: number;
    losses: number;
    draws: number;
    matchWinPct: number;
    omw: number;
    oomw: number;
  } | null;
  loading?: boolean;
}

export default function UserRankCard({ stats, loading }: UserRankProps) {
  if (loading) {
    return (
      <div className="w-full bg-surface border-4 border-white/10 p-12 animate-pulse">
        <div className="h-20 bg-white/5 w-1/2 mb-8" />
        <div className="grid grid-cols-3 gap-12">
            <div className="h-24 bg-white/5" />
            <div className="h-24 bg-white/5" />
            <div className="h-24 bg-white/5" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative w-full bg-surface border border-white/5 p-12 hover:shadow-[24px_24px_0px_0px_rgba(82,185,70,0.05)] transition-all duration-500 overflow-hidden"
    >
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-12">
        <div className="text-center md:text-left space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-primary mb-4 font-poppins">CURRENT STANDING</p>
            <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white leading-none font-poppins italic">
              {stats.username}
            </h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-6 justify-center md:justify-start">
            <div className="bg-primary text-black px-8 py-3 text-xl font-black uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)]">
              RANK #{stats.rank}
            </div>
            <div className="bg-surface border-2 border-white/10 px-8 py-3 text-xl font-black uppercase tracking-widest text-white">
              {stats.points} POINTS
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 border-t-4 md:border-t-0 md:border-l-4 border-white/10 pt-12 md:pt-0 md:pl-24 w-full md:w-auto">
          <div className="text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-2 font-poppins">WINS</p>
            <p className="text-4xl md:text-5xl font-black text-white italic tracking-tighter font-poppins">{stats.wins}</p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-2 font-poppins">LOSSES</p>
            <p className="text-4xl md:text-5xl font-black text-white/40 italic tracking-tighter font-poppins">{stats.losses}</p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-2 font-poppins">DRAWS</p>
            <p className="text-4xl md:text-5xl font-black text-white/20 italic tracking-tighter font-poppins">{stats.draws}</p>
          </div>
          {/* The OMW / OOMW tiles were removed: the backend never
              calculates those tiebreaker values (it always sends 0 or
              just repeats the win rate), so the tiles showed numbers
              that were not real. */}
          <div className="text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-2 font-poppins">WIN RATE</p>
            <p className="text-4xl md:text-5xl font-black text-primary italic tracking-tighter font-poppins">
              {(stats.matchWinPct * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Industrial Accents */}
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <div className="text-[8px] font-black uppercase tracking-widest text-white rotate-90 origin-top-right font-poppins">
          SESSION ACTIVE // {new Date().getFullYear()}
        </div>
      </div>
    </motion.div>
  );
}
