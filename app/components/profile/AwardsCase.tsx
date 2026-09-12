"use client";

import type { UserAward } from "../../tournaments/types";
import Medal from "../awards/Medal";
import Plaque from "../awards/Plaque";
import { groupAwards } from "../awards/group";

/**
 * Every award a person holds — the header only shows what they chose to pin.
 * Repeats are grouped (×N) with each date and note one tap away.
 *
 * Renders nothing at all for someone with no awards: an empty trophy case is
 * clutter on most profiles, and says nothing a missing one does not.
 */
const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function AwardsCase({ awards }: { awards: UserAward[] }) {
  const groups = groupAwards(awards);
  if (groups.length === 0) return null;

  const medals = groups.filter((g) => g.kind === "MEDAL");
  const plaques = groups.filter((g) => g.kind === "PLAQUE");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black uppercase tracking-widest text-foreground font-poppins flex items-center gap-3">
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="9" r="6" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.5 14 7 22l5-3 5 3-1.5-8" />
          </svg>
          Awards
        </h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
          {awards.length} total
        </span>
      </div>

      <div className="bg-component-background border-2 border-component-border p-6 md:p-8 space-y-8">
        {medals.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-4">Medals</p>
            <div className="flex flex-wrap gap-6">
              {medals.map((g) => (
                <div key={g.awardId} className="w-24 text-center">
                  <Medal
                    name={g.name}
                    imageUrl={g.imageUrl}
                    description={g.description}
                    grants={g.grants}
                    sizeClass="w-24 h-24"
                  />
                  <p className="text-[10px] font-bold text-white/70 mt-2 leading-tight line-clamp-2">{g.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {plaques.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-4">Plaques</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plaques.map((g) => (
                <div key={g.awardId}>
                  <Plaque name={g.name} imageUrl={g.imageUrl} size="md" count={g.grants.length} />
                  <p className="text-[10px] text-white/40 mt-2">
                    {g.grants.map((x) => date(x.awardedAt) + (x.note ? ` — ${x.note}` : "")).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
