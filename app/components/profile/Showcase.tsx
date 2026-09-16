import Link from "next/link";
import type { UserAward } from "../../tournaments/types";
import Medal from "../awards/Medal";
import Plaque from "../awards/Plaque";
import { showcaseOf } from "../awards/group";

/**
 * The awards a profile shows: only what its owner chose — the one plaque and up
 * to three pinned medals (Settings → Showcase). Everything else they hold stays
 * off the page; listing every award under the showcase repeated the same
 * medals twice.
 *
 * Each medal carries its name, because a lone picture under the plaque read as
 * decoration. Tap or hover a medal for its dates and notes.
 */
export default function Showcase({
  awards,
  isOwnProfile,
  profileUrl,
  compact = false,
}: {
  awards: UserAward[];
  isOwnProfile: boolean;
  /** This profile's address; an award links to its awards page. */
  profileUrl: string;
  /** Phone: a smaller plaque and medals. */
  compact?: boolean;
}) {
  const awardsUrl = `${profileUrl}/awards`;
  const { pinned, plaque } = showcaseOf(awards);

  if (!plaque && pinned.length === 0) {
    // Only the owner learns that there is something to show, and where to
    // choose it; a visitor sees nothing.
    if (!isOwnProfile || awards.length === 0) return null;
    const n = new Set(awards.map((a) => a.awardId)).size;
    return (
      <p className="text-xs leading-relaxed text-white/60 border border-dashed border-component-border px-3 py-2.5">
        You have {n} award{n === 1 ? "" : "s"}, hidden until you pin {n === 1 ? "it" : "them"}.{" "}
        <Link href="/profile/edit#showcase" className="underline underline-offset-2">Choose in Settings</Link>
        {" · "}
        <Link href={awardsUrl} className="underline underline-offset-2">See them</Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {plaque && (
        <Link href={`${awardsUrl}#award-${plaque.awardId}`} title={plaque.description ?? plaque.name} className="block">
          <Plaque name={plaque.name} imageUrl={plaque.imageUrl} size={compact ? "sm" : "md"} count={plaque.grants.length} />
        </Link>
      )}
      {pinned.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {pinned.map((g) => (
            <li key={g.awardId} className={compact ? "w-[72px]" : "w-20"}>
              <Link
                href={`${awardsUrl}#award-${g.awardId}`}
                title={g.description ?? g.name}
                className="flex flex-col items-center gap-1.5 text-center group"
              >
                {/* showDetail off: the detail card is a button, which cannot
                    sit inside a link — the awards page carries the detail. */}
                <Medal
                  name={g.name}
                  imageUrl={g.imageUrl}
                  grants={g.grants}
                  sizeClass={compact ? "w-12 h-12" : "w-14 h-14"}
                  showDetail={false}
                />
                <span className="text-[11px] leading-tight font-semibold font-poppins text-white/85 line-clamp-2 group-hover:text-primary transition-colors">
                  {g.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
