"use client";
import Link from "next/link";
import Image from "next/image";
import { profileHref, resolveImageUrl, displayNameOf } from "../../utils/api";
import { tieBreakerLabel } from "../../utils/formatConfig";
import type { LeaderboardEntry } from "../../tournaments/[id]/bracket/types";

/**
 * The ranking table for Swiss and round robin — where the standings, not a
 * bracket, are the structure of the event.
 *
 * All columns, always (decided 2026-09-16): there is no toggle and no
 * progressive disclosure, because the only question anyone asks of a standings
 * table is "why am I below them", and hiding the answer behind a tap does not
 * help. `Ratio` — an unlabelled match win percentage — is gone; GW% takes its
 * place as a column people recognise.
 */

interface Props {
  entries: LeaderboardEntry[];
  /** Most significant first, from the tournament's own config. */
  tieBreakerOrder: string[];
  fieldSize: number;
  /** Highlights the viewer's own row. */
  currentUserId?: string;
  loading?: boolean;
}

/** Percentage-style tiebreakers are 0..1 ratios; counts are shown as-is. */
const PERCENT = new Set(["omw", "oomw", "gw", "ogw", "matchWinPct"]);

function valueOf(entry: LeaderboardEntry, key: string): number | null {
  switch (key) {
    case "omw": return entry.omw;
    case "oomw": return entry.oomw;
    case "gw": return entry.gw;
    case "ogw": return entry.ogw;
    case "matchWinPct": return entry.matchWinPct;
    case "wins": return entry.wins;
    case "losses": return entry.losses;
    default: return null;
  }
}

function show(key: string, value: number | null): string {
  if (value === null) return "—";
  return PERCENT.has(key) ? `${(value * 100).toFixed(1)}%` : String(value);
}

/**
 * Which tiebreaker separated two adjacent rows — the same walk the server does
 * in `tiebreakCriterion`, so the column the table marks is the column that
 * actually decided the order.
 *
 * Returns null when nothing separates them, which is a real answer: the two are
 * level and share a rank.
 */
function decidedBy(
  above: LeaderboardEntry | undefined,
  row: LeaderboardEntry,
  order: string[],
): string | null {
  if (!above) return null;
  if (above.points !== row.points) return null;
  for (const key of order) {
    const a = valueOf(above, key);
    const b = valueOf(row, key);
    if (a === null || b === null) continue;
    if (Math.abs(a - b) > 0.0001) return key;
  }
  return null;
}

export default function StandingsTable({
  entries,
  tieBreakerOrder,
  fieldSize,
  currentUserId,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 animate-pulse" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 border border-white/10 bg-surface" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-white/15 bg-white/[0.02] px-6 py-8">
        <p className="text-sm text-white/55">
          No results yet — the table fills in as matches are reported.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45 font-poppins">
          {entries.length} of {fieldSize} {fieldSize === 1 ? "player" : "players"}
        </p>
        <p className="text-[10px] font-mono text-white/45">
          Ties:{" "}
          {tieBreakerOrder.map((key, i) => (
            <span key={key}>
              {i > 0 && <span className="text-white/25"> → </span>}
              <span className="text-primary">{tieBreakerLabel(key)}</span>
            </span>
          ))}
        </p>
      </div>

      {/* The table is wider than a phone, so it scrolls in its own container
          rather than clipping its right-hand columns as the old panel did. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[560px]">
          <thead>
            <tr className="border-b border-white/15">
              {["#", "Player", "Rec", "Pts", ...tieBreakerOrder.map(tieBreakerLabel)].map(
                (head, i) => (
                  <th
                    key={`${head}-${i}`}
                    className={`py-2.5 px-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/45 font-poppins ${
                      i <= 1 ? "text-left" : "text-right"
                    }`}
                  >
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const mine = !!currentUserId && entry.userId === currentUserId;
              const decided = decidedBy(entries[idx - 1], entry, tieBreakerOrder);
              const level =
                idx > 0 &&
                entries[idx - 1].points === entry.points &&
                entries[idx - 1].rank === entry.rank;

              return (
                <tr
                  key={entry.userId}
                  className={`border-b border-white/5 ${mine ? "bg-primary/[0.08]" : ""}`}
                >
                  <td className="py-2.5 px-2 text-left">
                    <span className="text-sm font-black italic text-primary font-poppins tabular-nums">
                      {entry.rank}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-left">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="relative w-6 h-6 shrink-0 border border-white/10 bg-background flex items-center justify-center text-[9px] font-black text-primary overflow-hidden">
                        {entry.avatarUrl ? (
                          <Image
                            src={resolveImageUrl(entry.avatarUrl)}
                            alt=""
                            aria-hidden
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          displayNameOf(entry)[0]?.toUpperCase() || "?"
                        )}
                      </span>
                      {entry.userId ? (
                        <Link
                          href={profileHref(entry)}
                          className="text-[13px] font-black uppercase tracking-tight text-white hover:text-primary transition-colors truncate font-poppins"
                        >
                          {displayNameOf(entry)}
                        </Link>
                      ) : (
                        <span className="text-[13px] font-black uppercase tracking-tight text-white truncate font-poppins">
                          {displayNameOf(entry)}
                        </span>
                      )}
                      {level && (
                        <span className="text-[9px] font-mono text-white/35 shrink-0">level</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-[13px] text-white/70 tabular-nums font-poppins">
                    {entry.wins}-{entry.losses}-{entry.draws}
                  </td>
                  <td className="py-2.5 px-2 text-right text-[13px] font-black text-white tabular-nums font-poppins">
                    {entry.points}
                  </td>
                  {tieBreakerOrder.map((key) => (
                    <td
                      key={key}
                      className={`py-2.5 px-2 text-right text-[13px] tabular-nums font-poppins whitespace-nowrap ${
                        decided === key ? "text-primary" : "text-white/70"
                      }`}
                    >
                      {show(key, valueOf(entry, key))}
                      {decided === key && (
                        <span className="ml-1.5 text-[9px] font-mono text-primary">← decided</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-white/40 leading-relaxed">
        Opponents&rsquo; win rates are floored at 33%, as most Swiss rules require — which is why
        early rounds show a lot of 33.3%. Players level on every tiebreaker share a rank, and the
        next distinct player takes the following number.
      </p>
    </div>
  );
}
