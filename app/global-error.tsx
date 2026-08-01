"use client"; // Error boundaries must be Client Components

import "./globals.css";

/** Last-resort boundary for a crash in the root layout itself.
 *
 *  `error.tsx` wraps pages and nested layouts but explicitly does NOT wrap the
 *  root layout above it, so a throw in the layout — or in any of the providers
 *  it mounts — escapes every other boundary and leaves a blank document. This
 *  file replaces the root layout when that happens, which is why it has to
 *  supply its own <html> and <body>.
 *
 *  Styling is kept inline and minimal on purpose: if the failure was in the
 *  layout, its fonts and providers cannot be relied on. Metadata exports are
 *  not supported here, so the title is set with React's <title>. */
export default function GlobalError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  const retry = unstable_retry ?? reset;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1B1B1B",
          color: "#EDEDED",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <title>Hobby+ — Application error</title>
        <div style={{ maxWidth: "32rem", width: "100%" }}>
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.6rem",
              fontWeight: 900,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "#52B946",
            }}
          >
            Application error
          </p>
          <h1
            style={{
              margin: "0 0 1rem",
              fontSize: "1.5rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
            }}
          >
            The application could not start
          </h1>
          <p
            style={{
              margin: "0 0 1.5rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "rgba(237,237,237,0.55)",
            }}
          >
            Something failed before the page could load. Reloading usually
            resolves it. No tournament data was changed.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "0 0 1.5rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.7rem",
                color: "rgba(237,237,237,0.3)",
              }}
            >
              Reference: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {retry && (
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "0.7rem 1.5rem",
                  backgroundColor: "#52B946",
                  color: "#1B1B1B",
                  fontSize: "0.625rem",
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Try again
              </button>
            )}
            {/* Deliberately a plain anchor, not next/link. This boundary only
                renders when the root layout itself failed, so client-side
                navigation cannot be trusted — a full document load is the
                recovery, because it rebuilds the layout and providers from
                scratch. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "0.7rem 1.5rem",
                border: "1px solid rgba(237,237,237,0.15)",
                color: "rgba(237,237,237,0.6)",
                fontSize: "0.625rem",
                fontWeight: 900,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
