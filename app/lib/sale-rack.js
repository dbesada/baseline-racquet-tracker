// "Other racquets on sale": discounted racquets that are not on Baseline's
// tracked model list. The relay picks them; the page groups and labels them.

// Pre-strung racquets come with strings and are ready to play (mostly
// starter and recreational frames). Unstrung frames need strings fitted.
export function isPreStrung(title = "") {
  return /\b(?:pre-?strung|strung)\b/i.test(title) && !/\bunstrung\b/i.test(title);
}

function titleKey(title = "") {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Cheapest first, one listing per racquet name, and separate caps for
// pre-strung and unstrung frames so neither crowds out the other.
export function pickSaleOffers(offers, { preStrung = 18, unstrung = 30 } = {}) {
  const onSale = offers
    .filter((offer) => offer.modelKey === "other-sale" && Number.isFinite(offer.currentPrice) && offer.compareAtPrice > offer.currentPrice)
    .sort((a, b) => a.currentPrice - b.currentPrice);
  const seen = new Set();
  const counts = { pre: 0, unstrung: 0 };
  const picked = [];
  for (const offer of onSale) {
    const key = titleKey(offer.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const pre = isPreStrung(offer.title);
    if (pre ? counts.pre >= preStrung : counts.unstrung >= unstrung) continue;
    if (pre) counts.pre += 1; else counts.unstrung += 1;
    picked.push({ ...offer, preStrung: pre });
  }
  return picked;
}

// A shorter name for the card: drops "(Pre-Strung)", "Tennis Racquet" and
// similar words that the pre-strung tag and the section already say.
export function saleTitle(title = "") {
  const cleaned = title
    .replace(/\s*\((?:pre-?strung|strung|unstrung)\)/gi, "")
    .replace(/,\s*(?:pre-?strung|strung|unstrung)\)/gi, ")")
    .replace(/\b(?:tennis\s+)?(?:racquet|racket)\b/gi, "")
    .replace(/\b(?:pre-?strung|unstrung|strung)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,)\]])/g, "$1")
    .trim();
  return cleaned || title;
}
