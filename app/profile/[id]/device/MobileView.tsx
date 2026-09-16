"use client";

import { useState } from "react";
import { displayNameOf, handleOf, profileHref } from "../../../utils/api";
import ProfileAvatar from "../../../components/profile/ProfileAvatar";
import Showcase from "../../../components/profile/Showcase";
import ProfileActions from "../../../components/profile/ProfileActions";
import StatsStrip from "../../../components/profile/StatsStrip";
import GallerySection from "../../../components/profile/GallerySection";
import TournamentHistory from "../../../components/profile/TournamentHistory";
import { formatMonth } from "../../../components/profile/format";
import MatchFeed from "./mobile/MatchFeed";
import type { ProfileViewProps } from "./types";

type Tab = "matches" | "tournaments";

/**
 * Phone profile (under 1024px): identity and record first, the gallery folded
 * under them, then matches / tournaments as tabs so the page stays
 * about one and a half screens long. The open tab lives in the URL hash, so
 * going back or sharing a link keeps it.
 */
export default function MobileView(p: ProfileViewProps) {
  const { user } = p;
  const name = displayNameOf(user);
  const profileUrl = profileHref(user);

  const tabs: { key: Tab; label: string; count: number | null }[] = [
    { key: "matches", label: "Matches", count: p.matches?.length ?? null },
    { key: "tournaments", label: "Tournaments", count: p.tournaments.length },
  ];

  // The tab named in the hash on arrival, if this profile has it.
  const [tab, setTab] = useState<Tab>(() => {
    const fromHash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return (tabs.find((t) => t.key === fromHash)?.key ?? "matches") as Tab;
  });
  const choose = (t: Tab) => {
    setTab(t);
    try {
      history.replaceState(null, "", `#${t}`);
    } catch {}
  };

  return (
    <div className="w-full px-4 flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <ProfileAvatar name={name} avatarUrl={user.avatarUrl} accent className="w-16 h-16 text-3xl" />
        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="text-[26px] leading-none font-black uppercase tracking-tight text-white font-poppins truncate">{name}</h1>
          {handleOf(user) && <p className="font-mono text-[13px] text-white/70 truncate">{handleOf(user)}</p>}
          {user.createdAt && <p className="text-xs text-white/55">Member since {formatMonth(user.createdAt)}</p>}
        </div>
      </div>

      <Showcase awards={p.awards} isOwnProfile={p.isOwnProfile} profileUrl={profileUrl} compact />

      {user.bio && <p className="text-sm leading-relaxed text-white/75 whitespace-pre-line break-words">{user.bio}</p>}

      <ProfileActions isOwnProfile={p.isOwnProfile} onAward={p.onAward} />

      <StatsStrip stats={p.stats} compact />

      <GallerySection
        images={p.gallery}
        viewerRoles={p.viewerRoles}
        isOwnProfile={p.isOwnProfile}
        onRemoved={p.onGalleryRemoved}
        compact
      />

      <div>
        <div role="tablist" aria-label="Profile sections" className="flex gap-5 overflow-x-auto border-b border-component-border">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={active}
                aria-controls={`panel-${t.key}`}
                onClick={() => choose(t.key)}
                className={`h-11 shrink-0 flex items-center gap-2 border-b-2 -mb-px text-[11px] font-bold uppercase tracking-[0.1em] font-poppins whitespace-nowrap ${
                  active ? "border-primary text-white" : "border-transparent text-white/55"
                }`}
              >
                {t.label}
                {t.count !== null && (
                  <span className={`text-[10px] border px-1.5 ${active ? "border-primary/45 text-primary" : "border-component-border text-white/55"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-4">
          {tab === "matches" && <MatchFeed matches={p.matches} allHref={`${profileUrl}/matches`} />}
          {tab === "tournaments" && <TournamentHistory results={p.tournaments} />}
        </div>
      </div>
    </div>
  );
}
