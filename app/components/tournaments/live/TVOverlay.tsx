'use client';
import { useEffect, useRef, useState } from 'react';

interface TVOverlayProps {
  tvMode: boolean;
  onExitTV: () => void;
}

export default function TVOverlay({ tvMode, onExitTV }: TVOverlayProps) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request fullscreen on TV mode mount
  useEffect(() => {
    if (!tvMode) return;
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {}); // Gracefully ignore if denied
    }
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [tvMode]);

  // Auto-hide controls after 3s of inactivity
  useEffect(() => {
    if (!tvMode) return;
    const reset = () => {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    };
    reset();
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keydown', reset);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [tvMode]);

  if (!tvMode) return null;

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-none"
      style={{ transition: 'opacity 0.5s ease' }}
    >
      {/* Exit button */}
      <div
        className={`absolute bottom-6 right-6 pointer-events-auto transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <button
          onClick={onExitTV}
          className="flex items-center gap-2 px-4 py-2 bg-black/80 border border-white/10 hover:border-white/30 text-white/40 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all backdrop-blur-sm"
        >
          <span>⊠</span>
          <span>Exit TV Mode</span>
        </button>
      </div>

      {/* TV Mode indicator (top-left, fades) */}
      <div
        className={`absolute top-4 left-4 pointer-events-none transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.4em] text-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          TV Mode
        </span>
      </div>
    </div>
  );
}
