"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { io, Socket } from "socket.io-client";
import { authenticatedFetch, API_ENDPOINTS, safeJson, SOCKET_URL } from "../utils/api";
import { useUser } from "./UserProvider";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  items: AppNotification[];
  unreadCount: number;
  connected: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Socket origin is resolved centrally in utils/api.ts - see the comment there.

// Poll intervals:
// - Disconnected: frequent polling (15s) so the user doesn't miss invites or match calls.
// - Connected: low-frequency safety-net poll (45s) in case the socket is in an untrusted origin
//   room or a packet was dropped silently.
const DISCONNECTED_POLL_MS = 15000;
const CONNECTED_SAFETY_POLL_MS = 45000;

// Cap on how many notifications are held in memory. The dropdown only ever shows
// the recent ones, and an unbounded list would grow for the whole session.
const MAX_ITEMS = 50;

// Transient notifications (matches and score verifications) expire after a configurable duration.
// Defaults to 60 minutes. Can be adjusted in Dev Tools (stored in localStorage: joust_notif_expiry_mins).
// Invitations, awards, placements, and moderations stay until read.
const DEFAULT_EXPIRATION_MINUTES = 60;
const TRANSIENT_TYPES = new Set([
  "MATCH_READY",
  "SCORE_PENDING",
  "MATCH_RESULT",
  "MATCH_TIMER_ENDED",
]);

export function getNotificationExpiryMinutes(): number {
  if (typeof window === "undefined") return DEFAULT_EXPIRATION_MINUTES;
  try {
    const raw = localStorage.getItem("joust_notif_expiry_mins");
    if (!raw) return DEFAULT_EXPIRATION_MINUTES;
    const val = parseInt(raw, 10);
    return isNaN(val) || val <= 0 ? DEFAULT_EXPIRATION_MINUTES : val;
  } catch {
    return DEFAULT_EXPIRATION_MINUTES;
  }
}

function isExpired(notification: AppNotification, expiryMinutes: number): boolean {
  if (notification.type === "GUEST_CLEANUP_SCHEDULED") return true;
  if (TRANSIENT_TYPES.has(notification.type)) {
    const ageMs = Date.now() - new Date(notification.createdAt).getTime();
    return ageMs > expiryMinutes * 60 * 1000;
  }
  return false;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);

  // Guests have no inbox: they cannot log back in to read one.
  const hasInbox = !!user && !user.isGuest;

  const refresh = useCallback(async () => {
    if (!hasInbox) return;
    const res = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.LIST);
    if (!res.ok) return;
    const data = await safeJson(res);
    const rawItems: AppNotification[] = data?.items ?? [];
    const expiryMins = getNotificationExpiryMinutes();
    // Filter out internal housekeeping noise and expired transient alerts
    const filtered = rawItems.filter((n) => !isExpired(n, expiryMins));
    const unreadFiltered = filtered.filter((n) => !n.read).length;
    setItems(filtered);
    setUnreadCount(unreadFiltered);
  }, [hasInbox]);

  useEffect(() => {
    if (!hasInbox) return;
    // Same pattern as UserProvider: fetching once when the identity settles is
    // intentional, and every state update inside refresh happens after the
    // network call rather than synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [hasInbox, refresh]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!hasInbox) return;

    const socket: Socket = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
    });

    socket.on("connect", () => {
      setConnected(true);
      if (process.env.NODE_ENV === "development") {
        console.log("[Notifications] Socket connected:", socket.id);
      }
      // Resync on every (re)connect to fetch any notifications emitted while down.
      void refreshRef.current();
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      if (process.env.NODE_ENV === "development") {
        console.log("[Notifications] Socket disconnected:", reason);
      }
    });

    socket.on("connect_error", (err) => {
      setConnected(false);
      if (process.env.NODE_ENV === "development") {
        console.warn("[Notifications] Socket connect error:", err.message);
      }
    });

    socket.on("notification:new", (payload: AppNotification) => {
      if (payload.type === "GUEST_CLEANUP_SCHEDULED") return;
      if (process.env.NODE_ENV === "development") {
        console.log("[Notifications] Live notification received:", payload);
      }
      setItems((prev) => [{ ...payload, read: false }, ...prev].slice(0, MAX_ITEMS));
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [hasInbox]);

  // Continuous backup polling:
  // Runs at 15s when disconnected, and 45s when connected (as a guaranteed safety net).
  useEffect(() => {
    if (!hasInbox) return;
    const intervalMs = connected ? CONNECTED_SAFETY_POLL_MS : DISCONNECTED_POLL_MS;
    const timer = setInterval(() => void refreshRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [hasInbox, connected]);

  // Refetch when the tab returns to the foreground. Mobile browsers suspend a
  // backgrounded tab — freezing both the socket and the poll above — so when the
  // user unlocks the phone or re-opens the app the bell can be stale by exactly
  // the notifications that arrived while it slept. Resyncing on the visibility
  // change makes it correct the moment it is looked at, instead of waiting out
  // the poll interval or forcing a reload.
  useEffect(() => {
    if (!hasInbox) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hasInbox]);

  // Both mark-read paths update local state first so the badge responds
  // instantly; the request is fire-and-forget because a failure only means the
  // next refresh restores the true count.
  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.READ(id), { method: "PATCH" });
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.READ_ALL, { method: "PATCH" });
  }, []);

  // Signing out is handled by deriving rather than by clearing state in an
  // effect: the rows stay in memory until they are replaced by the next user's
  // fetch, but nothing without an inbox can ever read them.
  return (
    <NotificationContext.Provider
      value={{
        items: hasInbox ? items : [],
        unreadCount: hasInbox ? unreadCount : 0,
        connected,
        markRead,
        markAllRead,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
