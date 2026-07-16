export type TournamentFormat = "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "SWISS" | "ROUND_ROBIN" | "HYBRID";
export type GameTrackingMode = 'HP' | 'POINTS';

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

export interface TournamentFormatModel {
  id: string;
  name: string;
  description?: string | null;
  gameName?: string | null;
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
  isPrivate: boolean;
  status: TournamentStatus;
  guestCleanupAt: string | null;
  createdAt: string;
  createdById: string;
  createdBy?: {
    username: string;
  };
  formatId: string;
  format: string | TournamentFormatModel;
  /** Per-tournament rules override; when set, fully replaces the format preset's config */
  config?: FormatConfig | null;
  participants: {
    id: string;
    userId: string;
    seed?: number;
    user: {
      id: string;
      username: string;
      email: string;
      guestName?: string;
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
        guestName?: string;
        isGuest?: boolean;
      } | null;
      player2?: {
        id: string;
        username?: string;
        guestName?: string;
        isGuest?: boolean;
      } | null;
      winnerId?: string | null;
      winner?: {
        id: string;
        username?: string;
        guestName?: string;
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
  configFields: Array<{
    key: string;
    label: string;
    placeholder: string;
    defaultValue?: number | null;
    min?: number;
    max?: number;
  }>;
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