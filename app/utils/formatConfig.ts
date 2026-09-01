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

/** Whether the bracket is seeded by hand rather than drawn at random.
 *
 *  Mirrors the backend's resolution in `format-config.helper.ts`: `seedingMode`
 *  is read from the config ROOT first (how the field is drawn belongs to the
 *  event, not to a HYBRID event's Swiss phase), falling back to the phase1
 *  alias. Anything other than the literal "MANUAL" means a random draw at start,
 *  so the on-screen seed order — and any concrete bracket preview built from it —
 *  is not the matchup that will actually be played. Shared so RosterPanel and
 *  BracketPreview cannot disagree about it. */
export function isManualSeeding(t: TournamentLike): boolean {
  const raw = getRawTournamentConfig(t);
  const mode = raw.seedingMode ?? (raw.phase1 as Record<string, any>)?.seedingMode;
  return mode === "MANUAL";
}

/** Whether a drawn result is survivable under this tournament system.
 *
 *  This is a correctness gate, not a preference. A draw is stored as COMPLETED
 *  with `winnerId: null`, and the engine's advancement step is guarded by
 *  `if (match.nextMatchId && match.winnerId)`. The consequences per system
 *  (`formats.service.ts` handleMatchCompletion):
 *
 *  - SWISS / ROUND_ROBIN — safe. Both rank on points and award
 *    `swissPointsForDraw`; nothing needs to advance.
 *  - SINGLE_ELIMINATION — STALLS. Nobody advances, the next slot stays empty
 *    forever, and the match is already COMPLETED so it cannot be resubmitted.
 *  - DOUBLE_ELIMINATION — CORRUPTS. The loser is derived as
 *    `player1Id === winnerId ? player2Id : player1Id`; with a null winner that
 *    comparison is false, so player 1 is silently dropped into the losers
 *    bracket while nobody advances to winners.
 *  - HYBRID — depends on the match: phase 1 IS Swiss and safe, phase 2 is the
 *    single-elimination top cut and stalls exactly like SINGLE_ELIMINATION.
 *
 *  Hence the phase argument: for a hybrid event the answer differs per match,
 *  not per tournament. */
export function systemAllowsDraw(
  system: string | null | undefined,
  phase: number = 1,
): boolean {
  if (system === 'SWISS' || system === 'ROUND_ROBIN') return true;
  if (system === 'HYBRID') return phase === 1;
  return false;
}

/** Whether the Draw control should be offered for this specific match.
 *
 *  Combines the organizer's `allowDraw` setting with the two limits the backend
 *  independently enforces on a winnerless submit (`match.service.ts`): it is
 *  rejected for a series (`bestOf > 1`) and for threshold-scored matches. The
 *  system check is the part that was missing — without it the button appeared
 *  on elimination brackets, where submitting it damages the bracket. */
export function canOfferDraw(args: {
  system: string | null | undefined;
  config: FormatConfig | null | undefined;
  phase?: number;
}): boolean {
  const { system, config, phase = 1 } = args;
  if (!config?.allowDraw) return false;
  if (!systemAllowsDraw(system, phase)) return false;
  if ((config.bestOf ?? 1) > 1) return false;
  if ((config.pointsThreshold ?? 0) > 0) return false;
  return true;
}

/** The tracker settings the engine will actually use.
 *
 *  Plan item 9.7. `trackingMode`, `useTracker` and `defaultStartingValue` are
 *  DERIVED outputs of the backend's `resolveConfig` — computed from `startingHp`
 *  and `pointsThreshold`, never stored on the config and never returned. Reading
 *  them off the config object therefore always yielded `undefined`, and the
 *  rules panel fell back to defaults that stated the opposite of the truth: an
 *  HP-tracked match was reported as "POINTS", and a real starting value as
 *  "Auto".
 *
 *  Derived here identically to format-config.helper.ts so the two agree. */
export function getTrackerSettings(config: FormatConfig | null | undefined): {
  useTracker: boolean;
  trackingMode: 'HP' | 'POINTS';
  defaultStartingValue: number | null;
} {
  const startingHp = config?.startingHp ?? 0;
  const pointsThreshold = config?.pointsThreshold ?? 0;
  const hasHp = startingHp > 0;
  const hasPoints = pointsThreshold > 0;
  return {
    useTracker: hasHp || hasPoints,
    trackingMode: hasHp ? 'HP' : 'POINTS',
    defaultStartingValue: hasHp ? startingHp : hasPoints ? pointsThreshold : null,
  };
}

/** The tiebreakers, in order, that decide two players level on points.
 *
 *  Mirrors the backend in two steps, because the default lives in two places:
 *  `resolveConfig` returns `tieBreakerOrder ?? []` (format-config.helper.ts),
 *  and the sorter substitutes `['omw','oomw','matchWinPct']` when that array is
 *  empty (leaderboard.service.ts `sortEntries` / `tiebreakCriterion`). An empty
 *  configured array therefore means "use the default", not "no tiebreakers".
 *
 *  Read this rather than hardcoding OMW anywhere: the order is configurable,
 *  and three places in the UI previously asserted OMW regardless of it. */
