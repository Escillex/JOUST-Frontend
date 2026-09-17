"use client";
import { useState } from "react";
import type { ReactNode } from "react";

/**
 * A collapsible group on the manage page's Settings tab.
 *
 * Settings absorbed what used to be four separate destinations — rules, staff,
 * details, deletion — because none of them is a job you open this page to do
 * (agreed 2026-09-16). Collapsed by default so the tab is a short list of
 * choices rather than 1,200 lines of form: only the group being edited is open.
 *
 * Deliberately not `<details>`: the panels inside subscribe to sockets and
 * fetch on mount, and `<details>` keeps its content mounted while hidden, so
 * every collapsed panel would still be polling.
 */
interface Props {
  title: string;
  /** Sits to the right of the title — a count, or what the group is set to. */
  summary?: string;
  /** Opens on first render; use for the group most likely to be wanted. */
  defaultOpen?: boolean;
  tone?: "default" | "danger";
  children: ReactNode;
}

export default function ManageSection({
  title,
  summary,
  defaultOpen = false,
  tone = "default",
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`border ${
        tone === "danger" ? "border-[#FF4D4D]/30" : "border-white/10"
      } bg-[#1B1B1B]`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span
          className={`text-[11px] font-black uppercase tracking-[0.12em] ${
            tone === "danger" ? "text-[#FF4D4D]" : "text-white"
          }`}
        >
          {title}
        </span>
        {summary && (
          <span className="text-[11px] text-white/45 truncate">{summary}</span>
        )}
        <span
          aria-hidden
          className={`ml-auto text-white/40 text-xs transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▸
        </span>
      </button>

      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}
