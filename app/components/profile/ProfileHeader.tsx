"use client";
import { UserProfile, UserAward } from "../../tournaments/types";
import Medal from "../awards/Medal";
import Plaque from "../awards/Plaque";
import { showcaseOf } from "../awards/group";

import React from "react";
import { BentoBox } from "../ui/Bento";

import Image from "next/image";
import { displayNameOf, handleOf, resolveImageUrl } from "../../utils/api";

interface ProfileHeaderProps {
  user: UserProfile;
  /** Every award this person holds; the card shows the chosen plaque and the
   *  pinned medals. */
  awards?: UserAward[];
}

/**
 * The signed-in user's compact identity card on the home dashboard. The full
 * profile page no longer uses it — it has its own device views under
 * app/profile/[id]/device/.
 */
export default function ProfileHeader({ user, awards }: ProfileHeaderProps) {
  const { pinned, plaque } = showcaseOf(awards);
  return (
    <BentoBox theme="default" className="p-0 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_2px_2px,rgba(var(--color-primary),0.03)_1px,transparent_0)] bg-[size:24px_24px] pointer-events-none" />
      <div className="p-6 flex items-center gap-8 h-full relative z-10">
        <div className="relative group">
          <div className="w-24 h-24 text-3xl bg-component-background border-2 border-primary text-primary flex items-center justify-center font-black font-poppins relative z-10 overflow-hidden">
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
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary/40 z-30" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary/40 z-30" />
          </div>
        </div>

        <div className="flex flex-col">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white font-poppins leading-none mb-6 mix-blend-difference">
            {displayNameOf(user)}
          </h1>
          {/* The handle underneath, the way Twitter/Steam do it: the big name is
              who they are, the @handle is how you address them. */}
          {handleOf(user) && (
            <p className="text-xs font-mono text-white/30 -mt-4 mb-2">{handleOf(user)}</p>
          )}

          {plaque && (
            <Plaque
              name={plaque.name}
              imageUrl={plaque.imageUrl}
              size="sm"
              count={plaque.grants.length}
              title={plaque.description ?? plaque.name}
              className="mt-2"
            />
          )}

          {pinned.length > 0 && (
            <div className="flex items-center gap-3 mt-3">
              {pinned.map((g) => (
                <Medal
                  key={g.awardId}
                  name={g.name}
                  imageUrl={g.imageUrl}
                  description={g.description}
                  grants={g.grants}
                  sizeClass="w-10 h-10"
                  // The card clips its overflow, which would cut the detail
                  // card off.
                  showDetail={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </BentoBox>
  );
}