export const DEFAULT_TIE_BREAKER_ORDER = ['omw', 'oomw', 'matchWinPct'];

export function getTieBreakerOrder(t: TournamentLike): string[] {
  const configured = getTournamentConfig(t)?.tieBreakerOrder;
  return configured && configured.length > 0
    ? configured
    : DEFAULT_TIE_BREAKER_ORDER;
}

/** Human label for a tiebreaker key, for column headers and messages. */
export function tieBreakerLabel(key: string): string {
  const labels: Record<string, string> = {
    omw: 'OMW%',
    oomw: 'OOMW%',
    matchWinPct: 'Match Win%',
    wins: 'Wins',
    losses: 'Losses',
    points: 'Points',
  };
  return labels[key] ?? key;
}

/** The tournament's system, however the payload happens to carry `format`. */
export function getTournamentSystem(
  t: TournamentLike & { format?: unknown },
): string | undefined {
  const f = (t as { format?: unknown })?.format;
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') {
    return (f as { system?: string }).system;
  }
  return undefined;
}

/** Whether standings ARE the result for this system.
 *
 *  Plan 8.5. Since 8.1 an elimination bracket awards no match points, so a
 *  points table there is a column of zeroes that explains nothing — the bracket
 *  is the standing. Swiss and round robin are the opposite: standings decide
 *  the tournament. A hybrid is ranked by its Swiss phase, so it counts. */
export function usesPointsStandings(
  system: string | null | undefined,
): boolean {
  return system === 'SWISS' || system === 'ROUND_ROBIN' || system === 'HYBRID';
}

/** Where a given rule key actually lives in a HYBRID tournament's config.
 *
 *  Plan 9.6. `resolveConfig` on the backend starts with
 *  `const c = config?.phase1 ?? config` — so the moment a HYBRID config has a
 *  `phase1` object, every top-level scoring key is invisible to the engine. The
 *  rules editor read and wrote those keys FLAT, which meant that on a hybrid
 *  tournament it displayed the defaults rather than the real phase-1 values, and
 *  saving wrote a key the engine would never read. The organizer was told
 *  "saved" and nothing changed — the same silent no-op as the `configFields`
 *  bug this whole plan was written around.
 *
 *  Two keys are exceptions, and both are deliberate:
 *  - `seedingMode` is resolved from the config ROOT first, because how the field
 *    is drawn belongs to the event and not to its Swiss phase.
 *  - `topCutSize` belongs to phase 2, the elimination cut. */
export type ConfigLocation = 'root' | 'phase1' | 'phase2';

/** A raw config blob as stored. Values are `unknown` rather than `any` so that
 *  reading one forces a deliberate narrowing at the point of use. */
export type RawConfig = Record<string, unknown> & {
  phase1?: Record<string, unknown>;
  phase2?: Record<string, unknown>;
};

export function configValueLocation(key: string): ConfigLocation {
  if (key === 'seedingMode') return 'root';
  if (key === 'topCutSize') return 'phase2';
  return 'phase1';
}

/** Is this config shaped as a hybrid (i.e. does the phase1 alias apply)? */
function isPhased(raw: RawConfig | null | undefined): boolean {
  return !!raw && typeof raw.phase1 === 'object' && raw.phase1 !== null;
}

/** A flat view of the rules the engine will ACTUALLY apply.
 *
 *  For a non-phased config this is the config itself. For a hybrid it merges
 *  each key in from wherever the engine reads it, so the editor shows the truth
 *  instead of the ignored top level. */
export function ruleView(
  raw: RawConfig | null | undefined,
): FormatConfig {
  if (!raw) return {};
  if (!isPhased(raw)) return raw as FormatConfig;
  return {
    ...(raw.phase1 ?? {}),
    ...(raw.phase2?.topCutSize !== undefined
      ? { topCutSize: raw.phase2.topCutSize }
      : {}),
    ...(raw.seedingMode !== undefined ? { seedingMode: raw.seedingMode } : {}),
  } as FormatConfig;
}

/** Writes a rule into the place the engine reads it from, returning a new
 *  config. Non-phased configs are written flat, exactly as before. */
export function writeRuleValue(
  raw: RawConfig | null | undefined,
  key: string,
  value: unknown,
): RawConfig {
  const base: RawConfig = raw ?? {};
  if (!isPhased(base)) return { ...base, [key]: value };

  switch (configValueLocation(key)) {
    case 'root':
      return { ...base, [key]: value };
    case 'phase2':
      return { ...base, phase2: { ...(base.phase2 ?? {}), [key]: value } };
    default:
      return { ...base, phase1: { ...(base.phase1 ?? {}), [key]: value } };
  }
}
