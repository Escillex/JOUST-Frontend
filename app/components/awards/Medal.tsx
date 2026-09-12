"use client";

import { useState } from "react";
import { resolveImageUrl } from "../../utils/api";

/**
 * A medal: square artwork on a transparent canvas (the server contains it at
 * 512x512 rather than cropping, since medals are round and ribbon-hung).
 *
 * Tapping or hovering shows the detail card — name, description, and each time
 * it was given with its note — because a pinned medal is otherwise just a small
 * picture, and "what is this for?" is the first thing anyone asks.
 */
interface Grant {
  awardedAt: string;
  note: string | null;
}

interface MedalProps {
  name: string;
  imageUrl: string;
  description?: string | null;
  /** Every grant of this medal to this person; length > 1 shows a ×N badge. */
  grants?: Grant[];
  /** Tailwind size classes, so a caller can be responsive (e.g. 56px on
   *  mobile, 72px from md up). */
  sizeClass?: string;
  /** Pin slot number, shown in the showcase editor. */
  slot?: number | null;
  showDetail?: boolean;
  className?: string;
}

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function Medal({
  name,
  imageUrl,
  description,
  grants = [],
  sizeClass = "w-[72px] h-[72px]",
  slot,
  showDetail = true,
  className = "",
}: MedalProps) {
  const [open, setOpen] = useState(false);
  const count = grants.length;
  const Tag = showDetail ? "button" : "span";

  return (
    <div
      className={`relative group ${className}`}
      onMouseEnter={() => showDetail && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* A button only when it does something. Pickers wrap medals in their
          own buttons, and a button inside a button is invalid HTML — so a
          non-interactive medal is a plain element. */}
      <Tag
        {...(showDetail
          ? {
              type: "button" as const,
              onClick: () => setOpen((o) => !o),
              "aria-label": count > 1 ? `${name}, awarded ${count} times` : name,
            }
          : { "aria-hidden": true })}
        className={`relative block ${sizeClass} ${showDetail ? "transition-transform hover:-translate-y-0.5" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveImageUrl(imageUrl)}
          alt=""
          className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
          draggable={false}
        />
        {count > 1 && (
          <span className="absolute -bottom-1 -right-1 bg-primary text-black text-[9px] font-black px-1.5 leading-4 border border-black">
            ×{count}
          </span>
        )}
        {slot ? (
          <span className="absolute -top-1 -left-1 bg-black border border-primary text-primary text-[9px] font-black w-4 h-4 flex items-center justify-center">
            {slot}
          </span>
        ) : null}
      </Tag>

      {showDetail && open && (
        <div className="absolute z-40 left-1/2 -translate-x-1/2 top-full mt-2 w-60 bg-[#0A0A0A] border border-primary/40 p-4 shadow-[4px_4px_0_rgba(0,0,0,0.6)] text-left pointer-events-none">
          <p className="text-[11px] font-black uppercase tracking-widest text-primary">{name}</p>
          {description && <p className="text-xs text-white/60 mt-1.5 leading-relaxed">{description}</p>}
          {count > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
              {grants.slice(0, 5).map((g, i) => (
                <li key={i} className="text-[10px] text-white/50 leading-snug">
                  <span className="text-white/80 font-bold">{date(g.awardedAt)}</span>
                  {g.note ? ` — ${g.note}` : ""}
                </li>
              ))}
              {count > 5 && <li className="text-[10px] text-white/30">and {count - 5} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
