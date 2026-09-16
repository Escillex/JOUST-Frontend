"use client";

import Link from "next/link";
import { profileHref } from "../../../../utils/api";
import type { ProfileMatch, ProfileMatchPlayer } from "../../../../tournaments/types";
import ProfileAvatar from "../../../../components/profile/ProfileAvatar";
import { formatDay, RESULT_CHIP, RESULT_LABEL } from "../../../../components/profile/format";

const INITIAL = 5;

function Player({ p, align }: { p: ProfileMatchPlayer; align: "left" | "right" }) {
  const name = p.id ? (
    <Link href={profileHref(p)} title={p.name} className="text-[15px] font-semibold font-poppins text-white truncate hover:text-primary transition-colors">
      {p.name}
    </Link>
  ) : (
    <span title={p.name} className="text-[15px] font-semibold font-poppins text-white truncate">{p.name}</span>
  );
  const avatar = <ProfileAvatar name={p.name} avatarUrl={p.avatarUrl} className="w-8 h-8 text-xs" />;
  return (
    <div className={`flex items-center gap-2.5 flex-1 min-w-0 ${align === "right" ? "justify-end" : ""}`}>
      {align === "left" ? <>{avatar}{name}</> : <>{name}{avatar}</>}
    </div>
  );
}

/**
 * The five most recent matches as one dense row each: tournament and date ·
 * players · score · result. The whole history, grouped by tournament, is one
 * click away rather than hidden in a scroll box inside the page's own scroll.
 */
export default function MatchTable({ matches, allHref }: { matches: ProfileMatch[] | null; allHref: string }) {
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

  return (
    <div className="bg-component-background border border-component-border">
      <ul>
        {matches.slice(0, INITIAL).map((m, i) => {
          const s1 = m.player1.score;
          const s2 = m.player2.score;
          return (
            <li key={m.id} className={`flex items-center gap-4 px-5 min-h-16 py-3 ${i > 0 ? "border-t border-component-border/60" : ""}`}>
              <div className="w-40 shrink-0 min-w-0 flex flex-col gap-0.5">
                <span className="text-[13px] text-white/75 truncate" title={m.subtitle}>{m.subtitle}</span>
                <span className="text-xs text-white/55">{formatDay(m.time)}</span>
              </div>
              <Player p={m.player1} align="left" />
              <span className="shrink-0 w-16 flex items-baseline justify-center gap-1.5 font-black font-poppins">
                <span className={`text-xl ${s1 > s2 ? "text-primary" : "text-white"}`}>{s1}</span>
                <span className="text-xs text-white/55" aria-label="to">–</span>
                <span className={`text-xl ${s2 > s1 ? "text-primary" : "text-white"}`}>{s2}</span>
              </span>
              <Player p={m.player2} align="right" />
              <span className={`w-14 shrink-0 text-center text-[10px] font-bold uppercase tracking-[0.12em] border py-1 font-poppins ${RESULT_CHIP[m.type]}`}>
                {RESULT_LABEL[m.type]}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href={allHref}
        className="w-full h-11 border-t border-component-border flex items-center justify-center text-[11px] font-bold uppercase tracking-[0.12em] text-primary hover:bg-primary/5 transition-colors font-poppins"
      >
        View all matches
      </Link>
    </div>
  );
}
