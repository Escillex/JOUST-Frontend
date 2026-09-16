"use client";
import Link from "next/link";
import React from "react";

/**
 * One titled band of the dashboard.
 *
 * The page was a grid of equally-weighted tiles, which gave the viewer no
 * reading order: a tournament you are playing in tomorrow carried exactly the
 * same weight as a leaderboard you are not on, and every tile was padded out
 * to fill its cell whether it had content or not. Sections restore the order —
 * heading, the one action that belongs to it, then the content — and each is
 * only as tall as what it holds.
 */
interface HomeSectionProps {
  title: string;
  /** Sits beside the heading when there is something to count. */
  count?: number;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}

export default function HomeSection({
  title,
  count,
  action,
  children,
  className = "",
}: HomeSectionProps) {
  return (
    <section className={`flex flex-col min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-4 mb-5 pb-3 border-b border-white/10">
        <h2 className="flex items-baseline gap-3 min-w-0">
          <span className="text-sm font-black uppercase tracking-[0.25em] text-white font-poppins truncate">
            {title}
          </span>
          {typeof count === "number" && count > 0 && (
            <span className="text-[11px] font-black text-white/45 font-mono shrink-0 tabular-nums">
              {count}
            </span>
          )}
        </h2>

        {action && (
          <Link
            href={action.href}
            className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 hover:text-primary transition-colors font-poppins flex items-center gap-1.5"
          >
            {action.label}
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>

      {children}
    </section>
  );
}

/**
 * What a section says when it has nothing to show. Always offers the next step:
 * the old dashboard stated the absence ("No activity recorded.") and stopped
 * there, in a card tall enough to hold ten rows.
 */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-white/15 bg-white/[0.02] px-6 py-8">
      <p className="text-sm text-white/55">{message}</p>
      {action && (
        <Link
          href={action.href}
          className="text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:text-white transition-colors font-poppins flex items-center gap-1.5"
        >
          {action.label}
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
