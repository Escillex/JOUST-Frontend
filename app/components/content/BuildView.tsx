"use client";

import { useState } from "react";
import { resolveImageUrl } from "../../utils/api";
import type { BuildKind, BuildStatus } from "../../tournaments/types";
import ImageLightbox from "./ImageLightbox";

/**
 * One tournament build, whatever form it takes (todo.md obj. 4.3): a photo, a
 * plain-text list, or an https link. Text is rendered as text — never HTML —
 * and links open in a new tab with no referrer and no opener.
 */
export interface BuildBody {
  kind: BuildKind;
  imageUrl: string | null;
  text?: string | null;
  url?: string | null;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export default function BuildView({ build, alt, compact = false }: { build: BuildBody; alt: string; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(false);

  if (build.kind === "IMAGE" && build.imageUrl) {
    return (
      <>
        <button type="button" onClick={() => setZoom(true)} className="block w-full group" title="View full size">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveImageUrl(build.imageUrl)}
            alt={alt}
            loading="lazy"
            className={`w-full object-cover border border-white/10 group-hover:border-primary/50 transition-colors ${
              compact ? "h-28" : "aspect-[4/3]"
            }`}
          />
        </button>
        {zoom && <ImageLightbox src={build.imageUrl} alt={alt} onClose={() => setZoom(false)} />}
      </>
    );
  }

  if (build.kind === "LINK" && build.url) {
    return (
      <a
        href={build.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex items-center gap-3 border border-white/10 px-3 py-3 hover:border-primary/50 transition-colors group"
      >
        <svg className="w-4 h-4 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        <span className="min-w-0">
          <span className="block text-xs font-bold text-white group-hover:text-primary truncate">{hostOf(build.url)}</span>
          <span className="block text-[10px] text-white/30 truncate">{build.url}</span>
        </span>
      </a>
    );
  }

  if (build.kind === "TEXT" && build.text) {
    const long = build.text.split("\n").length > (compact ? 6 : 14) || build.text.length > (compact ? 300 : 900);
    return (
      <div className="border border-white/10 bg-black/40">
        <pre
          className={`px-3 py-3 text-[11px] leading-relaxed text-white/80 font-mono whitespace-pre-wrap break-words overflow-hidden ${
            expanded ? "" : compact ? "max-h-28" : "max-h-72"
          }`}
        >
          {build.text}
        </pre>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full border-t border-white/10 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white"
          >
            {expanded ? "Show less" : "Show all"}
          </button>
        )}
      </div>
    );
  }

  return <p className="text-xs text-white/30">Nothing to show.</p>;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "text-primary border-primary/40",
  PENDING: "text-amber-400 border-amber-400/40",
  REJECTED: "text-[#FF4D4D] border-[#FF4D4D]/40",
  MISSING: "text-white/40 border-white/15",
  GUEST: "text-white/30 border-white/10",
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  PENDING: "Awaiting review",
  REJECTED: "Rejected",
  MISSING: "No build",
  GUEST: "Guest — exempt",
};

export function BuildStatusChip({ status, reviewed = true }: { status: BuildStatus | "MISSING" | "GUEST"; reviewed?: boolean }) {
  // In an optional-builds tournament nothing is reviewed, so "Awaiting review"
  // would be a promise nobody keeps; the caller passes reviewed={false}.
  const label = !reviewed && status === "PENDING" ? "Submitted" : STATUS_LABEL[status] ?? status;
  const tone = !reviewed && status === "PENDING" ? "text-white/60 border-white/20" : STATUS_TONE[status] ?? "text-white/40 border-white/10";
  return (
    <span className={`inline-block text-[8px] font-black uppercase tracking-widest border px-1.5 py-0.5 whitespace-nowrap ${tone}`}>
      {label}
    </span>
  );
}
