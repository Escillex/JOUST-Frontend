"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "../UserProvider";

/**
 * MobileBottomNav - Persistent bottom navigation for mobile viewports.
 * Refactored to separate guest and logged-in experience with 3-tab and slide-up menu design.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Sign-out logic now lives in one place (UserProvider.logout), so this
  // component only closes its own menu and delegates the rest.
  const handleSignOut = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  // 1. Guest Viewport: Floating Login Button on the Right for specific pages
  if (!user) {
    const isAllowedPath = pathname === "/" || pathname.startsWith("/tournaments");
    if (!isAllowedPath) return null;

    return (
      <div className="fixed bottom-8 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Link
          href="/auth"
          className="bg-primary text-black border border-primary px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(82,185,70,0.3)] hover:shadow-[0_0_30px_rgba(82,185,70,0.5)] flex items-center gap-2 font-poppins rounded-xl"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          SIGN IN / SIGN UP
        </Link>
      </div>
    );
  }

  // 2. User Viewport: Responsive 3-Tab Controller (Tournaments, Home, Menu)
  const isTournamentsActive = pathname.startsWith("/tournaments") && pathname !== "/tournaments/manage";
  const isHomeActive = pathname === "/home";
  
  const isMenuTabActive = 
    pathname.startsWith("/profile") || 
    pathname === "/leaderboards" || 
    pathname === "/tournaments/manage" || 
    pathname === "/admin";
  const isMoreActive = isMenuTabActive || isMenuOpen;

  return (
    <>
      <nav className="fixed bottom-0 left-0 z-50 w-full bg-background/85 backdrop-blur-2xl border-t border-foreground/5 px-4 pb-safe-area-inset-bottom h-20 shadow-[0_-5px_30px_rgba(0,0,0,0.4)]">
        <div className="max-w-md mx-auto flex items-center justify-around h-full">
          {/* Left Tab: Tournaments */}
          <Link
            href="/tournaments"
            onClick={() => setIsMenuOpen(false)}
            className="relative flex flex-col items-center justify-center w-20 h-full group pt-2"
          >
            <div className={`transition-all duration-300 ${isTournamentsActive ? "text-primary -translate-y-1" : "text-foreground/40 hover:text-foreground/60"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest mt-1 font-poppins transition-all duration-300 ${isTournamentsActive ? "opacity-100 scale-100 text-primary" : "opacity-40"}`}>
              Tournaments
            </span>
          </Link>

          {/* Middle Tab: Home (Centered Anchor) */}
          <Link
            href="/home"
            onClick={() => setIsMenuOpen(false)}
            className="relative flex flex-col items-center justify-center -mt-10"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
              isHomeActive
                ? "bg-primary text-black scale-110 shadow-primary/40 ring-4 ring-background"
                : "bg-foreground text-background scale-100 shadow-black/20"
            }`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
                <path d="M3 9.5L12 3L21 9.5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V9.5Z" />
              </svg>
            </div>
            <span className={`text-[8px] font-black uppercase tracking-[0.2em] mt-2 font-poppins transition-all duration-300 ${isHomeActive ? "text-primary opacity-100" : "text-foreground opacity-40"}`}>
              Home
            </span>
          </Link>

          {/* Right Tab: Menu System Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="relative flex flex-col items-center justify-center w-20 h-full group pt-2 outline-none focus:outline-none"
          >
            <div className={`transition-all duration-300 ${isMoreActive ? "text-primary -translate-y-1" : "text-foreground/40 hover:text-foreground/60"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest mt-1 font-poppins transition-all duration-300 ${isMoreActive ? "opacity-100 scale-100 text-primary" : "opacity-40"}`}>
              Menu
            </span>
          </button>
        </div>
      </nav>

      {/* Menu Overlay / Backdrop */}
      <div
        onClick={() => setIsMenuOpen(false)}
        className={`fixed inset-0 bg-black/70 backdrop-blur-md z-[99] transition-opacity duration-300 ease-in-out ${
          isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-Up Bottom Drawer Menu */}
      <div
        className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#161616] border-t border-primary/20 p-8 rounded-t-[2.5rem] z-[100] shadow-[0_-15px_50px_rgba(0,0,0,0.95)] transition-transform duration-300 ease-out transform ${
          isMenuOpen ? "translate-y-0" : "translate-y-full"
        } pb-safe-area-inset-bottom`}
      >
        <div className="flex justify-between items-center pb-4 border-b border-foreground/10 mb-6">
          {/* Reworded from "SYSTEM DIRECTORY" to plain language
              (project language rule). */}
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] font-poppins">Menu</span>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/40 hover:text-white transition-all text-xs font-black"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {/* Profile Link */}
          {/* The signed-in user object can carry the ID as "sub" (from
              the login token) or as "id", so check both — project rule. */}
          <Link
            href={`/profile/${user.sub || user.id}`}
            onClick={() => setIsMenuOpen(false)}
            className={`flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest border transition-all rounded-xl font-poppins ${
              pathname.startsWith("/profile")
                ? "bg-primary/10 border-primary text-primary"
                : "bg-foreground/5 border-foreground/5 text-white/60 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 shrink-0">
              <path d="M20 21C20 18.2386 16.4183 16 12 16C7.58172 16 4 18.2386 4 21" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            PROFILE
          </Link>

          {/* Leaderboards Link */}
          <Link
            href="/leaderboards"
            onClick={() => setIsMenuOpen(false)}
            className={`flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest border transition-all rounded-xl font-poppins ${
              pathname === "/leaderboards"
                ? "bg-primary/10 border-primary text-primary"
                : "bg-foreground/5 border-foreground/5 text-white/60 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 shrink-0">
              <path d="M8 21V10" />
              <path d="M12 21V3" />
              <path d="M16 21V14" />
            </svg>
            LEADERBOARDS
          </Link>

          {/* Organizer Control Dashboard */}
          {user?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER") && (
            <Link
              href="/tournaments/manage"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest border transition-all rounded-xl font-poppins ${
                pathname === "/tournaments/manage"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-foreground/5 border-foreground/5 text-white/60 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 shrink-0">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <path d="M9 3v18" />
                <path d="m14 9 3 3-3 3" />
              </svg>
              Organizer Portal
            </Link>
          )}

          {/* System Administrator Panel */}
          {user?.roles?.includes("ADMIN") && (
            <Link
              href="/admin"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest border transition-all rounded-xl font-poppins ${
                pathname === "/admin"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-foreground/5 border-foreground/5 text-white/60 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              SYSTEM ADMIN
            </Link>
          )}

          {/* Sign Out Trigger */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest border border-red-500/10 bg-red-500/5 text-red-500 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all rounded-xl font-poppins text-left"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            LOG OUT
          </button>
        </div>
      </div>
    </>
  );
}
