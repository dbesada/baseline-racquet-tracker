const priorityLabels = {
  comfort: "comfort",
  power: "easy power",
  spin: "spin",
  control: "control",
  balanced: "all-court balance",
};

function numberFrom(value) {
  return value ? Number.parseFloat(value) : Number.NaN;
}

function formatKind(format = "") {
  const value = format.toLowerCase();
  if (value.includes("half")) return "half-set";
  if (value.includes("reel")) return "reel";
  if (value.includes("set")) return "set";
  return "package";
}

function modelFamily(model) {
  const text = `${model.key} ${model.name}`.toLowerCase();
  const families = [
    "pro staff", "pure aero", "pure drive", "pure strike", "aero pro", "aeropro",
    "rf 01", "t fight", "tfight", "tf x1", "tfx1", "vcore pro",
    "blade", "clash", "defyer", "ultra", "shift", "ezone", "vcore", "percept",
    "muse", "speed", "gravity", "radical", "prestige", "extreme", "boom", "instinct",
    "tf40", "tempo", "fire",
  ];
  return families.find((family) => text.includes(family)) ?? model.key.replace(/(?:-v?\d+|-20\d{2})+$/g, "");
}

function modelSignals(model) {
  const pattern = String(model.pattern ?? "").replace("×", "x").toLowerCase();
  const color = String(model.color ?? "").toLowerCase();
  const identity = `${model.key} ${model.name} ${model.profile ?? ""} ${color} ${pattern}`.toLowerCase();
  return {
    identity,
    pattern,
    comfort: /clash|gravity|comfort|soft|forgiving|flex|feel/.test(identity),
    power: /ezone|ultra|pure[- ]?drive|instinct|boom|boost|evo drive|power|depth|easy/.test(identity),
    spin: /pure[- ]?aero|aero ?pro|aeropro|vcore|defyer|extreme|shift|spin/.test(identity),
    control: /blade|pro[- ]?staff|percept|tf40|prestige|radical|pure[- ]?strike|control|precision|stability|dense|classic/.test(identity),
    balanced: /speed|t[- ]?fight|tfight|all-court|versatility|balanced|power \/ control|control \/ feel/.test(identity),
    recreational: /\b(?:play|ace|alpha|boost|xceed|elite|evo)\b|recreational|pre-strung|junior/.test(identity),
    light: /\b(?:team l|lite|light|ul|ultra-light)\b/.test(identity),
    boldStyle: /rafa|aero|vcore|defyer|extreme|boom|shift|concept|wimbledon|neon|yellow|orange|red|pink|purple|lime|volt|electric|blast/.test(identity),
    understatedStyle: /pro staff|blade|percept|tf40|prestige|classic|noir|black|white|silver|graphite|navy|forest/.test(identity),
    iconicStyle: /pro staff|rf ?01|rafa|wimbledon|classic|prestige|blade|pure aero|pure drive|ezone|vcore/.test(identity),
  };
}

