import { FormatConfig } from "../tournaments/types";

type TournamentLike = {
  config?: FormatConfig | Record<string, any> | null;
  format?: string | { config?: Record<string, any> | null } | null;
} | null | undefined;

/** Raw rules for a tournament: the per-tournament override (tournament.config)
 *  fully replaces the format preset's config when set. */
export function getRawTournamentConfig(t: TournamentLike): Record<string, any> {
  const fromFormat =
    t && typeof t.format === "object" && t.format
      ? (t.format.config as Record<string, any> | null | undefined)
      : undefined;
  return (t?.config as Record<string, any>) ?? fromFormat ?? {};
}

/** Scoring view of the config — for HYBRID the scoring rules live under phase1
 *  (mirrors the backend's resolveConfig aliasing). */
export function getTournamentConfig(t: TournamentLike): FormatConfig {
  const raw = getRawTournamentConfig(t);
  return ((raw.phase1 as Record<string, any>) ?? raw) as FormatConfig;
}
