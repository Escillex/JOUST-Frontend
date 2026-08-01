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

// How often to re-fetch while the socket is down. The socket is the fast path;
// this is the floor that keeps the bell honest on a flaky connection.
const FALLBACK_POLL_MS = 60000;

// Cap on how many notifications are held in memory. The dropdown only ever shows
// the recent ones, and an unbounded list would grow for the whole session.
const MAX_ITEMS = 50;

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
    setItems(data?.items ?? []);
    setUnreadCount(data?.unreadCount ?? 0);
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

    // The server places this socket in its private user room during the
    // handshake, using the same cookie, so there is nothing to subscribe to here.
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("notification:new", (payload: AppNotification) => {
      setItems((prev) => [{ ...payload, read: false }, ...prev].slice(0, MAX_ITEMS));
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [hasInbox]);

  // Fallback poll: only runs while the socket is down, so a healthy connection
  // costs nothing. This is what keeps the bell correct on venue Wi-Fi.
  useEffect(() => {
    if (!hasInbox || connected) return;
    const timer = setInterval(() => void refreshRef.current(), FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [hasInbox, connected]);

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
