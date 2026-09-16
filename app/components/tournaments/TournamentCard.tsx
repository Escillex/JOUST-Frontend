"use client";
import Image from "next/image";
import Link from "next/link";
import { Tournament } from "../../tournaments/types";
import { resolveImageUrl } from "../../utils/api";
import GameIcon from "../ui/GameIcon";
import { describeStatus, formatWhen, seatsLeft } from "../../utils/tournamentStatus";
import { systemLabel } from "../../utils/formatConfig";

/**
 * One tournament in the browse grid.
 *
 * What a card says is the whole decision: the old one showed an 8-character
 * slice of the UUID and the prize, and nothing a player actually chooses on —
 * not the game, not the date, not whether there is a seat. All three were
 * already on the wire; they were simply never rendered.
 */

interface Props {
  tournament: Tournament;
  isJoined?: boolean;
}

export default function TournamentCard({ tournament: t, isJoined = false }: Props) {
  const status = describeStatus(t, isJoined);
  const when = formatWhen(t.date);
  const left = seatsLeft(t);
  const taken = t.participants?.length ?? 0;
  // Finished tournaments are not cards — they render as `FinishedRow`, so
  // nothing here needs a COMPLETED branch.
  const showSeats = t.status === "OPEN" || t.status === "UPCOMING";
  // A tournament being played right now gets a red frame, not the brand green —
  // green already means "you can join this", and the two were indistinguishable.
  const live = status.tone === "now";

  const format =
    typeof t.format === "object" && t.format ? systemLabel(t.format.system) : null;

  return (
    <Link
      href={`/tournaments/${t.id}`}
      className={`group relative flex flex-col bg-component-background border-2 transition-colors ${
        live
          ? "border-[#FF4D4D]/60 hover:border-[#FF4D4D]"
          : "border-component-border hover:border-primary"
      }`}

    >
      <div
        className={`relative h-36 w-full overflow-hidden border-b-2 bg-background ${
          live ? "border-[#FF4D4D]/60" : "border-component-border"
        }`}
      >
        {t.bannerUrl ? (
          <Image
            src={resolveImageUrl(t.bannerUrl, "")}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover opacity-95 group-hover:opacity-100 transition-opacity duration-500"
          />
        ) : (
          // A tournament with no banner gets a quiet ground, not the
          // "PLACEHOLDER — NO IMAGE SET" artwork, which reads as broken.
          <div
            aria-hidden
            className="absolute inset-0 bg-zinc-900"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 14px)",
            }}
          />
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-black uppercase tracking-widest border ${
              live
                ? "bg-[#FF4D4D] border-[#FF4D4D] text-white"
                : isJoined
                  ? "bg-primary border-primary text-black"
                  : status.tone === "open"
                    ? "bg-component-background/90 border-primary text-primary"
                    : "bg-component-background/90 border-component-border text-white/70"
            }`}
          >
            {live && (
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
            {!live && status.tone === "open" && !isJoined && <span aria-hidden>● </span>}
            {status.label}
          </span>

          {t.game && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-component-background/90 border border-component-border text-[9px] font-black uppercase tracking-widest text-white max-w-[55%]">
              <GameIcon game={t.game} size="chip" />
              <span className="truncate">{t.game.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3
          className={`text-xl font-black uppercase tracking-tight leading-tight text-white transition-colors ${
            live ? "group-hover:text-[#FF4D4D]" : "group-hover:text-primary"
          }`}
        >
          {t.name}
        </h3>

        <p className="text-xs text-white/70">
          {when ?? "Date to be announced"}
          {format && <span className="text-white/40"> · {format}</span>}
        </p>

        {showSeats && (
          <div className="flex items-center gap-3">
            <span aria-hidden className="relative h-1.5 flex-1 bg-component-border">
              <span
                className="absolute inset-y-0 left-0 bg-primary"
                style={{ width: `${Math.min(100, (taken / Math.max(1, t.maxPlayers)) * 100)}%` }}
              />
            </span>
            <span className="text-[11px] text-white whitespace-nowrap">
              {taken} / {t.maxPlayers}
              <span className="text-white/50">
                {" · "}
                {left === 0 ? "full" : `${left} seat${left === 1 ? "" : "s"} left`}
              </span>
            </span>
          </div>
        )}

        {t.prizePool && (
          <p className="mt-auto text-[11px] text-white/70">
            <span className="text-white/40 uppercase tracking-widest">Prize </span>
            {t.prizePool}
          </p>
        )}
      </div>
    </Link>
  );
}
