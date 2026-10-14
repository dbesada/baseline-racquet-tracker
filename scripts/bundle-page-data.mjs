import { build } from "rolldown";

// Bundles cloudflare/page-data.ts (the site's own TypeScript spec and offer
// helpers) into plain JavaScript that the GitHub price check can run while
// building racquet pages. Usage: node scripts/bundle-page-data.mjs [out file]

export async function bundlePageData(file = "out/page-data.mjs") {
  await build({
    input: new URL("../cloudflare/page-data.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    platform: "node",
    logLevel: "warn",
    output: { file, format: "esm" },
  });
  return file;
}

if (process.argv[1]?.endsWith("bundle-page-data.mjs")) {
  console.log(`Bundled ${await bundlePageData(process.argv[2])}`);
}
