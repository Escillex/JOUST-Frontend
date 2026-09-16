"use client";

import { useId, useState } from "react";
import { resolveImageUrl } from "../../utils/api";
import type { GalleryImage } from "../../tournaments/types";
import ImageLightbox from "../content/ImageLightbox";
import ContentActions from "../content/ContentActions";
import { Icons } from "./ProfileSection";

/**
 * A profile's gallery (todo.md obj. 4.3) — one image per game, posted by the
 * owner once they have finished a tournament. It sits at the top of the
 * profile and folds away; whether it is folded is remembered per browser, so
 * someone who only wants the record closes it once. Renders nothing for an
 * empty gallery.
 */
const STORAGE_KEY = "profile.gallery.collapsed";

export default function GallerySection({
  images,
  viewerRoles,
  isOwnProfile,
  onRemoved,
  compact = false,
}: {
  images: GalleryImage[];
  viewerRoles?: string[];
  isOwnProfile: boolean;
  onRemoved: () => void;
  /** Phone layout: two columns instead of four. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState<GalleryImage | null>(null);
  // Read once, on the client (the profile renders its views only after
  // measuring the window). No storage — a private window, blocked site data —
  // simply means open.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const panelId = useId();

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  if (images.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          className="w-full min-h-11 flex items-center justify-between gap-4 text-left group"
        >
          <span className="flex items-center gap-2.5 text-lg md:text-xl font-black uppercase tracking-[0.08em] text-white font-poppins">
            <span className="text-primary" aria-hidden="true">{Icons.gallery}</span>
            Gallery
          </span>
          <span className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white/55 font-poppins group-hover:text-white transition-colors">
            {images.length} game{images.length === 1 ? "" : "s"}
            <span className="flex items-center gap-1.5 border border-component-border px-2.5 h-8 group-hover:border-primary/60 transition-colors">
              {collapsed ? "Show" : "Hide"}
              <svg
                className={`w-3.5 h-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </span>
        </button>
      </h2>

      <div
        id={panelId}
        hidden={collapsed}
        className={`grid gap-3 md:gap-5 ${compact ? "grid-cols-2" : "grid-cols-3 xl:grid-cols-4"}`}
      >
        {images.map((img) => (
          <div key={img.id} className="bg-component-background border border-component-border flex flex-col">
            <button type="button" onClick={() => setOpen(img)} className="block w-full" title="View full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveImageUrl(img.imageUrl)}
                alt={`${img.gameName} — gallery image`}
                loading="lazy"
                className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
              />
            </button>
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0 flex flex-col gap-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary truncate font-poppins">{img.gameName}</p>
                {img.caption && <p className="text-[13px] text-white/75 leading-snug line-clamp-2">{img.caption}</p>}
              </div>
              <ContentActions
                targetType="GALLERY_IMAGE"
                targetId={img.id}
                viewerRoles={viewerRoles}
                isOwner={isOwnProfile}
                onRemoved={onRemoved}
              />
            </div>
          </div>
        ))}
      </div>

      {open && (
        <ImageLightbox
          src={open.imageUrl}
          alt={`${open.gameName} — gallery image`}
          caption={open.caption ? `${open.gameName} · ${open.caption}` : open.gameName}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
