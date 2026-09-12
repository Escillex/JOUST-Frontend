"use client";
import { UserProfile, UserAward } from "../../tournaments/types";
import Medal from "../awards/Medal";
import Plaque from "../awards/Plaque";
import { showcaseOf } from "../awards/group";

import React from "react";
import * as m from "motion/react";
import { BentoBox } from "../ui/Bento";


import Image from "next/image";
import Link from "next/link";
import { displayNameOf, handleOf, resolveImageUrl } from "../../utils/api";

interface ProfileHeaderProps {
  user: UserProfile;
  isOwnProfile?: boolean;
  onLogout?: () => void;
  variant?: "default" | "bento";
  /** Every award this person holds; the header shows the chosen plaque and
   *  the pinned medals, and the full list lives in AwardsCase. */
  awards?: UserAward[];
  /** Present only when the viewer is an admin and the profile can hold awards;
   *  opens GrantAwardModal. */
  onAward?: () => void;
}

export default function ProfileHeader({ user, isOwnProfile = false, onLogout, variant = "default", awards, onAward }: ProfileHeaderProps) {
  const { pinned, plaque } = showcaseOf(awards);
  const bento = variant === "bento";
  const avatar = (
    <div className="relative group">
      <div className={`
        ${variant === "bento" ? "w-24 h-24 text-3xl" : "w-40 h-40 md:w-56 md:h-56 text-6xl md:text-8xl"}
        bg-component-background border-2 border-primary text-primary flex items-center justify-center font-black font-poppins relative z-10 overflow-hidden
      `}>
        {user.avatarUrl ? (
          <Image 
            src={resolveImageUrl(user.avatarUrl)}
            alt={displayNameOf(user)} 
            fill 
            className="object-cover"
            unoptimized // Since we might be using local backend uploads
          />
        ) : (
          displayNameOf(user)[0]?.toUpperCase() || "U"
        )}

        {/* Internal technical lines */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary/40 z-30" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary/40 z-30" />
      </div>
    </div>
  );

  const statsInfo = (
    <div className="flex flex-col">
      <h1 className={`
        ${variant === "bento" ? "text-4xl" : "text-6xl md:text-8xl lg:text-9xl"}
        font-black uppercase tracking-tighter text-white font-poppins leading-none mb-6 mix-blend-difference
      `}>
        {displayNameOf(user)}
      </h1>
      {/* The handle underneath, the way Twitter/Steam do it: the big name is
          who they are, the @handle is how you address them. */}
      {handleOf(user) && (
        <p className={`${variant === "bento" ? "text-xs" : "text-lg"} font-mono text-white/30 -mt-4 mb-2`}>
          {handleOf(user)}
        </p>
      )}

      {/* The one plaque this person chose, directly under the handle — a
          nameplate, the way Steam and Discord place theirs. */}
      {plaque && (
        <Plaque
          name={plaque.name}
          imageUrl={plaque.imageUrl}
          size={bento ? "sm" : "lg"}
          count={plaque.grants.length}
          title={plaque.description ?? plaque.name}
          className={bento ? "mt-2" : "mt-4 mx-auto md:mx-0"}
        />
      )}

      {pinned.length > 0 && (
        <div className={`flex items-center gap-3 ${bento ? "mt-3" : "mt-5 justify-center md:justify-start"}`}>
          {pinned.map((g) => (
            <Medal
              key={g.awardId}
              name={g.name}
              imageUrl={g.imageUrl}
              description={g.description}
              grants={g.grants}
              sizeClass={bento ? "w-10 h-10" : "w-14 h-14 md:w-[72px] md:h-[72px]"}
              // The bento card clips its overflow, which would cut the detail
              // card off; the full profile has room for it.
              showDetail={!bento}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (variant === "bento") {
    return (
      <BentoBox theme="default" className="p-0 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_2px_2px,rgba(var(--color-primary),0.03)_1px,transparent_0)] bg-[size:24px_24px] pointer-events-none" />
        <div className="p-6 flex items-center gap-8 h-full relative z-10">
          {avatar}
          {statsInfo}
        </div>
      </BentoBox>
    );
  }

  return (
    <m.motion.div 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="flex flex-col md:flex-row items-center md:items-center gap-16 bg-component-background border-2 border-component-border p-12 md:p-24 relative overflow-hidden min-h-[500px]"
    >
      {/* Background Greeble Pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none overflow-hidden select-none">
        <div className="text-[20rem] font-black leading-none uppercase rotate-12 -ml-24 -mt-24">
          {displayNameOf(user)}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 p-8 text-white/5 font-mono text-[8px] tracking-widest hidden md:block">
        PROFILE_DATA_SESSION
      </div>

      <div className="relative z-10">
        {avatar}
      </div>

      <div className="flex-1 text-center md:text-left z-10 flex flex-col justify-center">
        {statsInfo}
        
        <div className="mt-12 flex items-center gap-6">
          <div className="text-white/20 text-[9px] font-mono tracking-widest uppercase bg-background/50 px-4 py-2 border border-component-border">
             ID_{user.id?.toUpperCase()}
          </div>
          {user.createdAt && (
            <div className="text-white/20 text-[9px] font-mono tracking-widest uppercase">
              REGISTERED_{new Date(user.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {onAward && (
        <div className={`absolute top-6 ${isOwnProfile ? "right-20 md:right-28" : "right-6 md:right-12"} md:top-12 z-20`}>
          <button
            onClick={onAward}
            className="h-10 md:h-12 px-4 border-2 border-primary/60 text-primary text-[10px] font-black uppercase tracking-widest transition-all hover:bg-primary hover:text-black"
            title="Give this user an award"
          >
            Award
          </button>
        </div>
      )}

      {isOwnProfile && (
        <div className="absolute top-6 right-6 md:top-12 md:right-12 z-20">
          <Link
            href="/profile/edit"
            className="w-10 h-10 md:w-12 md:h-12 border-2 border-primary text-primary flex items-center justify-center transition-all hover:bg-primary hover:text-black hover:shadow-[0_0_20px_rgba(82,185,70,0.3)]"
            title="Edit Profile"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </Link>
        </div>
      )}
    </m.motion.div>
  );
}

