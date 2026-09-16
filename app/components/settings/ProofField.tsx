"use client";

import { useEffect, useId, useState } from "react";
import { API_ENDPOINTS, API_URL, safeJson } from "../../utils/api";
import GoogleButton from "../auth/GoogleButton";
import type { AccountSecurity } from "../../tournaments/types";
import { formStyles } from "../profile/formStyles";
import { errorText, send } from "./account";

export interface Proof {
  currentPassword?: string;
  code?: string;
  googleCredential?: string;
}

/**
 * The confirmation a sensitive change needs, in whichever form the server asks
 * for: the emailed code when this site can send mail (with a Send button and a
 * cool-down), otherwise the current password. The parent sends `value` along
 * with its own fields.
 */
export default function ProofField({
  security,
  value,
  onChange,
}: {
  security: AccountSecurity;
  value: Proof;
  onChange: (p: Proof) => void;
}) {
  const id = useId();
  const [viaGoogle, setViaGoogle] = useState(security.proof === "google");
  const [clientId, setClientId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  // Google's button needs this deployment's Client ID, as the sign-in page does.
  useEffect(() => {
    if (!security.canUseGoogle) return;
    fetch(`${API_URL}${API_ENDPOINTS.AUTH.PROVIDERS}`, { credentials: "include" })
      .then(safeJson)
      .then((p) => { if (p?.google?.enabled && p.google.clientId) setClientId(p.google.clientId); })
      .catch(() => {});
  }, [security.canUseGoogle]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const swap = security.canUseGoogle && security.proof !== "google" && (
    <button
      type="button"
      onClick={() => { setViaGoogle((v) => !v); onChange({}); }}
      className="self-start text-xs text-primary underline underline-offset-2"
    >
      {viaGoogle ? `Use ${security.proof === "code" ? "an emailed code" : "my password"} instead` : "Confirm with Google instead"}
    </button>
  );

  if (viaGoogle || security.proof === "google") {
    return (
      <div className="flex flex-col gap-2">
        <span className={formStyles.label}>Confirm with Google</span>
        {value.googleCredential ? (
          <p className={formStyles.ok} role="status">Google confirmed. Finish below.</p>
        ) : clientId ? (
          <div className="w-full sm:w-[300px]">
            <GoogleButton clientId={clientId} onCredential={(credential) => onChange({ googleCredential: credential })} text="continue_with" />
          </div>
        ) : (
          <p className={formStyles.help}>Loading Google…</p>
        )}
        <p className={formStyles.help}>Sign in with the Google account connected here, to prove it is you.</p>
        {swap}
      </div>
    );
  }

  if (security.proof === "none") {
    return (
      <p className={`${formStyles.error} border border-[#FF4D4D]/40 px-3 py-2.5`}>
        This account has no password and this site cannot send email, so changes like this cannot be confirmed. Ask an
        admin.
      </p>
    );
  }

  if (security.proof === "password") {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className={formStyles.label}>
          Current password
        </label>
        <input
          id={id}
          type="password"
          autoComplete="current-password"
          value={value.currentPassword ?? ""}
          onChange={(e) => onChange({ currentPassword: e.target.value })}
          className={formStyles.input}
        />
        <p className={formStyles.help}>To make sure it is you.</p>
        {swap}
      </div>
    );
  }

  const sendCode = async () => {
    setSending(true);
    setError(null);
    const { ok, data } = await send(API_ENDPOINTS.AUTH.ME_CODE);
    setSending(false);
    const d = (data ?? {}) as { sent?: boolean; to?: string; retryAfterSeconds?: number; error?: string };
    if (ok && d.sent) {
      setSentTo(d.to ?? security.maskedEmail);
      setWait(60);
    } else if (d.retryAfterSeconds) {
      setWait(d.retryAfterSeconds);
      setSentTo(d.to ?? security.maskedEmail);
    } else {
      setError(d.error || errorText(data, "Could not send the code."));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={formStyles.label}>
        Code from your email
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 digits"
          value={value.code ?? ""}
          onChange={(e) => onChange({ code: e.target.value.replace(/\D/g, "").slice(0, 6) })}
          className={`${formStyles.input} tracking-[0.3em] font-mono`}
        />
        <button type="button" onClick={sendCode} disabled={sending || wait > 0} className={`shrink-0 ${formStyles.btnSecondary}`}>
          {sending ? "Sending…" : wait > 0 ? `Resend in ${wait}s` : sentTo ? "Resend" : "Send code"}
        </button>
      </div>
      <p className={error ? formStyles.error : formStyles.help} role={error ? "alert" : undefined}>
        {error ?? (sentTo ? `Sent to ${sentTo}. It expires in 15 minutes.` : `We email a code to ${security.maskedEmail}.`)}
      </p>
      {swap}
    </div>
  );
}

/** True when `p` carries what `security.proof` asks for. */
export function proofReady(security: AccountSecurity, p: Proof): boolean {
  if (p.googleCredential) return security.canUseGoogle;
  if (security.proof === "code") return /^\d{6}$/.test(p.code ?? "");
  if (security.proof === "password") return !!p.currentPassword;
  return false;
}
