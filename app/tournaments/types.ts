export type TournamentFormat = "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "SWISS" | "ROUND_ROBIN" | "HYBRID";
export type GameTrackingMode = 'HP' | 'POINTS';

/** Mirrors SeedingMode in server/src/Formats/format-config.helper.ts. */
export type SeedingMode = 'RANDOM' | 'MANUAL';

/** One editable rule on a tournament's config.
 *  Mirrors ConfigField in server/src/Formats/config-fields.helper.ts. */
export interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  defaultValue?: number | string | boolean | null;
  min?: number;
  max?: number;
  type: 'number' | 'boolean' | 'select' | 'array' | 'string';
  /** Permitted values when type is 'select'. */
  options?: string[];
  /** What this rule does, shown as help text next to the input. */
  help?: string;
}

export interface MatchGameLog {
  id: string;
  matchId: string;
  gameNumber: number;
  mode: GameTrackingMode;
  startingValue: number;
  player1Value: number;
  player2Value: number;
  trackerActive: boolean;
  winnerId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export type TournamentStatus = "UPCOMING" | "PENDING" | "OPEN" | "ONGOING" | "COMPLETED";

/** A game in the admin-managed catalog — the thing being played, distinct from the
 *  bracket STRUCTURE and from a FORMAT preset. Every tournament has one; the
 *  built-in "General" is the floor (todo.md §5 / server Game model). */
export interface Game {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  trackingMode?: "HP" | "POINTS";
  isBuiltin: boolean;
  /** Present on list/get responses. */
  _count?: { tournaments: number };
}

/** An organizer's queued request for a game not yet in the catalog (todo.md §5). */
export interface GameRequest {
  id: string;
  name: string;
  note?: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  tournamentId?: string | null;
  tournament?: { id: string; name: string; game?: { name: string } | null } | null;
  requestedBy?: { id: string; username: string | null } | null;
  createdAt: string;
}

export interface TournamentFormatModel {
  id: string;
  name: string;
  description?: string | null;
  /** DEPRECATED free-text label; superseded by the `game` relation. */
  gameName?: string | null;
  /** Optional default game this preset pre-fills at tournament creation. */
  gameId?: string | null;
  game?: Pick<Game, "id" | "name" | "iconUrl"> | null;
  system: TournamentFormat;
  config: any;
  isBuiltin: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string | null;
  maxPlayers: number;
  prizePool: number | null;
  entranceFee: number | null;
  venue: string | null;
  date: string | null;
  inviteToken: string;
  /** Short custom invite-link name (e.g. "summer-cup"); null when unset,
   *  in which case the long inviteToken is the only invite link. */
  slug?: string | null;
  isPrivate: boolean;
  /** Computed per request by the backend: true when the viewer may manage this
   *  tournament. Management controls gate on this rather than on the viewer's
   *  role, so what renders matches what the API will actually permit. */
  canManage?: boolean;
  status: TournamentStatus;
  guestCleanupAt: string | null;
  createdAt: string;
  createdById: string;
  createdBy?: {
    username: string;
  };
  formatId: string;
  format: string | TournamentFormatModel;
  /** The game being played. Every tournament has one (the "General" floor); it is
   *  chosen at creation independent of the format (todo.md §5). */
  gameId?: string | null;
  game?: Pick<Game, "id" | "name" | "iconUrl"> | null;
  /** Per-tournament rules override; when set, fully replaces the format preset's config */
  config?: FormatConfig | null;
  participants: {
    id: string;
    userId: string;
    seed?: number;
    /** ACTIVE by default; FORFEITED when the organizer removed the player from a
     *  live tournament. Forfeited players are shown tagged and non-actionable. */
    status?: "ACTIVE" | "FORFEITED";
    user: {
      id: string;
      username: string;
      email: string;
      isGuest?: boolean;
    };
  }[];
  rounds?: {
    roundNumber: number;
    matches: {
      id: string;
      player1Id?: string | null;
      player2Id?: string | null;
      player1?: {
        id: string;
        username?: string;
          isGuest?: boolean;
      } | null;
      player2?: {
        id: string;
        username?: string;
          isGuest?: boolean;
      } | null;
      winnerId?: string | null;
      winner?: {
        id: string;
        username?: string;
          isGuest?: boolean;
      } | null;
      status: string;
      isBye: boolean;
      nextMatchId?: string | null;
      loserNextMatchId?: string | null;
    }[];
  }[];
  formatConfig?: FormatConfig;
  // Fields for UI
  bannerUrl?: string | null;
  color?: string;
}

export interface FormatConfig {
  winsToAdvance?: number;
  swissRounds?: number;
  swissPointsForWin?: number;
  swissPointsForDraw?: number;
  swissPointsForLoss?: number;
  pointsThreshold?: number;
  bestOf?: number;
  allowDraw?: boolean;
  /** How the field is placed into the bracket at start. RANDOM (the default)
   *  draws the field at random; MANUAL honours the roster's seed order.
   *  Lives at the config root, so on HYBRID it sits beside phase1/phase2 rather
   *  than inside them. Resolved backend-side in format-config.helper.ts. */
  seedingMode?: SeedingMode;
  tieBreakerOrder?: string[];
  progressionType?: string;
  // In-game tracker config
  useTracker?: boolean;
  trackingMode?: GameTrackingMode;
  defaultStartingValue?: number | null;
  startingHp?: number;
  // Placement-based global points awarded at tournament completion
  placementPointsChampion?: number;
  placementPoints2nd?: number;
  placementPoints3rd?: number;
  placementPointsTopCut?: number;       // only relevant for HYBRID
  placementPointsParticipation?: number;
}

export interface FormatDefinition {
  id: string;
  label: string;
  description: string;
  /** Editable rules for this format's system, served by GET /tournament-formats.
   *  Mirrors ConfigField in server/src/Formats/config-fields.helper.ts — the two
   *  must agree (CLAUDE.md Core Rule 9). This was typed here for a long time
   *  while nothing on the backend produced it, which silently disabled the whole
   *  rules editor; that is now closed (plan 4.3 / 7.9). */
  configFields: ConfigField[];
}

export interface TournamentTemplate {
  id: string;
  name: string;
  description?: string | null;
  format: string;
  config: FormatConfig;
  isGlobal: boolean;
  gameName?: string | null;
  createdById: string;
  createdBy?: { id: string; username: string | null };
  createdAt: string;
}
/** A staff row on one tournament. Only ACCEPTED grants management rights;
 *  PENDING and DECLINED grant nothing. */
export interface TournamentStaff {
  id: string;
  userId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  user: { id: string; username: string; avatarUrl?: string | null };
}

/** An entry in the GLOBAL (cross-tournament) leaderboard.
 *
 *  Deliberately distinct from `LeaderboardEntry` in
 *  `app/tournaments/[id]/bracket/types.ts`, which is the PER-TOURNAMENT
 *  standings row. They were previously two same-named interfaces with different
 *  shapes: this one carries `tournamentsPlayed`/`avatarUrl`, that one carries
 *  `isGuest`. Collapsing them into one name would let a row from one endpoint be
 *  passed where the other is expected, so they keep separate names.
 *
 *  Carries NO omw/oomw: those need an opponent graph, which only exists inside
 *  a single tournament. The API used to send them filled with the player's own
 *  winRate — two fields under opponent-strength names holding a number that was
 *  not opponent strength. Removed on both sides in plan 7.2. */
export interface GlobalLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
  avatarUrl?: string | null;
}

/** Lifetime totals for one user, as shown on a profile. */
export interface LeaderboardStats {
  points: number;
  tournamentsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
}

/** The subset of a user record the profile screens render. `email` is only
 *  present when the viewer is entitled to see it. */
export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  roles?: string[];
  isGuest?: boolean;
  avatarUrl?: string | null;
  createdAt?: string;
}
