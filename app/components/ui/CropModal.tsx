"use client";

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { motion, AnimatePresence } from "motion/react";

interface CropModalProps {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
  cropShape?: "rect" | "round";
}

export default function CropModal({
  imageSrc,
  onConfirm,
  onCancel,
  aspectRatio = 21 / 9,
  cropShape = "rect",
}: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: any
  ): Promise<Blob | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.9);
    });
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (blob) onConfirm(blob);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-4xl bg-background border-2 border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
          <div>
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Image Editor</h3>
            <p className="text-[8px] text-white/40 uppercase tracking-widest mt-1">Standardize banner dimensions</p>
          </div>
          <button 
            onClick={onCancel}
            className="text-white/20 hover:text-white transition-colors p-2"
          >
            ✕
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative flex-1 bg-black min-h-[400px] md:min-h-[500px]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            cropShape={cropShape}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            classes={{
              containerClassName: "bg-black",
              cropAreaClassName: "border-2 border-primary shadow-[0_0_30px_rgba(82,185,70,0.3)]",
            }}
          />
        </div>

        {/* Controls Panel */}
        <div className="p-8 bg-zinc-900/80 backdrop-blur-md border-t border-white/5 space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/40">
              <span>Magnification Level</span>
              <span className="text-primary italic tracking-widest">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.01}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              onClick={onCancel}
              className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all italic"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="px-10 py-3 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-[2px] hover:brightness-110 shadow-[0_0_20px_rgba(82,185,70,0.2)] transition-all flex items-center gap-3 italic"
            >
              {processing ? (
                <>
                  <div className="w-3 h-3 border-2 border-black/30 border-t-black animate-spin rounded-full" />
                  PROCESSING...
                </>
              ) : "Finalize Crop"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
