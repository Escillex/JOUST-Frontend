"use client";
import { GamePlayed } from "../../tournaments/types";
import GameIcon from "../ui/GameIcon";

/** The games somebody says they play, under their name. Icons carry it — the
 *  name is there for anyone who does not recognise the icon, and for screen
 *  readers, which get nothing from the icon at all. */
export default function PlaysRow({
  games,
  compact = false,
}: {
  games: GamePlayed[] | undefined;
  compact?: boolean;
}) {
  if (!games || games.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Plays</span>
      {games.map((g) => (
        <span
          key={g.id}
          className="inline-flex items-center gap-1.5 border border-component-border px-2 py-1"
        >
          <GameIcon game={g} size="chip" />
          {!compact && <span className="text-[11px] text-white/80">{g.name}</span>}
          {compact && <span className="sr-only">{g.name}</span>}
        </span>
      ))}
    </div>
  );
}
