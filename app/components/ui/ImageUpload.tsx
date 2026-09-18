"use client";

import Image from "next/image";
import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { resolveImageUrl } from "../../utils/api";
import CropModal from "./CropModal";

interface ImageUploadProps {
  currentUrl?: string | null;
  /** Receives the final cropped File ready for upload */
  onUpload: (file: File) => void;
  onDelete?: () => void;
  uploading?: boolean;
  /** Tailwind aspect-ratio class, e.g. "aspect-[21/9]" or "aspect-square" */
  aspectRatio?: string;
  /**
   * Crop ratio, when it must differ from the preview box. Normally leave it
   * unset: it is derived from `aspectRatio` below, because two independent
   * props are two props that can disagree — and they did. The prize-picture
   * upload showed a 4:3 preview while the cropper cut a 21/9 strip, so what the
   * organizer framed was never what got saved.
   */
  cropAspectRatio?: number;
  label?: string;
  placeholder?: React.ReactNode;
  /** When rendered in compact tiles (e.g. 64-80px icons), use scaled-down touch overlay buttons */
  compact?: boolean;
}

export default function ImageUpload({
  currentUrl,
  onUpload,
  onDelete,
  uploading = false,
  aspectRatio = "aspect-video",
  cropAspectRatio,
  label = "UPDATE IMAGE",
  placeholder,
  compact = false,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  /** "aspect-[21/9]" -> 2.33, "aspect-square" -> 1, "aspect-video" -> 1.78. */
  const ratioFromClass = (cls: string): number => {
    const bracket = cls.match(/aspect-\[(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\]/);
    if (bracket) return Number(bracket[1]) / Number(bracket[2]);
    if (cls.includes("aspect-square")) return 1;
    return 16 / 9; // aspect-video, and the fallback
  };
  const cropRatio = cropAspectRatio ?? ratioFromClass(aspectRatio);

  // Resolve display URL — prefix API base for relative server paths
  // resolveImageUrl also keeps "blob:" preview URLs unchanged, which
  // this component relies on while a new image is being uploaded.
  const displayUrl = currentUrl
    ? resolveImageUrl(currentUrl)
    : "/placeholder.png";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so re-selecting the same file triggers onChange again
    e.target.value = "";
    // Create a local object URL and open the crop modal
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = (blob: Blob) => {
    // Revoke the temporary object URL
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    // Convert Blob → File so consumers get a standard File object
    // PNG, matching what CropModal now produces: lossless out of the canvas,
    // re-encoded to WebP once by the server instead of twice.
    const croppedFile = new File([blob], `image_${Date.now()}.png`, {
      type: "image/png",
    });
    onUpload(croppedFile);
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  return (
    <>
      {/* ── Crop Modal (portal-like, rendered outside the card) ── */}
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          aspectRatio={cropRatio}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {/* ── Upload Card ── */}
      <div
        className={`relative group overflow-hidden border-2 border-component-border hover:border-primary/50 transition-colors bg-component-background ${aspectRatio}`}
      >
        {/* Current / preview image.
            Deliberately a raw <img>, not next/image: while a new file is being
            uploaded displayUrl is a "blob:" object URL, and next/image cannot
            parse blob:/data: sources — it throws rather than rendering. The
            local preview is the whole point of this component, so the
            optimizer is traded away here and nowhere else. */}
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt="Uploaded content"
            className="w-full h-full object-cover opacity-95 group-hover:opacity-100 brightness-100 group-hover:brightness-110 transition-all duration-500"
          />
        ) : placeholder ? (
          <div className="w-full h-full flex items-center justify-center bg-[#111]">
            {placeholder}
          </div>
        ) : (
          /* A quiet hatched ground, not the "PLACEHOLDER — NO IMAGE SET"
             artwork. That image reads as a broken upload rather than an empty
             slot — it was retired from tournament cards for the same reason,
             and this is the component every other empty slot inherits it
             from. */
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-zinc-900"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 14px)",
            }}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              No image
            </span>
          </div>
        )}

        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_2px]" />

        <div className={`absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex flex-col items-center justify-center ${
          compact
            ? "gap-1 p-1 [@media(hover:none)]:opacity-100 [@media(hover:none)]:top-auto [@media(hover:none)]:flex-col [@media(hover:none)]:gap-1 [@media(hover:none)]:p-1 [@media(hover:none)]:bg-black/85"
            : "gap-4 [@media(hover:none)]:opacity-100 [@media(hover:none)]:top-auto [@media(hover:none)]:flex-row [@media(hover:none)]:flex-wrap [@media(hover:none)]:justify-center [@media(hover:none)]:gap-2 [@media(hover:none)]:p-2 [@media(hover:none)]:bg-black/75"
        }`}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`${
              compact
                ? "w-full py-1 px-1.5 bg-primary text-black font-black text-[9px] tracking-wider truncate"
                : "min-h-11 px-6 py-2 bg-primary text-black font-black text-xs tracking-widest hover:scale-105 active:scale-95 transition-transform"
            } disabled:opacity-50 disabled:scale-100`}
          >
            {uploading ? "..." : label}
          </button>

          {currentUrl && onDelete && !uploading && (
            <button
              type="button"
              onClick={onDelete}
              className={`${
                compact
                  ? "w-full py-0.5 text-[8px] font-bold text-red-400 hover:text-red-300 tracking-wider uppercase truncate"
                  : "min-h-11 px-3 text-[11px] font-bold text-red-400 hover:text-red-300 tracking-widest uppercase"
              }`}
            >
              {compact ? "Remove" : "Remove image"}
            </button>
          )}
        </div>

        {/* Uploading spinner */}
        <AnimatePresence>
          {uploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                <span className="text-[10px] font-black tracking-widest text-primary">
                  UPLOADING...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Corner accents */}
        <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </>
  );
}
