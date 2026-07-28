"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "./api";

// Live values for a single game's tracker, mirroring the backend
// RealtimeGateway payload. Sent often (every HP/points change), so the
// listener updates its bars from this directly instead of refetching.
export interface TrackerUpdatePayload {
  matchId: string;
  player1Value: number;
  player2Value: number;
  gameNumber: number;
}

// Where to open the socket:
// - When NEXT_PUBLIC_API_URL is an absolute URL (the usual host/dev setup),
//   API_URL is that "http://host:4000" origin and the socket connects straight
//   to the backend.
// - Otherwise API_URL is the "/api/backend" proxy path, which is HTTP-only; in
//   that case we connect to the same origin and let the production reverse
//   proxy route "/socket.io/" to the backend.
// Either way, if the socket cannot connect the screens keep working through
// their polling fallback, so this is never a hard dependency.
const SOCKET_URL = API_URL.startsWith("http") ? API_URL : undefined;

interface Handlers {
  // Coarse "something changed" — the caller should refetch its data.
  onTournamentUpdate?: () => void;
  // Live tracker values for a match in this tournament.
  onTrackerUpdate?: (payload: TrackerUpdatePayload) => void;
}

/**
 * Subscribes to real-time updates for one tournament over Socket.IO.
 *
 * The returned `connected` flag lets callers slow their polling down to a rare
 * safety-net tick while the socket is live, and snap back to normal polling the
 * moment it drops — so a lost socket degrades to exactly the old polling
 * behaviour, never a stale screen.
 */
export function useTournamentSocket(
  tournamentId: string | undefined | null,
  handlers: Handlers,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);

  // Keep the latest handlers in a ref so changing them (which happens on most
  // renders, since they are usually inline arrow functions) does not tear down
  // and rebuild the socket connection.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!tournamentId) return;

    const socket: Socket = io(SOCKET_URL, {
      // Send the auth cookie with the handshake (used for optional identity;
      // listening itself does not require a login).
      withCredentials: true,
      // socket.io reconnects automatically with backoff; these defaults are
      // fine, kept explicit so the intent is clear.
      reconnection: true,
    });

    const joinRoom = () => socket.emit("subscribe", tournamentId);

    socket.on("connect", () => {
      setConnected(true);
      // (Re)join the tournament room on first connect and after any reconnect.
      joinRoom();
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("tournament:updated", () => {
      handlersRef.current.onTournamentUpdate?.();
    });
    socket.on("tracker:update", (payload: TrackerUpdatePayload) => {
      handlersRef.current.onTrackerUpdate?.(payload);
    });

    return () => {
      socket.emit("unsubscribe", tournamentId);
      socket.disconnect();
    };
  }, [tournamentId]);

  return { connected };
}
