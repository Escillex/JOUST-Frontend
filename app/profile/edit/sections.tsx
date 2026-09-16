"use client";

import React from "react";
import type { AccountSecurity, GamePlayed } from "../../tournaments/types";
import BioEditor from "../../components/profile/BioEditor";
import ShowcaseEditor from "../../components/profile/ShowcaseEditor";
import GalleryEditor from "../../components/profile/GalleryEditor";
import PictureSection from "../../components/settings/PictureSection";
import NameSection from "../../components/settings/NameSection";
import EmailSection from "../../components/settings/EmailSection";
import PasswordSection from "../../components/settings/PasswordSection";
import SecuritySection from "../../components/settings/SecuritySection";
import DeleteSection from "../../components/settings/DeleteSection";
import GamesSection from "../../components/settings/GamesSection";

/**
 * The settings, in order, and how each one renders. Both device views read
 * this: desktop stacks them beside a rail, a phone lists them and opens one
 * at a time — so a section added here appears in both, which is exactly what
 * the two separate trees tend to get wrong.
 */
export type SectionKey = "picture" | "games" | "showcase" | "gallery" | "name" | "email" | "password" | "security" | "delete";

export interface SectionItem {
  key: SectionKey;
  label: string;
  danger?: boolean;
  /** Needs GET /auth/me/security before it can render. */
  account?: boolean;
}

export const GROUPS: { label: string | null; items: SectionItem[] }[] = [
  {
    label: "Public profile",
    items: [
      { key: "picture", label: "Picture and bio" },
      { key: "games", label: "Games I play" },
      { key: "showcase", label: "Showcase" },
      { key: "gallery", label: "Gallery" },
    ],
  },
  {
    label: "Account",
    items: [
      { key: "name", label: "Name and username" },
      { key: "email", label: "Email", account: true },
      { key: "password", label: "Password", account: true },
      { key: "security", label: "Sign-in and security", account: true },
    ],
  },
  { label: null, items: [{ key: "delete", label: "Delete account", danger: true, account: true }] },
];

export const ALL_KEYS = GROUPS.flatMap((g) => g.items.map((i) => i.key));

export function isSectionKey(v: string): v is SectionKey {
  return (ALL_KEYS as string[]).includes(v);
}

export interface SettingsUser {
  id: string;
  username: string;
  displayName?: string | null;
  slug?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  isGuest?: boolean;
  googleLinked?: boolean;
  games?: GamePlayed[];
}

export interface SectionContext {
  user: SettingsUser;
  refreshUser: () => Promise<void>;
  security: AccountSecurity | null;
  securityFailed: boolean;
  reloadSecurity: () => void;
  /** Clears the local session and leaves — after deleting the account, or
   *  after signing out of every browser. */
  onDeleted: () => Promise<void>;
}

export function renderSection(key: SectionKey, ctx: SectionContext): React.ReactNode {
  const { user, security } = ctx;
  const account = GROUPS.flatMap((g) => g.items).find((i) => i.key === key)?.account;
  if (account && !security) {
    return (
      <p className={`text-sm ${ctx.securityFailed ? "text-[#FF4D4D]" : "text-white/60"}`} role={ctx.securityFailed ? "alert" : undefined}>
        {ctx.securityFailed ? "Could not load your account settings. Check the connection and reload." : "Loading…"}
      </p>
    );
  }
  // After a change to the account, both the user and the security summary may
  // have moved (e.g. the email shows in both), so reload both.
  const changed = async () => {
    ctx.reloadSecurity();
    await ctx.refreshUser();
  };

  switch (key) {
    case "picture":
      return (
        <div className="flex flex-col gap-10">
          <PictureSection userId={user.id} username={user.username} avatarUrl={user.avatarUrl} onChanged={ctx.refreshUser} />
          <BioEditor key={user.id} initial={user.bio} onSaved={ctx.refreshUser} />
        </div>
      );
    case "games":
      return <GamesSection key={user.id} games={user.games} onSaved={ctx.refreshUser} />;
    case "showcase":
      return <ShowcaseEditor handle={user.id} />;
    case "gallery":
      return <GalleryEditor />;
    case "name":
      return <NameSection displayName={user.displayName} username={user.username} slug={user.slug} onSaved={ctx.refreshUser} />;
    case "email":
      return <EmailSection security={security!} onChanged={changed} />;
    case "password":
      return <PasswordSection security={security!} onChanged={changed} />;
    case "security":
      return (
        <SecuritySection
          security={security!}
          googleLinked={!!user.googleLinked}
          onChanged={changed}
          onSignedOut={ctx.onDeleted}
        />
      );
    case "delete":
      return <DeleteSection security={security!} username={user.username} onDeleted={ctx.onDeleted} />;
  }
}
