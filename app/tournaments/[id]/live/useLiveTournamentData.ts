"use client";

import { useCallback, useState } from "react";
import { Tournament, MatchGameLog } from "../../types";
import { Round } from "../bracket/types";
import { authenticatedFetch, API_ENDPOINTS } from "../../../utils/api";
import { usePolling } from "../../../utils/usePolling";
import {
  useTournamentSocket,
  TrackerUpdatePayload,
} from "../../../utils/useTournamentSocket";

const POLL_INTERVAL = 4000;

/**
 * Everything the live view needs to stay current: the tournament, its rounds,
 * and the tracker logs for whichever matches are in progress.
 *
 * Plan item 6.6. The live page carried fetching, socket wiring, polling
 * fallback and ~300 lines of JSX in one file. Pulling the data layer out means
 * the page renders and this decides *when* the data changes — the two can now
 * be read, and changed, independently.
 *
 * The realtime design is preserved exactly, because it is load-bearing for
 * Core Rule 8: the socket is primary, and polling stays as a safety net that
 * backs off to 60s while connected and returns to 4s the moment it drops, so a
 * dead socket degrades to the old behaviour rather than a stale screen.
 */
export function useLiveTournamentData(tournamentId: string) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [logs, setLogs] = useState<Record<string, MatchGameLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const tRes = await authenticatedFetch(
        API_ENDPOINTS.TOURNAMENTS.GET_ONE(tournamentId),
      );
      if (!tRes.ok) return;
      const t: Tournament = await tRes.json();
      setTournament(t);

      const rRes = await authenticatedFetch(
        API_ENDPOINTS.TOURNAMENTS.ROUNDS(tournamentId),
      );
      const roundData: Round[] = rRes.ok ? await rRes.json() : [];
      setRounds(roundData);

      // Tracker logs are only fetched for matches actually in progress; a
      // finished or unstarted match has nothing live to show.
      const ongoingMatches = roundData
        .flatMap((r) => r.matches)
        .filter((m) => m.status === "ONGOING" && !m.isBye);

      const logEntries = await Promise.all(
        ongoingMatches.map(async (m) => {
          try {
            const lRes = await authenticatedFetch(
              API_ENDPOINTS.MATCHES.TRACKER_GET(m.id),
            );
            const logData: MatchGameLog[] = lRes.ok ? await lRes.json() : [];
            return [m.id, Array.isArray(logData) ? logData : []] as const;
          } catch {
            return [m.id, []] as const;
          }
        }),
      );

      setLogs(Object.fromEntries(logEntries));
      setLastUpdated(new Date());
    } catch {
      // Silent: the next tick retries. Surfacing an error here would flash a
      // failure on a screen that is usually left running unattended.
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Live tracker values arrive over the socket. Patch just the affected game
  // log in place so the HP/points bars move without refetching every match.
  const applyTrackerUpdate = useCallback((p: TrackerUpdatePayload) => {
    setLogs((prev) => {
      const existing = prev[p.matchId];
      // Not on screen: ignore it. The coarse tournament:updated signal and the
      // fallback poll will pick it up.
      if (!existing) return prev;
      return {
        ...prev,
        [p.matchId]: existing.map((l) =>
          l.gameNumber === p.gameNumber
            ? { ...l, player1Value: p.player1Value, player2Value: p.player2Value }
            : l,
        ),
      };
    });
    setLastUpdated(new Date());
  }, []);

  const { connected } = useTournamentSocket(tournamentId, {
    onTournamentUpdate: fetchAll,
    onTrackerUpdate: applyTrackerUpdate,
  });

  // temporary polling block
  // Fallback behind the WebSocket connection: a slow 60s safety-net tick while
  // connected, returning to the fast rate the moment the socket drops. The hook
  // also pauses while the tab is hidden and stops once the tournament is
  // COMPLETED.
  usePolling(
    fetchAll,
    connected ? 60000 : POLL_INTERVAL,
    tournament?.status !== "COMPLETED",
  );
  // end of temporary polling block

  // No initial fetch here on purpose: usePolling already "runs one fetch right
  // away on mount" (see utils/usePolling.ts). Adding one would double every
  // page load.

  return { tournament, rounds, logs, loading, lastUpdated, connected, refetch: fetchAll };
}
