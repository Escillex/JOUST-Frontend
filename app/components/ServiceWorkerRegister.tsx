"use client";
import { useEffect } from "react";

// Registers the service worker (public/sw.js) that caches build files
// and images on the device for faster loads, and makes Hobby+
// installable as an app.
//
// It only runs in production builds: in development the cache would
// keep serving old code and make changes invisible, which is very
// confusing to debug.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    // updateViaCache: "none" makes the browser always check the server
    // for a newer sw.js, so caching-logic updates reach users quickly.
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Registration failing (old browser, private mode) is fine:
        // the app simply works without the extra caching.
      });
  }, []);

  return null;
}
