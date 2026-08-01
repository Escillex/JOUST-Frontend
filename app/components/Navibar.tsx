"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { resolveImageUrl } from "../utils/api";
import { useUser } from "./UserProvider";
import NotificationBell from "./NotificationBell";

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

  const navLinks = [];
  if (user) {
    navLinks.push({ name: "Home", href: "/home" });
  }
  navLinks.push(
    { name: "Tournaments", href: "/tournaments" },
    { name: "Leaderboards", href: "/leaderboards" }
  );

  const isAdmin = user?.roles?.includes('ADMIN');
  if (isAdmin) {
    navLinks.push({ name: "Admin", href: "/admin" });
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-component-border h-20">
      <div className="max-w-7xl mx-auto h-full px-8 flex items-center justify-between relative z-10">
        {/* Branding */}
        <div className="flex items-center gap-12">
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
 
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const linkDelays: Record<string, number> = {
                Home: 0,
                Tournaments: 0.1,
                Leaderboards: 0.2,
                Admin: 0.3,
              };
              return (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: linkDelays[link.name] ?? 0.1, type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Link
                    href={link.href}
                    className={`text-[11px] font-black uppercase tracking-[0.4em] transition-all duration-300 relative py-2 font-poppins hover:scale-105 active:scale-95 block ${
                      isActive ? "text-primary" : "text-white/40 hover:text-white"
                    }`}
                  >
                    {link.name}
                    {isActive && (
                      <motion.div 
                        layoutId="activeNavIndicator"
                        className="absolute -bottom-1 left-0 w-full h-[3px] bg-primary shadow-[0_0_20px_rgba(var(--color-primary),1)]"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
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
                    className={`w-10 h-10 flex items-center justify-center font-black text-xs transition-all border-2 font-poppins overflow-hidden relative ${
                      isProfileMenuOpen 
                      ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.5)]" 
                      : "bg-component-background text-white border-component-border hover:border-primary"
                    }`}
                  >
                    {user?.avatarUrl ? (
                      <Image 
                        src={resolveImageUrl(user.avatarUrl)}
                        alt={user.username || "User"} 
                        fill 
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      user?.username?.[0]?.toUpperCase() || "U"
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
                          alt={user.username || "User"} 
                          fill 
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-background text-primary flex items-center justify-center font-black">
                          {user.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-1 font-poppins">USER</p>
                      <p className="text-lg font-black truncate font-poppins text-white">{user.username?.toUpperCase()}</p>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-white/10">
                    <Link
                      href={`/profile/${user.id || user.sub}`}
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
