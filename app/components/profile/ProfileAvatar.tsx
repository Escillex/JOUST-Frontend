"use client";

import Image from "next/image";
import { resolveImageUrl } from "../../utils/api";

/** A square avatar: the uploaded picture, or the name's first letter. */
export default function ProfileAvatar({
  name,
  avatarUrl,
  className = "w-8 h-8 text-xs",
  accent = false,
}: {
  name: string;
  avatarUrl?: string | null;
  /** Size and letter size. */
  className?: string;
  /** The profile owner's own avatar gets the green frame; others get a quiet one. */
  accent?: boolean;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden flex items-center justify-center font-black font-poppins text-primary bg-[#111] ${
        accent ? "border-2 border-primary" : "border border-component-border"
      } ${className}`}
    >
      {avatarUrl ? (
        <Image src={resolveImageUrl(avatarUrl)} alt={name} fill className="object-cover" unoptimized />
      ) : (
        <span aria-hidden="true">{name[0]?.toUpperCase() || "?"}</span>
      )}
    </div>
  );
}
