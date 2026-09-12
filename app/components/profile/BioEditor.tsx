"use client";

import { useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";

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
    <div className="space-y-6">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/20 flex items-center gap-3">
        <div className="w-2 h-2 bg-primary" />
        ABOUT
      </div>
      <div className="bg-component-background border border-component-border p-6 md:p-8 space-y-4">
        <label htmlFor="bio" className="block text-[11px] font-black uppercase tracking-widest text-white">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          maxLength={MAX}
          rows={4}
          onChange={(e) => { setBio(e.target.value); setMessage(null); }}
          placeholder="A line or two about you — what you play, where you compete."
          className="w-full bg-background border border-component-border px-4 py-3 text-sm text-white leading-relaxed focus:outline-none focus:border-primary transition-all placeholder:text-white/20 resize-y"
        />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button
              onClick={save}
              disabled={busy || !dirty}
              className="px-8 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-40 transition-all active:scale-95"
            >
              {busy ? "Saving..." : "Save Bio"}
            </button>
            {message && <p className={`text-xs ${message.ok ? "text-primary" : "text-[#FF4D4D]"}`}>{message.text}</p>}
          </div>
          <span className={`text-[10px] font-bold tabular-nums ${bio.length > MAX - 20 ? "text-amber-400" : "text-white/30"}`}>
            {bio.length} / {MAX}
          </span>
        </div>
        <p className="text-[10px] text-white/30">Shown on your public profile. Leave it empty to remove it.</p>
      </div>
    </div>
  );
}
