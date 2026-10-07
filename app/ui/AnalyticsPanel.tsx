import type { AnalyticsSummary, AnalyticsTotals, RetailerWeekRow, RetailerWeeks } from "./baseline-types";
import { glossary } from "./glossary";

export const analyticsRanges = [7, 30, 90] as const;

const weekLabel = (monday: string) => new Date(`${monday}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

const kindLabels: Record<string, string> = {
  racquet: "Tracked racquets", sale: "Sale rack", special: "Special editions", used: "Used market",
  string: "Strings", ball: "Balls", accessory: "Accessories", unknown: "Earlier clicks (no section recorded)",
};
const sectionLabels: Record<string, string> = {
  catalogue: "Racquets", special: "Special editions", strings: "Strings", balls: "Balls", accessories: "Accessories", guide: "Racquet guide", "string-guide": "String guide",
};
const startHereLabels = { coach: "Help me choose", browse: "I know what I want", hide: "Hid the card" } as const;
const saleFilterLabels: Record<string, string> = { all: "All", unstrung: "Unstrung frames", prestrung: "Pre-strung" };
const termLabel = (term: string) => (glossary as Record<string, { title: string } | undefined>)[term]?.title ?? term.replaceAll("-", " ");

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : "—");

// "+12% vs previous 30 days", or nothing when there is no earlier data.
function Change({ now, before }: { now: number; before: number }) {
  if (!before) return <small>{now ? "new this period" : "no data yet"}</small>;
  const change = Math.round(((now - before) / before) * 100);
  return <small className={change > 0 ? "up" : change < 0 ? "down" : ""}>{change > 0 ? "▲" : change < 0 ? "▼" : "■"} {Math.abs(change)}% vs previous</small>;
}

function Kpi({ label, value, change }: { label: string; value: string | number; change?: React.ReactNode }) {
  return <div><span>{label}</span><strong>{value}</strong>{change}</div>;
}

function CountList({ rows, empty }: { rows: Array<{ label: string; count: number }>; empty: string }) {
  if (!rows.length) return <p>{empty}</p>;
  const max = Math.max(...rows.map((row) => row.count), 1);
  return <ol className="analytics-bars">{rows.map((row) => <li key={row.label}>
    <span>{row.label}</span><b>{row.count}</b><i style={{ width: `${(row.count / max) * 100}%` }} aria-hidden="true" />
  </li>)}</ol>;
}

// Visits and buy clicks per day, scaled to the busiest day.
function DailyChart({ daily }: { daily: AnalyticsSummary["daily"] }) {
  const visitsOf = (day: AnalyticsSummary["daily"][number]) => day.visits || day.pageViews;
  const max = Math.max(...daily.map((day) => Math.max(visitsOf(day), day.buyClicks)), 1);
  if (!daily.some((day) => visitsOf(day) || day.buyClicks)) return <p>No visits recorded in this period yet.</p>;
  const labelEvery = daily.length > 31 ? 14 : daily.length > 8 ? 5 : 1;
  return <>
    <div className="analytics-days" role="img" aria-label="Daily visits and buy clicks">
      {daily.map((day, index) => <div key={day.date} title={`${dayLabel(day.date)}: ${visitsOf(day)} visits, ${day.buyClicks} buy clicks`}>
        <span style={{ height: `${(visitsOf(day) / max) * 100}%` }} />
        <i style={{ height: `${(day.buyClicks / max) * 100}%` }} />
        <small>{index % labelEvery === 0 || index === daily.length - 1 ? dayLabel(day.date) : ""}</small>
      </div>)}
    </div>
    <p className="analytics-legend"><span className="visits" /> Visits <span className="clicks" /> Buy clicks · busiest day {max}</p>
  </>;
}

function RetailerWeekCells({ row }: { row: RetailerWeekRow }) {
  return <>
    <th scope="row">{row.retailer}</th>
    {row.weeks.map((count, index) => <td key={index}>{count || "·"}</td>)}
    <td><b>{row.total}</b></td>
    <td>{row.affiliate ? `${Math.round((row.affiliate / row.total) * 100)}%` : "—"}</td>
  </>;
}

// Clicks per retailer per week from the /go/ click log (admin only).
function RetailerWeeksTable({ report }: { report: RetailerWeeks }) {
  return (
    <section className="analytics-section analytics-retailer-weeks">
      <div><span className="settings-label">RETAILER CLICKS BY WEEK</span><strong>Where visitors go to buy</strong></div>
      {report.totalClicks ? <div className="analytics-table-scroll"><table>
        <thead><tr><th scope="col">Retailer</th>{report.weeks.map((week, index) => <th scope="col" key={week}>{index === 0 ? "This week" : weekLabel(week)}</th>)}<th scope="col">Total</th><th scope="col">Affiliate</th></tr></thead>
        <tbody>
          {report.retailers.map((row) => <tr key={row.retailer}><RetailerWeekCells row={row} /></tr>)}
          {report.other && <tr className="analytics-other"><RetailerWeekCells row={report.other} /></tr>}
        </tbody>
      </table></div> : <p>No retailer clicks recorded yet. Clicks are counted from this release on.</p>}
      <p className="analytics-table-note">Weeks start Monday, Toronto time. “Affiliate” is the share of clicks that went through an affiliate link.</p>
    </section>
  );
}

export function AnalyticsPanel({ analytics, loading, days, onDaysChange, onClose }: {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  days: number;
  onDaysChange: (days: number) => void;
  onClose: () => void;
}) {
  const totals: AnalyticsTotals | undefined = analytics?.totals;
  const previous = analytics?.previous;
  // Visits are counted from this release; earlier days only have page views.
  const visitsKnown = Boolean(totals?.visits);
  const beginner = analytics?.beginner;
  return (
    <div className="analytics-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="analytics-panel" role="dialog" aria-modal="true" aria-labelledby="analytics-title">
        <div className="analytics-head">
          <div><p className="eyebrow">PRIVATE BETA SIGNALS</p><h2 id="analytics-title">Baseline analytics</h2><p>Aggregate counts only. No accounts, names, IP addresses, or individual browsing histories are stored.</p></div>
          <button onClick={onClose} aria-label="Close analytics">×</button>
        </div>
        <div className="analytics-range" role="group" aria-label="Report period">
          {analyticsRanges.map((range) => <button key={range} className={days === range ? "active" : ""} aria-pressed={days === range} onClick={() => onDaysChange(range)}>{range} days</button>)}
        </div>
        {loading ? <p className="analytics-loading">Loading analytics…</p> : analytics && totals && previous && beginner ? <>
          <div className="analytics-kpis">
            {visitsKnown
              ? <Kpi label="Visits" value={totals.visits} change={<Change now={totals.visits} before={previous.visits} />} />
              : <Kpi label="Page views" value={totals.pageViews} change={<small>visits are counted from this release</small>} />}
            <Kpi label="Buy clicks" value={totals.buyClicks} change={<Change now={totals.buyClicks} before={previous.buyClicks} />} />
            <Kpi label="Click rate" value={percent(totals.buyClicks, totals.visits || totals.pageViews)} change={<small>buy clicks per {visitsKnown ? "visit" : "page view"}</small>} />
            <Kpi label="Coach finished" value={totals.coachCompletes} change={<small>of {totals.coachOpens} opened ({percent(totals.coachCompletes, totals.coachOpens)})</small>} />
          </div>

          <section className="analytics-section"><div><span className="settings-label">DAILY MOMENTUM</span><strong>Visits and buy clicks</strong></div><DailyChart daily={analytics.daily} /></section>

          <section className="analytics-section analytics-split">
            <div><span className="settings-label">BUY CLICKS BY SECTION</span><CountList rows={analytics.clicksByKind.map((row) => ({ label: kindLabels[row.kind] ?? row.kind, count: row.count }))} empty="No buy clicks in this period." /></div>
            <div><span className="settings-label">MOST-CLICKED RACQUETS</span><CountList rows={analytics.topRacquets.map((row) => ({ label: row.name === row.modelKey ? row.modelKey.replaceAll("-", " ") : row.name, count: row.count }))} empty="No racquet clicks recorded with a model yet." /></div>
          </section>

          <section className="analytics-section analytics-split">
            <div><span className="settings-label">WHERE VISITORS COME FROM</span><CountList rows={analytics.referrers.map((row) => ({ label: row.source === "direct" ? "Direct, app or bookmark" : row.source, count: row.count }))} empty="Referring sites are counted from this release." /></div>
            <div><span className="settings-label">WHAT PEOPLE BROWSE</span><CountList rows={analytics.sections.slice(0, 8).map((row) => ({ label: sectionLabels[row.section] ?? row.section.replaceAll("-", " "), count: row.count }))} empty="No section changes recorded yet." /></div>
          </section>

          <section className="analytics-section analytics-split">
            <div><span className="settings-label">BEGINNER HELP</span><CountList rows={[
              ...(Object.keys(startHereLabels) as Array<keyof typeof startHereLabels>).map((key) => ({ label: `Start here: ${startHereLabels[key]}`, count: beginner.startHere[key] })),
              { label: "Coach opened", count: totals.coachOpens },
              ...beginner.coachCompletes.map((row) => ({ label: `Coach finished: ${row.focus}`, count: row.count })),
              ...beginner.saleFilters.map((row) => ({ label: `Sale filter: ${saleFilterLabels[row.filter] ?? row.filter}`, count: row.count })),
            ].filter((row) => row.count > 0)} empty="Counted from this release." /></div>
            <div><span className="settings-label">TERMS PEOPLE TAP TO UNDERSTAND</span><CountList rows={beginner.terms.map((row) => ({ label: termLabel(row.term), count: row.count }))} empty="No explanations opened yet." /></div>
          </section>

          <section className="analytics-section analytics-split">
            <div><span className="settings-label">ENGAGEMENT</span><ol><li><span>Store comparisons opened</span><b>{totals.retailerOpens}</b></li><li><span>Side-by-side comparisons</span><b>{totals.comparisons}</b></li><li><span>Used market visits</span><b>{totals.usedMarket}</b></li><li><span>Page views (incl. reloads)</span><b>{totals.pageViews}</b></li></ol></div>
            <div><span className="settings-label">TRACKER HEALTH</span><ol><li><span>Fresh listings</span><b>{analytics.operations.freshOffers}</b></li><li><span>Retailer sources live</span><b>{analytics.operations.liveSources}/{analytics.operations.totalSources}</b></li><li><span>Price drops, 24h</span><b>{analytics.operations.dropsLast24Hours}</b></li></ol></div>
          </section>

          {analytics.retailerWeeks && <RetailerWeeksTable report={analytics.retailerWeeks} />}
          <p className="analytics-note">Analytics began {new Date(analytics.startedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}. A visit is one browser tab session; counts are totals, not unique people. Buy clicks come from the /go/ click log, so they include every buy button on the site.</p>
        </> : <p className="analytics-loading">No analytics snapshot is available yet.</p>}
      </section>
    </div>
  );
}
