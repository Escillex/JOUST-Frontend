"use client";

import { useEffect, useRef, useState } from "react";
import { displayNameOf, handleOf, profileHref } from "../../../utils/api";
import ProfileAvatar from "../../../components/profile/ProfileAvatar";
import PlaysRow from "../../../components/profile/PlaysRow";
import Showcase from "../../../components/profile/Showcase";
import ProfileActions from "../../../components/profile/ProfileActions";
import ProfileSection, { Icons } from "../../../components/profile/ProfileSection";
import StatsStrip from "../../../components/profile/StatsStrip";
import GallerySection from "../../../components/profile/GallerySection";
import TournamentHistory from "../../../components/profile/TournamentHistory";
import { formatMonth } from "../../../components/profile/format";
import MatchTable from "./desktop/MatchTable";
import type { ProfileViewProps } from "./types";

/**
 * Desktop profile (1024px and up): who this is in a sidebar that stays on
 * screen, the record in the wide column beside it — stats, gallery, matches,
 * tournaments.
 */
export default function DesktopView(p: ProfileViewProps) {
  const { user } = p;
  const name = displayNameOf(user);
  const profileUrl = profileHref(user);

  // The sidebar only sticks when it fits the window. A tall one (a long bio,
  // many awards) would otherwise hide its own bottom until the page ended.
  const asideRef = useRef<HTMLElement>(null);
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const check = () => setSticky(el.offsetHeight <= window.innerHeight - 128);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-8 grid grid-cols-[280px_minmax(0,1fr)] min-[1180px]:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] gap-8 items-start">
      <aside
        ref={asideRef}
        className={`bg-component-background border border-component-border p-6 flex flex-col gap-6 ${sticky ? "sticky top-28" : ""}`}
      >
        <ProfileAvatar name={name} avatarUrl={user.avatarUrl} accent className="w-full aspect-square text-[120px]" />

        <div className="flex flex-col gap-2 min-w-0">
          <h1 className="text-4xl leading-none font-black uppercase tracking-tight text-white font-poppins break-words">{name}</h1>
          {handleOf(user) && <p className="font-mono text-sm text-white/70">{handleOf(user)}</p>}
          {user.createdAt && <p className="text-[13px] text-white/55">Member since {formatMonth(user.createdAt)}</p>}
        </div>

        <Showcase awards={p.awards} isOwnProfile={p.isOwnProfile} profileUrl={profileUrl} />

        <ProfileActions isOwnProfile={p.isOwnProfile} onAward={p.onAward} />

        {user.bio && (
          <p className="text-[15px] leading-relaxed text-white/75 whitespace-pre-line break-words">{user.bio}</p>
        )}

        <PlaysRow games={user.games} />

      </aside>

      <div className="flex flex-col gap-10 min-w-0">
        <StatsStrip stats={p.stats} />

        <GallerySection
          images={p.gallery}
          viewerRoles={p.viewerRoles}
          isOwnProfile={p.isOwnProfile}
          onRemoved={p.onGalleryRemoved}
        />

        <ProfileSection title="Recent matches" icon={Icons.matches} meta={p.matches?.length ? `${p.matches.length} recent` : undefined}>
          <MatchTable matches={p.matches} allHref={`${profileUrl}/matches`} />
        </ProfileSection>

        <ProfileSection title="Tournament history" icon={Icons.tournaments} meta={p.tournaments.length ? `${p.tournaments.length} played` : undefined}>
          <TournamentHistory results={p.tournaments} twoUp />
        </ProfileSection>
      </div>
    </div>
  );
}
