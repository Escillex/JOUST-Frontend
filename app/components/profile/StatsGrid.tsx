"use client";

import React from "react";
import * as m from "motion/react";

interface LeaderboardStats {
  points: number;
  tournamentsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
  omw: number;
  oomw: number;
}

import { BentoBox } from "../ui/Bento";

interface StatsGridProps {
  stats: LeaderboardStats | null;
  variant?: "default" | "bento";
}

export default function StatsGrid({ stats, variant = "default" }: StatsGridProps) {
  if (!stats) {
    const emptyState = (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-12 min-h-[300px] bg-component-background border-2 border-component-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(var(--color-primary),0.02)_1px,transparent_0)] bg-[size:16px_16px] pointer-events-none" />
        <svg className="w-16 h-16 text-primary/10 mb-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest leading-relaxed max-w-xs font-poppins">
          No statistics available.
        </p>
      </div>
    );
    return variant === "bento" ? <BentoBox theme="default" noPadding className="p-0 overflow-hidden">{emptyState}</BentoBox> : emptyState;
  }

  const statItems = [
    { label: "POINTS", value: stats.points, color: "default" },
    { label: "WIN_RATE", value: `${(stats.matchWinPct * 100).toFixed(0)}%`, color: "primary" },
    { label: "WINS", value: stats.wins, color: "default" },
    { label: "LOSSES", value: stats.losses, color: "default" },
    { label: "DRAWS", value: stats.draws, color: "default" },
    { label: "TOURNAMENTS", value: stats.tournamentsPlayed, color: "default" },
    { label: "OMW", value: `${(stats.omw * 100).toFixed(1)}%`, color: "default", title: "Opponent Match Win Rate" },
    { label: "OOMW", value: `${(stats.oomw * 100).toFixed(1)}%`, color: "default", title: "Opponent's Opponent Match Win Rate" },
  ];

  const grid = (
    <div className={`grid ${variant === "bento" ? "grid-cols-4" : "grid-cols-2 md:grid-cols-4"} h-full`}>
      {statItems.map((item, idx) => (
        <m.motion.div 
          key={item.label}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: idx * 0.05 }}
          title={item.title}
          className={`
            p-8 flex flex-col justify-center items-center transition-all border border-component-border bg-component-background group ${item.title ? "cursor-help" : ""}
          `}
        >
          <span className="text-white/30 text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-center font-poppins">
            {item.label}
          </span>
          <span className={`text-4xl font-black tracking-tighter font-poppins ${item.color === "primary" ? "text-primary" : "text-white"}`}>
            {item.value}
          </span>
        </m.motion.div>
      ))}
    </div>
  );

  return variant === "bento" ? (
    <div className="h-full bg-component-background">
      {grid}
    </div>
  ) : grid;
}
