"use client";

import { useState } from "react";
import ImageUpload from "../ui/ImageUpload";
import ProfileSection, { Icons } from "../profile/ProfileSection";
import { formStyles } from "../profile/formStyles";
import { authenticatedFetch, API_ENDPOINTS, UPLOAD_TIMEOUT_MS } from "../../utils/api";

/** The profile picture: cropped square on the client, stored 400×400. */
export default function PictureSection({
  userId,
  username,
  avatarUrl,
  onChanged,
}: {
  userId: string;
  username: string;
  avatarUrl: string | null | undefined;
  onChanged: () => void | Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  // Shown straight away after an upload, before the user record reloads.
  const [localUrl, setLocalUrl] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const current = localUrl === undefined ? avatarUrl ?? null : localUrl;

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.UPLOAD_AVATAR(userId), {
        method: "POST",
        body: formData,
        // Uploads carry real bytes; the default request timeout is for reads.
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
      if (res.ok) {
        const data = await res.json();
        setLocalUrl(data.avatarUrl);
        await onChanged();
      } else {
        setError("The picture could not be uploaded.");
      }
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    setUploading(true);
    setError(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.DELETE_AVATAR(userId), { method: "DELETE" });
      if (res.ok) {
        setLocalUrl(null);
        await onChanged();
      } else {
        setError("The picture could not be removed.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProfileSection title="Profile picture" icon={Icons.picture}>
      <div className={`${formStyles.card} flex flex-col sm:flex-row gap-6 sm:items-center`}>
        <div className="w-full max-w-[280px] sm:w-44 sm:max-w-none aspect-square shrink-0">
          <ImageUpload
            currentUrl={current}
            onUpload={upload}
            onDelete={remove}
            uploading={uploading}
            aspectRatio="aspect-square"
            cropAspectRatio={1}
            label="CHANGE PICTURE"
            placeholder={
              <span className="text-6xl font-black font-poppins text-primary">{username?.[0]?.toUpperCase() || "U"}</span>
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className={formStyles.help}>
            PNG, JPEG or WebP. You crop it to a square before it uploads, and it is resized to 400×400.
          </p>
          {/* Touch screens show the buttons on the picture itself. */}
          <p className={`${formStyles.help} [@media(hover:none)]:hidden`}>Point at the picture to change or remove it.</p>
          {error && <p className={formStyles.error} role="alert">{error}</p>}
        </div>
      </div>
    </ProfileSection>
  );
}
