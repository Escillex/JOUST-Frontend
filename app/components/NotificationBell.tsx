"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useUser } from "./UserProvider";
import { useNotifications, AppNotification } from "./NotificationProvider";

/** Turns an ISO timestamp into a short relative label. Notifications are read at
 *  a glance, so "4m" carries more than a full date would. */
function relativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function NotificationBell() {
  const router = useRouter();
  const { user } = useUser();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Signed-out visitors and guests have no inbox, so the bell is not rendered
  // rather than rendered empty.
  if (!user || user.isGuest) return null;

  const handleOpenNotification = async (notification: AppNotification) => {
    setIsOpen(false);
    if (!notification.read) await markRead(notification.id);
    if (notification.link) router.push(notification.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className={`w-10 h-10 flex items-center justify-center transition-all border-2 relative ${
          isOpen
            ? "bg-primary text-black border-primary"
            : "bg-component-background text-white border-component-border hover:border-primary"
        }`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary text-black text-[9px] font-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </motion.button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-80 max-h-[26rem] overflow-y-auto bg-component-background border-2 border-component-border shadow-[0_0_40px_rgba(0,0,0,1)] z-50">
          <div className="px-5 py-4 border-b border-component-border bg-zinc-900/30 flex items-center justify-between sticky top-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-[9px] font-black uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
                No notifications yet
              </p>
            </div>
          ) : (
            items.map((notification) => (
              <button
                key={notification.id}
                onClick={() => void handleOpenNotification(notification)}
                className={`w-full text-left px-5 py-4 border-b border-component-border/60 transition-colors hover:bg-white/[0.03] ${
                  notification.read ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-bold text-white leading-snug">
                    {notification.title}
                  </span>
                  <span className="text-[9px] font-black text-white/25 flex-shrink-0 mt-0.5">
                    {relativeTime(notification.createdAt)}
                  </span>
                </div>
                {notification.body && (
                  <p className="mt-1 text-[10px] text-white/40 leading-relaxed">
                    {notification.body}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
