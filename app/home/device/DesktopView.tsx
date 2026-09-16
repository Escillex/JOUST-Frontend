"use client";
import Link from "next/link";
import HomeHeader from "../../components/home/HomeHeader";
import HomeSection, { EmptyState } from "../../components/home/HomeSection";
import TournamentLane from "../../components/home/TournamentLane";
import ActivityFeed from "../../components/home/ActivityFeed";
import TournamentCard from "../../components/tournaments/TournamentCard";
import RotatingGameLeaderboard from "../../components/leaderboard/RotatingGameLeaderboard";
import type { Tournament, UserAward } from "../../tournaments/types";
import type { User } from "../../components/UserProvider";
import type { DashboardData, DashboardOpening } from "../types";

/**
 * Home at desktop width: tournament lanes.
 *
 * A wide screen can afford a row per tournament with your standing spelled out
 * beside it, so it gets one. Identity and the board sit in the strip above the
 * lanes — deliberately, so a record and a ranking can never be pushed to the
 * bottom of the page by however many events you happen to be in.
 */

interface Props {
  user: NonNullable<User>;
  awards: UserAward[];
  data: DashboardData;
}

export default function DesktopView({ user, awards, data }: Props) {
  const canManage = user?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER");
  const uid = user?.id || user?.sub;

  return (
    <div className="flex flex-col gap-12">
      {/* You, and where you rank — above the lanes on purpose. */}
      {/* Equal heights, and the left card earns its height: identity, the
          record, then the games you play. An earlier pass stretched it with
          nothing to fill it (an avatar adrift in 300px of card) and the pass
          after that let it sit short beside a tall board, which just moved the
          awkwardness outside the border. */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6 items-stretch">
        <HomeHeader user={user} awards={awards} stats={data.record} games={data.boards} />
        <div className="flex flex-col">
          <RotatingGameLeaderboard limit={3} showHeading={false} />
        </div>
      </div>

      <HomeSection
        title="Your tournaments"
        count={data.entries.length}
        action={
          canManage
            ? { href: "/tournaments/manage", label: "Manage" }
            : { href: "/tournaments", label: "Browse all" }
        }
      >
        {data.entries.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.entries.map((e) => (
              <TournamentLane key={e.id} entry={e} />
            ))}
          </div>
        ) : (
          <EmptyState
            message="You are not entered in a tournament right now."
            action={{ href: "/tournaments", label: "See what's open" }}
          />
        )}
      </HomeSection>

      {data.openToJoin.length > 0 && (
        <HomeSection title="Open to join" action={{ href: "/tournaments", label: "Browse all" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {data.openToJoin.slice(0, 3).map((o) => (
              <TournamentCard key={o.id} tournament={asTournament(o)} />
            ))}
          </div>
        </HomeSection>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-10 items-start">
        <ActivityFeed userId={uid} limit={5} />

        <HomeSection title="The scene" action={{ href: "/community", label: "Community" }}>
          <div className="flex flex-col gap-3">
            {data.community.champion ? (
              <div className="border border-white/10 bg-component-background p-5 flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 font-poppins">
                  Latest champion
                </span>
                <p className="text-base font-black uppercase tracking-tight text-white font-poppins">
                  {data.community.champion.name}
                </p>
                <p className="text-xs text-white/55">won {data.community.champion.tournament}</p>
              </div>
            ) : (
              <EmptyState message="No tournament has been won yet." />
            )}

            {data.community.newMembers > 0 && (
              <div className="border border-white/10 bg-component-background p-5">
                <p className="text-sm text-white/70">
                  <span className="text-primary font-black">{data.community.newMembers}</span>{" "}
                  {data.community.newMembers === 1 ? "person" : "people"} joined this week
                </p>
              </div>
            )}

            {data.collection.medals + data.collection.photos + data.collection.builds > 0 && (
              <Link
                href="/profile"
                className="border border-white/10 bg-component-background p-5 hover:border-primary transition-colors"
              >
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 font-poppins">
                  Your collection
                </span>
                <p className="mt-1.5 text-sm text-white/70">
                  {data.collection.medals} medals · {data.collection.photos} photos ·{" "}
                  {data.collection.builds} builds
                </p>
              </Link>
            )}
          </div>
        </HomeSection>
      </div>
    </div>
  );
}

/**
 * The openings the dashboard serves carry fewer fields than a full tournament —
 * only what a card renders. This adapts rather than duplicating the card, so
 * browse and home keep showing a tournament the same way.
 */
function asTournament(o: DashboardOpening): Tournament {
  return {
    id: o.id,
    name: o.name,
    date: o.date,
    status: o.status,
    game: o.game,
    gameId: o.game?.id,
    maxPlayers: o.maxPlayers,
    participants: Array.from({ length: o.participantCount }, () => ({})),
  } as unknown as Tournament;
}
