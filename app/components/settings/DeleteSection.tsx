"use client";

import { useState } from "react";
import Link from "next/link";
import { API_ENDPOINTS } from "../../utils/api";
import type { AccountSecurity } from "../../tournaments/types";
import ProfileSection from "../profile/ProfileSection";
import { formStyles } from "../profile/formStyles";
import { errorCode, errorText, send } from "./account";
import ProofField, { proofReady, type Proof } from "./ProofField";
import { SettingsIcons } from "./icons";

/**
 * Deleting your own account. No `window.confirm` (Core Rule 5): the form has
 * to be opened, the username typed out, and the proof given — three deliberate
 * steps instead of one dialog.
 */
export default function DeleteSection({
  security,
  username,
  onDeleted,
}: {
  security: AccountSecurity;
  username: string;
  onDeleted: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [proof, setProof] = useState<Proof>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<{ id: string; name: string }[]>([]);

  const matches = confirm.trim().toLowerCase() === username.toLowerCase();

  const remove = async () => {
    setBusy(true);
    setError(null);
    setBlocking([]);
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME_DELETE, { confirm, ...proof });
    setBusy(false);
    if (ok) {
      await onDeleted();
      return;
    }
    setError(errorText(data, "Could not delete your account."));
    if (errorCode(data) === "ACTIVE_IN_LIVE_TOURNAMENT") {
      setBlocking(((data as { tournaments?: { id: string; name: string }[] })?.tournaments) ?? []);
    }
  };

  return (
    <ProfileSection title="Delete account" icon={<span className="text-[#FF4D4D]">{SettingsIcons.trash}</span>}>
      <div className="bg-component-background border border-[#FF4D4D]/35 p-5 md:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1 max-w-xl">
            <p className={formStyles.label}>Delete your account</p>
            <p className={formStyles.help}>
              Finished matches keep your name so brackets still read correctly; your profile, awards, gallery and sign-in
              go. It cannot be undone. Not possible while you are entered in a live tournament.
            </p>
          </div>
          {!open && (
            <button type="button" onClick={() => setOpen(true)} className={formStyles.btnDanger}>
              Delete account
            </button>
          )}
        </div>

        {open && (
          <div className="flex flex-col gap-4 border-t border-[#FF4D4D]/25 pt-4">
            <div className="flex flex-col gap-2 md:max-w-sm">
              <label htmlFor="confirm-delete" className={formStyles.label}>Type your username, {username}</label>
              <input id="confirm-delete" autoComplete="off" spellCheck={false} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={formStyles.input} />
            </div>
            <div className="md:max-w-sm">
              <ProofField security={security} value={proof} onChange={setProof} />
            </div>
            {error && (
              <div className="flex flex-col gap-2" role="alert">
                <p className={formStyles.error}>{error}</p>
                {blocking.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {blocking.map((t) => (
                      <li key={t.id}><Link href={`/tournaments/${t.id}`} className="text-sm underline underline-offset-2">{t.name}</Link></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              <button onClick={remove} disabled={busy || !matches || !proofReady(security, proof)} className={formStyles.btnDanger}>
                {busy ? "Deleting…" : "Delete my account for good"}
              </button>
              <button type="button" onClick={() => { setOpen(false); setConfirm(""); setProof({}); setError(null); setBlocking([]); }} className={formStyles.btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </ProfileSection>
  );
}
