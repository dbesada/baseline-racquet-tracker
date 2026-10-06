// The affiliate disclosure is shown only while at least one retailer link
// earns a commission. The relay lists those retailers in the dashboard.

export const affiliateDisclosurePath = "/affiliate-disclosure";

/** @param {{ affiliateRetailers?: string[] } | null | undefined} data */
export function hasAffiliateLinks(data) {
  return Array.isArray(data?.affiliateRetailers) && data.affiliateRetailers.length > 0;
}
