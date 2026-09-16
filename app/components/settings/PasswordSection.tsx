"use client";

import { useState } from "react";
import { API_ENDPOINTS } from "../../utils/api";
import type { AccountSecurity } from "../../tournaments/types";
import ProfileSection from "../profile/ProfileSection";
import { formStyles } from "../profile/formStyles";
import { errorText, send } from "./account";
import ProofField, { proofReady, type Proof } from "./ProofField";
import { SettingsIcons } from "./icons";

/** Mirrors PASSWORD_MIN_LENGTH in server/src/auth/dto/auth.dto.ts. */
const MIN = 8;

export default function PasswordSection({
  security,
  onChanged,
}: {
  security: AccountSecurity;
  onChanged: () => void | Promise<void>;
}) {
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [proof, setProof] = useState<Proof>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const short = next.length > 0 && next.length < MIN;
  const mismatch = repeat.length > 0 && next !== repeat;
  const ready = next.length >= MIN && next === repeat && proofReady(security, proof);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME_PASSWORD, { newPassword: next, ...proof });
    setBusy(false);
    if (ok) {
      const body = data as { devicesForgotten?: number; token?: string };
      // Every other session just ended, this one included — the server issued a
      // replacement for this browser. Without storing it, the next request is
      // refused and the person who changed their password is the one locked out.
      if (body.token) {
        try {
          localStorage.setItem("token", body.token);
        } catch {}
      }
      const forgotten = body.devicesForgotten ?? 0;
      setNext("");
      setRepeat("");
      setProof({});
      setMessage({
        text: `Password changed. Every other browser has been signed out${
          forgotten > 0 ? `, and ${forgotten} remembered browser${forgotten === 1 ? "" : "s"} will need a code next time` : ""
        }.`,
        ok: true,
      });
      await onChanged();
    } else {
      setMessage({ text: errorText(data, "Could not change your password."), ok: false });
    }
  };

  return (
    <ProfileSection title={security.hasPassword ? "Password" : "Set a password"} icon={SettingsIcons.lock}>
      <div className={`${formStyles.card} flex flex-col gap-4`}>
        {!security.hasPassword && (
          <p className={formStyles.help}>
            You sign in with Google. Setting a password gives you a second way in — and once you have one, you can
            disconnect Google under Sign-in and security and carry on as an ordinary account.
          </p>
        )}
        <div className="md:max-w-sm">
          <ProofField security={security} value={proof} onChange={(p) => { setProof(p); setMessage(null); }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="new-password" className={formStyles.label}>New password</label>
            <input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setMessage(null); }} aria-invalid={short} className={formStyles.input} />
            <p className={short ? formStyles.error : formStyles.help}>At least {MIN} characters.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="repeat-password" className={formStyles.label}>Repeat new password</label>
            <input id="repeat-password" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={mismatch} className={formStyles.input} />
            {mismatch && <p className={formStyles.error}>The two passwords are different.</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={save} disabled={busy || !ready} className={formStyles.btnPrimary}>
            {busy ? "Changing…" : security.hasPassword ? "Change password" : "Set password"}
          </button>
          {message && <p className={message.ok ? formStyles.ok : formStyles.error} role="status">{message.text}</p>}
        </div>
      </div>
    </ProfileSection>
  );
}
