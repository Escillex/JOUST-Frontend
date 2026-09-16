"use client";

import Link from "next/link";
import { profileHref } from "../../../../utils/api";
import type { ProfileMatch } from "../../../../tournaments/types";
import ProfileAvatar from "../../../../components/profile/ProfileAvatar";
import { formatDay, RESULT_CHIP, RESULT_LABEL } from "../../../../components/profile/format";

const INITIAL = 5;

/**
 * Recent matches on a phone. The profile owner is in every match, so each row
 * names only the opponent — "vs Owen Blake" — with the score from the owner's
 * side. The old three-way split squeezed both names to zero width at 390px.
 */
export default function MatchFeed({ matches, allHref }: { matches: ProfileMatch[] | null; allHref: string }) {

  if (matches === null) {
    return (
      <div className="bg-component-background border border-component-border" aria-busy="true" aria-label="Loading matches">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-16 px-5 flex items-center gap-4 ${i > 0 ? "border-t border-component-border/60" : ""}`}>
            <div className="h-3 w-24 bg-white/[0.06] animate-pulse" />
            <div className="h-3 flex-1 bg-white/[0.06] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <p className="bg-component-background border border-component-border py-10 text-center text-sm text-white/55">
        No matches played yet.
      </p>
    );
  }

  const visible = matches.slice(0, INITIAL);

  return (
    <div className="bg-component-background border border-component-border">
      <ul>
        {visible.map((m, i) => {
          const me = m.isPlayer1 ? m.player1 : m.player2;
          const opp = m.isPlayer1 ? m.player2 : m.player1;
          return (
            <li key={m.id} className={`flex flex-col gap-2 px-3.5 py-3 ${i > 0 ? "border-t border-component-border/60" : ""}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] border px-2 py-0.5 font-poppins ${RESULT_CHIP[m.type]}`}>
                  {RESULT_LABEL[m.type]}
                </span>
                <span className="flex-1 min-w-0 text-xs text-white/75 truncate">{m.subtitle}</span>
                <span className="shrink-0 text-xs text-white/55">{formatDay(m.time, { withYear: false })}</span>
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <ProfileAvatar name={opp.name} avatarUrl={opp.avatarUrl} className="w-8 h-8 text-xs" />
                <span className="flex-1 min-w-0 truncate text-[15px] font-semibold font-poppins text-white">
                  <span className="text-white/55 font-normal">vs </span>
                  {opp.id ? (
                    <Link href={profileHref(opp)} className="hover:text-primary transition-colors">{opp.name}</Link>
                  ) : (
                    opp.name
                  )}
                </span>
                <span className="shrink-0 flex items-baseline gap-1.5 font-black font-poppins">
                  <span className={`text-lg ${me.score > opp.score ? "text-primary" : "text-white"}`}>{me.score}</span>
                  <span className="text-xs text-white/55" aria-label="to">–</span>
                  <span className={`text-lg ${opp.score > me.score ? "text-primary" : "text-white"}`}>{opp.score}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <Link
        href={allHref}
        className="w-full h-11 border-t border-component-border flex items-center justify-center text-[11px] font-bold uppercase tracking-[0.12em] text-primary active:bg-primary/5 font-poppins"
      >
        View all matches
      </Link>
    </div>
  );
}
