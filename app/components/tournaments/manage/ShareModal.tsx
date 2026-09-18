"use client";

import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  onClose: () => void;
  onCopy: () => void;
}

export default function ShareModal({ url, onClose, onCopy }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-[#1B1B1B] border border-white/20 rounded max-w-sm w-full p-6 space-y-6 shadow-[0_0_40px_rgba(0,0,0,1)] text-center flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">Share Tournament</h3>
          <p className="text-xs text-[#888888]">
            Scan to join or copy the link below.
          </p>
        </div>

        <div className="bg-[#000000] p-4 rounded-lg border border-white/10 inline-block">
          <QRCodeSVG
            value={url}
            size={220}
            level="H"
            bgColor="#000000"
            fgColor="#FFFFFF"
            marginSize={2}
            className="[&_image]:scale-75 [&_image]:origin-center"
            imageSettings={{
              src: "/h+small.png",
              height: 64,
              width: 64,
              excavate: true,
            }}
          />
        </div>

        <div className="w-full flex gap-2 pt-2">
          <input
            readOnly
            value={url}
            className="flex-1 h-10 bg-background border border-white/20 px-3 text-xs text-[#B0B0B0] focus:outline-none rounded"
            onClick={(e) => e.currentTarget.select()}
          />
          <button
            onClick={onCopy}
            className="h-10 px-4 bg-primary text-black font-semibold text-xs rounded hover:brightness-90 transition-colors"
          >
            Copy
          </button>
        </div>
        
        <button
          onClick={onClose}
          className="w-full h-10 text-xs font-semibold border border-white/20 text-[#B0B0B0] hover:text-white transition-colors rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}
