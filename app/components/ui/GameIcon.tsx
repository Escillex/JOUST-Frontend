"use client";
import Image from "next/image";
import { GamePlayed } from "../../tournaments/types";
import { resolveImageUrl } from "../../utils/api";

/**
 * A game's 1:1 icon, at one of the three sizes the app actually uses.
 *
 * Every game in the catalog MAY have an icon; none is required. A game without
 * one renders as a lettered square rather than a gap or a broken image, so no
 * screen depends on an admin having got round to the upload — which is how the
 * catalog has looked since games went first-class.
 */

type IconSize = "chip" | "row" | "tile";

const PX: Record<IconSize, number> = {
  chip: 14, // beside a game name in a chip
  row: 28, // a settings / profile list row
  tile: 56, // the picker grid
};

interface Props {
  game: Pick<GamePlayed, "name" | "iconUrl">;
  size?: IconSize;
  className?: string;
}

export default function GameIcon({ game, size = "chip", className = "" }: Props) {
  const px = PX[size];
  const box = `${className} shrink-0 bg-component-border overflow-hidden`;

  if (!game.iconUrl) {
    return (
      <span
        aria-hidden
        style={{ width: px, height: px, fontSize: Math.round(px * 0.5) }}
        className={`${box} inline-flex items-center justify-center font-black uppercase text-white/50 leading-none`}
      >
        {game.name.trim().charAt(0) || "?"}
      </span>
    );
  }

  return (
    <Image
      src={resolveImageUrl(game.iconUrl, "")}
      alt=""
      aria-hidden
      width={px}
      height={px}
      // Already 256x256 WebP on disk; the optimizer would only re-encode a file
      // that is a few KB to begin with.
      unoptimized
      className={`${box} object-cover`}
      style={{ width: px, height: px }}
    />
  );
}
