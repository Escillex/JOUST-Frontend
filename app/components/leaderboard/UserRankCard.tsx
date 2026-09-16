"use client";
import { displayNameOf } from "../../utils/api";
import React from "react";
import { motion } from "motion/react";

interface UserRankProps {
  identity: {
    username: string;
    displayName?: string | null;
  };
  /** null means the viewer has no rank on this board yet — rendered as
   *  "Unranked" rather than hiding the card, so it's always clear where
   *  they stand (or don't) on whatever's currently selected. */
  rank: number | null;
  loading?: boolean;
  /** Which board this is (e.g. "Beyblade board") — always the tab that's
   *  currently selected, never a separate all-games figure. */
  scopeLabel?: string;
  /** Scrolls to and flashes the viewer's own row in the table below.
   *  Only meaningful when ranked, so the card is inert without it. */
  onJump?: () => void;
}

export default function UserRankCard({ identity, rank, loading, scopeLabel, onJump }: UserRankProps) {
  if (loading) {
    return <div className="w-full h-24 md:h-28 bg-surface border border-white/5 animate-pulse" />;
  }

  const ranked = rank !== null;

  return (
    <motion.button
      type="button"
      disabled={!ranked}
      onClick={ranked ? onJump : undefined}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group w-full flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8 bg-surface border border-white/5 p-5 md:px-10 md:py-8 text-left transition-all duration-300 enabled:hover:border-primary/40 enabled:hover:shadow-[16px_16px_0px_0px_rgba(82,185,70,0.08)] disabled:cursor-default"
    >
      <div className="min-w-0">
        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-primary font-poppins">
          Your standing
        </p>
        <h2 className="mt-1 text-2xl md:text-6xl font-black uppercase tracking-tighter text-white leading-none font-poppins italic truncate">
          {displayNameOf(identity)}
        </h2>
        {scopeLabel && (
          <p className="mt-1.5 text-[11px] md:text-xs text-white/35 font-poppins normal-case truncate">
            on the {scopeLabel}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
        {ranked ? (
          <div className="bg-primary text-black px-6 py-2.5 md:px-8 md:py-3 text-base md:text-xl font-black uppercase tracking-widest shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)]">
            Rank #{rank}
          </div>
        ) : (
          <div className="border-2 border-white/10 text-white/40 px-6 py-2.5 md:px-8 md:py-3 text-base md:text-xl font-black uppercase tracking-widest">
            Unranked
          </div>
        )}
        {ranked && (
          <span className="text-white/20 group-hover:text-primary group-hover:translate-y-0.5 transition-all text-xl md:text-2xl" aria-hidden="true">
            ↓
          </span>
        )}
      </div>
    </motion.button>
  );
}
