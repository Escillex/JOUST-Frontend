"use client";
import Image from "next/image";
import HubDoor, { FaceStack } from "../../components/home/HubDoor";
import Medal from "../../components/awards/Medal";
import Plaque from "../../components/awards/Plaque";
import { showcaseOf } from "../../components/awards/group";
import GameIcon from "../../components/ui/GameIcon";
import { displayNameOf, handleOf, profileHref, resolveImageUrl } from "../../utils/api";
import type { UserAward } from "../../tournaments/types";
import type { User } from "../../components/UserProvider";
import { DashboardData, entryAction, mostUrgent } from "../types";

/**
 * Home on a phone: the hub.
 *
 * The desktop lanes are three columns of detail per tournament — at 390px that
 * is four stacked paragraphs each, and you scroll past your own record to reach
 * anything. So the phone inverts it: the single thing worth acting on goes on
 * top, and everything else becomes a door you can reach with one thumb without
 * scrolling.
 *
 * The doors carry a real thing rather than a count, and the state drives the
 * page — a live match turns its door red and fills the card above. It reads as
 * a menu only on a day when genuinely nothing is happening.
 */

interface Props {
  user: NonNullable<User>;
  awards: UserAward[];
  data: DashboardData;
}

export default function MobileView({ user, awards, data }: Props) {
  const urgent = mostUrgent(data.entries);
  const live = urgent ? urgent.status === "ONGOING" || entryAction(urgent).tone === "live" : false;
  const record = data.record;
  const topBoard = data.boards.find((b) => b.myRank != null) ?? data.boards[0] ?? null;
  let recommended = null;
  if (!urgent && data.openToJoin.length > 0) {
    const userGameIds = new Set(data.boards.map((b) => b.game.id));
    recommended = data.openToJoin.find((o) => o.game?.id && userGameIds.has(o.game.id)) || data.openToJoin[0];
  }

  if (urgent) {
    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-2.5 h-[calc(100dvh-180px)]">
        {/* ROW 1 */}
        {/* Name [2x1] */}
        <HubDoor
          href={profileHref(user)}
          accent="primary"
          className="col-span-2 row-span-1"
        >
          <div className="flex items-center gap-[6%] mt-1">
            <span className="relative w-[clamp(4rem,20cqw,7rem)] aspect-square shrink-0 border-2 border-primary bg-component-background flex items-center justify-center text-[clamp(1.5rem,10cqw,3rem)] font-black text-primary font-poppins overflow-hidden">
              {user?.avatarUrl ? (
                <Image src={resolveImageUrl(user.avatarUrl)} alt="" aria-hidden fill className="object-cover" unoptimized />
              ) : (
                displayNameOf(user)[0]?.toUpperCase() || "U"
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[clamp(1.5rem,8cqw,2.5rem)] font-black text-white uppercase tracking-tighter font-poppins leading-[0.95] block truncate">
                {displayNameOf(user)}
              </span>
              {handleOf(user) && (
                <span className="text-[clamp(0.75rem,4cqw,1rem)] font-mono text-white/45 block truncate mt-1">
                  {handleOf(user)}
                </span>
              )}
            </div>
          </div>
          <MobileAwardStrip awards={awards} compact />
        </HubDoor>

        {/* Leaderboard [1x1] */}
        <HubDoor
          href={topBoard ? "/leaderboards" : "/profile/edit#games"}
          title="Leaderboard"
          accent="board"
          className="col-span-1 row-span-1"
        >
          <span className="text-white font-black font-poppins text-[clamp(0.8rem,6cqw,1.1rem)] leading-[0.95] uppercase tracking-[-0.08em] block whitespace-nowrap mt-1">
            {topBoard && topBoard.myRank ? `${topBoard.game.name} #${topBoard.myRank}` : "UNRANKED"}
          </span>
          <span className="text-[clamp(0.7rem,8cqw,0.875rem)] text-white/50 block mt-1">
            {data.boards.length > 0 ? `${data.boards.length} games` : "Pick games"}
          </span>
        </HubDoor>

        {/* ROW 2 */}
        {/* Latest Tournament [2x1] */}
        <HubDoor
          href={`/tournaments/${urgent.id}`}
          title="Next Match"
          accent="primary"
          live={live}
          className="col-span-2 row-span-1"
          foot={
            <span className="flex items-center gap-1">
              {urgent.game && <GameIcon game={urgent.game} size="chip" />}
            </span>
          }
        >
          <div className="mt-1">
            <span className="text-[clamp(1.5rem,8cqw,2.5rem)] font-black text-white uppercase tracking-tighter font-poppins leading-[0.95] block line-clamp-2 break-words">
              {urgent.name}
            </span>
            <span className="text-[clamp(0.875rem,5cqw,1.125rem)] text-primary font-semibold block mt-1.5 leading-tight">
              {entryAction(urgent).tone === "live" ? "Action required" : "Awaiting opponent"}
            </span>
          </div>
        </HubDoor>

        {/* Community [1x1] — stays above Play in both mobile states. */}
        <HubDoor
          href="/community"
          title="Community"
          accent="community"
          inverse={true}
          className="col-span-1 row-span-1"
        >
          <CommunitySummary community={data.community} />
        </HubDoor>

        {/* ROW 3 */}
        {/* Your Record [2x1] */}
        <HubDoor
          href={`${profileHref(user)}/matches`}
          title="Your Record"
          accent="record"
          className="col-span-2 row-span-1"
        >
          {record ? (
            <div className="mt-1">
              <span className="text-white font-black font-poppins text-[clamp(1.5rem,10cqw,2.5rem)] leading-[0.95] block line-clamp-2 break-words">
                #{record.rank} <span className="text-[clamp(1rem,7cqw,1.5rem)] text-white/70 font-sans tracking-normal font-semibold">· {record.points} pts</span>
              </span>
              <span className="text-[clamp(0.875rem,5cqw,1.125rem)] text-white/50 block mt-1">
                {record.wins}W {record.losses}L {record.draws}D · {(record.matchWinPct * 100).toFixed(0)}%
              </span>
            </div>
          ) : (
            <span className="text-[clamp(0.875rem,5cqw,1.125rem)] text-white/50 mt-1 block">No matches played yet</span>
          )}
        </HubDoor>

        {/* Matches [1x1] — stays below Community in both mobile states. */}
        <HubDoor
          href="/tournaments"
          title="Matches"
          accent="record"
          inverse={true}
          className="col-span-1 row-span-1 relative group"
        >
          <span className="text-black font-black font-poppins text-[clamp(1.5rem,20cqw,3rem)] uppercase tracking-tighter block mt-1">PLAY</span>
          <div className="absolute bottom-3 right-3 text-black/60 group-hover:text-black transition-colors">
            <svg className="w-[clamp(1.5rem,15cqw,2.25rem)] h-[clamp(1.5rem,15cqw,2.25rem)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H9.5a4.5 4.5 0 0 1 0-9h1" /><path d="M15 16l4-4-4-4" />
            </svg>
          </div>
        </HubDoor>
      </div>
    );
  }

  // NO TOURNAMENT (4-row layout)
  return (
    <div className="grid grid-cols-3 grid-rows-4 gap-2.5 h-[calc(100dvh-180px)]">
      {/* 1. Username Hero [3x2] */}
      <HubDoor
        href={profileHref(user)}
        accent="primary"
        className="col-span-3 row-span-2"
        foot={
          data.boards.length > 0 ? (
            <span className="flex items-center gap-1">
              {data.boards.slice(0, 4).map((b) => (
                <GameIcon key={b.game.id} game={b.game} size="chip" />
              ))}
            </span>
          ) : undefined
        }
      >
          <div className="flex h-full min-h-0 flex-col gap-4 mt-1">
            <div className="flex min-h-0 flex-1 items-center gap-[6%]">
          <span className="relative w-[clamp(6rem,24cqw,12rem)] aspect-square shrink-0 border-2 border-primary bg-component-background flex items-center justify-center text-[clamp(2.5rem,12cqw,4rem)] font-black text-primary font-poppins overflow-hidden">
            {user?.avatarUrl ? (
              <Image src={resolveImageUrl(user.avatarUrl)} alt="" aria-hidden fill className="object-cover" unoptimized />
            ) : (
              displayNameOf(user)[0]?.toUpperCase() || "U"
            )}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[clamp(1.5rem,8cqw,3rem)] font-black text-white uppercase tracking-tighter font-poppins leading-[0.95] block line-clamp-2 break-words">
              {displayNameOf(user)}
            </span>
            {handleOf(user) && (
              <span className="text-[clamp(0.875rem,4cqw,1.25rem)] font-mono text-white/45 block truncate mt-1.5 mb-2">
                {handleOf(user)}
              </span>
            )}
            {recommended ? (
              <span className="text-[clamp(0.875rem,3cqw,1.125rem)] text-white/60 block mt-1 truncate leading-tight">
                Recommended: {recommended.name}
              </span>
            ) : null}
          </div>
          </div>
          <MobileAwardStrip awards={awards} />
          <div className="mt-auto">
            <MobileProfileStats record={record} />
          </div>
        </div>
      </HubDoor>

      {/* 2. Leaderboard [2x1] (Swapped to Row 3) */}
      <HubDoor
        href={topBoard ? "/leaderboards" : "/profile/edit#games"}
        title="Leaderboard"
        accent="board"
        className="col-span-2 row-span-1"
        foot={
          topBoard?.leader ? (
            <>
              <FaceStack names={[topBoard.leader.name]} />
              <span className="text-[10px] text-white/45 truncate">{topBoard.leader.name} leads</span>
            </>
          ) : undefined
        }
      >
        <span className="text-white font-black font-poppins text-[clamp(1.1rem,7cqw,1.75rem)] leading-[0.95] uppercase tracking-tighter block whitespace-nowrap mt-1">
          {topBoard && topBoard.myRank ? `${topBoard.game.name} #${topBoard.myRank}` : "UNRANKED"}
        </span>
        <span className="text-[clamp(0.75rem,5cqw,1.125rem)] text-white/50 block mt-1">
          {data.boards.length > 0 ? `${data.boards.length} games tracked` : "Pick the games you play"}
        </span>
      </HubDoor>

      {/* 3. Community [1x1] */}
      <HubDoor
        href="/community"
        title="Community"
        accent="community"
          inverse={true}
          className="col-span-1 row-span-1"
        >
          <CommunitySummary community={data.community} />
      </HubDoor>

      {/* 4. Your Record [2x1] (Swapped to Row 4) */}
      <HubDoor
        href={`${profileHref(user)}/matches`}
        title="Your Record"
        accent="record"
        className="col-span-2 row-span-1"
      >
        {record ? (
          <div className="mt-1">
            <span className="text-white font-black font-poppins text-[clamp(1.5rem,10cqw,3rem)] leading-[0.95] block truncate">
              #{record.rank} <span className="text-[clamp(1.125rem,7cqw,2rem)] text-white/70 font-sans tracking-normal font-semibold">· {record.points} pts</span>
            </span>
            <span className="text-[clamp(0.875rem,5cqw,1.25rem)] text-white/50 block mt-1">
              {record.wins}W {record.losses}L {record.draws}D · {(record.matchWinPct * 100).toFixed(0)}%
            </span>
          </div>
        ) : (
          <span className="text-[clamp(0.875rem,5cqw,1.25rem)] text-white/50 mt-1 block">No matches played yet</span>
        )}
      </HubDoor>

      {/* 5. Matches [1x1] (Restored to bottom right) */}
      <HubDoor
        href="/tournaments"
        title="Matches"
        accent="record"
        inverse={true}
        className="col-span-1 row-span-1 relative group"
      >
        <span className="text-black font-black font-poppins text-[clamp(1.875rem,20cqw,3.5rem)] uppercase tracking-tighter block mt-1">PLAY</span>
        <div className="absolute bottom-3 right-3 text-black/60 group-hover:text-black transition-colors">
          <svg className="w-[clamp(1.5rem,15cqw,2.5rem)] h-[clamp(1.5rem,15cqw,2.5rem)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H9.5a4.5 4.5 0 0 1 0-9h1" /><path d="M15 16l4-4-4-4" />
          </svg>
        </div>
      </HubDoor>
    </div>
  );
}

/**
 * The profile door is the phone home screen's identity object, so its awards
 * stay visible here instead of becoming an unrelated count in another tile.
 * The parent HubDoor is already the profile link; these are deliberately
 * non-interactive artwork elements to avoid nesting links inside that card.
 */
function MobileAwardStrip({ awards, compact = false }: { awards: UserAward[]; compact?: boolean }) {
  const { pinned, plaque } = showcaseOf(awards);
  if (!plaque && pinned.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${compact ? "mt-2" : "border-t border-white/10 pt-3"}`} aria-label="Profile awards">
      {plaque && (
        <Plaque
          name={plaque.name}
          imageUrl={plaque.imageUrl}
          size="sm"
          count={plaque.grants.length}
          title={plaque.description ?? plaque.name}
          className={compact ? "max-w-[150px]" : "max-w-[220px]"}
        />
      )}
      {pinned.map((g) => (
        <Medal
          key={g.awardId}
          name={g.name}
          imageUrl={g.imageUrl}
          grants={g.grants}
          sizeClass={compact ? "w-8 h-8" : "w-10 h-10"}
          showDetail={false}
        />
      ))}
      <span className="sr-only">{plaque ? plaque.name : "Pinned awards"}</span>
    </div>
  );
}

function CommunitySummary({ community }: { community: DashboardData["community"] }) {
  if (community.champion) {
    return (
      <div className="mt-1">
        <span className="block line-clamp-2 break-words text-[clamp(0.75rem,10cqw,1.1rem)] font-black font-poppins uppercase tracking-wider">
          {community.champion.name}
        </span>
        <span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.12em] text-black/60">
          Latest champion
        </span>
      </div>
    );
  }

  if (community.newMembers > 0) {
    return (
      <div className="mt-1">
        <span className="block text-[clamp(0.75rem,10cqw,1.1rem)] font-black font-poppins uppercase tracking-wider">
          +{community.newMembers} new
        </span>
        <span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.12em] text-black/60">
          This week
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <span className="block text-[clamp(0.75rem,10cqw,1.1rem)] font-black font-poppins uppercase tracking-wider">View</span>
      <span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.12em] text-black/60">Explore community</span>
    </div>
  );
}

/** Keeps the large profile hero useful even when the account has no showcase awards. */
function MobileProfileStats({ record }: { record: DashboardData["record"] }) {
  if (!record) {
    return (
      <p className="border-t border-white/10 pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
        Play a match to build your record
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
      <div>
        <span className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">Rank</span>
        <p className="mt-1.5 text-xl font-black font-poppins leading-none text-white">#{record.rank}</p>
      </div>
      <div>
        <span className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">Points</span>
        <p className="mt-1.5 text-xl font-black font-poppins leading-none text-primary">{record.points}</p>
      </div>
      <div>
        <span className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">Win rate</span>
        <p className="mt-1.5 text-xl font-black font-poppins leading-none text-white">{(record.matchWinPct * 100).toFixed(0)}%</p>
      </div>
    </div>
  );
}
