import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link className="legal-brand" href="/">BASELINE</Link>
      <article>
        <p className="eyebrow">PRIVACY</p>
        <h1>Privacy at Baseline.</h1>
        <p className="legal-updated">Effective October 5, 2026</p>

        <h2>What Baseline stores</h2>
        <p>Baseline’s public beta does not require an account. Your grip preference, six-frame watchlist, target prices, completed Baseline Coach fit, and browser-notification preference are stored locally on your device. The protected Baseline admin service stores its own operational retailer settings and scheduled-monitoring preferences separately.</p>

        <h2>Technical information</h2>
        <p>The server may create standard operational logs such as request time, IP address, browser type and error details. These logs are used to keep the service reliable and secure. Baseline does not use advertising trackers or sell personal information.</p>

        <h2>Retailers and marketplaces</h2>
        <p>Baseline reads publicly available product and marketplace information. Opening a deal goes through a Baseline link that records the time, the listing, the retailer, the market and the affiliate network, if any. These records do not include accounts, names, IP addresses or device identifiers, and are kept for up to 90 days. Some retailer links may be affiliate links, and the retailer or its affiliate network may use cookies on its own site to credit the referral; the <Link href="/affiliate-disclosure">affiliate disclosure</Link> explains how this works. Once you reach the retailer or marketplace, that company’s privacy terms apply. Baseline does not receive payment-card details or marketplace passwords.</p>

        <h2>Notifications</h2>
        <p>If notifications are enabled, the browser or mobile operating system records that permission. Baseline uses it only for requested price-check alerts. Notifications can be disabled in the browser, device, or Baseline settings.</p>

        <h2>Your choices</h2>
        <p>Clearing Baseline’s site data removes your device-local preferences. Public-beta preferences are not connected to a public profile or shared with other visitors.</p>

        <h2>Changes</h2>
        <p>Baseline’s public beta records privacy-light, aggregate product analytics: page views, section browsing, comparison opens, Baseline Coach opens and retailer-link clicks. These counts do not include accounts, names, IP addresses, device identifiers, precise location, or individual browsing histories. Aggregate analytics are stored on Baseline’s own service for up to 90 days and are used only to improve the beta. This page will be updated before Baseline adds accounts, payments, advertising, native push notifications, or other personal-data handling.</p>
      </article>
      <Link className="legal-back" href="/">← Back to Baseline</Link>
    </main>
  );
}
