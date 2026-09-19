"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { motion } from "motion/react";
import { displayNameOf, handleOf, profileHref, resolveImageUrl } from "../utils/api";
import { useUser } from "./UserProvider";
import NotificationBell from "./NotificationBell";

// The management screens are set in Inter, not Poppins. The bar joins them.
const inter = Inter({ subsets: ["latin"] });

/**
 * Navibar - The primary navigation component.
 * Implements the "Modern Sleek Hobbyist" aesthetic with professional terminology.
 */
export default function Navibar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useUser();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Handle outside clicks for profile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sign-out logic now lives in one place (UserProvider.logout), so this
  // component only closes its own menu and delegates the rest.
  const handleSignOut = async () => {
    setIsProfileMenuOpen(false);
    await logout();
  };

  const isOrganizer = user?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER");
  const isAdmin = user?.roles?.includes("ADMIN");

  /**
   * The navbar has two modes, and the ROUTE decides which — not a toggle held in
   * state. A refresh, a deep link, or a notification that drops someone straight
   * into a manage page all have to arrive in the right mode, and only the URL
   * knows that. Stacking "Manage" and "Admin" beside the public links made the
   * userspace bar carry management it mostly does not need.
   */
  const inManageMode =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/tournaments/manage") ||
    /^\/tournaments\/[^/]+\/manage/.test(pathname);

  /**
   * Userspace lists the public pages; management lists the management ones.
   * Showing the public links inside management just offers exits, and the way
   * out is already the Back button on the left.
   *
   * Management has exactly two destinations, so an organizer who is not an
   * admin has nowhere to navigate — their bar is Back and nothing else, the
   * same rule the phone menu follows.
   */
  const navLinks: { name: string; href: string }[] = [];
  if (inManageMode) {
    if (isOrganizer) {
      navLinks.push(
        { name: "Manage", href: "/tournaments/manage" },
        { name: "Guests", href: "/tournaments/manage/guests" },
      );
    }
    if (isAdmin) navLinks.push({ name: "Admin", href: "/admin" });
  } else {
    if (user) navLinks.push({ name: "Home", href: "/home" });
    navLinks.push(
      { name: "Tournaments", href: "/tournaments" },
      { name: "Leaderboards", href: "/leaderboards" },
      { name: "Community", href: "/community" },
    );
    // Plain link, styled like every other one: a bordered green button made the
    // way in look like the most important thing on a page it has nothing to do with.
    if (isOrganizer || loading) {
      navLinks.push({ name: "Manage", href: "/tournaments/manage" });
    }
  }

  return (
    <header className={`sticky top-0 z-50 w-full border-b transition-colors ${
      // Two zones, one bar (docs/design-system.md). Management borrows the
      // manage screens' own treatment — Inter, softer borders, a shorter bar —
      // so the chrome stops shouting the moment the work starts.
      inManageMode
        ? `h-14 bg-component-background border-white/10 ${inter.className}`
        : "h-20 bg-background border-component-border"
    }`}>
      <div className={`mx-auto h-full flex items-center justify-between relative z-10 ${
        // In management the bar shares ManagerLayout's container, so "Back"
        // starts on the same line as the table below it.
        inManageMode ? "max-w-[1600px] w-full px-4 md:px-6" : "max-w-7xl px-8"
      }`}>
        {/* Branding — or, in management, the way back out. */}
        <div className={`flex items-center ${inManageMode ? "gap-8" : "gap-12"}`}>
          {inManageMode ? (
            <Link
              href="/home"
              className="flex items-center gap-2 text-[13px] font-semibold text-[#E0E0E0]/60 hover:text-[#E0E0E0] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              Back
            </Link>
          ) : (
            <Link href="/" className="group flex items-center">
              <div className="flex items-center gap-4">
                <Image
                  src="/hpluslogo.png"
                  alt="Hplus Logo"
                  width={120}
                  height={40}
                  className="w-28 h-auto object-contain brightness-125 group-hover:scale-105 transition-transform duration-300"
                  priority
                />
              </div>
            </Link>
          )}


          {/* Desktop Navigation */}
          <nav className={`hidden md:flex items-center ${inManageMode ? "gap-7" : "gap-10"}`}>
            {navLinks.map((link) => {
              const isActive =
                inManageMode
                  ? pathname === link.href
                  : pathname === link.href || (link.name === "Manage" && pathname.startsWith("/admin"));
              const linkDelays: Record<string, number> = {
                Home: 0,
                Tournaments: 0.1,
                Leaderboards: 0.2,
                Admin: 0.3,
              };
              const isManageWithAdmin = link.name === "Manage" && isAdmin && !inManageMode;

              return (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: linkDelays[link.name] ?? 0.1, type: "spring", stiffness: 300, damping: 20 }}
                  className={isManageWithAdmin ? "relative group" : undefined}
                >
                  <Link
                    href={link.href}
                    className={`transition-colors duration-200 relative py-2 block ${
                      inManageMode
                        ? "text-[13px] font-semibold tracking-normal"
                        : "text-[11px] font-black uppercase tracking-[0.4em] font-poppins transition-all duration-300 hover:scale-105 active:scale-95"
                    } ${
                      isActive
                        ? inManageMode ? "text-primary" : "text-primary"
                        : inManageMode ? "text-[#E0E0E0]/50 hover:text-[#E0E0E0]" : "text-white/40 hover:text-white"
                    }`}
                  >
                    {link.name}
                    {isActive && (
                      <motion.div 
                        layoutId="activeNavIndicator"
                        className={`absolute left-0 w-full ${
                          inManageMode
                            ? "-bottom-2 h-[2px] bg-primary/70 rounded-full"
                            : "-bottom-1 h-[3px] bg-primary shadow-[0_0_20px_rgba(var(--color-primary),1)]"
                        }`}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>

                  {/* Hover dropdown for Manage to reveal Admin if user is admin */}
                  {isManageWithAdmin && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50 pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 transition-all duration-200">
                      <div className="min-w-[180px] bg-component-background border-2 border-component-border shadow-[0_10px_30px_rgba(0,0,0,0.8)] py-1 overflow-hidden backdrop-blur-md">
                        <Link
                          href="/admin"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-primary hover:bg-white/5 transition-all font-poppins"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-primary shrink-0">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span>Admin Panel</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}

          </nav>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-6 min-w-[80px] justify-end">
          {loading ? (
            /* Stable greeble-style loading placeholder to prevent layout shifts */
            <div className="w-10 h-10 border-2 border-white/10 bg-background animate-pulse" />
          ) : user ? (
            <>
            <NotificationBell />
            <div className="relative" ref={profileMenuRef}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    aria-label="Account menu"
                    aria-haspopup="menu"
                    aria-expanded={isProfileMenuOpen}
                    className={`w-10 h-10 flex items-center justify-center font-black text-xs transition-all border-2 font-poppins overflow-hidden relative ${
                      isProfileMenuOpen 
                      ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.5)]" 
                      : "bg-component-background text-white border-component-border hover:border-primary"
                    }`}
                  >
                    {user?.avatarUrl ? (
                      <Image 
                        src={resolveImageUrl(user.avatarUrl)}
                        alt={displayNameOf(user)} 
                        fill 
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      displayNameOf(user)[0]?.toUpperCase() || "U"
                    )}
                  </motion.button>
              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-4 w-72 bg-component-background border-2 border-component-border shadow-[0_0_40px_rgba(0,0,0,1)] py-0 overflow-hidden z-50">
                  <div className="px-8 py-6 border-b border-component-border bg-zinc-900/30 flex items-center gap-4">
                    <div className="w-12 h-12 border border-primary/20 relative overflow-hidden flex-shrink-0">
                      {user.avatarUrl ? (
                        <Image 
                          src={resolveImageUrl(user.avatarUrl)}
                          alt={displayNameOf(user)} 
                          fill 
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-background text-primary flex items-center justify-center font-black">
                          {displayNameOf(user)[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-1 font-poppins">USER</p>
                      <p className="text-lg font-black truncate font-poppins text-white">{displayNameOf(user).toUpperCase()}</p>
                      {handleOf(user) && (
                        <p className="text-[10px] font-mono text-white/30 truncate">{handleOf(user)}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="divide-y divide-white/10">
                    <Link
                      href={profileHref(user)}
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-6 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-primary hover:bg-white/5 transition-all font-poppins"
                    >
                      <div className="w-2 h-2 bg-primary/40 group-hover:bg-primary" />
                      PROFILE
                    </Link>

                    {user?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER") && (
                      <Link
                        href="/tournaments/manage"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-6 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-primary hover:bg-white/5 transition-all font-poppins"
                      >
                        <div className="w-2 h-2 bg-primary/40 group-hover:bg-primary" />
                        MANAGE TOURNAMENTS
                      </Link>
                    )}

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-6 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all text-left font-poppins"
                    >
                      <div className="w-2 h-2 bg-red-500/40" />
                      LOGOUT
                    </button>
                  </div>
                </div>
              )}
            </div>
            </>
          ) : (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/auth"
                className="bg-primary text-black border-2 border-primary px-8 py-2.5 text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_0_20px_rgba(var(--color-primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--color-primary),0.5)] block font-poppins"
              >
                SIGN IN
              </Link>
            </motion.div>
          )}

        </div>
      </div>
    </header>
  );
}
