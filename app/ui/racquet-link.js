// Shareable racquet links: #racquet-<model key> opens that racquet's pop-up.

const prefix = "#racquet-";

/** @param {string} modelKey */
export function racquetHash(modelKey) {
  return `${prefix}${encodeURIComponent(modelKey)}`;
}

/** The model key in a #racquet-… address, or null. @param {string} hash */
export function racquetKeyFromHash(hash) {
  if (typeof hash !== "string" || !hash.startsWith(prefix)) return null;
  try {
    const key = decodeURIComponent(hash.slice(prefix.length));
    return /^[a-z0-9-]{1,80}$/.test(key) ? key : null;
  } catch {
    return null;
  }
}