function modelBreakdown(model, answers) {
  const head = numberFrom(model.head);
  const weight = numberFrom(model.weight);
  const hasHead = Number.isFinite(head);
  const hasWeight = Number.isFinite(weight);
  const pattern = String(model.pattern ?? "").replace("×", "x").toLowerCase();
  const signals = modelSignals(model);
  const profile = signals.identity;
  const tags = [];
  let score = 0;

  if (answers.level === "new") {
    if (hasHead && head >= 104) score += 14;
    else if (hasHead && head >= 100) score += 10;
    else if (hasHead && head < 98) score -= 10;
    if (hasWeight && weight <= 285) score += 14;
    else if (hasWeight && weight <= 295) score += 9;
    else if (hasWeight && weight > 305) score -= 12;
    if (/forgiving|accessible|easy|recreational|maneuverable|light/.test(profile) || signals.recreational) score += 16;
    if ((hasHead && head >= 100) || (hasWeight && weight <= 290) || signals.recreational) tags.push("Accessible spec");
  } else if (answers.level === "intermediate") {
    if (hasHead && head >= 98 && head <= 102) score += 13;
    else if (hasHead) score -= Math.min(8, Math.abs(head - 100) * 2);
    if (hasWeight && weight >= 285 && weight <= 305) score += 13;
    else if (hasWeight) score -= Math.min(9, Math.abs(weight - 295) / 3);
    if (/versatility|all-court|balanced|maneuverable|forgiving/.test(profile) || signals.balanced) score += 9;
    if ((hasHead && head >= 98 && head <= 102 && hasWeight && weight >= 285 && weight <= 305) || signals.balanced) tags.push("Intermediate sweet spot");
    if (signals.recreational && !signals.balanced) score -= 16;
  } else if (answers.level === "advanced") {
    if (hasHead && head <= 98) score += 14;
    else if (hasHead && head <= 100) score += 9;
    else if (hasHead && head >= 104) score -= 10;
    if (hasWeight && weight >= 305 && weight <= 325) score += 14;
    else if (hasWeight && weight >= 300) score += 9;
    else if (hasWeight && weight < 285) score -= 12;
    if (/control|precision|stability|tour|feel|attack|classic/.test(profile) || signals.control) score += 13;
    if ((hasHead && head <= 100 && hasWeight && weight >= 300) || signals.control) tags.push("Advanced-player spec");
    if (signals.recreational || signals.light) score -= 30;
  }

  if (answers.priority === "comfort") {
    if (signals.comfort) {
      score += 32;
      tags.push("Comfort-oriented");
    } else score -= 4;
    if (hasHead && head >= 100) score += 5;
    if (hasWeight && weight >= 280 && weight <= 305) score += 4;
  } else if (answers.priority === "power") {
    if (signals.power) {
      score += 32;
      tags.push("Easy-power match");
    } else score -= 4;
    if (hasHead && head >= 104) score += 10;
    else if (hasHead && head >= 100) score += 7;
    if (hasWeight && weight <= 300) score += 5;
  } else if (answers.priority === "spin") {
    if (signals.spin) {
      score += 34;
      tags.push("Spin-oriented family");
    } else score -= 5;
    if (/16\s*x\s*(?:18|19)/.test(pattern)) score += 10;
    if (hasHead && head >= 98 && head <= 102) score += 5;
    if (/16\s*x\s*(?:18|19)/.test(pattern)) tags.push("Spin-friendly pattern");
    if (signals.comfort && !signals.power && !signals.control) score -= 8;
  } else if (answers.priority === "control") {
    if (signals.control) {
      score += 34;
      tags.push("Control-oriented family");
    } else score -= 5;
    if (/18\s*x\s*20|16\s*x\s*20/.test(pattern)) score += 10;
    if (hasHead && head <= 98) score += 8;
    else if (hasHead && head <= 100) score += 4;
    if (hasWeight && weight >= 300) score += 5;
    if ((hasHead && head <= 98) || /18\s*x\s*20|16\s*x\s*20/.test(pattern)) tags.push("Control-first spec");
  } else if (answers.priority === "balanced") {
    if (signals.balanced) {
      score += 30;
      tags.push("Balanced all-court fit");
    } else score -= 3;
    if (hasHead && head >= 98 && head <= 100) score += 9;
    if (hasWeight && weight >= 295 && weight <= 305) score += 9;
    if (/16\s*x\s*(?:19|20)/.test(pattern)) score += 5;
  }

  if (answers.arm === "tender") {
    if (signals.comfort) score += 28;
    else if (/feel/.test(profile)) score += 10;
    if (hasWeight && weight >= 280 && weight <= 305) score += 6;
    if (/firm|stiff/.test(profile)) score -= 18;
    if (signals.comfort) tags.push("Arm-conscious choice");
  }

  if (answers.brand && answers.brand !== "any") {
    if (model.brand === answers.brand) {
      score += 36;
      tags.push(`${answers.brand} preference`);
    } else {
      score -= 10;
    }
  }

  if (answers.aesthetic === "bold") {
    if (signals.boldStyle) { score += 22; tags.push("Bold visual direction"); } else score -= 3;
  } else if (answers.aesthetic === "understated") {
    if (signals.understatedStyle) { score += 22; tags.push("Clean visual direction"); } else score -= 3;
  } else if (answers.aesthetic === "iconic") {
    if (signals.iconicStyle) { score += 22; tags.push("Iconic line"); } else score -= 3;
  }

  const budget = answers.budget === "any" || !answers.budget ? Number.POSITIVE_INFINITY : Number(answers.budget);
  if (Number.isFinite(budget)) {
    if (model.price <= budget) {
      score += 18;
      tags.push(`Under $${budget}`);
    } else {
      score -= 24 + Math.min(24, (model.price - budget) / 8);
    }
  }

  return { score, tags: [...new Set(tags)] };
}

export function modelScore(model, answers) {
  return modelBreakdown(model, answers).score;
}

export function modelFitTags(model, answers) {
  const tags = modelBreakdown(model, answers).tags;
  const brandTag = answers.brand && answers.brand !== "any"
    ? tags.find((tag) => tag === `${answers.brand} preference`)
    : undefined;
  return [...(brandTag ? [brandTag] : []), ...tags.filter((tag) => tag !== brandTag)].slice(0, 3);
}

