"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

export default function InitialAppLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    // Check if already loaded in this session to prevent re-showing
    if (sessionStorage.getItem('joust-app-loaded')) {
      setLoading(false);
      setShowLoader(false);
      return;
    }

    // List of critical assets to preload for the Hero section
    const assets = [
      "/hpluslogo.png",
      "/hero-bg-1.jpg",
      "/hero-bg-2.jpg",
      "/shp.png",
      "/laz.png"
    ];

    let loadedCount = 0;
    let hasFinished = false;

    const finishLoading = () => {
      if (hasFinished) return;
      hasFinished = true;
      sessionStorage.setItem('joust-app-loaded', 'true');
      setLoading(false);
      // Wait for fade out animation before removing from DOM
      setTimeout(() => setShowLoader(false), 800);
    };

    const onLoad = () => {
      loadedCount++;
      if (loadedCount >= assets.length) {
        finishLoading();
      }
    };

    // Preload all assets
    assets.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      img.onload = onLoad;
      img.onerror = onLoad; // Continue even if one fails
    });

    // Fallback maximum loading time of 6 seconds
    const timeout = setTimeout(finishLoading, 6000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      {showLoader && (
        <div 
          className={`fixed inset-0 z-[100] bg-[#121214] flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${
            loading ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="relative flex flex-col items-center">
            <Image 
              src="/hpluslogo.png" 
              alt="Hobby+" 
              width={160} 
              height={160} 
              className="animate-pulse drop-shadow-[0_0_30px_rgba(82,185,70,0.3)] mb-8"
              priority
            />
            {/* Loading Bar */}
            <div className="relative w-48 h-1 bg-white/5 overflow-hidden rounded-full">
              <div className="absolute inset-y-0 left-0 bg-primary/80 w-1/3 animate-[bounce_2s_infinite] shadow-[0_0_10px_rgba(82,185,70,0.8)]" style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite, slide 1.5s ease-in-out infinite alternate" }} />
            </div>
            <style jsx>{`
              @keyframes slide {
                0% { transform: translateX(0%); }
                100% { transform: translateX(200%); }
              }
            `}</style>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-primary/80 animate-pulse font-poppins">
              Loading Hobby+
            </p>
          </div>
        </div>
      )}
      {/* Hide the main content scrollbar if we are currently loading */}
      <div className={loading && showLoader ? "h-screen overflow-hidden" : ""}>
        {children}
      </div>
    </>
  );
}
