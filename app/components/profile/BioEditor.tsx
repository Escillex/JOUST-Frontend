"use client";

import { useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";
import ProfileSection, { Icons } from "./ProfileSection";
import { formStyles } from "./formStyles";

/** Mirrors BIO_MAX_LENGTH in server/src/auth/dto/auth.dto.ts. */
const MAX = 300;

/**
 * The "about" line on a profile (todo.md obj. 4.2). Saved through
 * PATCH /auth/me, the same route as the rest of a user's own profile.
 */
export default function BioEditor({ initial, onSaved }: { initial: string | null | undefined; onSaved: () => void | Promise<void> }) {
  const [bio, setBio] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const dirty = bio.trim() !== saved.trim();

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ME, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        const next = data?.bio ?? "";
        setBio(next);
        setSaved(next);
        setMessage({ text: next ? "Bio saved." : "Bio removed.", ok: true });
        await onSaved();
      } else {
        const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
        setMessage({ text: msg || "Could not save your bio.", ok: false });
      }
    } catch {
      setMessage({ text: "Could not reach the server.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileSection title="About" icon={Icons.about}>
      <div className={`${formStyles.card} flex flex-col gap-3`}>
        <label htmlFor="bio" className={formStyles.label}>
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          maxLength={MAX}
          rows={4}
          onChange={(e) => { setBio(e.target.value); setMessage(null); }}
          placeholder="A line or two about you — what you play, where you compete."
          aria-describedby="bio-help"
          className="w-full bg-background border border-component-border px-3 py-2.5 text-sm text-white leading-relaxed focus:outline-none focus:border-primary placeholder:text-white/40 resize-y"
        />
        <div className="flex items-center justify-between gap-4">
          <p id="bio-help" className={formStyles.help}>Shown on your public profile. Leave it empty to remove it.</p>
          <span className={`shrink-0 text-xs tabular-nums ${bio.length > MAX - 20 ? "text-amber-400" : "text-white/60"}`}>
            {bio.length} / {MAX}
          </span>
        </div>
        <div className="flex items-center gap-4 flex-wrap pt-1">
          <button onClick={save} disabled={busy || !dirty} className={formStyles.btnPrimary}>
            {busy ? "Saving…" : "Save bio"}
          </button>
          {message && <p className={message.ok ? formStyles.ok : formStyles.error} role="status">{message.text}</p>}
        </div>
      </div>
    </ProfileSection>
  );
}
