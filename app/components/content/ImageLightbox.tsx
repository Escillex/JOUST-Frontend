"use client";

import { useEffect } from "react";
import { resolveImageUrl } from "../../utils/api";

/** Full-screen view of one uploaded image. Tap outside or Escape to close. */
export default function ImageLightbox({
  src,
  alt,
  caption,
  onClose,
  footer,
}: {
  src: string;
  alt: string;
  caption?: string | null;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center p-4 gap-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveImageUrl(src)}
        alt={alt}
        className="relative max-w-full max-h-[80vh] object-contain border border-white/10"
      />
      {(caption || footer) && (
        <div className="relative w-full max-w-2xl flex flex-wrap items-center justify-between gap-3">
          {caption ? <p className="text-sm text-white/70">{caption}</p> : <span />}
          {footer}
        </div>
      )}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white"
      >
        Close
      </button>
    </div>
  );
}
