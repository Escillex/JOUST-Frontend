"use client";

import React, { useRef, useState, useEffect } from "react";
import { API_URL, authenticatedFetch } from "../../utils/api";
import CropModal from "./CropModal";

interface EditableAssetProps {
  assetKey: string;
  defaultSrc?: string;
  isEditing?: boolean;
  aspectRatio?: string;
  cropAspectRatio?: number;
  className?: string;
  alt?: string;
}

export default function EditableAsset({
  assetKey,
  defaultSrc,
  isEditing = false,
  aspectRatio = "aspect-video",
  cropAspectRatio = 16 / 9,
  className = "",
  alt = "Asset",
}: EditableAssetProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(defaultSrc || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Fetch the asset on mount
  useEffect(() => {
    fetch(`${API_URL}/images/assets/${assetKey}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.url) {
          setCurrentUrl(data.url);
        }
      })
      .catch(() => { /* ignore, fallback to defaultSrc */ });
  }, [assetKey]);

  const displayUrl = currentUrl
    ? (currentUrl.startsWith("http") || currentUrl.startsWith("blob:"))
      ? currentUrl
      : `${API_URL}${currentUrl}`
    : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Only image formats are allowed for site assets. Videos are not supported by the backend processor.");
      e.target.value = "";
      return;
    }

    e.target.value = "";
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    const file = new File([blob], `${assetKey}_${Date.now()}.webp`, { type: "image/webp" });
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authenticatedFetch(`${API_URL}/images/assets/${assetKey}`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUrl(data.url);
      }
    } catch (err) {
      console.error("Asset upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete asset ${assetKey}?`)) return;
    setUploading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/images/assets/${assetKey}`, { method: "DELETE" });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Asset deletion failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  return (
    <>
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          aspectRatio={cropAspectRatio}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      
      <div className={`relative group overflow-hidden ${isEditing ? 'ring-2 ring-primary ring-dashed ring-offset-2 ring-offset-black' : ''} ${className}`}>
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={alt}
            className={`w-full h-full object-cover transition-transform duration-700 ${isEditing ? '' : 'group-hover:scale-105'}`}
          />
        ) : (
          <div className="w-full h-full bg-bg-component flex items-center justify-center">
            <span className="text-[10px] font-black text-white/20 tracking-widest">NO ASSET</span>
          </div>
        )}

        {isEditing && (
          <>
            {/* Permanent Edit Button in Edit Mode */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
                disabled={uploading}
                className="px-4 py-2 bg-primary text-black font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:scale-105 active:scale-95 transition-transform border-2 border-black"
              >
                {uploading ? "SYNCING..." : `EDIT ${assetKey}`}
              </button>
              {currentUrl && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={uploading}
                  className="px-4 py-2 bg-red-600/90 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-red-500 hover:scale-105 active:scale-95 transition-all border-2 border-black"
                >
                  DELETE
                </button>
              )}
            </div>
            
            {/* Subtle Overlay on Hover */}
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" />

            <input

              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </>
        )}
      </div>
    </>
  );
}
