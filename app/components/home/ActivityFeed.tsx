"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { authenticatedFetch, API_ENDPOINTS, safeJson, resolveImageUrl, profileHref } from "../../utils/api";
import HomeSection, { EmptyState } from "./HomeSection";

/**
 * Your last few matches.
 *
 * Previously `profile/MatchHistory` — it lived under profile/ but the profile
 * pages have had their own device views for a while, so the dashboard was its
 * only caller. Three things changed with the move:
 *
 *  - The "SYNCHRONIZED" badge is gone. This fetches once on mount; there is no
 *    poll and no socket behind it, so the badge promised a live feed the panel
 *    does not have, and would have kept promising it while the list went stale.
 *  - The rows are rows, not 24px-padded bordered cards. Four of the old ones
 *    filled the panel; this shows the same four in half the height.
 *  - Empty means "here is what to do about it", not a dashed box the height of
 *    ten rows saying "No activity recorded."
 */

interface Activity {
  id: string;
  type: "win" | "loss" | "draw" | "entry";
  title: string;
  subtitle: string;
  time: string;
  value?: string;
  player1?: { id: string | null; name: string; avatarUrl: string | null; score: number };
  player2?: { id: string | null; name: string; avatarUrl: string | null; score: number };
  isPlayer1?: boolean;
}

const OUTCOME: Record<string, { label: string; className: string; bar: string }> = {
  win: { label: "Won", className: "text-primary border-primary/30 bg-primary/5", bar: "bg-primary" },
  loss: { label: "Lost", className: "text-[#FF4D4D] border-[#FF4D4D]/30 bg-[#FF4D4D]/5", bar: "bg-[#FF4D4D]" },
  draw: { label: "Draw", className: "text-white/60 border-white/15 bg-white/5", bar: "bg-white/30" },
};

function Face({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <span className="relative w-8 h-8 shrink-0 bg-background border border-white/10 flex items-center justify-center text-[10px] font-black text-primary overflow-hidden">
      {avatarUrl ? (
        <Image src={resolveImageUrl(avatarUrl)} alt="" aria-hidden fill className="object-cover" unoptimized />
      ) : (
        name[0]?.toUpperCase() || "U"
      )}
    </span>
  );
}

function Side({
  player,
  align = "left",
}: {
  player: NonNullable<Activity["player1"]>;
  align?: "left" | "right";
}) {
  const label = player.id ? (
    <Link
      href={profileHref(player)}
      className="text-sm font-black uppercase tracking-tight text-white hover:text-primary transition-colors truncate font-poppins"
      title={player.name}
    >
      {player.name}
    </Link>
  ) : (
    <span
      className="text-sm font-black uppercase tracking-tight text-white truncate font-poppins"
      title={player.name}
    >
      {player.name}
    </span>
  );

  return (
    <div
      className={`flex items-center gap-3 min-w-0 flex-1 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <Face name={player.name} avatarUrl={player.avatarUrl} />
      {label}
    </div>
  );
}

export default function ActivityFeed({ userId, limit = 6 }: { userId?: string; limit?: number }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    // No setLoading(true) here: the initial value already covers the only case
    // this page produces, and re-raising it on a later change would blank a
    // list we can still show while the next one loads (Core Rule 8).
    authenticatedFetch(API_ENDPOINTS.AUTH.USER_MATCHES(userId))
      .then(safeJson)
      .then((data) => {
        if (alive && Array.isArray(data)) setActivities(data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const shown = activities.slice(0, limit);

  return (
    <HomeSection
      title="Recent matches"
      action={
        activities.length > 0 && userId
          ? { href: `/profile/${userId}/matches`, label: "View all" }
          : undefined
      }
    >
      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[74px] border border-white/10 bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          message="No matches played yet."
          action={{ href: "/tournaments", label: "Find a tournament" }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((a) => {
            const outcome = OUTCOME[a.type] ?? OUTCOME.draw;
            return (
              <li
                key={a.id}
                className="relative flex flex-col gap-3 border border-white/10 bg-component-background px-5 py-4 hover:border-white/25 transition-colors"
              >
                <span aria-hidden className={`absolute left-0 inset-y-0 w-[3px] ${outcome.bar}`} />

                <div className="flex items-center justify-between gap-4">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45 truncate font-poppins"
                    title={a.subtitle}
                  >
                    {a.subtitle}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 border font-poppins ${outcome.className}`}
                    >
                      {outcome.label}
                    </span>
                    <span className="text-[10px] font-mono text-white/40 whitespace-nowrap">{a.time}</span>
                  </div>
                </div>

                {a.player1 && a.player2 ? (
                  <div className="flex items-center gap-4">
                    <Side player={a.player1} />
                    <span className="flex items-center gap-2 shrink-0 font-poppins tabular-nums">
                      <span className={`text-xl font-black ${a.isPlayer1 ? "text-primary" : "text-white"}`}>
                        {a.player1.score}
                      </span>
                      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">vs</span>
                      <span className={`text-xl font-black ${!a.isPlayer1 ? "text-primary" : "text-white"}`}>
                        {a.player2.score}
                      </span>
                    </span>
                    <Side player={a.player2} align="right" />
                  </div>
                ) : (
                  <p className="text-sm font-black uppercase tracking-tight text-white font-poppins truncate">
                    {a.title}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </HomeSection>
  );
}
