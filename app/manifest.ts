import type { MetadataRoute } from "next";

// Web app manifest (a Next.js metadata route, served at /manifest.webmanifest).
// This is what lets browsers offer "Install app" / "Add to Home Screen",
// so Hobby+ opens in its own window like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hobby+",
    short_name: "Hobby+",
    description: "Hobby Plus — tournaments and leaderboards for all hobbies",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#52B946",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        // "maskable" means the icon has extra padding so Android can
        // crop it into a circle or squircle without cutting the logo.
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
