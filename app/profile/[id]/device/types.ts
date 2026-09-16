import type {
  GalleryImage,
  ProfileMatch,
  ProfileStats,
  ProfileTournamentResult,
  UserAward,
  UserProfile,
} from "../../../tournaments/types";

/** Everything the page has loaded; both device views render from the same set. */
export interface ProfileViewProps {
  user: UserProfile;
  stats: ProfileStats;
  /** Null while the match history is still loading. */
  matches: ProfileMatch[] | null;
  tournaments: ProfileTournamentResult[];
  awards: UserAward[];
  gallery: GalleryImage[];
  /** Undefined when signed out: reporting needs an account. */
  viewerRoles?: string[];
  isOwnProfile: boolean;
  /** Present only for an admin viewing a profile that can hold awards. */
  onAward?: () => void;
  /** Re-reads the profile after a moderator removes a gallery image. */
  onGalleryRemoved: () => void;
}
