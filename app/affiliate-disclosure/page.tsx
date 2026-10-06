import Link from "next/link";

export default function AffiliateDisclosurePage() {
  return (
    <main className="legal-page">
      <Link className="legal-brand" href="/">BASELINE</Link>
      <article>
        <p className="eyebrow">AFFILIATE DISCLOSURE</p>
        <h1>How Baseline earns money.</h1>
        <p className="legal-updated">Effective October 6, 2026</p>

        <h2>Affiliate links</h2>
        <p>Some retailer links on Baseline are affiliate links. If you follow one and buy something, the retailer or its affiliate network may pay Baseline a commission. You pay the same price either way. Baseline shows a short note near prices whenever affiliate links are in use.</p>

        <h2>What commissions never change</h2>
        <p>Baseline ranks deals by price, or by the view you choose, such as Most stocked or your Baseline Coach fit. Whether a retailer pays a commission never changes the order of results, which deals and retailers are shown, your target prices, price-drop alerts or Baseline Coach picks. Retailers without an affiliate program are listed exactly the same way.</p>

        <h2>How the links work</h2>
        <p>Retailer links go through a Baseline address that starts with /go/. It sends you to the retailer page shown on Baseline and, where Baseline belongs to that retailer’s affiliate program, adds a referral code. The retailer or affiliate network may use cookies on its own site to credit the referral; that company’s privacy terms apply there.</p>

        <h2>What Baseline records</h2>
        <p>For each retailer-link click, Baseline records the time, the listing, the retailer, the market and the affiliate network, if any. It does not record your IP address, device identifiers or an account. These records are kept for up to 90 days and are used to understand which retailers visitors choose. The <Link href="/privacy">privacy policy</Link> has more detail.</p>
      </article>
      <Link className="legal-back" href="/">← Back to Baseline</Link>
    </main>
  );
}
