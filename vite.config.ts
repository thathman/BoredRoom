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
        theme_color: "#12f7ff",
        background_color: "#080b1a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        shortcuts: [
          { name: "Host Ludo", short_name: "Host", url: "/ludo/host", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Join Game", short_name: "Join", url: "/ludo/join", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Naija Arcade", short_name: "Arcade", url: "/arcade", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }
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
        clientsClaim: true
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
