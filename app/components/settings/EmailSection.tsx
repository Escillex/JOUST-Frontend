"use client";

import { useState } from "react";
import { API_ENDPOINTS } from "../../utils/api";
import type { AccountSecurity } from "../../tournaments/types";
import ProfileSection from "../profile/ProfileSection";
import { formStyles } from "../profile/formStyles";
import { errorText, send } from "./account";
import ProofField, { proofReady, type Proof } from "./ProofField";
import { SettingsIcons } from "./icons";

/** The address sign-in codes and resets go to. Changing it needs proof; the
 *  new address is typed twice, because a typo here can lock you out. */
export default function EmailSection({
  security,
  onChanged,
}: {
  security: AccountSecurity;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [repeat, setRepeat] = useState("");
  const [proof, setProof] = useState<Proof>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const mismatch = repeat.length > 0 && email.trim().toLowerCase() !== repeat.trim().toLowerCase();
  const ready = /.+@.+\..+/.test(email.trim()) && !mismatch && repeat.length > 0 && proofReady(security, proof);

  const close = () => {
    setOpen(false);
    setEmail("");
    setRepeat("");
    setProof({});
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME_EMAIL, { email: email.trim(), ...proof });
    setBusy(false);
    if (ok) {
      const now = (data as { email?: string })?.email ?? email.trim();
      close();
      setMessage({
        text: security.twoFactor.requiredForYou
          ? `Your email is now ${now}. The next time you sign in, a code goes there to confirm it.`
          : `Your email is now ${now}.`,
        ok: true,
      });
      await onChanged();
    } else {
      setMessage({ text: errorText(data, "Could not change your email."), ok: false });
    }
  };

  return (
    <ProfileSection title="Email" icon={SettingsIcons.mail}>
      <div className={`${formStyles.card} flex flex-col gap-4`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[15px] font-semibold font-poppins text-white break-all">{security.email ?? "No email on file"}</p>
            <p className={formStyles.help}>Sign-in codes and password resets go here.</p>
          </div>
          {!open && (
            <button type="button" onClick={() => { setOpen(true); setMessage(null); }} className={formStyles.btnSecondary}>
              Change email
            </button>
          )}
        </div>

        {open && (
          <div className="flex flex-col gap-4 border-t border-component-border/60 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="new-email" className={formStyles.label}>New email</label>
                <input id="new-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={formStyles.input} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="repeat-email" className={formStyles.label}>Repeat new email</label>
                <input id="repeat-email" type="email" autoComplete="off" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={mismatch} className={formStyles.input} />
                {mismatch && <p className={formStyles.error}>The two addresses are different.</p>}
              </div>
            </div>
            <ProofField security={security} value={proof} onChange={setProof} />
            <div className="flex gap-3 flex-wrap">
              <button onClick={save} disabled={busy || !ready} className={formStyles.btnPrimary}>
                {busy ? "Changing…" : "Change email"}
              </button>
              <button type="button" onClick={close} className={formStyles.btnSecondary}>Cancel</button>
            </div>
          </div>
        )}

        {message && <p className={message.ok ? formStyles.ok : formStyles.error} role="status">{message.text}</p>}
      </div>
    </ProfileSection>
  );
}
