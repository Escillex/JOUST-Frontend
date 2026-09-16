"use client";

import { useState } from "react";
import { API_ENDPOINTS } from "../../utils/api";
import ProfileSection from "../profile/ProfileSection";
import { formStyles } from "../profile/formStyles";
import { errorText, send } from "./account";
import { SettingsIcons } from "./icons";

/** Mirrors USERNAME_PATTERN / Length(3, 20) in server/src/auth/dto/auth.dto.ts. */
const USERNAME = /^[A-Za-z0-9._-]{3,20}$/;

/** Display name and @username — the two halves of how a person appears.
 *  Saved through PATCH /auth/me; a rename moves the profile address with it. */
export default function NameSection({
  displayName,
  username,
  slug,
  onSaved,
}: {
  displayName: string | null | undefined;
  username: string;
  slug: string | null | undefined;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(displayName ?? "");
  const [handle, setHandle] = useState(username);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const nameChanged = name.trim() !== (displayName ?? "").trim();
  const handleChanged = handle !== username;
  const handleValid = USERNAME.test(handle);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const body: Record<string, string> = {};
    if (nameChanged) body.displayName = name;
    if (handleChanged) body.username = handle;
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME, body, "PATCH");
    setBusy(false);
    if (ok) {
      setMessage({ text: handleChanged ? "Saved. Your profile address changed with your username." : "Saved.", ok: true });
      await onSaved();
    } else {
      setMessage({ text: errorText(data, "Could not save."), ok: false });
    }
  };

  return (
    <ProfileSection title="Name and username" icon={SettingsIcons.person}>
      <div className={`${formStyles.card} flex flex-col gap-5`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="display-name" className={formStyles.label}>Display name</label>
            <input
              id="display-name"
              value={name}
              maxLength={50}
              autoComplete="name"
              onChange={(e) => { setName(e.target.value); setMessage(null); }}
              placeholder={username}
              className={formStyles.input}
            />
            <p className={formStyles.help}>The big name on your profile. Spaces are fine, up to 50 characters.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="username" className={formStyles.label}>Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40" aria-hidden="true">@</span>
              <input
                id="username"
                value={handle}
                maxLength={20}
                autoComplete="username"
                spellCheck={false}
                onChange={(e) => { setHandle(e.target.value.trim()); setMessage(null); }}
                aria-invalid={!handleValid}
                className={`${formStyles.input} pl-7`}
              />
            </div>
            <p className={handleValid ? formStyles.help : formStyles.error}>
              3–20 letters, numbers, dots, dashes or underscores — no spaces.
            </p>
          </div>
        </div>
        {handleChanged && handleValid && (
          <p className="text-xs text-amber-300 border border-amber-400/40 px-3 py-2.5">
            Your profile address will follow the new username. Links to the old address will stop working.
          </p>
        )}
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={save} disabled={busy || !handleValid || (!nameChanged && !handleChanged)} className={formStyles.btnPrimary}>
            {busy ? "Saving…" : "Save"}
          </button>
          {message ? (
            <p className={message.ok ? formStyles.ok : formStyles.error} role="status">{message.text}</p>
          ) : (
            <p className={formStyles.help}>Profile address: /profile/{slug || username}</p>
          )}
        </div>
      </div>
    </ProfileSection>
  );
}
