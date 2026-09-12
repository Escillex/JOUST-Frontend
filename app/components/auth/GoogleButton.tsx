"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Google's own "Sign in with Google" button, rendered by Google Identity
 * Services. Loaded from Google's script tag rather than an npm package — the
 * button and its popup are Google's, which is what makes the credential it
 * returns trustworthy to verify.
 *
 * The Client ID is not hard-coded anywhere: it comes from Admin → Settings via
 * GET /auth/providers, so each deployment uses its own Google Cloud project.
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            ux_mode?: "popup" | "redirect";
          }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

const SRC = "https://accounts.google.com/gsi/client";
let loading: Promise<void> | null = null;

/** One script tag for the whole app, however many buttons mount. */
function loadScript(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.accounts?.id) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error("Could not load Google sign-in.")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

interface Props {
  clientId: string;
  onCredential: (credential: string) => void;
  text?: "signin_with" | "continue_with" | "signup_with";
}

export default function GoogleButton({ clientId, onCredential, text = "continue_with" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // The callback is captured by Google at initialize(); keep it current without
  // re-initializing on every render.
  const cb = useRef(onCredential);
  useEffect(() => { cb.current = onCredential; }, [onCredential]);

  useEffect(() => {
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !host.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => cb.current(r.credential),
          ux_mode: "popup",
        });
        host.current.innerHTML = "";
        window.google.accounts.id.renderButton(host.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          text,
          width: Math.min(host.current.offsetWidth || 360, 400),
        });
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [clientId, text]);

  if (failed) {
    // A blocked script (an ad blocker, a school network) must not look like a
    // silent missing button.
    return (
      <p className="text-[10px] text-white/40 uppercase tracking-widest text-center">
        Google sign-in could not load on this network.
      </p>
    );
  }
  return <div ref={host} className="w-full flex justify-center min-h-[44px]" />;
}
