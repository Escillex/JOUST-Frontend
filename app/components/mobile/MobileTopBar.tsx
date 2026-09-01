"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "../NotificationBell";

/**
 * MobileTopBar - Simplified header for mobile "Web App" feel.
 */
export default function MobileTopBar() {
  const pathname = usePathname();
  
  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl border-b border-foreground/5 h-16 flex items-center px-6">
      <div className="flex items-center justify-between w-full">
        <Link href="/" className="flex items-center">
          <Image
            src="/hpluslogo.png"
            alt="Hobby+"
            width={100}
            height={32}
            className="object-contain"
            priority
          />
        </Link>

        {/* Notification inbox — the mobile counterpart to the desktop Navibar
            bell. NotificationBell self-hides for guests/signed-out users. */}
        <NotificationBell />
      </div>
    </header>
  );
}
