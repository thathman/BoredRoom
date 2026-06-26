import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { VitePWA } from "vite-plugin-pwa";

function resolveBuildHash(): string {
  if (process.env.VITE_BUILD_HASH) return process.env.VITE_BUILD_HASH;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

process.env.VITE_BUILD_HASH = resolveBuildHash();
// ponytail: read version from package.json so the chip tracks the beta scheme automatically
process.env.VITE_APP_VERSION = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-192-maskable.png",
        "icons/icon-512-maskable.png",
        "icons/apple-touch-icon.png"
      ],
      manifest: {
        id: "/",
        name: "BoredRoom",
        short_name: "BoredRoom",
        description: "Browser-based same-room multiplayer game platform.",
        theme_color: "#45f36b",
        background_color: "#020817",
        display: "standalone",
        // Prefer an immersive fullscreen shell when the platform supports it, falling back to
        // standalone, then minimal-ui, then the browser tab.
        display_override: ["fullscreen", "standalone", "minimal-ui"],
        orientation: "any",
        start_url: "/",
        scope: "/",
        shortcuts: [
          { name: "Host a game night", short_name: "Host", url: "/start", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Join a game night", short_name: "Join", url: "/join", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Games Library", short_name: "Games", url: "/games", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }
        ],
        screenshots: [
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", form_factor: "narrow" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", form_factor: "wide" }
        ],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icons/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/colyseus\.hendrix\.com\.ng\/games\/catalog/,
            handler: "NetworkFirst",
            options: {
              cacheName: "boredroom-game-catalog",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 1, maxAgeSeconds: 3600 }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
