import type { NextConfig } from "next";

// BASELINE_STATIC=1 builds the site as plain files (for Cloudflare static
// assets); the NAS build keeps the server-rendered app.
const nextConfig: NextConfig = process.env.BASELINE_STATIC === "1" ? { output: "export" } : {};

export default nextConfig;
