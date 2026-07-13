"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Offer = {
  id: string;
  modelKey: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  previousPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  gripSizes: string[];
  lastChecked: string;
};

type Dashboard = {
  offers: Offer[];
  saleOffers: Offer[];
  targets: Record<string, number>;
  lastCheck: null | { checkedAt: string; storesChecked: number; offersFound: number; failures: number };
  history: Array<{ modelKey: string; price: number; checkedAt: string }>;
  modelNames: Record<string, string>;
  stores: string[];
  retailers: Array<{ key: string; name: string; enabled: boolean; kind: string }>;
};

const modelOrder = ["blade-v8", "blade-v9", "ezone-98", "pure-aero-98"];
const accents: Record<string, string> = {
  "blade-v8": "mint",
  "blade-v9": "forest",
  "ezone-98": "blue",
  "pure-aero-98": "yellow",
};

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });

function relativeTime(value?: string) {
  if (!value) return "Not checked yet";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function BaselineApp() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/tracker", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load prices");
    setData(await response.json());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((caught) => setError(caught.message)).finally(() => setLoading(false));
      setNotifications(localStorage.getItem("baseline-notifications") === "on" && Notification.permission === "granted");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const drops = useMemo(() => (data?.offers ?? []).filter((offer) =>
    offer.inStock && offer.currentPrice !== null && offer.previousPrice !== null && offer.currentPrice < offer.previousPrice,
  ), [data]);

  const checkNow = async () => {
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/tracker?action=check", { method: "POST" });
      if (!response.ok) throw new Error("Price check failed. Please try again.");
      const next = await response.json() as Dashboard;
      setData(next);
      const newDrops = next.offers.filter((offer) =>
        offer.currentPrice !== null && offer.previousPrice !== null && offer.currentPrice < offer.previousPrice,
      );
      if (notifications && newDrops.length) {
        new Notification("Baseline found a price drop", {
          body: `${newDrops[0].title} is now ${money.format(newDrops[0].currentPrice ?? 0)} at ${newDrops[0].store}.`,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Price check failed");
    } finally {
      setChecking(false);
    }
  };

  const toggleNotifications = async () => {
    if (!notifications) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      localStorage.setItem("baseline-notifications", "on");
      setNotifications(true);
      new Notification("Baseline alerts are on", { body: "You’ll be notified when a fresh check finds a lower price." });
    } else {
      localStorage.setItem("baseline-notifications", "off");
      setNotifications(false);
    }
  };

  const saveTarget = async (modelKey: string) => {
    const value = Number(targetDraft);
    if (!Number.isFinite(value) || value <= 0) return;
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelKey, targetPrice: value }),
    });
    if (response.ok) setData(await response.json());
    setEditing(null);
  };

  const toggleRetailer = async (retailerKey: string, enabled: boolean) => {
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retailerKey, enabled }),
    });
    if (response.ok) setData(await response.json());
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Baseline home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          BASELINE
        </a>
        <div className="top-actions">
          <span className="status-dot"><i /> Watching {data?.stores.length ?? 5} stores</span>
          <button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label="Open tracker settings">Settings</button>
          <button className={`alert-toggle ${notifications ? "on" : ""}`} onClick={toggleNotifications}>
            <span aria-hidden="true">{notifications ? "●" : "○"}</span>
            {notifications ? "Alerts on" : "Turn on alerts"}
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-panel-head">
              <div><p className="eyebrow">BASELINE CONTROL ROOM</p><h2 id="settings-title">Settings</h2></div>
              <button className="close-settings" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>
            <div className="settings-block">
              <span className="settings-label">CHECK FREQUENCY</span>
              <div className="frequency-card"><strong>Every hour</strong><span>Automatic checks run hourly. You can still check manually anytime.</span></div>
            </div>
            <div className="settings-block">
              <span className="settings-label">RETAILERS</span>
              <p className="settings-help">Disable a store to skip it during checks and remove its listings from the comparison.</p>
              <div className="retailer-list">
                {(data?.retailers ?? []).map((retailer) => (
                  <label className="retailer-toggle" key={retailer.key}>
                    <span><strong>{retailer.name}</strong>{retailer.kind === "amazon" && <small>Best-effort marketplace search</small>}</span>
                    <input type="checkbox" checked={retailer.enabled} onChange={(event) => toggleRetailer(retailer.key, event.target.checked)} />
                    <i aria-hidden="true" />
                  </label>
                ))}
              </div>
            </div>
            <p className="settings-footnote">All matches are filtered to new, in-stock grip size 3 (L3 / 4⅜). Amazon can throttle automated searches, so those feeds may occasionally report no results.</p>
          </aside>
        </div>
      )}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">CANADIAN RACQUET PRICE TRACKER</p>
          <h1>Wait for the<br /><em>right bounce.</em></h1>
          <p className="lede">Baseline watches the frames on your shortlist, checks enabled Canadian retailers every hour, and calls the shot when the price drops.</p>
          <div className="hero-actions">
            <button className="check-button" onClick={checkNow} disabled={checking}>
              <span className={checking ? "spin" : ""} aria-hidden="true">↻</span>
              {checking ? "Checking stores…" : "Check prices now"}
            </button>
            <span className="last-check">Last checked<br /><strong>{relativeTime(data?.lastCheck?.checkedAt)}</strong></span>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
        <div className="court-card" aria-label="Deal summary">
          <div className="court-lines"><span /><span /><span /></div>
          <div className="summary-ball">
            <strong>{drops.length}</strong>
            <span>fresh<br />drops</span>
          </div>
          <div className="summary-copy">
            <span>{data?.lastCheck?.offersFound ?? 0} matching listings</span>
            <strong>{data?.offers.filter((offer) => offer.inStock).length ?? 0} in stock</strong>
          </div>
        </div>
      </section>

      <section className="watchlist">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR WATCHLIST</p>
            <h2>Four frames. Best price wins.</h2>
          </div>
          <div className="legend"><span className="deal-dot" /> Below target <span className="stock-dot" /> In stock</div>
        </div>

        <div className="model-grid">
          {modelOrder.map((modelKey, index) => {
            const offers = (data?.offers ?? []).filter((offer) => offer.modelKey === modelKey);
            const inStock = offers.filter((offer) => offer.inStock && offer.currentPrice !== null);
            const best = inStock.sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
            const target = data?.targets[modelKey] ?? 0;
            const belowTarget = Boolean(best && best.currentPrice !== null && best.currentPrice <= target);
            const history = (data?.history ?? []).filter((row) => row.modelKey === modelKey).slice(0, 8).reverse();
            const max = Math.max(...history.map((row) => row.price), 1);
            const min = Math.min(...history.map((row) => row.price), max);
            return (
              <article className={`model-card ${accents[modelKey]}`} key={modelKey} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
                <div className="card-top">
                  <span className="model-number">0{index + 1}</span>
                  <span className={`deal-pill ${belowTarget ? "hit" : ""}`}>{belowTarget ? "Target hit" : "Watching"}</span>
                </div>
                <h3>{data?.modelNames[modelKey] ?? modelKey}</h3>
                <div className="price-row">
                  <div>
                    <span className="price-label">BEST IN-STOCK PRICE</span>
                    <strong className="price">{best?.currentPrice != null ? money.format(best.currentPrice) : "—"}</strong>
                  </div>
                  <div className="sparkbars" aria-label="Recent lowest price trend">
                    {history.length ? history.map((row, i) => (
                      <i key={`${row.checkedAt}-${i}`} style={{ height: `${28 + ((max - row.price) / Math.max(max - min, 1)) * 42}%` }} />
                    )) : <span>No history yet</span>}
                  </div>
                </div>
                <div className="target-row">
                  <span>Alert me under</span>
                  {editing === modelKey ? (
                    <form onSubmit={(event) => { event.preventDefault(); saveTarget(modelKey); }}>
                      <label><span>$</span><input autoFocus inputMode="decimal" value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)} aria-label="Target price in Canadian dollars" /></label>
                      <button type="submit">Save</button>
                    </form>
                  ) : (
                    <button className="target-button" onClick={() => { setEditing(modelKey); setTargetDraft(String(target)); }}>
                      {money.format(target)} <span>edit</span>
                    </button>
                  )}
                </div>
                <div className="offers">
                  {loading ? <div className="loading-line" /> : inStock.length ? inStock.slice(0, 3).map((offer, offerIndex) => {
                    const dropped = offer.previousPrice !== null && offer.currentPrice !== null && offer.currentPrice < offer.previousPrice;
                    return (
                      <a href={offer.url} target="_blank" rel="noreferrer" className="offer" key={offer.id}>
                        <span className="rank">{offerIndex + 1}</span>
                        <span className="store"><strong>{offer.store}</strong><small>{offer.gripSizes.length ? `${offer.gripSizes.length} grip sizes` : "Check grip sizes"}</small></span>
                        <span className="offer-price"><strong>{money.format(offer.currentPrice ?? 0)}</strong>{dropped && <small>↓ {money.format((offer.previousPrice ?? 0) - (offer.currentPrice ?? 0))}</small>}</span>
                        <span className="arrow" aria-hidden="true">↗</span>
                      </a>
                    );
                  }) : <p className="empty">No in-stock match found today.</p>}
                </div>
              </article>
            );
          })}
        </div>

        <div className="sale-section">
          <div className="sale-heading">
            <div>
              <p className="eyebrow">THE REST OF THE SALE RACK</p>
              <h2>Other frames worth a look.</h2>
            </div>
            <span className="sale-note">Grip 3 only · new · in stock</span>
          </div>
          <div className="sale-grid">
            {(data?.saleOffers ?? []).map((offer) => (
              <a className="sale-offer" href={offer.url} target="_blank" rel="noreferrer" key={offer.id}>
                <span className="sale-store">{offer.store}</span>
                <strong>{offer.title}</strong>
                <span className="sale-prices"><b>{money.format(offer.currentPrice ?? 0)}</b><del>{offer.compareAtPrice != null ? money.format(offer.compareAtPrice) : ""}</del><i>↓ {offer.compareAtPrice && offer.currentPrice ? Math.round((1 - offer.currentPrice / offer.compareAtPrice) * 100) : 0}%</i></span>
                <span className="arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
          {!loading && !(data?.saleOffers?.length) && <p className="empty sale-empty">No additional grip-3 sale frames found in this check.</p>}
        </div>
      </section>

      <section className="how-it-works">
        <p className="eyebrow">HOW IT WORKS</p>
        <div className="steps">
          <div><span>01</span><strong>We check</strong><p>Enabled Canadian retailers, every hour.</p></div>
          <div><span>02</span><strong>We compare</strong><p>Only new, in-stock frames in CAD—no demo noise.</p></div>
          <div><span>03</span><strong>You save</strong><p>Set your price and jump directly to the retailer.</p></div>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark"><i /><i /><i /></span> BASELINE</a>
        <p>Prices can change between checks. Shipping and tax are confirmed at the retailer.</p>
        <span>CAD · CANADA</span>
      </footer>
    </main>
  );
}
