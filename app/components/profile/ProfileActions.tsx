import Link from "next/link";
import { Icons } from "./ProfileSection";

/** "Edit profile" for the owner, "Give award" for an admin — labelled
 *  buttons, not the old icon-only pencil floating in a corner. */
export default function ProfileActions({ isOwnProfile, onAward }: { isOwnProfile: boolean; onAward?: () => void }) {
  if (!isOwnProfile && !onAward) return null;
  const base =
    "h-11 px-4 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] font-poppins transition-colors";
  return (
    <div className={`grid gap-3 ${isOwnProfile && onAward ? "grid-cols-2" : "grid-cols-1"}`}>
      {isOwnProfile && (
        <Link href="/profile/edit" className={`${base} border-2 border-primary text-primary hover:bg-primary hover:text-black`}>
          {Icons.edit}
          Edit profile
        </Link>
      )}
      {onAward && (
        <button
          type="button"
          onClick={onAward}
          className={`${base} border border-component-border text-white/85 hover:border-primary/60 hover:text-white`}
        >
          Give award
        </button>
      )}
    </div>
  );
}
