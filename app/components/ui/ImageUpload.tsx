"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { API_URL } from "../../utils/api";
import CropModal from "./CropModal";

interface ImageUploadProps {
  currentUrl?: string | null;
  /** Receives the final cropped File ready for upload */
  onUpload: (file: File) => void;
  onDelete?: () => void;
  uploading?: boolean;
  /** Tailwind aspect-ratio class, e.g. "aspect-[21/9]" or "aspect-square" */
  aspectRatio?: string;
  /** Numeric aspect ratio for the cropper, e.g. 21/9 or 1 */
  cropAspectRatio?: number;
  label?: string;
}

export default function ImageUpload({
  currentUrl,
  onUpload,
  onDelete,
  uploading = false,
  aspectRatio = "aspect-video",
  cropAspectRatio = 21 / 9,
  label = "UPDATE IMAGE",
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Resolve display URL — prefix API base for relative server paths
  const displayUrl = currentUrl
    ? (currentUrl.startsWith("http") || currentUrl.startsWith("blob:"))
      ? currentUrl
      : `${API_URL}${currentUrl}`
    : "/placeholder.jpg";

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
    const croppedFile = new File([blob], `banner_${Date.now()}.webp`, {
      type: "image/webp",
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
          aspectRatio={cropAspectRatio}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {/* ── Upload Card ── */}
      <div
        className={`relative group overflow-hidden border-2 border-white/10 hover:border-[#52B946]/50 transition-colors bg-black ${aspectRatio}`}
      >
        {/* Current / preview image */}
        <img
          src={displayUrl}
          alt="Uploaded content"
          className="w-full h-full object-cover opacity-95 group-hover:opacity-100 brightness-100 group-hover:brightness-110 transition-all duration-500"
        />

        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]" />

        {/* Hover action overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-6 py-2 bg-[#52B946] text-black font-black text-xs tracking-[0.2em] hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
          >
            {uploading ? "UPLOADING..." : label}
          </button>

          {currentUrl && onDelete && !uploading && (
            <button
              type="button"
              onClick={onDelete}
              className="text-[10px] font-bold text-red-500 hover:text-red-400 tracking-widest uppercase"
            >
              Remove
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
                <div className="w-8 h-8 border-2 border-[#52B946] border-t-transparent animate-spin rounded-full" />
                <span className="text-[10px] font-black tracking-[0.3em] text-[#52B946]">
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
        <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#52B946] opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#52B946] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </>
  );
}
