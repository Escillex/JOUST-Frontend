"use client";

import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";
import type { AccountSecurity } from "../../tournaments/types";

/** The server's words for a refusal: `{code, message}` from AccountService,
 *  or class-validator's array of messages. */
export function errorText(data: unknown, fallback: string): string {
  const m = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(m)) return m.join(" ");
  return typeof m === "string" && m ? m : fallback;
}

export function errorCode(data: unknown): string | undefined {
  const c = (data as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : undefined;
}

/** POST/DELETE a JSON body to an account route; resolves to the parsed body and
 *  whether it succeeded. Network failures come back as `ok: false`. */
export async function send(url: string, body?: unknown, method = "POST") {
  const res = await authenticatedFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await safeJson(res);
  return { ok: res.ok, status: res.status, data };
}

/**
 * Everything Settings shows about signing in — which proof this account needs,
 * the masked address a code goes to, recovery codes left, remembered browsers.
 * One read, shared by every section on the page; `reload` after a change.
 */
export function useAccountSecurity(enabled: boolean) {
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    authenticatedFetch(API_ENDPOINTS.AUTH.ME_SECURITY)
      .then(async (res) => {
        const data = await safeJson(res);
        if (!alive) return;
        if (res.ok && data) {
          setSecurity(data as AccountSecurity);
          setFailed(false);
        } else {
          setFailed(true);
        }
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [enabled, tick]);

  return { security, failed, reload };
}

/** "Chrome on Windows" from a user-agent string — enough to recognise a
 *  browser in a list, not a fingerprint. */
export function describeBrowser(ua: string | null): string {
  if (!ua) return "Unknown browser";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "A browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
