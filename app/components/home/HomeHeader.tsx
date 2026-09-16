"use client";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import Medal from "../awards/Medal";
import Plaque from "../awards/Plaque";
import { showcaseOf } from "../awards/group";
import GameIcon from "../ui/GameIcon";
import type { GlobalLeaderboardEntry, UserAward } from "../../tournaments/types";
import type { DashboardBoard } from "../../home/types";
import type { User } from "../UserProvider";
import { displayNameOf, handleOf, profileHref, resolveImageUrl } from "../../utils/api";

/**
 * Who you are and how you are doing, in one band across the top of the
 * dashboard.
 *
 * This replaces two separate tiles: an identity card that centred an avatar and
 * a name inside a height it did not fill (most accounts have no plaque and no
 * pinned medals, so it was mostly empty margin), and a row of four boxes each
 * holding one number. Merged, the identity reads first and the figures read as
 * one rail beside it.
 */

type Stats = Partial<GlobalLeaderboardEntry> | null;

interface HomeHeaderProps {
  user: NonNullable<User>;
  awards?: UserAward[];
  stats?: Stats;
  /** The games you play and where you sit on each. Fills the card so it stands
   *  level with the board beside it instead of being padded out to match. */
  games?: DashboardBoard[];
}

/** A player who has not played yet has no rank, no rate and no record. Saying
 *  "#--" and "0.0%" four times over states nothing; one line does. */
function hasRecord(stats: Stats | undefined): boolean {
  return Boolean(
    (stats?.wins ?? 0) || (stats?.losses ?? 0) || (stats?.draws ?? 0) || (stats?.points ?? 0),
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {/* Raised from white/20: this caption is the only thing that says what
          the number underneath it means. */}
      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 font-poppins">
        {label}
      </span>
      <span className="text-2xl font-black text-white font-poppins leading-none tabular-nums">
        {children}
      </span>
    </div>
  );
}

export default function HomeHeader({ user, awards, stats, games = [] }: HomeHeaderProps) {
  const { pinned, plaque } = showcaseOf(awards);
  const played = hasRecord(stats);
  const name = displayNameOf(user);
  const handle = handleOf(user);

  return (
    // Stacked, not a row: side by side the name was squeezed into "TOBI…" by
    // the figures next to it. h-full lets the card stand level with the board
    // beside it — and it is filled with content rather than padding, which is
    // what made the earlier equal-height version look empty.
    <header className="flex h-full flex-col gap-6 border border-white/10 bg-surface p-6 md:p-8">
      <div className="flex items-center gap-5 min-w-0">
        <Link
          href={profileHref(user)}
          className="relative w-24 h-24 shrink-0 bg-component-background border-2 border-primary text-primary flex items-center justify-center text-3xl font-black font-poppins overflow-hidden hover:border-white transition-colors"
        >
          {user?.avatarUrl ? (
            <Image
              src={resolveImageUrl(user.avatarUrl)}
              alt=""
              aria-hidden
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            name[0]?.toUpperCase() || "U"
          )}
        </Link>

        <div className="flex flex-col gap-1 min-w-0">
          <Link
            href={profileHref(user)}
            className="text-4xl xl:text-5xl font-black uppercase tracking-tighter text-white font-poppins leading-[0.9] hover:text-primary transition-colors break-words"
            title={name}
          >
            {name}
          </Link>
          {handle && <p className="text-xs font-mono text-white/45 truncate">{handle}</p>}

          {(plaque || pinned.length > 0) && (
            <div className="flex items-center gap-3 flex-wrap mt-2">
              {plaque && (
                <Plaque
                  name={plaque.name}
                  imageUrl={plaque.imageUrl}
                  size="sm"
                  count={plaque.grants.length}
                  title={plaque.description ?? plaque.name}
                />
              )}
              {pinned.map((g) => (
                <Medal
                  key={g.awardId}
                  name={g.name}
                  imageUrl={g.imageUrl}
                  description={g.description}
                  grants={g.grants}
                  sizeClass="w-9 h-9"
                  showDetail={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {played ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 border-t border-white/10 pt-5">
          <Figure label="Rank">{stats?.rank ? `#${stats.rank}` : "Unranked"}</Figure>
          <Figure label="Points">
            <span className="text-primary">{stats?.points ?? 0}</span>
          </Figure>
          <Figure label="W / L / D">
            <span className="flex items-baseline gap-1">
              <span className="text-primary">{stats?.wins ?? 0}</span>
              <span className="text-sm text-white/30">/</span>
              <span>{stats?.losses ?? 0}</span>
              <span className="text-sm text-white/30">/</span>
              <span className="text-white/55">{stats?.draws ?? 0}</span>
            </span>
          </Figure>
          <Figure label="Win rate">{((stats?.matchWinPct ?? 0) * 100).toFixed(1)}%</Figure>
        </div>
      ) : (
        <p className="border-t border-white/10 pt-5 text-sm text-white/45">
          Your rank and record appear here once you have played your first match.
        </p>
      )}

      {games.length > 0 && (
        <div className="mt-auto border-t border-white/10 pt-5 flex flex-col gap-3">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 font-poppins">
            Games you play
          </span>
          <ul className="flex flex-col gap-2.5">
            {games.map((b) => (
              <li key={b.game.id} className="flex items-center gap-3 min-w-0">
                <GameIcon game={b.game} size="chip" />
                <span className="text-sm text-white truncate">{b.game.name}</span>
                <span className="ml-auto text-sm font-black text-white font-poppins tabular-nums shrink-0">
                  {b.myRank ? `#${b.myRank}` : <span className="text-white/40">Unranked</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
