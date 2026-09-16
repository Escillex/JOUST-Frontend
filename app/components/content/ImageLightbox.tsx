"use client";

import { useEffect, useRef } from "react";
import { resolveImageUrl } from "../../utils/api";

/** Everything inside the picture that a keyboard can land on. */
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen view of one uploaded image. Click outside or press Escape to
 * close.
 *
 * It claims `aria-modal`, so it has to behave like one for a keyboard: opening
 * used to leave the keyboard on the thumbnail behind the picture, so the next
 * Tab pressed controls nobody could see, and the only way out was a 37×15px
 * "Close" in half-faded 10px text. Now focus moves in on open, Tab cycles
 * inside, and closing hands focus back to whatever opened it.
 */
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
  const shell = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Whatever was focused when the picture opened — the thumbnail, normally.
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => {
      // Back where they were, so they carry on down the gallery.
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !shell.current) return;

      const items = Array.from(shell.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;

      // Tab must not walk the page behind the picture.
      const here = items.indexOf(document.activeElement as HTMLElement);
      if (here === -1) {
        e.preventDefault();
        items[0].focus();
        return;
      }
      const next = e.shiftKey ? (here - 1 + items.length) % items.length : (here + 1) % items.length;
      e.preventDefault();
      items[next].focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={shell}
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center p-4 gap-3"
      role="dialog"
      aria-modal="true"
      aria-label={caption || alt}
    >
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
        ref={closeButton}
        onClick={onClose}
        className="absolute top-4 right-4 h-11 px-4 flex items-center gap-2 border border-component-border bg-component-background/90 text-[11px] font-bold uppercase tracking-[0.12em] text-white font-poppins hover:border-primary/60 transition-colors"
      >
        Close
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
