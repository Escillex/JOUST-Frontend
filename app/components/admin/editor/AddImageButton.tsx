"use client";

import { useRef, useState } from "react";
import CropModal from "../../ui/CropModal";

interface Props {
  label: string;
  /** Crop ratio the picked image is framed to. */
  aspectRatio: number;
  onPicked: (file: File) => void;
  busy?: boolean;
  /** Overrides the default row shape — the filmstrip passes a tile. */
  className?: string;
}

/**
 * Picks and crops one image, without rendering a preview card.
 *
 * `ImageUpload` is the right control when an image is already on screen and is
 * being replaced; in a list it is the wrong shape — a full crop box per row is
 * exactly what made ten slides unmanageable.
 */
export default function AddImageButton({
  label,
  aspectRatio,
  onPicked,
  busy,
  className = "w-full h-10 px-3 flex items-center gap-2 border border-dashed border-white/25 text-[11px] font-black uppercase tracking-widest text-white/60 hover:border-primary hover:text-primary transition-colors disabled:opacity-40",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  return (
    <>
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          aspectRatio={aspectRatio}
          onConfirm={(blob) => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
            onPicked(new File([blob], `image_${Date.now()}.png`, { type: "image/png" }));
          }}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          e.target.value = ""; // so picking the same file again still fires
          setCropSrc(URL.createObjectURL(file));
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={className}
      >
        <span className="text-sm leading-none">+</span>
        {busy ? "Uploading..." : label}
      </button>
    </>
  );
}
