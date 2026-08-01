"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

/** Route-level error boundary.
 *
 *  Before this file existed there was no boundary anywhere in the app, so a
 *  single render throw — one malformed match, one unexpected null in a bracket —
 *  blanked the entire page with no message and no way out except a manual
 *  reload. This catches the segment instead, keeps the navigation shell intact,
 *  and offers a retry.
 *
 *  Next.js 16.2 passes `unstable_retry`, which re-fetches and re-renders the
 *  segment; that is the right recovery for the common cause here, a request
 *  that failed or returned something unexpected. `reset` only clears the error
 *  state without re-fetching, so it is the fallback for older behaviour. */
export default function Error({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    // No error-reporting service is wired up, so the console is the only record.
    // For errors thrown while server-rendering, `digest` is what matches this
    // against the server-side log — production replaces the message itself with
    // a generic string in that case.
    console.error("Route error boundary caught:", error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-8 px-6 py-20">
      <div className="flex w-full max-w-lg flex-col gap-6 border border-component-border bg-component-background p-8">
        <div className="flex flex-col gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary/60">
            Something went wrong
          </span>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            This page could not be displayed
          </h1>
        </div>

        <p className="text-sm leading-relaxed text-white/50">
          The page hit an unexpected error while rendering. Your data is not
          affected — nothing was saved or changed by this.
        </p>

        {/* Note this IS shown in production for client-component throws — Next
            only substitutes a generic string for errors forwarded from server
            components. Since nearly every page here is a client component, treat
            this as user-visible: it should stay a bare JS/React message and must
            never be given API payloads or identifiers to print. */}
        {error.message && (
          <p className="border-l-2 border-primary/30 pl-3 font-mono text-[11px] leading-relaxed break-words text-white/30">
            {error.message}
            {error.digest && (
              <span className="mt-1 block text-white/20">
                Reference: {error.digest}
              </span>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {retry && (
            <button
              type="button"
              onClick={() => retry()}
              className="bg-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-background transition-all hover:brightness-110"
            >
              Try again
            </button>
          )}
          <Link
            href="/"
            className="border border-white/15 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/60 transition-colors hover:border-primary hover:text-primary"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
