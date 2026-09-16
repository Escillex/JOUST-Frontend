"use client";

import { useEffect, useState } from "react";
import { API_ENDPOINTS, API_URL, authenticatedFetch, safeJson } from "../../utils/api";
import GoogleButton from "../auth/GoogleButton";
import ProfileSection, { Icons } from "./ProfileSection";
import { formStyles } from "./formStyles";

/**
 * Connecting Google to an existing account. This is where the sign-in page
 * sends someone whose email already has a password: Google sign-in will not
 * take over a password account by email, so the owner connects it from here,
 * signed in, where their identity is already proved.
 *
 * Hidden entirely when this deployment has not configured Google sign-in.
 */
interface Props {
  googleLinked: boolean;
  hasPassword: boolean;
  onChanged: () => void | Promise<void>;
  /** Just the Google row, for a card that already has its own heading
   *  (Settings → Sign-in and security). */
  bare?: boolean;
}

export default function ConnectedAccounts({ googleLinked, hasPassword, onChanged, bare = false }: Props) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}${API_ENDPOINTS.AUTH.PROVIDERS}`, { credentials: "include" })
      .then(safeJson)
      .then((p) => { if (p?.google?.enabled && p.google.clientId) setClientId(p.google.clientId); })
      .catch(() => {});
  }, []);

  if (!clientId && !googleLinked) return null;

  const connect = async (credential: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.GOOGLE_LINK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setMessage({ text: `Connected ${data?.email ?? "your Google account"}.`, ok: true });
        await onChanged();
      } else {
        setMessage({ text: data?.message || "Could not connect Google.", ok: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.GOOGLE_LINK, { method: "DELETE" });
      const data = await safeJson(res);
      if (res.ok) {
        setMessage({ text: "Google disconnected.", ok: true });
        await onChanged();
      } else {
        setMessage({ text: data?.message || "Could not disconnect Google.", ok: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const content = (
    <>
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-1">
            <p className={formStyles.label}>Google</p>
            <p className={formStyles.help}>
              {googleLinked
                ? "Connected — you can sign in with Google, and skip the emailed code when you do."
                : "Connect Google to sign in with it. Google does its own verification, so no emailed code is needed."}
            </p>
          </div>
          {googleLinked ? (
            <button
              onClick={disconnect}
              disabled={busy || !hasPassword}
              title={hasPassword ? undefined : "Set a password first"}
              className={formStyles.btnDanger}
            >
              {busy ? "Working…" : "Disconnect"}
            </button>
          ) : clientId ? (
            <div className="w-full sm:w-[300px]">
              <GoogleButton clientId={clientId} onCredential={connect} text="continue_with" />
            </div>
          ) : null}
        </div>
        {googleLinked && !hasPassword && (
          <p className={formStyles.help}>
            This account has no password, so Google is its only way in and cannot be disconnected until one is set.
          </p>
        )}
        {message && <p className={message.ok ? formStyles.ok : formStyles.error} role="status">{message.text}</p>}
    </>
  );

  if (bare) return <div className="flex flex-col gap-4 p-5 md:px-6">{content}</div>;

  return (
    <ProfileSection title="Connected accounts" icon={Icons.link}>
      <div className={`${formStyles.card} flex flex-col gap-4`}>{content}</div>
    </ProfileSection>
  );
}
