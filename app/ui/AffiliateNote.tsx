import { affiliateDisclosurePath } from "./affiliate-disclosure";

// A short, quiet line shown near prices while affiliate links are on.
export function AffiliateNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="affiliate-note">
      Some retailer links earn Baseline a commission. Prices and rankings are never affected. <a href={affiliateDisclosurePath}>Learn more</a>
    </p>
  );
}
