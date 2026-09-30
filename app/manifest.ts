import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Baseline Racquet Deals",
    short_name: "Baseline",
    description: "Canadian racquet and tennis-string prices, comparisons, alerts, and buying guidance.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1e8",
    theme_color: "#10251d",
    orientation: "portrait-primary",
    categories: ["shopping", "sports", "utilities"],
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Check prices", short_name: "Check", description: "Open the latest Canadian racquet prices", url: "/#top", icons: [{ src: "/app-icon-192.png", sizes: "192x192" }] },
      { name: "Used market", short_name: "Used", description: "Open verified used-racquet listings", url: "/?market=used#used-top", icons: [{ src: "/app-icon-192.png", sizes: "192x192" }] },
    ],
  };
}
