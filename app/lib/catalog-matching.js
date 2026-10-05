// Shared product matching for retailer listings.
//
// Used by the price monitor (scripts/check-prices.mjs), the only code that reads
// retailer pages. The tracker API (app/api/tracker/route.ts) used to keep its
// own copy of these rules and of the retailer readers; the copies drifted apart
// and production never ran the API's, so both were removed. Change matching
// rules here only.

const manufacturerModelCodes = new Map([
  ["WR207811", "blade-v10"], ["WR207911", "blade-98-18x20-v10"],
  ["WR149811", "blade-v9"], ["WR149911", "blade-98-18x20-v9"],
  ["WR078711", "blade-v8"], ["WR078811", "blade-98-18x20-v8"],
  ["101574", "pure-strike-97"], ["101576", "pure-strike-100-16x20"], ["101579", "pure-strike-100"],
  ["101577", "pure-strike-98"], ["101524", "pure-strike-98"], ["101406", "pure-strike-98"],
  ["101578", "pure-strike-98-18x20"], ["101526", "pure-strike-98-18x20"], ["101404", "pure-strike-98-18x20"],
  ["14TF44056", "tf40-305"], ["14TF43056", "tf40-305"],
  ["14TF44058", "tf40-305-18x20"], ["14TF43058", "tf40-305-18x20"],
]);

