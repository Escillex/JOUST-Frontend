"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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
  // Below 1 the image no longer fills the frame — which is exactly what you
  // want when the subject is taller than the crop and you would rather letterbox
  // than cut its head off. react-easy-crop needs restrictPosition off to allow it.
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  /**
   * Decode with the EXIF orientation applied.
   *
   * `<img>` rendering honours EXIF, but `ctx.drawImage` works on decoded pixels
   * and browsers have disagreed about whether orientation is applied there — so
   * a phone photo could be framed upright and saved sideways. `createImageBitmap`
   * with `imageOrientation: "from-image"` settles it in one place; the <img>
   * path stays as the fallback for anything that lacks it.
   */
  const decode = async (url: string): Promise<CanvasImageSource> => {
    if (typeof createImageBitmap === "function") {
      try {
        const blob = await fetch(url).then((r) => r.blob());
        return await createImageBitmap(blob, { imageOrientation: "from-image" });
      } catch {
        // fall through to the <img> path
      }
    }
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });
  };

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: any
  ): Promise<Blob | null> => {
    const image = await decode(imageSrc);
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

    // Lossless out of the canvas. The server re-encodes to WebP anyway
    // (ImagesService), so compressing here only stacked a second generation of
    // loss onto every uploaded image.
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
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

  // Rendered into document.body, not where it is written.
  //
  // `position: fixed` is relative to the nearest ancestor with a transform, and
  // these pages wrap their content in framer-motion elements that animate one.
  // So the overlay was being positioned inside that wrapper rather than the
  // viewport: the backdrop dimmed the screen while the dialog itself sat far
  // down the document, with "Save crop" 600px below the fold on a phone and
  // 400px below it on a desktop. Nothing about the sizing was wrong.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-4xl bg-background border-2 border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden flex flex-col max-h-[92dvh] h-full sm:h-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
          <div>
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Image Editor</h3>
            <p className="text-[8px] text-white/40 uppercase tracking-widest mt-1">Drag to move, scroll or use the slider to zoom</p>
          </div>
          <button 
            onClick={onCancel}
            className="text-white/20 hover:text-white transition-colors p-2"
          >
            ✕
          </button>
        </div>

        {/* Cropper Area. Focusable and arrow-key nudgeable: react-easy-crop is
            drag-and-wheel only, which leaves anyone without a pointer unable to
            frame anything. The zoom slider is the other half of that. */}
        <div
          role="application"
          aria-label="Crop area. Use the arrow keys to move the image, shift for larger steps."
          tabIndex={0}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 4;
            const move: Record<string, [number, number]> = {
              ArrowLeft: [step, 0], ArrowRight: [-step, 0],
              ArrowUp: [0, step], ArrowDown: [0, -step],
            };
            const delta = move[e.key];
            if (delta) {
              e.preventDefault();
              setCrop((c) => ({ x: c.x + delta[0], y: c.y + delta[1] }));
            } else if (e.key === "+" || e.key === "=") {
              e.preventDefault(); setZoom((z) => Math.min(6, z + 0.1));
            } else if (e.key === "-" || e.key === "_") {
              e.preventDefault(); setZoom((z) => Math.max(0.6, z - 0.1));
            }
          }}
          className="relative flex-1 min-h-[220px] md:min-h-[360px] bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            cropShape={cropShape}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            showGrid
            minZoom={0.6}
            maxZoom={6}
            restrictPosition={false}
            classes={{
              containerClassName: "bg-black",
              cropAreaClassName: "border-2 border-primary shadow-[0_0_30px_rgba(82,185,70,0.3)]",
            }}
          />
        </div>

        {/* Controls Panel */}
        <div className="p-4 md:p-6 bg-zinc-900/80 backdrop-blur-md border-t border-white/5 space-y-4 md:space-y-6 shrink-0">
          <div className="space-y-2 md:space-y-3">
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/40">
              <span>Zoom</span>
              <span className="text-primary italic tracking-widest">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={0.6}
              max={6}
              step={0.01}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 sm:gap-4">
            <button
              onClick={onCancel}
              className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all italic border border-white/10 sm:border-0 rounded-[2px]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="px-10 py-3 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-[2px] hover:brightness-110 shadow-[0_0_20px_rgba(82,185,70,0.2)] transition-all flex items-center justify-center gap-3 italic"
            >
              {processing ? (
                <>
                  <div className="w-3 h-3 border-2 border-black/30 border-t-black animate-spin rounded-full" />
                  Saving…
                </>
              ) : "Save crop"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    host,
  );
}
