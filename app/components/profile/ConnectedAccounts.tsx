"use client";

import { useEffect, useState } from "react";
import { API_ENDPOINTS, API_URL, authenticatedFetch, safeJson } from "../../utils/api";
import GoogleButton from "../auth/GoogleButton";

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
}

export default function ConnectedAccounts({ googleLinked, hasPassword, onChanged }: Props) {
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

  return (
    <div className="space-y-6">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/20 flex items-center gap-3">
        <div className="w-2 h-2 bg-primary" />
        CONNECTED ACCOUNTS
      </div>
      <div className="bg-component-background border border-component-border p-6 md:p-8 space-y-5">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-white">Google</p>
            <p className="text-[10px] text-white/40 mt-1">
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
              className="px-6 py-2.5 border border-[#FF4D4D]/40 text-[#FF4D4D] text-[10px] font-black uppercase tracking-widest hover:bg-[#FF4D4D] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#FF4D4D] transition-all"
            >
              {busy ? "Working..." : "Disconnect"}
            </button>
          ) : clientId ? (
            <div className="w-full sm:w-[300px]">
              <GoogleButton clientId={clientId} onCredential={connect} text="continue_with" />
            </div>
          ) : null}
        </div>
        {googleLinked && !hasPassword && (
          <p className="text-[10px] text-white/30">
            This account has no password, so Google is its only way in and cannot be disconnected until one is set.
          </p>
        )}
        {message && <p className={`text-xs ${message.ok ? "text-primary" : "text-[#FF4D4D]"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
