// Readable addresses for racquet pages: /tennis-racquets/wilson-blade-98-16x19-v9.
// Shared by the page builder (GitHub price check) and the site, so both link
// to the same address.

export function racquetSlug(name, modelKey = "") {
  const slug = String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
  return slug || modelKey;
}

// One unique slug per model key. If two names give the same slug, the later
// one gets its model key appended, so every racquet keeps a stable address.
/**
 * @param {Record<string, string>} modelNames
 * @returns {Record<string, string>}
 */
export function racquetSlugs(modelNames) {
  /** @type {Record<string, string>} */
  const slugs = {};
  const taken = new Set();
  for (const modelKey of Object.keys(modelNames ?? {}).sort()) {
    let slug = racquetSlug(modelNames[modelKey], modelKey);
    if (taken.has(slug)) slug = `${slug}-${modelKey}`;
    taken.add(slug);
    slugs[modelKey] = slug;
  }
  return slugs;
}

export const racquetPagePath = (slug) => `/tennis-racquets/${slug}`;