export function recommendModels(models, answers) {
  const ranked = [...models].sort((a, b) => modelScore(b, answers) - modelScore(a, answers) || a.price - b.price || a.name.localeCompare(b.name));
  const budget = answers.budget === "any" || !answers.budget ? Number.POSITIVE_INFINITY : Number(answers.budget);
  const underBudget = Number.isFinite(budget) ? ranked.filter((model) => model.price <= budget) : ranked;
  const budgetPool = underBudget.length >= 3 ? underBudget : ranked;
  const preferred = answers.brand && answers.brand !== "any"
    ? budgetPool.filter((model) => model.brand === answers.brand) : [];
  const pool = preferred.length >= 3 ? preferred : [...preferred, ...budgetPool.filter((model) => !preferred.includes(model))];
  const selected = [];
  const familyCounts = new Map();
  const brandCounts = new Map();

  for (const model of pool) {
    const family = modelFamily(model);
    if ((familyCounts.get(family) ?? 0) > 0) continue;
    if ((!answers.brand || answers.brand === "any") && (brandCounts.get(model.brand) ?? 0) >= 2) continue;
    selected.push(model);
    familyCounts.set(family, 1);
    brandCounts.set(model.brand, (brandCounts.get(model.brand) ?? 0) + 1);
    if (selected.length === 3) return selected;
  }
  for (const model of pool) {
    if (selected.some((candidate) => candidate.key === model.key)) continue;
    selected.push(model);
    if (selected.length === 3) break;
  }
  return selected;
}

export function modelReason(model, answers) {
  const tags = modelFitTags(model, answers);
  const profile = model.profile?.replaceAll(" / ", " and ").toLowerCase();
  const specs = [model.head, model.weight, model.pattern].filter(Boolean).join(" · ");
  const match = tags.length ? `${tags.join(" · ")}. ` : "";
  const colour = answers.aesthetic && answers.aesthetic !== "any" && model.color ? ` Colour: ${model.color}.` : "";
  return `${match}${profile ? `${profile.charAt(0).toUpperCase()}${profile.slice(1)}` : "Well-rounded performance profile"}${specs ? ` at ${specs}` : ""}.${colour}`;
}

function stringBreakdown(item, answers) {
  const type = item.type.toLowerCase();
  const format = formatKind(item.format);
  const tags = [];
  let score = 0;

  if (answers.priority === "comfort") {
    if (/natural gut/.test(type)) score += 32;
    else if (/multifilament/.test(type)) score += 29;
    else if (/synthetic gut/.test(type)) score += 13;
    else if (/polyester|monofilament/.test(type)) score -= 18;
    tags.push("Comfort material");
  } else if (answers.priority === "power") {
    if (/natural gut/.test(type)) score += 30;
    else if (/multifilament/.test(type)) score += 25;
    else if (/synthetic gut/.test(type)) score += 14;
    else if (/polyester/.test(type)) score -= 8;
    tags.push("Power-friendly response");
  } else if (answers.priority === "spin") {
    if (/polyester/.test(type)) score += 32;
    else if (/hybrid/.test(type)) score += 24;
    else if (/monofilament/.test(type)) score += 17;
    tags.push("Spin-oriented material");
  } else if (answers.priority === "control") {
    if (/polyester/.test(type)) score += 30;
    else if (/monofilament/.test(type)) score += 26;
    else if (/hybrid/.test(type)) score += 21;
    tags.push("Controlled response");
  } else if (answers.priority === "balanced") {
    if (/hybrid/.test(type)) score += 30;
    else if (/multifilament/.test(type)) score += 21;
    else if (/synthetic gut/.test(type)) score += 16;
    else if (/polyester/.test(type)) score += 8;
    tags.push("Balanced material choice");
  }

  if (answers.level === "new") {
    if (/multifilament|synthetic gut/.test(type)) score += 18;
    if (/polyester|monofilament/.test(type)) score -= 24;
  } else if (answers.level === "intermediate") {
    if (/hybrid|multifilament|synthetic gut/.test(type)) score += 10;
  } else if (answers.level === "advanced") {
    if (/polyester|hybrid|monofilament/.test(type)) score += 13;
  }

  if (answers.arm === "tender") {
    if (/natural gut/.test(type)) score += 34;
    else if (/multifilament/.test(type)) score += 30;
    else if (/synthetic gut/.test(type)) score += 13;
    if (/polyester|monofilament/.test(type)) score -= 40;
    tags.push("Arm-conscious material");
  }

  if ((answers.priority === "spin" || answers.priority === "control") && item.gauges.some((gauge) => ["17", "17L", "18"].includes(gauge))) {
    score += 10;
    tags.push("Thinner gauge available");
  }
  if ((answers.priority === "comfort" || answers.priority === "power") && item.gauges.some((gauge) => ["16", "16L"].includes(gauge))) {
    score += 8;
    tags.push("Practical 16 gauge");
  }

  const preferredFormat = answers.stringFormat ?? "any";
  if (preferredFormat !== "any") {
    if (format === preferredFormat) {
      score += 34;
      tags.push(item.format);
    } else {
      score -= 22;
    }
  } else {
    if (format === "set") score += 7;
    else if (format === "half-set") score += 4;
    else if (format === "reel") score -= 5;
  }

  const budget = answers.focus === "strings" && answers.budget !== "any" && answers.budget ? Number(answers.budget) : Number.POSITIVE_INFINITY;
  if (Number.isFinite(budget)) {
    if (item.price <= budget) {
      score += 18;
      tags.push(`Under $${budget}`);
    } else {
      score -= 28 + Math.min(20, item.price - budget);
    }
  }
  return { score, tags: [...new Set(tags)] };
}

