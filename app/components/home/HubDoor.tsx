"use client";
import Link from "next/link";
import React from "react";

/**
 * One door on the phone hub.
 *
 * A door carries a concrete thing — a name, a price, a rank — not a count, and
 * an accent hairline so six of them read as six destinations rather than one
 * grey slab. `live` promotes a door when something behind it needs attention.
 */

export type DoorAccent = "primary" | "record" | "board" | "collection" | "community" | "store";

const ACCENT: Record<DoorAccent, string> = {
  primary: "bg-primary",
  record: "bg-[#7EE074]",
  board: "bg-[#5AA9E6]",
  collection: "bg-[#E3A13C]",
  community: "bg-[#C76AD6]",
  store: "bg-[#D8D3C7]",
};

interface HubDoorProps {
  href: string;
  title?: string;
  accent?: DoorAccent;
  live?: boolean;
  children: React.ReactNode;
  /** The texture strip along the bottom — icons, faces, a medal row. */
  foot?: React.ReactNode;
  className?: string;
}

export default function HubDoor({
  href,
  title,
  accent = "primary",
  live = false,
  inverse = false,
  children,
  foot,
  className = "",
}: HubDoorProps & { inverse?: boolean }) {
  const isInverse = inverse && !live;
  const inverseBg = isInverse ? ACCENT[accent] : "bg-surface";
  const textColor = isInverse ? "text-black" : "text-white";
  const descColor = isInverse ? "text-black/80" : "text-white/60";

  return (
    <Link
      href={href}
      className={`@container group relative flex flex-col h-full w-full gap-2 border p-4 min-h-[104px] overflow-hidden transition-colors ${inverseBg} ${
        live ? "border-[#FF4D4D]/60 hover:border-[#FF4D4D]" : isInverse ? "border-black/10 hover:border-black/30" : "border-white/10 hover:border-primary/60"
      } ${className}`}
    >
      {!isInverse && (
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${live ? "bg-[#FF4D4D]" : ACCENT[accent]}`}
        />
      )}
      <span aria-hidden className={`absolute right-3 top-3 h-3 w-3 border-r border-t ${isInverse ? "border-black/35" : "border-white/20 group-hover:border-primary"}`} />
      {title && (
        <span className={`text-[length:min(10px,7cqw)] whitespace-nowrap font-black uppercase tracking-[0.24em] font-poppins ${isInverse ? "text-black/75" : "text-white/55"}`}>
          {title}
        </span>
      )}
      <div className={`flex-1 flex flex-col justify-between min-h-0 py-2 text-[11.5px] leading-snug ${descColor}`}>{children}</div>
      {foot && <div className={`mt-auto border-t ${isInverse ? "border-black/15" : "border-white/10"} pt-2 flex items-center gap-1.5 ${textColor}`}>{foot}</div>}
      <span aria-hidden className={`absolute bottom-3 right-3 h-2 w-2 border-b border-r ${isInverse ? "border-black/35" : "border-white/20 group-hover:border-primary"}`} />
    </Link>
  );
}

/** Overlapping initials — a cheap way to show people are involved. */
export function FaceStack({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <span className="flex">
      {names.slice(0, 4).map((n, i) => (
        <span
          key={`${n}-${i}`}
          className="w-5 h-5 -mr-1.5 bg-background border border-black flex items-center justify-center text-[8px] font-black text-primary font-poppins"
        >
          {n[0]?.toUpperCase() ?? "?"}
        </span>
      ))}
    </span>
  );
}
