import { spawnSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { webManifest } from "../app/lib/web-manifest.js";

// Builds the site as plain files in dist/client for Cloudflare static assets
// (cloudflare/wrangler.jsonc). The tracker API route is server code that a
// static site cannot run (the Cloudflare Worker serves /api/* instead), so it
// is set aside during the build: Next-style routing ignores folders whose name
// starts with "_".

const apiDir = "app/api";
const parkedDir = "app/_api-static-build";
if (existsSync(parkedDir)) throw new Error(`${parkedDir} exists from an interrupted build; move it back to ${apiDir}.`);

renameSync(apiDir, parkedDir);
let result;
try {
  result = spawnSync(process.execPath, ["node_modules/vinext/dist/cli.js", "build"], {
    stdio: "inherit",
    env: { ...process.env, BASELINE_STATIC: "1" },
  });
} finally {
  renameSync(parkedDir, apiDir);
}

if (!existsSync("dist/client/index.html")) {
  console.error("Static build failed: dist/client/index.html was not written.");
  process.exit(result?.status || 1);
}
writeFileSync("dist/client/manifest.webmanifest", JSON.stringify(webManifest));
console.log("Static site written to dist/client");