export function stringScore(item, answers) {
  return stringBreakdown(item, answers).score;
}

export function stringFitTags(item, answers) {
  return stringBreakdown(item, answers).tags.slice(0, 3);
}

function stringFamily(item) {
  const normalize = (value) => value.toLowerCase()
    .replace(/\b(?:half[- ]?set|set|reel|package|tennis strings?|strings?)\b/g, " ")
    .replace(/\b(?:15l|16l|17l|18l|15|16|17|18|19|20|22)\s*(?:g|ga|gauge)?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
  const title = String(item.title ?? "");
  if (/hybrid/i.test(item.type) && title.includes("+")) {
    const hybridTitle = title.toLowerCase()
      .replace(String(item.brand ?? "").toLowerCase(), " ")
      .replace(/\bhybrid\b/g, " ");
    const components = hybridTitle.split("+").map(normalize).filter(Boolean).sort();
    return `${item.brand}:hybrid:${components.join("|")}`.toLowerCase();
  }
  return `${item.brand}:${normalize(title)}`.toLowerCase();
}

export function recommendStrings(strings, answers) {
  const ranked = [...strings].sort((a, b) => stringScore(b, answers) - stringScore(a, answers) || a.price - b.price || a.title.localeCompare(b.title));
  const preferredFormat = answers.stringFormat ?? "any";
  const matchingFormat = preferredFormat === "any" ? ranked : ranked.filter((item) => formatKind(item.format) === preferredFormat);
  const formatPool = matchingFormat.length >= 3 ? matchingFormat : ranked;
  const budget = answers.focus === "strings" && answers.budget !== "any" && answers.budget ? Number(answers.budget) : Number.POSITIVE_INFINITY;
  const affordable = Number.isFinite(budget) ? formatPool.filter((item) => item.price <= budget) : formatPool;
  const pool = affordable.length >= 3 ? affordable : formatPool;
  const selected = [];
  const families = new Set();
  const typeCounts = new Map();
  const brandCounts = new Map();

  for (const item of pool) {
    const family = stringFamily(item);
    if (families.has(family) || (typeCounts.get(item.type) ?? 0) >= 2 || (brandCounts.get(item.brand) ?? 0) >= 2) continue;
    selected.push(item);
    families.add(family);
    typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
    brandCounts.set(item.brand, (brandCounts.get(item.brand) ?? 0) + 1);
    if (selected.length === 3) return selected;
  }
  for (const item of pool) {
    if (selected.some((candidate) => candidate.key === item.key) || families.has(stringFamily(item))) continue;
    selected.push(item);
    families.add(stringFamily(item));
    if (selected.length === 3) break;
  }
  return selected;
}

export function stringReason(item, answers) {
  const descriptions = {
    "Natural gut": "maximum comfort, feel and easy power",
    Multifilament: "arm-friendly comfort with useful power",
    "Synthetic gut": "balanced response and excellent value",
    Hybrid: "a blend of control and comfort",
    Polyester: "spin, control and a firmer response",
    Monofilament: "a consistent, controlled response",
    Other: "a distinctive response from the live catalogue",
  };
  const tags = stringFitTags(item, answers);
  const goal = priorityLabels[answers.priority] ?? "your requested feel";
  return `${tags.length ? `${tags.join(" · ")}. ` : ""}${item.format} with ${descriptions[item.type] ?? descriptions.Other}, ranked for ${goal}.`;
}
