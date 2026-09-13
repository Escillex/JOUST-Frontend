"use client";

import { useState } from "react";
import { resolveImageUrl } from "../../utils/api";
import type { GalleryImage } from "../../tournaments/types";
import ImageLightbox from "../content/ImageLightbox";
import ContentActions from "../content/ContentActions";

/**
 * A profile's gallery (todo.md obj. 4.3) — one image per game, posted by the
 * owner once they have finished a tournament. Renders nothing for an empty
 * gallery, like the awards case.
 */
export default function GallerySection({
  images,
  viewerRoles,
  isOwnProfile,
  onRemoved,
}: {
  images: GalleryImage[];
  viewerRoles?: string[];
  isOwnProfile: boolean;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState<GalleryImage | null>(null);
  if (images.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black uppercase tracking-widest text-foreground font-poppins flex items-center gap-3">
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="1" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 16 5-5 4 4 3-3 6 6" />
          </svg>
          Gallery
        </h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
          {images.length} game{images.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((img) => (
          <div key={img.id} className="bg-component-background border-2 border-component-border group">
            <button type="button" onClick={() => setOpen(img)} className="block w-full" title="View full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveImageUrl(img.imageUrl)}
                alt={`${img.gameName} — gallery image`}
                loading="lazy"
                className="w-full aspect-square object-cover group-hover:opacity-90 transition-opacity"
              />
            </button>
            <div className="p-3 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-primary truncate">{img.gameName}</p>
              {img.caption && <p className="text-[11px] text-white/60 leading-snug line-clamp-2">{img.caption}</p>}
              <div className="flex justify-end pt-1">
                <ContentActions
                  targetType="GALLERY_IMAGE"
                  targetId={img.id}
                  viewerRoles={viewerRoles}
                  isOwner={isOwnProfile}
                  onRemoved={onRemoved}
                />
              </div>
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
    </div>
  );
}
