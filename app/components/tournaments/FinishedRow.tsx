"use client";
import Link from "next/link";
import { Tournament } from "../../tournaments/types";
import { displayNameOf } from "../../utils/api";
import GameIcon from "../ui/GameIcon";
import { systemLabel } from "../../utils/formatConfig";

/**
 * A finished tournament, as one scannable row.
 *
 * Finished events were rendering as full cards: a 144px banner of empty hatching,
 * a seat bar that no longer means anything, a prize that has already been won —
 * and the winner, the only thing anybody looks for, squeezed into the status chip
 * in the corner at 9px, where a long name breaks the chip.
 *
 * History is scanned, not chosen from. So: who won, how big it was, and when it
 * actually ended — on one line, in the order those questions get asked.
 */

/** Matches the placement chip on the profile's Tournament History, so a result
 *  looks the same wherever it is shown. */
const PODIUM: Record<number, string> = {
  1: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300",
  2: "border-[#C9CDD3]/50 bg-[#C9CDD3]/10 text-[#C9CDD3]",
  3: "border-[#C98A4B]/50 bg-[#C98A4B]/10 text-[#D99A5B]",
};

/** "24 Aug" / "24 Aug 2025" — the day it ended; the time is noise in a list. */
function endedOn(t: Tournament): string | null {
  const raw = t.completedAt || t.date;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

interface Props {
  tournament: Tournament;
  /** Null when signed out. */
  userId?: string | null;
}

export default function FinishedRow({ tournament: t, userId }: Props) {
  const winner = t.winner ? displayNameOf(t.winner) : null;
  const players = t.participants?.length ?? 0;
  const ended = endedOn(t);
  const mine = userId ? t.participants?.find((p) => p.userId === userId) : undefined;
  const placement = mine?.placement ?? null;

  return (
    <Link
      href={`/tournaments/${t.id}`}
      className="group flex flex-wrap items-center gap-x-4 gap-y-2 py-3 px-3 -mx-3 border-b border-component-border hover:bg-white/[0.03] transition-colors"
    >
      {t.game && <GameIcon game={t.game} size="row" />}

      <span className="flex flex-col min-w-0 flex-1 basis-56">
        <span className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
          {t.name}
        </span>
        <span className="text-[11px] text-white/45 truncate">
          {[t.game?.name, systemLabel(typeof t.format === "object" ? t.format?.system : null)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

      {/* Fixed tracks from `sm` up so winner / size / date read as columns down
          the list; below that they wrap onto a second line under the name. */}
      {winner && (
        <span className="flex items-center gap-2 min-w-0 sm:w-56 sm:shrink-0">
          <span
            className={`shrink-0 px-1.5 py-0.5 border text-[10px] font-black ${PODIUM[1]}`}
            title="Champion"
          >
            #1
          </span>
          <span className="text-xs text-white/85 truncate">{winner}</span>
        </span>
      )}

      {/* Your own result beats the field size — it is the reason you opened the
          list. Shown only to somebody who actually played. */}
      {placement ? (
        <span className="shrink-0 sm:w-24">
          <span
            className={`px-2 py-0.5 border text-[10px] font-black ${
              PODIUM[placement] ?? "border-component-border bg-white/[0.03] text-white/70"
            }`}
            title={`You finished #${placement}`}
          >
            You #{placement}
          </span>
        </span>
      ) : (
        <span className="shrink-0 sm:w-24 text-[11px] text-white/45 tabular-nums">
          {players > 0 ? `${players} player${players === 1 ? "" : "s"}` : ""}
        </span>
      )}

      {ended && (
        <span className="shrink-0 text-[11px] text-white/45 tabular-nums w-16 sm:text-right">
          {ended}
        </span>
      )}
    </Link>
  );
}
