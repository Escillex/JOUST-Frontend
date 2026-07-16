"use client";
import { useState, useEffect } from "react";

/**
 * DelayedLoading - Only shows the loading spinner after a 5-second delay.
 * Before that, it shows a clean "blank page with background" as requested.
 */
export default function DelayedLoading() {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSpinner(true);
    }, 5000); // 5-second delay as requested
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-grow w-full h-full flex flex-col items-center justify-center bg-background min-h-[60vh]">
      {showSpinner ? (
        <div className="relative flex items-center justify-center animate-in fade-in duration-1000">
          {/* Professional Loading Circle */}
          <div className="w-16 h-16 border-2 border-foreground/5 rounded-full" />
          <div className="absolute w-16 h-16 border-t-2 border-primary rounded-full animate-spin" />
          
          <div className="absolute -bottom-12 whitespace-nowrap">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground/40 animate-pulse">
              Loading...
            </p>
          </div>
        </div>
      ) : (
        /* Blank page with background (already handled by RootLayout bg-background) */
        <div className="opacity-0">Connecting...</div>
      )}
    </div>
  );
}
