import type { AnalyticsSummary } from "./baseline-types";

export function AnalyticsPanel({ analytics, loading, onClose }: { analytics: AnalyticsSummary | null; loading: boolean; onClose: () => void }) {
  return (
    <div className="analytics-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="analytics-panel" role="dialog" aria-modal="true" aria-labelledby="analytics-title">
        <div className="analytics-head"><div><p className="eyebrow">PRIVATE BETA SIGNALS</p><h2 id="analytics-title">Baseline analytics</h2><p>Aggregate counts only. No accounts, names, IP addresses, or individual browsing histories are stored.</p></div><button onClick={onClose} aria-label="Close analytics">×</button></div>
        {loading ? <p className="analytics-loading">Loading analytics…</p> : analytics ? <>
          <div className="analytics-kpis">
            <div><span>Page views</span><strong>{analytics.totals.pageViews}</strong><small>last {analytics.windowDays || 1} days</small></div>
            <div><span>Retailer clicks</span><strong>{analytics.totals.dealOpens}</strong><small>outbound deal visits</small></div>
            <div><span>Store comparisons</span><strong>{analytics.totals.retailerOpens}</strong><small>all-retailer views</small></div>
            <div><span>Comparisons</span><strong>{analytics.totals.comparisons}</strong><small>side-by-side opens</small></div>
          </div>
          <section className="analytics-section"><div><span className="settings-label">DAILY MOMENTUM</span><strong>Visits and retailer clicks</strong></div><div className="analytics-days">{analytics.daily.length ? analytics.daily.map((day) => <div key={day.date}><span style={{ height: `${Math.max(7, Math.min(100, day.pageViews * 12))}%` }} title={`${day.pageViews} page views`} /><i style={{ height: `${Math.max(4, Math.min(100, day.dealOpens * 18))}%` }} title={`${day.dealOpens} retailer clicks`} /><small>{day.date.slice(5)}</small></div>) : <p>Collection starts with this release. Check back after beta visitors have used the app.</p>}</div></section>
          <section className="analytics-section analytics-split"><div><span className="settings-label">WHAT PEOPLE BROWSE</span>{analytics.sections.length ? <ol>{analytics.sections.slice(0, 6).map((item) => <li key={item.section}><span>{item.section.replaceAll("-", " ")}</span><b>{item.count}</b></li>)}</ol> : <p>No section changes recorded yet.</p>}</div><div><span className="settings-label">TRACKER HEALTH</span><ol><li><span>Fresh listings</span><b>{analytics.operations.freshOffers}</b></li><li><span>Retailer sources live</span><b>{analytics.operations.liveSources}/{analytics.operations.totalSources}</b></li><li><span>Price drops, 24h</span><b>{analytics.operations.dropsLast24Hours}</b></li><li><span>Baseline Coach opens</span><b>{analytics.totals.coachOpens}</b></li></ol></div></section>
          <p className="analytics-note">Analytics began {new Date(analytics.startedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}. Counts are event totals, not a claim of unique people.</p>
        </> : <p className="analytics-loading">No analytics snapshot is available yet.</p>}
      </section>
    </div>
  );
}
