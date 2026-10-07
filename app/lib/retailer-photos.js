// Retailer listing photos, used for racquets that have no manufacturer photo.

// The listing's own product photo (the matched variant's photo first), or null.
// Special editions are skipped because their colourway is not the regular
// frame's. Shopify's image service is asked for a 900px-wide copy.
export function listingPhoto(product, variant, origin, isSpecialEdition = false) {
  if (isSpecialEdition) return null;
  const src = variant?.featured_image?.src ?? product?.images?.[0]?.src ?? product?.image?.src;
  if (!src) return null;
  try {
    const url = new URL(src, origin);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "cdn.shopify.com" || url.pathname.includes("/cdn/shop/")) url.searchParams.set("width", "900");
    return url.href;
  } catch {
    return null;
  }
}

// One photo per racquet from its current listings: the cheapest listing that
// has one, so the choice stays the same between checks.
export function pickRetailerPhotos(offers) {
  const photos = {};
  const sorted = [...offers]
    .filter((offer) => offer?.imageUrl && offer.modelKey && offer.modelKey !== "other-sale" && Number.isFinite(offer.price))
    .sort((a, b) => a.price - b.price || String(a.store).localeCompare(String(b.store)));
  for (const offer of sorted) photos[offer.modelKey] ??= { url: offer.imageUrl, store: offer.store, pageUrl: offer.url };
  return photos;
}
