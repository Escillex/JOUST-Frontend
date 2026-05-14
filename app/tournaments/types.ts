export type TournamentFormat = "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "SWISS" | "ROUND_ROBIN" | "HYBRID";
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
    matches: {
      winner?: {
        username: string;
        isGuest?: boolean;
      };
    }[];
  }[];
  formatConfig?: FormatConfig;
  // Fields for UI
  bannerUrl?: string | null;
  color?: string;
  description?: string;
}

export interface FormatConfig {
  winsToAdvance?: number;
  swissRounds?: number;
  swissPointsForWin?: number;
  swissPointsForDraw?: number;
  swissPointsForLoss?: number;
  pointsThreshold?: number;
  sessionsCount?: number;
  pointsPerSession?: number;
  bestOf?: number;
  allowDraw?: boolean;
  tieBreakerOrder?: string[];
  progressionType?: string;
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