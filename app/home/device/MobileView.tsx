"use client";
import Image from "next/image";
import Link from "next/link";
import NowCard from "../../components/home/NowCard";
import HubDoor, { FaceStack } from "../../components/home/HubDoor";
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
  const live = urgent ? entryAction(urgent).tone === "live" : false;
  const record = data.record;
  const topBoard = data.boards.find((b) => b.myRank != null) ?? data.boards[0] ?? null;
  const openCount = data.openToJoin.length;

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Who you are — small, because the phone is here to do something. */}
      <Link href={profileHref(user)} className="flex items-center gap-3 min-w-0">
        <span className="relative w-11 h-11 shrink-0 border-2 border-primary bg-component-background flex items-center justify-center text-base font-black text-primary font-poppins overflow-hidden">
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
            displayNameOf(user)[0]?.toUpperCase() || "U"
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-black uppercase tracking-tight text-white font-poppins leading-none truncate">
            {displayNameOf(user)}
          </span>
          {handleOf(user) && (
            <span className="block text-[11px] font-mono text-white/45 truncate">
              {handleOf(user)}
            </span>
          )}
        </span>
        {awards.length > 0 && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-white/45 font-poppins shrink-0">
            {awards.length} {awards.length === 1 ? "award" : "awards"}
          </span>
        )}
      </Link>

      <NowCard entry={urgent} />

      <div className="grid grid-cols-2 gap-2.5">
        <HubDoor
          href="/tournaments"
          title="Compete"
          live={live}
          foot={
            data.boards.length > 0 ? (
              <span className="flex items-center gap-1">
                {data.boards.slice(0, 3).map((b) => (
                  <GameIcon key={b.game.id} game={b.game} size="chip" />
                ))}
              </span>
            ) : undefined
          }
        >
          {data.entries.length > 0 ? (
            <>
              <span className="text-white font-semibold">
                {data.entries.length} entered
              </span>
              {live && <span className="text-[#FF4D4D]"> · 1 live</span>}
              <br />
              {openCount > 0 ? `${openCount} open to join` : "Nothing else open"}
            </>
          ) : openCount > 0 ? (
            <>
              <span className="text-white font-semibold">{openCount} open to join</span>
              <br />
              {data.openToJoin[0]?.name}
            </>
          ) : (
            "Nothing scheduled yet"
          )}
        </HubDoor>

        <HubDoor href="/leaderboards" title="Your record" accent="record">
          {record ? (
            <>
              <span className="text-white font-semibold">#{record.rank}</span> · {record.points} pts
              <br />
              {record.wins}W {record.losses}L {record.draws}D ·{" "}
              {(record.matchWinPct * 100).toFixed(0)}%
            </>
          ) : (
            "No matches played yet"
          )}
        </HubDoor>

        <HubDoor
          href="/leaderboards"
          title="Boards"
          accent="board"
          foot={
            topBoard?.leader ? (
              <>
                <FaceStack names={[topBoard.leader.name]} />
                <span className="text-[10px] text-white/45 ml-2">
                  {topBoard.leader.name} leads
                </span>
              </>
            ) : undefined
          }
        >
          {topBoard ? (
            <>
              {topBoard.game.name}{" "}
              <span className="text-white font-semibold">
                {topBoard.myRank ? `#${topBoard.myRank}` : "unranked"}
              </span>
              <br />
              {data.boards.length} {data.boards.length === 1 ? "game" : "games"} you play
            </>
          ) : (
            "Pick the games you play"
          )}
        </HubDoor>

        <HubDoor href={profileHref(user)} title="Collection" accent="collection">
          {data.collection.medals + data.collection.plaques > 0 ||
          data.collection.photos + data.collection.builds > 0 ? (
            <>
              {data.collection.medals} medals · {data.collection.plaques} plaques
              <br />
              {data.collection.photos} photos · {data.collection.builds} builds
            </>
          ) : (
            "Nothing collected yet"
          )}
        </HubDoor>

        <HubDoor
          href="/community"
          title="Community"
          accent="community"
          foot={
            data.community.champion ? <FaceStack names={[data.community.champion.name]} /> : undefined
          }
        >
          {data.community.champion ? (
            <>
              <span className="text-white font-semibold">{data.community.champion.name}</span> won{" "}
              {data.community.champion.tournament}
            </>
          ) : (
            "No results in yet"
          )}
          {data.community.newMembers > 0 && (
            <>
              <br />
              {data.community.newMembers} new this week
            </>
          )}
        </HubDoor>

        <HubDoor href="/#store" title="Store" accent="store">
          {data.store.featured ? (
            <>
              <span className="text-white font-semibold">{data.store.featured.name}</span>
              <br />
              {data.store.featured.price} · {data.store.items} items
            </>
          ) : (
            "Nothing listed yet"
          )}
        </HubDoor>
      </div>

      <Link
        href="/profile/edit"
        className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/35 hover:text-primary transition-colors font-poppins py-2"
      >
        Settings
      </Link>
    </div>
  );
}
