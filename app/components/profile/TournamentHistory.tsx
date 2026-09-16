"use client";

import React from "react";
import Link from "next/link";
import { ProfileTournamentResult } from "../../tournaments/types";
import { formatDay } from "./format";

/** A square placement chip: gold, silver and bronze for the podium, neutral
 *  otherwise, and a dash when the placement predates placement persistence. */
const PODIUM: Record<number, string> = {
  1: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300",
  2: "border-[#C9CDD3]/50 bg-[#C9CDD3]/10 text-[#C9CDD3]",
  3: "border-[#C98A4B]/50 bg-[#C98A4B]/10 text-[#D99A5B]",
};

function PlacementBadge({ placement }: { placement: number | null }) {
  return (
    <span
      className={`w-10 h-10 shrink-0 flex items-center justify-center border text-xs font-black font-poppins ${
        (placement && PODIUM[placement]) || "border-component-border bg-white/[0.03] text-white/70"
      }`}
      title={placement ? `Finished #${placement}` : "Placement not recorded"}
    >
      {placement ? `#${placement}` : "—"}
    </span>
  );
}

/** Past results with their placement. Two per row on desktop. */
export default function TournamentHistory({
  results,
  twoUp = false,
}: {
  results: ProfileTournamentResult[];
  twoUp?: boolean;
}) {
  if (results.length === 0) {
    return (
      <p className="bg-component-background border border-component-border py-10 text-center text-sm text-white/55">
        No completed tournaments yet.
      </p>
    );
  }

  return (
    <ul className={`bg-component-background border border-component-border grid ${twoUp ? "grid-cols-2" : "grid-cols-1"}`}>
      {results.map((r, i) => (
        <li
          key={r.id}
          className={`border-component-border/60 ${i >= (twoUp ? 2 : 1) ? "border-t" : ""} ${twoUp && i % 2 === 0 ? "border-r" : ""}`}
        >
          <Link
            href={`/tournaments/${r.id}`}
            className="flex items-center gap-4 px-4 md:px-5 py-4 min-h-[72px] hover:bg-white/[0.03] transition-colors group"
          >
            <PlacementBadge placement={r.placement} />
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <span className="text-[15px] font-semibold font-poppins text-white truncate group-hover:text-primary transition-colors">
                {r.name}
              </span>
              <span className="text-xs text-white/55 truncate">
                {[r.game, r.format && r.format.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), formatDay(r.date)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
