"use client";

import React from "react";
import Link from "next/link";
import { ProfileTournamentResult } from "../../tournaments/types";

/** A medal for the podium, a rank chip otherwise, and a neutral dash when the
 *  placement predates placement persistence. Kept as one function so the three
 *  states stay visually consistent. */
function PlacementBadge({ placement }: { placement: number | null }) {
  if (placement === 1 || placement === 2 || placement === 3) {
    const medal = placement === 1 ? "🥇" : placement === 2 ? "🥈" : "🥉";
    const ring =
      placement === 1
        ? "border-yellow-400/50 bg-yellow-400/10"
        : placement === 2
          ? "border-white/40 bg-white/10"
          : "border-amber-600/50 bg-amber-600/10";
    return (
      <span
        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full border text-lg ${ring}`}
        title={`Placed #${placement}`}
      >
        {medal}
      </span>
    );
  }
  return (
    <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-black text-white/40 font-poppins">
      {placement ? `#${placement}` : "—"}
    </span>
  );
}

export default function TournamentHistory({
  results,
}: {
  results: ProfileTournamentResult[];
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black uppercase tracking-widest text-foreground font-poppins flex items-center gap-3">
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Tournament History
        </h3>
      </div>

      {results.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-2xl py-16 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 font-poppins">
            No completed tournaments yet
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/tournaments/${r.id}`}
              className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-primary/40 hover:bg-white/[0.04] transition-all group"
            >
              <PlacementBadge placement={r.placement} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black uppercase tracking-tight text-white truncate font-poppins group-hover:text-primary transition-colors">
                  {r.name}
                </p>
                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mt-0.5 truncate">
                  {[r.game, r.format?.replace(/_/g, " ")].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="text-[9px] font-black text-white/25 uppercase tracking-widest shrink-0 font-poppins">
                {new Date(r.date).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
