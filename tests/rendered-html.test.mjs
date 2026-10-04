import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { defaultTargets, modelNames } from "../app/lib/racquet-catalogue.js";

test("ships the finished Baseline tracker and its price API", async () => {
  const [page, ui, coach, styles, route, layout, hosting, monitor, relay, release] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/BaselineApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/BaselineCoach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/truenas-registry-release.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(page, /BaselineApp/);
  assert.match(ui, /Wait for the/);
  assert.match(route, /Wilson Blade 98/);
  assert.ok(Object.values(modelNames).includes("Wilson Blade 98 16x19 v8"));
  assert.match(route, /shortlist_slots/);
  assert.match(route, /shortlistSlotCount = 6/);
  assert.ok(Object.values(modelNames).includes("Head Speed Pro 2026"));
  assert.match(ui, /YOUR TOP FRAMES/);
  assert.match(ui, /Top-rated & available/);
  assert.match(ui, /Six frames/);
  assert.match(ui, /BEST PRICE FINDER/);
  assert.match(ui, /Best opportunity right now/);
  assert.match(ui, /View deal/);
  assert.match(ui, /modelImages/);
  assert.match(ui, /racquets\/optimized-v1\/blade-v8\.webp/);
  assert.match(ui, /model-thumbnail/);
  const racquetImages = [...ui.matchAll(/"\/racquets\/([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(racquetImages).size, 30);
  await Promise.all(racquetImages.map((filename) => access(new URL(`../public/racquets/${filename.split("?")[0]}`, import.meta.url))));
  assert.match(route, /collections\/tennis-racquets/);
  assert.match(route, /price_history/);
  assert.match(route, /isGripThree/);
  assert.match(route, /saleOffers/);
  assert.match(route, /retailer_settings/);
  assert.match(route, /brand_featured_slots/);
  assert.match(route, /featuredSlotCount = 6/);
  assert.match(ui, /FEATURED BY BRAND/);
  assert.match(ui, /Choose the six main racquets/);
  assert.match(ui, /6 featured frames/);
  assert.match(ui, /replaceFeaturedFrame/);
  assert.match(ui, /const maxCompareFrames = 6/);
  assert.match(ui, /compareKeys\.length\}\/\{maxCompareFrames\} selected/);
  assert.match(ui, /Stiffness \/ flex/);
  assert.match(ui, /Notable player \(endorsed line\)/);
  assert.match(ui, /publishedStiffness/);
  assert.match(ui, /notablePlayerFor/);
  assert.match(ui, /Name: A to Z/);
  assert.match(ui, /Stiffness: softest to firmest/);
  assert.match(ui, /Most widely stocked/);
  assert.match(ui, /Style: bold & distinctive/);
  assert.match(ui, /Style cues use the verified colour/);
  assert.match(ui, /Tour presence: most represented/);
  assert.match(ui, /Biggest current discount/);
  assert.match(ui, /catalogueMetrics/);
  assert.match(ui, /Comparable unit-sales totals are not publicly reported/);
  assert.match(monitor, /stiffnessMatch/);
  assert.match(monitor, /manufacturerSpecAuditVersion = 5/);
  assert.match(monitor, /BASELINE_FORCE_MODEL_AUDIT/);
  assert.match(relay, /action.*models/);
  assert.match(relay, /modelRefreshState/);
  assert.match(route, /action.*models/);
  assert.match(ui, /Fetch new models/);
  assert.match(ui, /refreshSelectedModel/);
  assert.match(ui, /Refreshing specs &amp; photo/);
  assert.match(ui, /racquet-photo-pending\.svg/);
  assert.match(ui, /image-preview-backdrop/);
  assert.match(ui, /Baseline analytics/);
  assert.match(ui, /api\/analytics/);
  assert.match(relay, /handleAnalytics/);
  assert.match(relay, /analyticsFile/);
  assert.match(relay, /isPublicPreviewRequest/);
  assert.match(relay, /baseline-beta\.besada\.net/);
  assert.match(ui, /Aggregate counts only/);
  assert.match(relay, /runSelectedModelRefresh/);
  assert.match(relay, /modelSelectionRefreshes/);
  assert.match(monitor, /BASELINE_TARGET_MODEL_KEY/);
  assert.match(monitor, /retailerSources/);
  assert.match(ui, /Checking official manufacturer catalogues/);
  assert.match(styles, /font-size: clamp\(18px/);
  assert.match(monitor, /officialImageUrl/);
  assert.match(ui, /isManufacturerSpec/);
  assert.match(ui, /resolvedRacquetSpecs\[modelKey\][?][.]imageUrl/);
  assert.match(ui, /alphabeticalBrandList/);
  assert.match(styles, /select option, select optgroup/);
  assert.match(styles, /font-size: \.875rem !important/);
  assert.match(styles, /color-scheme: dark/);
  assert.match(styles, /select \{ min-height: 48px; font-size: 1rem !important; \}/);
  assert.match(ui, /sortedModelOptions/);
  assert.match(ui, /sortedRetailers/);
  assert.match(styles, /--paper: #10171b/);
  assert.match(styles, /\.opportunity-panel \{ background: rgba\(23,35,41,.97\)/);
  assert.match(styles, /\.opportunity-court \{ min-height: 452px; \}/);
  assert.match(styles, /bottom: 88px/);
  assert.match(styles, /\.market-tabs button\.active, \.check-button, \.target-row form button, \.alert-toggle\.on/);
  assert.match(route, /HiSports/);
  assert.match(route, /racquetguys[.]ca\/collections\/adult-tennis-racquets\/products[.]json/);
  assert.match(route, /racquetguys[.]ca\/collections\/used-tennis-racquets\/products[.]json/);
  assert.match(route, /tenniscentral[.]ca\/collections\/racquets\/products[.]json/);
  assert.match(route, /tennisgiant[.]com\/collections\/all-racquets\/products[.]json/);
  assert.match(route, /tenniszon[.]com\/collections\/racquet-sale\/products[.]json/);
  assert.match(route, /racketsandrunners[.]ca\/collections\/adult-tennis-rackets\/products[.]json/);
  assert.match(route, /const productName = `\$\{product[.]vendor/);
  assert.match(route, /\(\?:l\|g\|grip/);
  assert.match(monitor, /fetchShopifyCatalogs/);
  assert.match(monitor, /new Map\(catalogues[.]flat\(\)[.]map/);
  assert.match(monitor, /for \(let page = 1; page <= 4; page \+= 1\)/);
  assert.match(ui, /resolvedRacquetSpecs\[modelKey\][.]stiffness/);
  assert.match(route, /Sports Virtuoso/);
  assert.match(route, /Racquet Science/);
  assert.match(route, /TennisNetPro/);
  assert.match(route, /Max Sports/);
  assert.match(route, /Babolat Canada/);
  assert.match(route, /Premier Racquet Store/);
  assert.match(route, /Racquet Network/);
  assert.match(route, /HEAD Canada/);
  assert.match(route, /Tennis ProSport/);
  assert.match(route, /TennisTek/);
  assert.match(route, /ORC Pro Shop/);
  assert.match(route, /T1 Sports/);
  assert.match(route, /JJ Sports Specialist/);
  assert.match(route, /Courtside Sports/);
  assert.match(route, /Sports Experts/);
  assert.match(route, /Walmart Canada/);
  assert.match(route, /Source for Sports/);
  assert.match(route, /SVP Sports/);
  assert.match(route, /Aforza Pro Shop/);
  assert.match(route, /The Sweet Spot/);
  assert.match(route, /prod-card__img-link/);
  assert.match(monitor, /prod-card__img-link/);
  assert.match(ui, /Store directory · no reliable public grip feed/);
  assert.match(route, /used_targets/);
  assert.match(route, /fetchWooCommerce/);
  assert.match(ui, /Used market/);
  assert.match(ui, /Kijiji Canada/);
  assert.match(ui, /eBay Canada/);
  assert.match(ui, /Facebook Marketplace/);
  assert.match(ui, /SidelineSwap/);
  assert.match(ui, /MARKETPLACE CONNECTIONS/);
  assert.match(ui, /Open a live search/);
  assert.match(ui, /NARROW THE BOARD/);
  assert.match(ui, /Fresh today/);
  assert.match(ui, /Lowest live price/);
  assert.match(ui, /Aim to pay under/);
  assert.match(ui, /Verified live listings/);
  assert.match(ui, /Browse every retailer/);
  assert.match(ui, /uniqueRetailerOffers/);
  assert.match(ui, /BEST PRICE FINDER/);
  assert.match(ui, /Best deal/);
  assert.match(ui, /Most stocked/);
  assert.match(ui, /Most played/);
  assert.match(ui, /reported tour players/);
  assert.match(ui, /ranked by price/);
  assert.match(ui, /String pattern/);
  assert.match(ui, /16 × 19 · open/);
  assert.match(styles, /\.pattern-open/);
  assert.match(styles, /\.pattern-dense/);
  assert.match(ui, /VERY OPEN/);
  assert.match(ui, /PARTIAL SCAN/);
  assert.match(ui, /baseline-public-preferences-v1/);
  assert.match(ui, /Public beta/);
  assert.match(ui, /They are saved only in this browser/);
  assert.match(route, /baseline-beta[.]besada[.]net/);
  assert.match(route, /This action is available in the protected Baseline admin app/);
  assert.match(ui, /LAST VERIFIED PRICE/);
  assert.match(ui, /renderSourceHealth/);
  assert.match(styles, /\.source-health/);
  assert.match(monitor, /resilientFetch/);
  assert.match(monitor, /settleInPool/);
  assert.match(monitor, /staleFallback/);
  assert.match(monitor, /sourceHealth/);
  assert.match(monitor, /configuredSourceResults/);
  assert.match(relay, /sourceState/);
  assert.match(relay, /baseline-settings[.]json/);
  assert.match(relay, /applyPersistentSettings/);
  assert.match(relay, /writePersistentSettings/);
  assert.match(release, /backupLiveSettings/);
  assert.match(release, /direct-data\/baseline-settings[.]json/);
  assert.match(relay, /sourceHealth/);
  assert.match(ui, /All racquets/);
  assert.match(ui, /Racquet guide/);
  assert.match(ui, /String guide/);
  assert.match(ui, /What racquet numbers feel like on court/);
  assert.match(ui, /Specifications describe tendencies/);
  assert.match(ui, /STRING TRANSLATOR/);
  assert.match(ui, /What to put in the frame/);
  assert.match(ui, /Polyester \/ monofilament/);
  assert.match(ui, /When to restring/);
  assert.match(ui, /Advanced string lab/);
  assert.match(ui, /LIVE CANADIAN EXAMPLES/);
  assert.match(ui, /stringGuideExamples/);
  assert.match(ui, /Your Local ATP\/WTA Tour Stringer/);
  assert.match(ui, /gaostringinglab\.com/);
  assert.match(ui, /Special editions/);
  assert.match(ui, /Special editions in every available grip/);
  assert.match(ui, /type GripSize = "L0" \| "L1" \| "L2" \| "L3" \| "L4" \| "L5"/);
  assert.match(ui, /\{ key: "L0", inches: "4 in" \}/);
  assert.match(ui, /className="top-grip-select"/);
  assert.match(ui, /availableHeadSizes\.map/);
  assert.doesNotMatch(ui, /<option value="97">97 in²<\/option>/);
  assert.match(ui, /\["all", \.\.\.brandList, "catalogue", "special", "strings", "balls", "accessories", "guide", "string-guide"\]/);
  assert.match(ui, /Tennis strings/);
  assert.match(ui, /Find the right feel, type, and gauge/);
  assert.match(ui, /stringGroupsByType/);
  assert.match(ui, /Construction type/);
  assert.match(ui, /All brands/);
  assert.match(ui, /availableStringBrands/);
  assert.match(ui, /All gauges/);
  assert.match(ui, /Package format/);
  assert.match(ui, /All formats/);
  assert.match(ui, /Half set/);
  assert.match(ui, /Tennis balls/);
  assert.match(ui, /The right ball for every court/);
  assert.match(monitor, /ballSourceResults/);
  assert.match(relay, /dashboard\.ballOffers/);
  assert.match(route, /ballOffers: \[\]/);
  assert.match(ui, /Compare \{group\.offers\.length\}/);
  assert.match(monitor, /const stringFeeds =/);
  assert.match(monitor, /fetchStringStore/);
  assert.match(monitor, /stringSourceResults/);
  assert.match(relay, /dashboard\.stringOffers/);
  assert.match(route, /stringOffers: \[\]/);
  assert.match(styles, /\.string-market-summary/);
  assert.match(styles, /\.string-grid/);
  assert.match(ui, /Accessories/);
  assert.match(ui, /Everything around the frame, in one place/);
  assert.match(ui, /accessoryGroupsByCategory/);
  assert.match(ui, /All accessory types/);
  assert.match(ui, /availableAccessoryBrands/);
  assert.match(ui, /Biggest savings/);
  assert.match(monitor, /const accessoryFeeds =/);
  assert.match(monitor, /fetchAccessoryStore/);
  assert.match(monitor, /accessorySourceResults/);
  assert.match(relay, /dashboard\.accessoryOffers/);
  assert.match(route, /accessoryOffers: \[\]/);
  assert.match(styles, /\.accessory-market-summary/);
  assert.match(styles, /\.accessory-grid/);
  assert.match(ui, /specialGripLabels/);
  assert.match(ui, /specialEditionGroups/);
  assert.match(ui, /specialEditionModelKey/);
  assert.match(ui, /UNIQUE RACQUETS/);
  assert.match(ui, /Compare \{group\.offers\.length\} retailer/);
  assert.match(monitor, /amazonSpecialEditionSearches/);
  assert.match(monitor, /specialOffers/);
  assert.match(monitor, /offerGripSizes/);
  assert.match(relay, /dashboard\.specialOffers/);
  assert.match(relay, /gzipSync/);
  assert.match(relay, /content-encoding/);
  assert.match(relay, /optimized-v\\d\+/);
  assert.match(relay, /max-age=31536000, immutable/);
  assert.match(ui, /activeBrand === "catalogue" && renderCatalogueControls/);
  assert.match(ui, /const cataloguePageSize = 24/);
  assert.match(ui, /Show 24 more/);
  assert.doesNotMatch(ui, /CATALOGUE VIEW/);
  assert.match(ui, /Open tracker settings/);
  assert.match(ui, /BaselineCoach/);
  assert.match(ui, /compareCoachPicks/);
  assert.match(coach, /Baseline Coach/);
  assert.match(coach, /What are we choosing today/);
  assert.match(coach, /A complete setup/);
  assert.match(coach, /recommendModels/);
  assert.match(coach, /recommendStrings/);
  assert.match(coach, /baseline-coach-profile-v2/);
  assert.match(coach, /How much string do you need/);
  assert.match(coach, /How should it feel off-court/);
  assert.match(coach, /Style only influences the list/);
  assert.match(coach, /coach-fit-tags/);
  assert.match(coach, /coach-recommender/);
  assert.match(styles, /\.coach-answer-summary/);
  assert.match(styles, /\.coach-fit-tags/);
  assert.match(styles, /\.coach-message p \{[^}]*font-size: \.88rem/);
  assert.match(styles, /\.coach-pick p \{[^}]*font-size: \.74rem/);
  assert.match(coach, /Compare these \{modelPicks\.length\} racquets/);
  assert.match(styles, /\.coach-launch/);
  assert.match(styles, /\.coach-panel/);
  assert.match(layout, /og\.png/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(`${page}${ui}${layout}`, /codex-preview|SkeletonPreview/);
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});

test("ships an installable mobile experience with guarded native releases", async () => {
  const [ui, layout, manifest, serviceWorker, privacy, capacitor, androidBuild, androidManifest, mobilePackage] = await Promise.all([
    readFile(new URL("../app/ui/BaselineApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../android-wrapper/capacitor.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../android-wrapper/scripts/build-android.ps1", import.meta.url), "utf8"),
    readFile(new URL("../android-wrapper/android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
    readFile(new URL("../android-wrapper/package.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /manifest\.webmanifest/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /app-icon-maskable-512\.png/);
  assert.match(serviceWorker, /baseline-offline-v1/);
  assert.match(serviceWorker, /request\.mode !== "navigate"/);
  assert.match(ui, /beforeinstallprompt/);
  assert.match(ui, /APP ON THIS DEVICE/);
  assert.match(ui, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(privacy, /public beta does not require an account/);
  assert.match(privacy, /stored locally on your device/);
  assert.match(capacitor, /BASELINE_BUILD === "production"/);
  assert.match(capacitor, /publicly reachable HTTPS host/);
  assert.match(androidBuild, /Android Studio\\jbr/);
  assert.match(androidManifest, /usesCleartextTraffic="false"/);
  assert.match(mobilePackage, /"@capacitor\/ios": "8\.4\.2"/);
  await Promise.all([
    access(new URL("../public/app-icon-192.png", import.meta.url)),
    access(new URL("../public/app-icon-512.png", import.meta.url)),
    access(new URL("../public/apple-touch-icon.png", import.meta.url)),
    access(new URL("../android-wrapper/ios/App/App.xcodeproj/project.pbxproj", import.meta.url)),
  ]);
});

test("recognizes the expanded current and legacy racquet catalogue", async () => {
  const [ui, route, monitor] = await Promise.all([
    readFile(new URL("../app/ui/BaselineApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8"),
  ]);

  const { classify } = await import("../app/lib/catalog-matching.js");

  const examples = new Map([
    ["Wilson Defyer 98 Pro V1 Tennis Racquet (2026)", "defyer-98-pro-v1"],
    ["Wilson Defyer 100 v1 Tennis Racquet", "defyer-100-v1"],
    ["Wilson Defyer 100L V1", "defyer-100l-v1"],
    ["Wilson Defyer 100UL V1", "defyer-100ul-v1"],
    ["Wilson Blade 98 Pro v10 16x19", "blade-pro-98-v10"],
    ["Wilson Blade 98 Pro 18x20 v10", "blade-pro-98-18x20-v10"],
    ["Wilson Blade 100 Pro v10", "blade-pro-100-v10"],
    ["Wilson Blade 98 18x20 v10", "blade-98-18x20-v10"],
    ["Wilson Blade 98 18/20 V10 WR207911U3", "blade-98-18x20-v10"],
    ["Wilson Blade 98 16/19 V10 WR207811U3", "blade-v10"],
    ["Wilson Blade 98 18x20 V9 WR149911L3", "blade-98-18x20-v9"],
    ["Wilson Blade 98 18x20 V8 WR078811L3", "blade-98-18x20-v8"],
    ["Babolat Pure Strike 98 16/19 101577", "pure-strike-98"],
    ["Babolat Pure Strike 98 18/20 101578", "pure-strike-98-18x20"],
    ["Babolat Pure Strike 97 101574", "pure-strike-97"],
    ["Babolat Pure Strike 100 16/20 101576", "pure-strike-100-16x20"],
    ["Babolat Pure Strike 100 16/19 101579", "pure-strike-100"],
    ["Tecnifibre TF40 305 16M V3 14TF44056", "tf40-305"],
    ["Tecnifibre TF40 305 18M V3 14TF44058", "tf40-305-18x20"],
    ["Wilson Blade 100L v10", "blade-100l-v10"],
    ["Wilson Blade 100UL v10", "blade-100ul-v10"],
    ["Wilson Blade 104 v10", "blade-104-v10"],
    ["Wilson Blade 98 v7", "blade-v7"],
    ["Wilson Blade 100 v9", "blade-100-v9"],
    ["Wilson Clash 100 Pro v3", "clash-100-pro"],
    ["Wilson Clash 100L V3", "clash-100l-v3"],
    ["Wilson Clash 100UL V3", "clash-100ul-v3"],
    ["Wilson Clash 108 V3", "clash-108-v3"],
    ["Wilson Clash 100 Pro V2", "clash-100-pro-v2"],
    ["Wilson Clash 100 V2", "clash-100-v2"],
    ["Wilson Clash 100L V2", "clash-100l-v2"],
    ["Wilson Clash 98 v2", "clash-98-v2"],
    ["Wilson Clash 100UL V2", "clash-100ul-v2"],
    ["Wilson Clash 108 V2", "clash-108-v2"],
    ["Wilson Clash 100 Tour", "clash-100-tour-v1"],
    ["Wilson Clash 100 V1", "clash-100-v1"],
    ["Wilson Clash 98 V1", "clash-98-v1"],
    ["Wilson Clash 100L V1", "clash-100l-v1"],
    ["Wilson Clash 100UL V1", "clash-100ul-v1"],
    ["Wilson Clash 108 V1", "clash-108-v1"],
    ["Wilson Ultra 100L V5 Tennis Racquet (2025)", "ultra-100l-v5"],
    ["Wilson Ultra 100UL V5 Tennis Racquet (2025)", "ultra-100ul-v5"],
    ["Wilson Ultra 111 V5 Tennis Racquet (2025)", "ultra-111-v5"],
    ["Wilson Pro Staff RF97 v13", "pro-staff-rf97-v13"],
    ["Wilson Pro Staff 97 Classic Tennis Racquet (2026)", "pro-staff-97-classic"],
    ["Wilson Pro Staff 97L Classic Tennis Racquet (2026)", "pro-staff-97l-classic"],
    ["Wilson Pro Staff Team Classic Tennis Racquet (2026)", "pro-staff-team-classic"],
    ["Yonex EZONE 98L 2025", "ezone-98l"],
    ["Yonex EZONE 98 Tour", "ezone-98-tour"],
    ["Yonex EZONE 98+", "ezone-98-plus"],
    ["Yonex EZONE 98 7th Gen 2022", "ezone-98-2022"],
    ["Yonex EZONE 100L 2025", "ezone-100l"],
    ["Yonex EZONE 100+ 2025", "ezone-100-plus"],
    ["Yonex EZONE 100 (2026)", "ezone-100"],
    ["Yonex EZONE 100SL 8th Gen", "ezone-100sl"],
    ["Yonex EZONE Alpha 8th Gen", "ezone-alpha"],
    ["Yonex VCORE 98L 2026", "vcore-98l"],
    ["Yonex VCORE 98+ 2026", "vcore-98-plus"],
    ["Yonex VCORE 98 Tour", "vcore-98-tour"],
    ["Yonex VCORE 98 7th Gen 2023", "vcore-98-2023"],
    ["Yonex VCORE 100L 2026", "vcore-100l"],
    ["Yonex VCORE 100+ 2026", "vcore-100-plus"],
    ["Yonex VCORE Alpha 8th Gen", "vcore-alpha"],
    ["Yonex VCORE ACE 8th Gen", "vcore-ace"],
    ["Yonex VCORE Play 8th Gen", "vcore-play"],
    ["Yonex Percept 97D", "percept-97d"],
    ["Yonex Percept 97H", "percept-97h"],
    ["Yonex VCORE Pro 97 2021", "vcore-pro-97-2021"],
    ["Yonex MUSE 100L Tennis Racquet", "muse-100l"],
    ["Yonex MUSE 100 SL Tennis Racquet", "muse-100sl"],
    ["Yonex MUSE 107 Tennis Racquet", "muse-107"],
    ["Babolat Pure Aero 2023", "pure-aero-2023"],
    ["Babolat Pure Aero Team Gen 9 Tennis Racquet (2026)", "pure-aero-team-2026"],
    ["Babolat Pure Aero Lite Gen 9 Tennis Racquet (2026)", "pure-aero-lite-2026"],
    ["Babolat Pure Aero Super Lite Gen9 Tennis Racquet (2026)", "pure-aero-super-lite-2026"],
    ["Babolat Pure Aero Rafa 2023", "pure-aero-rafa-2023"],
    ["Babolat Pure Aero VS", "pure-aero-vs"],
    ["Babolat AeroPro Drive", "aeropro-drive"],
    ["Babolat Pure Control Tour", "pure-control-tour"],
    ["Babolat Pure Drive 2021", "pure-drive-2021"],
    ["Babolat Pure Drive Wimbledon 2026", "pure-drive-100"],
    ["Babolat Pure Drive Team Gen 11 Tennis Racquet (2025)", "pure-drive-team-2025"],
    ["Babolat Pure Drive Lite Gen 11 Tennis Racquet (2025)", "pure-drive-lite-2025"],
    ["Babolat Pure Drive 107 Gen 11 Tennis Racquet (2025)", "pure-drive-107-2025"],
    ["Babolat Pure Strike 98 18x20", "pure-strike-98-18x20"],
    ["Babolat Boost Aero 2026", "boost-aero-2026"],
    ["Babolat Boost Strike 2026", "boost-strike-2026"],
    ["Babolat Boost Wimbledon 2026", "boost-wimbledon-2026"],
    ["Babolat Evo Aero Gen 2 Tennis Racquet", "evo-aero-gen2"],
    ["Babolat Evo Drive Gen2 2025", "evo-drive-gen2"],
    ["Head Speed MP 2024", "speed-mp-2024"],
    ["Head Speed MP L 2026", "speed-mp-l-2026"],
    ["Head Speed MP UL 2026", "speed-mp-ul-2026"],
    ["Head Speed Team 2026", "speed-team-2026"],
    ["Head Speed Elite 2026", "speed-elite-2026"],
    ["Head Speed Pro 2024", "speed-pro-2024"],
    ["Head Gravity Pro 2023", "gravity-pro-2023"],
    ["Head Gravity MP 2023", "gravity-mp-2023"],
    ["Head Gravity MP L 2025", "gravity-mp-l-2025"],
    ["Head Gravity Team 2025", "gravity-team-2025"],
    ["Head Radical MP 2023", "radical-mp-2023"],
    ["Head Radical Pro 2023", "radical-pro-2023"],
    ["Head Radical Team 2025", "radical-team-2025"],
    ["Head Radical Elite 2025", "radical-elite-2025"],
    ["Head Instinct PWR 110 2025", "instinct-pwr-110-2025"],
    ["Head Instinct PWR 115 2025", "instinct-pwr-115-2025"],
    ["Head Instinct Team L 2025", "instinct-team-l-2025"],
    ["Head IG Speed XCEED 2026", "ig-speed-xceed-2026"],
    ["Head IG Boom XCEED 2026", "ig-boom-xceed-2026"],
    ["Head IG Gravity XCEED 2026", "ig-gravity-xceed-2026"],
    ["Head IG Radical XCEED 2026", "ig-radical-xceed-2026"],
    ["Head Boom Pro 2022", "boom-pro-2022"],
    ["Head Boom MP 2022", "boom-mp-2022"],
    ["Head Prestige MP 2023", "prestige-mp-2023"],
    ["Head Extreme Tour 2022", "extreme-tour-2022"],
    ["Head Extreme MP XL 2026", "extreme-mp-xl-2026"],
    ["Head Extreme MP L 2026", "extreme-mp-l-2026"],
    ["Head Extreme MP UL 2026", "extreme-mp-ul-2026"],
    ["Head Extreme Team 2026", "extreme-team-2026"],
    ["Head Extreme Elite 2026", "extreme-elite-2026"],
    ["Head Boom MP L 2026", "boom-mp-l-2026"],
    ["Head Boom MP UL 2026", "boom-mp-ul-2026"],
    ["Head Boom Team Alternate 2026", "boom-team-2026"],
    ["Head Boom Elite 2026", "boom-elite-2026"],
    ["HEAD SQUARED 2026 Tennis Racquet", "squared-2026"],
    ["Tecnifibre TF40 315", "tf40-315"],
    ["Tecnifibre T-Fight 285", "tfight-285"],
    ["Tecnifibre T-Fight 300", "tfight-300"],
    ["Tecnifibre T-Fight ISO 305", "tfight-iso-305"],
    ["Tecnifibre TF-X1 v2 285", "tfx1-285"],
    ["Tecnifibre TF-X1 v2 305", "tfx1-305"],
    ["Tecnifibre Tempo 285", "tempo-285"],
    ["Tecnifibre FIRE 305S", "fire-305s"],
    ["Tecnifibre FIRE 300", "fire-300"],
    ["Tecnifibre FIRE 285", "fire-285"],
    ["Tecnifibre FIRE 270", "fire-270"],
    ["Dunlop CX 200 Tour 18x20", "dunlop-cx-200-tour-18x20"],
    ["Dunlop CX 200 Tour 16x19", "dunlop-cx-200-tour-16x19"],
    ["Dunlop CX 400 Tour", "dunlop-cx-400-tour"],
    ["Dunlop FX 500 Lite 2026", "dunlop-fx-500-lite-2026"],
    ["Prince Vortex 100 310g", "prince-vortex-100-310"],
    ["Prince ATS Textreme Tour 100P 305g", "prince-tour-100p-305"],
    ["Prince O3 RipStick 100 280g", "prince-o3-ripstick-100-280"],
    ["Volkl C10 EVO", "volkl-c10-evo"],
    ["Volkl V-Cell V1 MP", "volkl-vcell-v1-mp"],
    ["Volkl V-Cell 10 320g", "volkl-vcell-10-320"],
  ]);

  for (const [title, modelKey] of examples) {
    assert.equal(classify(title), modelKey, title);
    assert.ok(Object.hasOwn(modelNames, modelKey), `${modelKey} is in the shared catalogue`);
    assert.match(ui, new RegExp(`"${modelKey.replaceAll("-", "\\-")}"`));
  }

  assert.match(monitor, /Concept Edition/);
  assert.match(ui, /Concept Edition/);

  // Both the API and the monitor import this one catalogue, and every model has a target.
  assert.equal(Object.keys(modelNames).length, 201);
  assert.deepEqual(Object.keys(defaultTargets).sort(), Object.keys(modelNames).sort());
  for (const source of [route, monitor]) assert.match(source, /lib\/racquet-catalogue\.js"/);
  for (const field of ["strungWeight", "strungBalance", "swingweight", "composition", "tension", "productCode"]) {
    assert.match(ui, new RegExp(field));
    assert.match(monitor, new RegExp(field));
  }
  assert.match(ui, /filteredSpecialEditionGroups/);
  assert.match(ui, /Most retailer choices/);
  assert.match(ui, /retailer-corrected/);
});

test("extracts the full comparison specification set from retailer or manufacturer copy", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("function plainText");
  const end = monitor.indexOf("\nfunction manufacturerFor", start);
  const extractRacquetSpecs = Function(`${monitor.slice(start, end)}; return extractRacquetSpecs;`)();
  const specs = extractRacquetSpecs(`
    Head Size 100 sq. in. / 645 sq. cm. Length: 27 in.
    Strung Weight: 11.1 oz. / 317 g. Unstrung Weight: 10.6 oz. / 300 g.
    Strung Balance: 6 Pts. Head Light. Swingweight: 325. Flex: 66.
    Beam Width: 23.75 mm / 25 mm / 23 mm.
    Composition: Braided Graphite + Basalt. String Pattern: 16 Mains x 19 Crosses.
    Grip Size: 1 - 4. Recommended Strings: Luxilon ALU Power / Natural Gut.
    Recommended Stringing Tension: 50 - 60 lbs. Color: Forest Green. Made In: China. Product Code: WR215411
  `, "Wilson official", "https://wilson.example/frame");
  assert.equal(specs.head, "100 in²");
  assert.equal(specs.weight, "300 g");
  assert.equal(specs.strungWeight, "317 g");
  assert.match(specs.strungBalance, /Head Light/i);
  assert.equal(specs.swingweight, "325 kg·cm² · published");
  assert.equal(specs.stiffness, "66 RA");
  assert.equal(specs.beam, "23.75–25–23 mm");
  assert.equal(specs.composition, "Braided Graphite + Basalt.");
  assert.equal(specs.pattern, "16 × 19");
  assert.equal(specs.tension, "50–60 lbs");
  assert.equal(specs.productCode, "WR215411");
  assert.equal(specs.gripSizes, "1 - 4");
  assert.match(specs.recommendedStrings, /Luxilon ALU Power/);
  assert.equal(specs.color, "Forest Green");
  assert.equal(specs.madeIn, "China");
  const metricTension = extractRacquetSpecs("Head Size 98 sq. in. Unstrung Weight 305 g. String Pattern 18 x 20. Recommended tension 23 - 27 kg.", "Retailer", "https://retailer.example/frame");
  assert.equal(metricTension.tension, "51–60 lbs");
  const flexForce = extractRacquetSpecs("Head Size 100 sq. in. Unstrung Weight 300 g. Composition HM Graphite / 2G-Namd Flex Force / SERVO FILTER. String Pattern 16 x 19. Recommended tension 50 - 60 lbs.", "Yonex official", "https://yonex.example/percept");
  assert.equal(flexForce.stiffness, undefined);
});

test("cross-checks official specifications with distinct retailer catalogues", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("const crossCheckFields =");
  const end = monitor.indexOf("\nfor (const offer of offers)", start);
  const buildSpecValidation = Function(`const modelNames = { blade: "Blade" }; ${monitor.slice(start, end)}; return buildSpecValidation;`)();
  const offers = ["Store A", "Store B"].map((store) => ({
    modelKey: "blade", store, url: `https://${store.replace(" ", "").toLowerCase()}.example/blade`, sourceState: "fresh",
    specs: { head: "98 in²", weight: "305 g", pattern: "16 × 19", source: store },
  }));
  const result = buildSpecValidation(offers, { blade: { head: "98 in²", weight: "305 g", pattern: "16 × 19", source: "Wilson official" } });
  assert.equal(result.blade.status, "confirmed");
  assert.equal(result.blade.sources.length, 2);
  assert.equal(result.blade.confirmedFields, 3);
  assert.deepEqual(result.blade.fieldChecks.weight.retailers, ["Store A", "Store B"]);
});

test("does not confuse manufacturer model suffixes on family pages", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("function exactOfficialLabelIndex");
  const end = monitor.indexOf("\nfunction officialModelSection", start);
  const exactOfficialLabelIndex = Function(`${monitor.slice(start, end)}; return exactOfficialLabelIndex;`)();
  const page = "Yonex Percept 100D dense pattern. Yonex Percept 100 open pattern.";
  assert.equal(exactOfficialLabelIndex(page, "Yonex Percept 100"), page.lastIndexOf("Yonex Percept 100"));
});
