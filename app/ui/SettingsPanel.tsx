"use client";

import { useMemo } from "react";
import type { BrandKey, Dashboard, GripSize, InstallPromptEvent } from "./baseline-types";
import { alphabeticalBrandList, featuredByBrand, gripLabel, gripOptions, modelBrand } from "./baseline-catalogue";
import type { MarketplaceHealth } from "./dashboard-insights";

export type InstallContext = "browser" | "ios" | "installed" | "native";

export function SettingsPanel({ data, marketplaces, installContext, installPrompt, onInstall, onReplaceFrame, onReplaceFeaturedFrame, onGripSizeChange, onToggleRetailer, onClose }: {
  data: Dashboard | null;
  marketplaces: MarketplaceHealth[];
  installContext: InstallContext;
  installPrompt: InstallPromptEvent | null;
  onInstall: () => void;
  onReplaceFrame: (slot: number, modelKey: string) => void;
  onReplaceFeaturedFrame: (brand: Exclude<BrandKey, "all">, slot: number, modelKey: string) => void;
  onGripSizeChange: (gripSize: GripSize) => void;
  onToggleRetailer: (retailerKey: string, enabled: boolean) => void;
  onClose: () => void;
}) {
  const sortedModelOptions = useMemo(
    () => [...(data?.modelOptions ?? [])].sort((a, b) => a.name.localeCompare(b.name, "en-CA", { sensitivity: "base" })),
    [data],
  );
  const sortedRetailers = useMemo(
    () => [...(data?.retailers ?? [])].sort((a, b) => a.name.localeCompare(b.name, "en-CA", { sensitivity: "base" })),
    [data],
  );
  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-panel-head">
          <div><p className="eyebrow">{data?.publicPreview ? "YOUR BASELINE" : "BASELINE CONTROL ROOM"}</p><h2 id="settings-title">{data?.publicPreview ? "My picks" : "Settings"}</h2></div>
          <button className="close-settings" onClick={onClose} aria-label="Close settings">×</button>
        </div>
        <div className="settings-block">
          <span className="settings-label">YOUR TOP FRAMES</span>
          <p className="settings-help">These six frames appear on My watchlist. {data?.publicPreview ? "They are saved only in this browser." : "Choose any six unique tracked models."}</p>
          <div className="retailer-list">
            {(data?.modelOrder ?? []).map((modelKey, slot) => (
              <label className="retailer-toggle" key={`slot-${slot}`}>
                <span><strong>Slot {slot + 1}</strong><small>{data?.modelNames[modelKey] ?? modelKey}</small></span>
                <select value={modelKey} onChange={(event) => onReplaceFrame(slot, event.target.value)} aria-label={`Replace frame slot ${slot + 1}`}>
                  <optgroup label="Top-rated & available">
                    {sortedModelOptions.filter((option) => option.topRated).map((option) => (
                      <option value={option.key} key={option.key} disabled={data?.modelOrder.some((selected, selectedSlot) => selectedSlot !== slot && selected === option.key)}>{option.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="More tracked frames">
                    {sortedModelOptions.filter((option) => !option.topRated).map((option) => (
                      <option value={option.key} key={option.key} disabled={data?.modelOrder.some((selected, selectedSlot) => selectedSlot !== slot && selected === option.key)}>{option.name}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
            ))}
          </div>
        </div>
        {!data?.publicPreview && <div className="settings-block">
          <span className="settings-label">FEATURED BY BRAND</span>
          <p className="settings-help">Choose the six main racquets shown at the top of each brand page. The remaining models automatically stay under Other suggestions.</p>
          <div className="brand-settings">
            {alphabeticalBrandList.map((brand) => (
              <section className="brand-setting-group" key={brand}>
                <div className="brand-setting-head"><strong>{brand}</strong><span>6 featured frames</span></div>
                {(data?.brandPicks?.[brand] ?? featuredByBrand[brand]).map((modelKey, slot) => (
                  <label className="brand-frame-select" key={`${brand}-${slot}`}>
                    <span>{slot + 1}</span>
                    <select value={modelKey} onChange={(event) => onReplaceFeaturedFrame(brand, slot, event.target.value)} aria-label={`${brand} featured frame ${slot + 1}`}>
                      {sortedModelOptions.filter((option) => modelBrand(option.key) === brand).map((option) => (
                        <option value={option.key} key={option.key} disabled={(data?.brandPicks?.[brand] ?? featuredByBrand[brand]).some((selected, selectedSlot) => selectedSlot !== slot && selected === option.key)}>{option.name.replace(`${brand} `, "")}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </section>
            ))}
          </div>
        </div>}
        <div className="settings-block">
          <span className="settings-label">GRIP SIZE</span>
          <p className="settings-help">{data?.publicPreview ? "Use your preferred grip while browsing. It is saved only in this browser." : "Choose the grip Baseline should require across new stock, used listings, marketplace searches and alerts. The next scheduled or manual check refreshes all results."}</p>
          <label className="grip-setting">
            <span><strong>Required grip</strong><small>{gripLabel(data?.gripSize ?? "L3")}</small></span>
            <select value={data?.gripSize ?? "L3"} onChange={(event) => onGripSizeChange(event.target.value as GripSize)} aria-label="Required racquet grip size">
              {gripOptions.map((option) => <option value={option.key} key={option.key}>{option.key} — {option.inches}</option>)}
            </select>
          </label>
        </div>
        {!data?.publicPreview && <div className="settings-block">
          <span className="settings-label">CHECK FREQUENCY</span>
          <div className="frequency-card"><strong>Every 3 hours</strong><span>Automatic checks run every 3 hours. You can still check manually anytime.</span></div>
        </div>}
        <div className="settings-block">
          <span className="settings-label">APP ON THIS DEVICE</span>
          <div className={`install-card ${installContext}`}>
            <span className="install-card-icon" aria-hidden="true">B</span>
            <span className="install-card-copy">
              <strong>{installContext === "native" || installContext === "installed" ? "Baseline is installed" : "Install Baseline"}</strong>
              <small>{installContext === "native" ? "Running in the native mobile app." : installContext === "installed" ? "It opens from your home screen like an app." : installContext === "ios" ? "In Safari, tap Share, then Add to Home Screen." : installPrompt ? "Add it to your home screen for a full-screen app experience." : "Open your browser menu and choose Install app or Add to Home screen."}</small>
            </span>
            {installPrompt && installContext === "browser" && <button onClick={onInstall}>Install</button>}
            {(installContext === "native" || installContext === "installed") && <i aria-label="Installed">✓</i>}
          </div>
          <a className="settings-privacy-link" href="/privacy">Read the Baseline privacy policy →</a>
        </div>
        {!data?.publicPreview && <div className="settings-block">
          <span className="settings-label">USED MARKETPLACES</span>
          <p className="settings-help">Public listing collectors run every three hours. Facebook uses an isolated browser with no saved account password; exact grip evidence is still required before an ad appears.</p>
          <div className="marketplace-health">
            {marketplaces.map((source) => (
              <div className="marketplace-health-row" key={source.name}>
                <span><strong>{source.name}</strong><small>{!source.configured ? "Automated connector needs API credentials" : source.checked ? `${source.offers} matching listings this check` : "Waiting for first check"}</small></span>
                <i className={source.online ? "online" : "offline"}>{!source.configured ? "Setup" : source.online ? "Live" : "Unavailable"}</i>
              </div>
            ))}
          </div>
        </div>}
        {!data?.publicPreview && <div className="settings-block">
          <span className="settings-label">RETAILERS</span>
          <p className="settings-help">Canadian retailers and outlets are listed below. Stores with dependable public price, stock, and grip data are checked automatically; catalogue-only stores open directly.</p>
          <div className="retailer-list">
            {sortedRetailers.map((retailer) => retailer.kind === "manual" ? (
              <div className="retailer-toggle manual-retailer" key={retailer.key}>
                <span>
                  <strong>{retailer.name}</strong>
                  <small>Store directory · no reliable public grip feed</small>
                </span>
                <a className="manual-store-link" href={retailer.url} target="_blank" rel="noreferrer">Open store ↗</a>
              </div>
            ) : (
              <label className="retailer-toggle" key={retailer.key}>
                <span>
                  <strong>{retailer.name}</strong>
                  {retailer.kind === "amazon" && <small>Best-effort marketplace search</small>}
                  {retailer.kind === "woocommerce" && <small>Automated catalog feed</small>}
                  {retailer.kind === "lightspeed" && <small>Automated variant catalog</small>}
                  {retailer.kind === "wix" && <small>Automated grip-level catalog scan</small>}
                  {retailer.kind === "structured" && <small>Best-effort public catalog scan</small>}
                </span>
                <input type="checkbox" checked={retailer.enabled} onChange={(event) => onToggleRetailer(retailer.key, event.target.checked)} />
                <i aria-hidden="true" />
              </label>
            ))}
          </div>
        </div>}
        {!data?.publicPreview && <p className="settings-footnote">Racquet matches are filtered to the selected {gripLabel(data?.gripSize ?? "L3")} grip across new, used, special-edition and alert views. String, ball and accessory catalogues are not grip-specific. Amazon can throttle automated searches, so those feeds may occasionally report no results.</p>}
      </aside>
    </div>
  );
}
