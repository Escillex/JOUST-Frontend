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
  title: string;
  accent?: DoorAccent;
  live?: boolean;
  children: React.ReactNode;
  /** The texture strip along the bottom — icons, faces, a medal row. */
  foot?: React.ReactNode;
}

export default function HubDoor({
  href,
  title,
  accent = "primary",
  live = false,
  children,
  foot,
}: HubDoorProps) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col gap-1.5 border bg-surface p-4 min-h-[104px] transition-colors ${
        live ? "border-[#FF4D4D]/55 hover:border-[#FF4D4D]" : "border-white/10 hover:border-white/30"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[2px] ${live ? "bg-[#FF4D4D]" : ACCENT[accent]}`}
      />
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white font-poppins">
        {title}
      </span>
      <div className="text-[11.5px] leading-snug text-white/60">{children}</div>
      {foot && <div className="mt-auto pt-1.5 flex items-center gap-1.5">{foot}</div>}
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
