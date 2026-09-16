"use client";
import Image from "next/image";
import Link from "next/link";
import GameIcon from "../ui/GameIcon";
import { resolveImageUrl } from "../../utils/api";
import { formatWhen } from "../../utils/tournamentStatus";
import { DashboardEntry, entryAction, opponentName } from "../../home/types";

/**
 * One tournament you are in, as a row about **your** position in it.
 *
 * This is the desktop home's spine. It deliberately does not advertise the
 * event — you are already entered — so the three columns answer the three
 * questions an entrant actually has: which one is this, what do I do next, and
 * how am I doing.
 */

const TONE: Record<string, { chip: string; rail: string }> = {
  live: { chip: "bg-[#FF4D4D] border-[#FF4D4D] text-white", rail: "bg-[#FF4D4D]" },
  ready: { chip: "bg-primary border-primary text-black", rail: "bg-primary" },
  done: { chip: "bg-white/5 border-white/15 text-white/70", rail: "bg-white/25" },
  waiting: { chip: "bg-white/5 border-white/15 text-white/70", rail: "bg-white/15" },
};

export default function TournamentLane({ entry }: { entry: DashboardEntry }) {
  const action = entryAction(entry);
  const tone = TONE[action.tone] ?? TONE.waiting;
  const m = entry.myMatch;
  const when = formatWhen(entry.date);

  return (
    <article className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6 border border-white/10 bg-component-background p-5 pl-6 hover:border-white/25 transition-colors">
      <span aria-hidden className={`absolute left-0 inset-y-0 w-[3px] ${tone.rail}`} />

      {/* Which tournament */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          {entry.game && <GameIcon game={entry.game} size="row" />}
          <div className="min-w-0">
            <Link
              href={`/tournaments/${entry.id}`}
              className="block text-lg font-black uppercase tracking-tight text-white hover:text-primary transition-colors leading-tight font-poppins truncate"
              title={entry.name}
            >
              {entry.name}
            </Link>
            <p className="text-xs text-white/55 truncate">
              {entry.game?.name ?? "No game set"}
              {when && <span className="text-white/35"> · {when}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest border font-poppins ${tone.chip}`}
          >
            {action.tone === "live" && (
              <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1.5 align-middle animate-pulse" />
            )}
            {action.label}
          </span>
          {entry.round && (
            <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest border border-white/15 text-white/60 font-poppins">
              {entry.round.label}
            </span>
          )}
          {entry.seed != null && (
            <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest border border-white/15 text-white/60 font-poppins">
              Seeded {entry.seed} of {entry.fieldSize}
            </span>
          )}
        </div>
      </div>

      {/* What to do next */}
      <div className="flex flex-col gap-2 min-w-0">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 font-poppins">
          Your next match
        </span>

        {m ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              {m.opponent?.avatarUrl && !m.isBye && (
                <span className="relative w-8 h-8 shrink-0 border border-white/10 overflow-hidden">
                  <Image
                    src={resolveImageUrl(m.opponent.avatarUrl)}
                    alt=""
                    aria-hidden
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </span>
              )}
              <p className="text-base font-black uppercase tracking-tight text-white font-poppins truncate">
                {m.isBye ? "Bye this round" : `vs ${opponentName(m.opponent)}`}
              </p>
            </div>
            <p className="text-xs text-white/55">
              {entry.round?.label ?? "Current round"}
              {m.status === "COMPLETED" && (
                <span className="text-white/40">
                  {" · "}
                  finished {m.myScore}–{m.opponentScore}
                </span>
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-white/55">{action.label}</p>
        )}

        <div className="mt-1">
          {m && m.status !== "COMPLETED" && !m.isBye ? (
            <Link
              href={`/tournaments/${entry.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] bg-primary text-black hover:bg-white transition-colors font-poppins"
            >
              Open match <span aria-hidden>→</span>
            </Link>
          ) : (
            <Link
              href={`/tournaments/${entry.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] border border-white/15 text-white/70 hover:text-primary hover:border-primary transition-colors font-poppins"
            >
              View bracket <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      {/* How it is going */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-start gap-8">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 font-poppins">
              Position
            </span>
            <span className="text-xl font-black text-white font-poppins leading-none tabular-nums">
              {entry.placement
                ? ordinal(entry.placement)
                : entry.standing?.position
                  ? `${ordinal(entry.standing.position)} of ${entry.fieldSize}`
                  : "Not started"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 font-poppins">
              Record
            </span>
            <span className="text-xl font-black text-white font-poppins leading-none tabular-nums">
              {entry.standing ? (
                <>
                  <span className="text-primary">{entry.standing.wins}</span>
                  <span className="text-white/30 text-sm">/</span>
                  {entry.standing.losses}
                  <span className="text-white/30 text-sm">/</span>
                  <span className="text-white/55">{entry.standing.draws}</span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        </div>

        <Link
          href={`/tournaments/${entry.id}?tab=standings`}
          className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45 hover:text-primary transition-colors font-poppins"
        >
          Standings <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
