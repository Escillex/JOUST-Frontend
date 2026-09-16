"use client";

import { useState } from "react";
import { API_ENDPOINTS } from "../../utils/api";
import type { AccountSecurity } from "../../tournaments/types";
import ProfileSection from "../profile/ProfileSection";
import ConnectedAccounts from "../profile/ConnectedAccounts";
import { formStyles } from "../profile/formStyles";
import { formatDay } from "../profile/format";
import { describeBrowser, errorText, send } from "./account";
import ProofField, { proofReady, type Proof } from "./ProofField";
import { SettingsIcons } from "./icons";

const MODE_TEXT = {
  off: "Not used on this site.",
  staff: "Asked of organizers and admins on this site.",
  all: "Asked of everyone on this site.",
} as const;

/** How this account signs in: Google, the emailed sign-in code (a site-wide
 *  setting, shown so nobody is surprised by it), recovery codes, and the
 *  browsers that remember having passed a code. */
export default function SecuritySection({
  security,
  googleLinked,
  onChanged,
  onSignedOut,
}: {
  security: AccountSecurity;
  googleLinked: boolean;
  onChanged: () => void | Promise<void>;
  /** After ending every session, this browser included. */
  onSignedOut: () => void | Promise<void>;
}) {
  return (
    <ProfileSection title="Sign-in and security" icon={SettingsIcons.shield}>
      <div className="bg-component-background border border-component-border flex flex-col divide-y divide-component-border/60">
        <ConnectedAccounts bare googleLinked={googleLinked} hasPassword={security.hasPassword} onChanged={onChanged} />

        <div className="flex items-start justify-between gap-4 p-5 md:px-6 flex-wrap">
          <div className="flex flex-col gap-1">
            <p className={formStyles.label}>Emailed sign-in codes</p>
            <p className={formStyles.help}>Set for the whole site by its admins.</p>
          </div>
          <p className="text-sm text-white/85">
            {MODE_TEXT[security.twoFactor.mode]}
            {security.twoFactor.mode === "staff" && security.twoFactor.requiredForYou ? " That includes you." : ""}
          </p>
        </div>

        <RecoveryCodes security={security} onChanged={onChanged} />
        <Devices security={security} onChanged={onChanged} />
        <SignOutEverywhere onSignedOut={onSignedOut} />
      </div>
    </ProfileSection>
  );
}

function RecoveryCodes({ security, onChanged }: { security: AccountSecurity; onChanged: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<Proof>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const make = async () => {
    setBusy(true);
    setError(null);
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME_RECOVERY_CODES, proof);
    setBusy(false);
    if (ok) {
      setCodes((data as { codes: string[] }).codes);
      setOpen(false);
      setProof({});
      await onChanged();
    } else {
      setError(errorText(data, "Could not make new codes."));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes!.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 md:px-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <p className={formStyles.label}>Recovery codes</p>
          <p className={formStyles.help}>
            One-time codes for when an emailed code cannot reach you — at sign-in, or to reset your password.
            {" "}{security.recoveryCodesLeft > 0 ? `${security.recoveryCodesLeft} left.` : "You have none."}
          </p>
        </div>
        {!open && !codes && (
          <button type="button" onClick={() => setOpen(true)} className={formStyles.btnSecondary}>
            Make new codes
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-component-border/60 pt-4">
          {security.recoveryCodesLeft > 0 && (
            <p className="text-xs text-amber-300">Your current codes stop working as soon as the new ones are made.</p>
          )}
          <div className="md:max-w-sm">
            <ProofField security={security} value={proof} onChange={setProof} />
          </div>
          {error && <p className={formStyles.error} role="alert">{error}</p>}
          <div className="flex gap-3 flex-wrap">
            <button onClick={make} disabled={busy || !proofReady(security, proof)} className={formStyles.btnPrimary}>
              {busy ? "Making…" : "Make new codes"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setProof({}); setError(null); }} className={formStyles.btnSecondary}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {codes && (
        <div className="flex flex-col gap-3 border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold font-poppins text-white">Save these now — they are shown only once.</p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-sm text-white">
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex gap-3 flex-wrap">
            <button type="button" onClick={copy} className={formStyles.btnSecondary}>{copied ? "Copied" : "Copy all"}</button>
            <button type="button" onClick={() => setCodes(null)} className={formStyles.btnPrimary}>I have saved them</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Devices({ security, onChanged }: { security: AccountSecurity; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forget = async (id: string) => {
    setBusy(id);
    setError(null);
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME_DEVICE(id), undefined, "DELETE");
    setBusy(null);
    if (ok) await onChanged();
    else setError(errorText(data, "Could not forget that browser."));
  };

  return (
    <div className="flex flex-col gap-3 p-5 md:px-6">
      <div className="flex flex-col gap-1">
        <p className={formStyles.label}>Remembered browsers</p>
        <p className={formStyles.help}>Browsers that skip the emailed code for 30 days, because you ticked “remember this browser”.</p>
      </div>
      {security.devices.length === 0 ? (
        <p className="text-sm text-white/70">None.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-component-border/60 border border-component-border/60">
          {security.devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5 min-h-12">
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-white truncate">{describeBrowser(d.userAgent)}</span>
                <span className="text-xs text-white/60">Last used {formatDay(d.lastUsedAt)}</span>
              </div>
              {d.current ? (
                <span className="text-xs text-white/70 shrink-0">This browser</span>
              ) : (
                <button type="button" onClick={() => forget(d.id)} disabled={busy === d.id} className={`shrink-0 ${formStyles.btnSecondary}`}>
                  {busy === d.id ? "Forgetting…" : "Forget"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className={formStyles.error} role="alert">{error}</p>}
    </div>
  );
}

/** Ends every session on the account, this browser included — for a lost phone,
 *  or a computer you forgot to sign out of. No proof: it only removes access.
 *  No window.confirm (Core Rule 5); the first press arms, the second acts. */
function SignOutEverywhere({ onSignedOut }: { onSignedOut: () => void | Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME_SIGN_OUT_EVERYWHERE);
    setBusy(false);
    if (ok) await onSignedOut();
    else setError(errorText(data, "Could not sign out everywhere."));
  };

  return (
    <div className="flex items-start justify-between gap-4 p-5 md:px-6 flex-wrap">
      <div className="flex flex-col gap-1">
        <p className={formStyles.label}>Sign out everywhere</p>
        <p className={formStyles.help}>
          Ends every signed-in browser and phone, including this one. Sessions otherwise last a week.
        </p>
        {error && <p className={formStyles.error} role="alert">{error}</p>}
      </div>
      <button type="button" onClick={go} disabled={busy} className={armed ? formStyles.btnDanger : formStyles.btnSecondary}>
        {busy ? "Signing out…" : armed ? "Press again to sign out" : "Sign out everywhere"}
      </button>
    </div>
  );
}
