"use client";

import { resolveImageUrl } from "../../utils/api";

/**
 * A plaque: 4:1 artwork with the award's name drawn over it as live text.
 *
 * The title is rendered, not baked into the image, so one plaque design can
 * serve many awards and the lettering stays crisp at every size. It sits on a
 * dark horizontal scrim so it reads on any artwork — which is also why admins
 * are told to keep the middle of plaque art quiet.
 *
 * Sizes follow the proposal: ~360x90 under the name on desktop, full width on
 * mobile, 240x60 in the home bento.
 */
// Tracking is deliberately modest and the title may take two lines: at wider
// letter-spacing a perfectly ordinary name ("2026 Winter Invitational")
// truncated to "2026 WINTER INVITATI…" on desktop and worse on a phone.
const SIZES = {
  lg: { box: "w-full max-w-[360px]", text: "text-[12px] md:text-[14px] tracking-[0.12em]" },
  md: { box: "w-full max-w-[300px]", text: "text-[11px] tracking-[0.1em]" },
  sm: { box: "w-full max-w-[240px]", text: "text-[9px] tracking-[0.08em]" },
} as const;

interface PlaqueProps {
  name: string;
  imageUrl: string;
  size?: keyof typeof SIZES;
  /** Repeats of the same plaque, shown as a small badge. */
  count?: number;
  className?: string;
  title?: string;
}

export default function Plaque({ name, imageUrl, size = "lg", count, className = "", title }: PlaqueProps) {
  const s = SIZES[size];
  return (
    <div
      className={`relative ${s.box} aspect-[4/1] overflow-hidden border border-white/10 bg-black ${className}`}
      title={title ?? name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveImageUrl(imageUrl)}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      {/* Scrim: darkest through the middle band where the title sits. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-black/60 to-black/10" />
      <div className="absolute inset-0 flex items-center justify-center px-[9%]">
        <span
          className={`${s.text} font-black uppercase text-white font-poppins text-center leading-tight line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]`}
        >
          {name}
        </span>
      </div>
      {count && count > 1 && (
        <span className="absolute top-1 right-1 bg-primary text-black text-[9px] font-black px-1.5 leading-4">
          ×{count}
        </span>
      )}
    </div>
  );
}