export function manufacturerModelKey(evidence) {
  const compact = String(evidence ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return [...manufacturerModelCodes].find(([code]) => compact.includes(code))?.[1] ?? null;
}

export function hasStringPattern(evidence, mains, crosses) {
  return new RegExp(`(?:^|[^0-9])${mains}\\s*(?:x|×|/|by)\\s*${crosses}(?:$|[^0-9])`, "i").test(String(evidence));
}

export function classify(title) {
  const codeMatch = manufacturerModelKey(title);
  if (codeMatch) return codeMatch;
  const raw = title.toLowerCase();
  const value = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\b(demo|used|grommet|junior|jr)\b/.test(value)) return null;
  if (/dunlop cx 200 tour/.test(value) && hasStringPattern(raw, 18, 20)) return "dunlop-cx-200-tour-18x20";
  if (/dunlop cx 200 tour/.test(value)) return "dunlop-cx-200-tour-16x19";
  if (/dunlop cx 400 tour/.test(value)) return "dunlop-cx-400-tour";
  if (/dunlop cx 400/.test(value)) return "dunlop-cx-400";
  if (/dunlop cx 200/.test(value)) return "dunlop-cx-200";
  if (/dunlop fx 500 lite/.test(value)) return "dunlop-fx-500-lite-2026";
  if (/prince vortex 100/.test(value) && /310\s*g/.test(value)) return "prince-vortex-100-310";
  if (/prince vortex 100/.test(value) && /300\s*g/.test(value)) return "prince-vortex-100-300";
  if (/prince.*(?:ats textreme )?tour 100p/.test(value)) return "prince-tour-100p-305";
  if (/prince.*(?:o3 )?ripstick 100/.test(value)) return "prince-o3-ripstick-100-280";
  if (/prince legacy 110/.test(value)) return "prince-legacy-110";
  if (/prince warrior 100/.test(value)) return "prince-warrior-100-265";
  if (/volkl c10 evo/.test(value)) return "volkl-c10-evo";
  if (/volkl v1 evo/.test(value)) return "volkl-v1-evo";
  if (/volkl v1 classic/.test(value)) return "volkl-v1-classic";
  if (/volkl v cell v1 mp/.test(value)) return "volkl-vcell-v1-mp";
  if (/volkl v cell 10/.test(value) && /320\s*g/.test(value)) return "volkl-vcell-10-320";
  if (/volkl v cell 10/.test(value) && /300\s*g/.test(value)) return "volkl-vcell-10-300";
  if (/defyer 98 pro\b/.test(value)) return "defyer-98-pro-v1";
  if (/defyer 100ul\b|defyer 100 ul\b/.test(value)) return "defyer-100ul-v1";
  if (/defyer 100l\b|defyer 100 l\b/.test(value)) return "defyer-100l-v1";
  if (/ultra 100ul\b.*\bv5\b|ultra 100 ul\b.*\bv5\b/.test(value)) return "ultra-100ul-v5";
  if (/ultra 100l\b.*\bv5\b|ultra 100 l\b.*\bv5\b/.test(value)) return "ultra-100l-v5";
  if (/ultra 111\b.*\bv5\b/.test(value)) return "ultra-111-v5";
  if (/blade/.test(value) && /(?:pro 98|98 pro)/.test(value) && hasStringPattern(raw, 18, 20) && /\bv10\b/.test(value)) return "blade-pro-98-18x20-v10";
  if (/blade 98\b/.test(value) && hasStringPattern(raw, 18, 20) && /\bv10\b/.test(value)) return "blade-98-18x20-v10";
  if (/blade 98\b/.test(value) && hasStringPattern(raw, 18, 20) && /\bv9\b/.test(value)) return "blade-98-18x20-v9";
  if (/blade 98\b/.test(value) && hasStringPattern(raw, 18, 20) && /\bv8\b/.test(value)) return "blade-98-18x20-v8";
  if (/blade 100ul\b.*\bv10\b|blade 100 ul\b.*\bv10\b/.test(value)) return "blade-100ul-v10";
  if (/blade 100l\b.*\bv10\b|blade 100 l\b.*\bv10\b/.test(value)) return "blade-100l-v10";
  if (/pro staff 97l classic\b/.test(value)) return "pro-staff-97l-classic";
  if (/pro staff 97 classic\b/.test(value)) return "pro-staff-97-classic";
  if (/pro staff team classic\b/.test(value)) return "pro-staff-team-classic";
  if (/ezone 98l\b|ezone 98 l\b/.test(value)) return "ezone-98l";
  if (/ezone 100l\b|ezone 100 l\b/.test(value)) return "ezone-100l";
  if (/ezone 100sl\b|ezone 100 sl\b/.test(value)) return "ezone-100sl";
  if (/ezone alpha\b/.test(value)) return "ezone-alpha";
  if (/vcore 98l\b|vcore 98 l\b/.test(value)) return "vcore-98l";
  if (/vcore 100l\b|vcore 100 l\b/.test(value)) return "vcore-100l";
  if (/vcore alpha\b/.test(value)) return "vcore-alpha";
  if (/vcore ace\b/.test(value)) return "vcore-ace";
  if (/vcore play\b/.test(value)) return "vcore-play";
  if (/pure drive team\b.*\b(?:2025|gen ?11)\b/.test(value)) return "pure-drive-team-2025";
  if (/pure drive lite\b.*\b(?:2025|gen ?11)\b/.test(value)) return "pure-drive-lite-2025";
  if (/pure drive 107\b.*\b(?:2025|gen ?11)\b/.test(value)) return "pure-drive-107-2025";
  if (/pure aero team\b.*\b(?:2026|gen ?9)\b/.test(value)) return "pure-aero-team-2026";
  if (/pure aero (?:s ?lite|super l(?:ite|ight))\b.*\b(?:2026|gen ?9)\b/.test(value)) return "pure-aero-super-lite-2026";
  if (/pure aero lite\b.*\b(?:2026|gen ?9)\b/.test(value)) return "pure-aero-lite-2026";
  if (/muse 100\s*l\b/.test(value)) return "muse-100l";
  if (/muse 100\s*(?:sl|s l|super light)\b/.test(value)) return "muse-100sl";
  if (/muse 107\b/.test(value)) return "muse-107";
  if (/speed mp ul\b.*\b2026\b/.test(value)) return "speed-mp-ul-2026";
  if (/speed mp l\b.*\b2026\b/.test(value)) return "speed-mp-l-2026";
  if (/speed team\b.*\b2026\b/.test(value)) return "speed-team-2026";
  if (/speed elite\b.*\b2026\b/.test(value)) return "speed-elite-2026";
  if (/ig speed xceed\b/.test(value)) return "ig-speed-xceed-2026";
  if (/ig boom xceed\b/.test(value)) return "ig-boom-xceed-2026";
  if (/ig gravity xceed\b/.test(value)) return "ig-gravity-xceed-2026";
  if (/ig radical xceed\b/.test(value)) return "ig-radical-xceed-2026";
  if (/gravity mp l\b.*\b2025\b/.test(value)) return "gravity-mp-l-2025";
  if (/gravity team\b.*\b2025\b/.test(value)) return "gravity-team-2025";
  if (/radical team\b.*\b2025\b/.test(value)) return "radical-team-2025";
  if (/radical elite\b.*\b2025\b/.test(value)) return "radical-elite-2025";
  if (/instinct pwr 110\b.*\b2025\b/.test(value)) return "instinct-pwr-110-2025";
  if (/instinct pwr 115\b.*\b2025\b/.test(value)) return "instinct-pwr-115-2025";
  if (/instinct team l\b.*\b2025\b/.test(value)) return "instinct-team-l-2025";
  if (/extreme mp xl\b.*\b2026\b/.test(value)) return "extreme-mp-xl-2026";
  if (/extreme mp ul\b.*\b2026\b/.test(value)) return "extreme-mp-ul-2026";
  if (/extreme mp l\b.*\b2026\b/.test(value)) return "extreme-mp-l-2026";
  if (/extreme team\b.*\b2026\b/.test(value)) return "extreme-team-2026";
  if (/extreme elite\b.*\b2026\b/.test(value)) return "extreme-elite-2026";
  if (/boom mp ul\b.*\b2026\b/.test(value)) return "boom-mp-ul-2026";
  if (/boom mp l\b.*\b2026\b/.test(value)) return "boom-mp-l-2026";
  if (/boom mp l neon\b/.test(value)) return "boom-mp-l-2026";
  if (/boom team\b.*\b2026\b/.test(value)) return "boom-team-2026";
  if (/boom elite\b/.test(value)) return "boom-elite-2026";
  if (/(?:head )?squared\b/.test(value)) return "squared-2026";
  if (/boost wimbledon\b.*\b2026\b/.test(value)) return "boost-wimbledon-2026";
  if (/boost aero\b/.test(value)) return "boost-aero-2026";
  if (/boost strike\b/.test(value)) return "boost-strike-2026";
  if (/evo aero\b.*\b(?:gen ?2|2026)\b/.test(value)) return "evo-aero-gen2";
  if (/evo drive\b.*\b(?:gen ?2|2025|2026)\b/.test(value)) return "evo-drive-gen2";
  if (/\bclash\b/.test(value) && /\b(?:x2|2 pack|two pack|bundle)\b/.test(value)) return null;
  if (/clash (?:100 )?pro\b.*\b(?:v ?3|2025)\b/.test(value) || /clash pro 100\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-100-pro";
  if (/clash 100 ?ul\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-100ul-v3";
  if (/clash 100 ?l\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-100l-v3";
  if (/clash 108\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-108-v3";
  if (/clash 100\b.*\b(?:v ?3|2025)\b/.test(value)) return "clash-100";
  if (/clash (?:100 )?pro\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-100-pro-v2";
  if (/clash 100 ?ul\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-100ul-v2";
  if (/clash 100 ?l\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-100l-v2";
  if (/clash 108\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-108-v2";
  if (/clash 98\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-98-v2";
  if (/clash 100\b.*\b(?:v ?2|2022)\b/.test(value)) return "clash-100-v2";
  if (/clash 100 tour\b/.test(value)) return "clash-100-tour-v1";
  if (/clash 100 ?ul\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-100ul-v1";
  if (/clash 100 ?l\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-100l-v1";
  if (/clash 108\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-108-v1";
  if (/clash 98\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-98-v1";
  if (/clash 100\b.*\b(?:v ?1|2019)\b/.test(value)) return "clash-100-v1";
  if (/\b(98l|100l|100 l|100ul|100 ul|100sl|100 sl|mp l|team|lite|x2|2 pack)\b/.test(value)) return null;
  if (/pure drive (?:107|110)\b/.test(value)) return null;
  if (/defyer 100\b/.test(value)) return "defyer-100-v1";
  if (/blade 100 pro\b.*\bv10\b|blade pro 100\b.*\bv10\b/.test(value)) return "blade-pro-100-v10";
  if (/blade 98 pro\b.*\bv10\b|blade pro 98\b.*\bv10\b/.test(value)) return "blade-pro-98-v10";
  if (/blade 100/.test(value) && /\bv10\b/.test(value)) return "blade-100-v10";
  if (/blade 104\b.*\bv10\b/.test(value)) return "blade-104-v10";
  if (/blade 100/.test(value) && /\bv9\b/.test(value)) return "blade-100-v9";
  if (/blade 98/.test(value) && /\bv10\b/.test(value)) return "blade-v10";
  if (/blade 98/.test(value) && /\bv9\b/.test(value)) return "blade-v9";
  if (/blade 98/.test(value) && /\bv8\b/.test(value)) return "blade-v8";
  if (/blade 98/.test(value) && /\bv7\b/.test(value)) return "blade-v7";
  if (/ultra 99 pro\b.*\bv5\b/.test(value)) return "ultra-99-pro-v5";
  if (/ultra 100\b.*\bv5\b/.test(value)) return "ultra-100-v5";
  if (/pro staff x\b/.test(value)) return "pro-staff-x";
  if (/pro staff rf ?97\b.*\bv13\b|rf ?97\b.*\bv13\b/.test(value)) return "pro-staff-rf97-v13";
  if (/rf 01 pro\b/.test(value)) return "rf-01-pro";
  if (/rf 01\b/.test(value)) return "rf-01";
  if (/shift 99\b/.test(value)) return "shift-99";
  if (/ezone 98\b.*\b(?:7th gen|2022)\b|07ezone 98\b/.test(value)) return "ezone-98-2022";
  if (/ezone 98 tour\b/.test(value)) return "ezone-98-tour";
  if (/ezone 98\s*(?:plus|\+)/.test(raw) || /ezone 98 plus\b/.test(value)) return "ezone-98-plus";
  if (/ezone 98\b/.test(value)) return "ezone-98";
  if (/ezone 105\b/.test(value)) return "ezone-105";
  if (/ezone 100\s*(?:plus|\+)/.test(raw) || /ezone 100 plus\b/.test(value)) return "ezone-100-plus";
  if (/ezone 100\b.*\b(?:8th gen|2025|2026|blast blue)\b/.test(value)) return "ezone-100";
  if (/vcore 98\b.*\b(?:7th gen|2023)\b|07vcore 98\b/.test(value)) return "vcore-98-2023";
  if (/vcore 98 tour\b/.test(value)) return "vcore-98-tour";
  if (/vcore 98\s*(?:plus|\+)/.test(raw) || /vcore 98 plus\b/.test(value)) return "vcore-98-plus";
  if (/vcore 95\b/.test(value)) return "vcore-95";
  if (/vcore 100d\b|vcore 100 d\b/.test(value)) return "vcore-100d";
  if (/vcore 100\s*(?:plus|\+)/.test(raw) || /vcore 100 plus\b/.test(value)) return "vcore-100-plus";
  if (/percept 97d\b|percept 97 d\b/.test(value)) return "percept-97d";
  if (/percept 97h\b|percept 97 h\b/.test(value)) return "percept-97h";
  if (/percept 100d\b|percept 100 d\b/.test(value)) return "percept-100d";
  if (/percept 100\b/.test(value)) return "percept-100";
  if (/vcore pro 97\b.*\b(?:2021|v ?3)\b/.test(value)) return "vcore-pro-97-2021";
  if (/muse 98\b/.test(value)) return "muse-98";
  if (/muse 100\s*l\b/.test(value)) return "muse-100l";
  if (/muse 100\s*(?:sl|s l|super light)\b/.test(value)) return "muse-100sl";
  if (/muse 107\b/.test(value)) return "muse-107";
  if (/muse 100\b/.test(value)) return "muse-100";
  if (/aeropro drive\b|aero pro drive\b/.test(value)) return "aeropro-drive";
  if (/pure control tour\b/.test(value)) return "pure-control-tour";
  if (/pure aero rafa origin\b/.test(value)) return "pure-aero-rafa-origin";
  if (/pure aero rafa\b.*\b(?:2023|6th gen)\b/.test(value)) return "pure-aero-rafa-2023";
  if (/pure aero vs\b/.test(value)) return "pure-aero-vs";
  if (/pure aero(?: 100)? (?:plus\b|\+)/.test(raw) || /pure aero plus\b/.test(value)) return "pure-aero-plus";
  if (/pure aero 98\b/.test(value)) return "pure-aero-98";
  if (/pure aero (?:s ?lite|super l(?:ite|ight))\b.*\b(?:2026|gen ?9|9th generation)\b/.test(value)) return "pure-aero-super-lite-2026";
  if (/pure aero(?: 100)?\b.*\b(?:2023|gen ?8|8th generation)\b/.test(value)) return "pure-aero-2023";
  if (/pure aero(?: 100)?\b.*\b(?:2026|gen ?9|9th generation)\b/.test(value)) return "pure-aero-100";
  if (/vcore 98\b/.test(value)) return "vcore-98";
  if (/vcore 100\b.*\b(?:8th gen|2026)\b/.test(value)) return "vcore-100";
  if (/pure drive(?: 100)? (?:plus\b|\+)/.test(raw) || /pure drive plus\b/.test(value)) return "pure-drive-plus";
  if (/pure drive 98\b/.test(value)) return "pure-drive-98";
  if (/pure drive(?: 100)? wimbledon\b.*\b2026\b/.test(value)) return "pure-drive-100";
  if (/pure drive(?: 100)?\b.*\b(?:2021|gen ?10|10th generation)\b/.test(value)) return "pure-drive-2021";
  if (/pure drive(?: 100)?\b.*\b(?:2025|gen 11|generation 11)\b/.test(value)) return "pure-drive-100";
  if (/pure strike 97\b/.test(value)) return "pure-strike-97";
  if (/pure strike 100\b/.test(value) && hasStringPattern(raw, 16, 20)) return "pure-strike-100-16x20";
  if (/pure strike 100\b/.test(value)) return "pure-strike-100";
  if (/pure strike (?:103|vs)\b/.test(value)) return null;
  if (/pure strike(?: 98)?\b/.test(value) && hasStringPattern(raw, 18, 20)) return "pure-strike-98-18x20";
  if (/pure strike(?: 98)?\b/.test(value) && hasStringPattern(raw, 16, 19)) return "pure-strike-98";
  if (/pure strike 98\b/.test(value)) return "pure-strike-98";
  if (/pure strike\b/.test(value)) return "pure-strike-98";
  if (/pro staff 97\b/.test(value)) return "pro-staff-97";
  if (/percept 97\b/.test(value)) return "percept-97";
  if (/speed pro 2024\b/.test(value)) return "speed-pro-2024";
  if (/speed mp 2024\b/.test(value)) return "speed-mp-2024";
  if (/speed tour\b/.test(value)) return "speed-tour";
  if (/speed mp\b/.test(value)) return "speed-mp";
  if (/gravity pro 2023\b/.test(value)) return "gravity-pro-2023";
  if (/gravity mp 2023\b/.test(value)) return "gravity-mp-2023";
  if (/gravity pro 2025\b/.test(value)) return "gravity-pro-2025";
  if (/gravity mp 2025\b/.test(value)) return "gravity-mp-2025";
  if (/t fight iso 305\b|tfight iso 305\b/.test(value)) return "tfight-iso-305";
  if (/t fight 315s\b|tfight 315s\b/.test(value)) return "tfight-315s";
  if (/t fight 305s\b|tfight 305s\b/.test(value)) return "tfight-305s";
  if (/t fight 300s\b|tfight 300s\b/.test(value)) return "tfight-300s";
  if (/t fight 300\b|tfight 300\b/.test(value)) return "tfight-300";
  if (/t fight 285\b|tfight 285\b/.test(value)) return "tfight-285";
  if (/tf x1(?: v2)? 305\b|tfx1(?: v2)? 305\b/.test(value)) return "tfx1-305";
  if (/tf x1(?: v2)? 285\b|tfx1(?: v2)? 285\b/.test(value)) return "tfx1-285";
  if (/tf x1 300\b|tfx1 300\b/.test(value)) return "tfx1-300";
  if (/tempo 298\b/.test(value)) return "tempo-298";
  if (/tempo 285\b/.test(value)) return "tempo-285";
  if (/tf 40 315\b|tf40 315\b/.test(value)) return "tf40-315";
  if ((/tf 40 305\b|tf40 305\b/.test(value)) && hasStringPattern(raw, 18, 20)) return "tf40-305-18x20";
  if (/tf 40 305\b|tf40 305\b/.test(value)) return "tf40-305";
  if (/tf 40 290\b|tf40 290\b/.test(value)) return "tf40-290";
  if (/fire 305s\b|fire 305 s\b/.test(value)) return "fire-305s";
  if (/fire 300\b/.test(value)) return "fire-300";
  if (/fire 285\b/.test(value)) return "fire-285";
  if (/fire 270\b/.test(value)) return "fire-270";
  if (/radical pro 2023\b/.test(value)) return "radical-pro-2023";
  if (/radical mp 2023\b/.test(value)) return "radical-mp-2023";
  if (/radical pro 2025\b/.test(value)) return "radical-pro-2025";
  if (/radical mp 2025\b/.test(value)) return "radical-mp-2025";
  if (/speed pro (?:2026|legend 2025)\b/.test(value)) return "speed-pro-2026";
  if (/extreme pro (?:2026|2024)\b/.test(value)) return "extreme-pro-2026";
  if (/extreme mp (?:2026|2024)\b/.test(value)) return "extreme-mp-2026";
  if (/extreme tour 2022\b/.test(value)) return "extreme-tour-2022";
  if (/boom pro 2022\b/.test(value)) return "boom-pro-2022";
  if (/boom mp 2022\b/.test(value)) return "boom-mp-2022";
  if (/boom pro\b/.test(value)) return "boom-pro";
  if (/boom mp\b/.test(value)) return "boom-mp";
  if (/prestige mp 2023\b/.test(value)) return "prestige-mp-2023";
  if (/prestige pro\b/.test(value)) return "prestige-pro";
  if (/prestige tour\b/.test(value)) return "prestige-tour";
  if (/instinct mp\b/.test(value)) return "instinct-mp";
  if (/gravity tour 2025\b/.test(value)) return "gravity-tour-2025";
  return null;
}

export function classifyUsed(title) {
  if (/\b(pro ?stock|paint ?job|signed|autograph|replica)\b/i.test(title)) return null;
  if (/pure strike/i.test(title) && !/pure strike\s+(?:97|98|100)\b/i.test(title)) return null;
  return classify(title.replace(/\b(demo|used|pre[- ]owned|preowned|demo racquet|demo frame)\b/gi, " "));
}

export function isAccessory(title) {
  return /\b(demo|used|grommet|junior|jr|bag|cover|case|string|grip|overgrip|shoe|sock|apparel|hat)\b/i.test(title);
}

export function parseAmazonPrice(block) {
  const offscreen = block.match(/a-offscreen[^>]*>\s*[$€£]?\s*([\d,]+(?:\.\d{2})?)/i)?.[1];
  if (offscreen) {
    const parsed = Number(offscreen.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  const whole = block.match(/a-price-whole[^>]*>\s*([\d,]+)/i)?.[1];
  if (!whole) return null;
  const fraction = block.match(/a-price-fraction[^>]*>\s*(\d{2})/i)?.[1] ?? "00";
  const price = Number(`${whole.replace(/,/g, "")}.${fraction}`);
  return Number.isFinite(price) ? price : null;
}

export function decodeHtmlAttribute(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&#39;", "'").replaceAll("&quot;", '"');
}

export function productJsonLd(html) {
  const products = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
      const queue = Array.isArray(value) ? [...value] : [value];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        if (item["@type"] === "Product") products.push(item);
        if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
        if (Array.isArray(item.itemListElement)) {
          queue.push(...item.itemListElement.map((entry) => (entry && typeof entry === "object" ? entry.item ?? entry : entry)));
        }
      }
    } catch { /* Ignore malformed merchant metadata. */ }
  }
  return products;
}

export function jsonLdOffer(product) {
  const source = product.offers ?? product.Offers;
  const offers = Array.isArray(source) ? source : source ? [source] : [];
  return offers.find((offer) => offer && typeof offer === "object"
    && /InStock/i.test(String(offer.availability ?? offer.Availability ?? "")))
    ?? offers.find((offer) => offer && typeof offer === "object");
}
