"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BaselineCoach, type CoachString } from "./BaselineCoach";
import type { Dashboard, MarketTab, GripSize, BrandKey, BrandViewKey, AnalyticsSummary, OpportunityMode, InstallPromptEvent, TargetEditor } from "./baseline-types";
import {
  writePublicPreferences,
  applyPublicPreferences,
  publicPreferencesFromDashboard,
  brandList,
  alphabeticalBrandList,
  maxCompareFrames,
  gripLabel,
  gripOptions,
  money,
  uniqueRetailerOffers,
} from "./baseline-catalogue";
import { AccessoryMarket, useAccessoryMarket } from "./AccessoryMarket";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { BallMarket, useBallMarket } from "./BallMarket";
import { catalogueMetrics as computeCatalogueMetrics, coachModels as computeCoachModels, marketplaceHealth as computeMarketplaceHealth, opportunityChoices as computeOpportunityChoices, resolveRacquetSpecs } from "./dashboard-insights";
import { RacquetGuide, StringGuide } from "./EquipmentGuides";
import { RacquetBrowser, useRacquetCatalogue, type RacquetCardContext } from "./RacquetBrowser";
import { CompareTray, ComparisonDialog, ImagePreviewDialog, RetailerDialog } from "./RacquetDialogs";
import { RetailHero, SourceHealth } from "./RetailHero";
import { SettingsPanel, type InstallContext } from "./SettingsPanel";
import { SpecialEditionMarket, useSpecialEditions } from "./SpecialEditionMarket";
import { StringMarket, useStringMarket } from "./StringMarket";
import { UsedMarket, useUsedBoard } from "./UsedMarket";

const browseHeadings: Partial<Record<BrandViewKey, { eyebrow: string; title: string }>> = {
  all: { eyebrow: "YOUR WATCHLIST", title: "Six frames. Best price wins." },
  catalogue: { eyebrow: "THE COMPLETE MARKET", title: "All racquets. One searchable market." },
  special: { eyebrow: "LIMITED COLOURWAYS & COLLABORATIONS", title: "Special editions in every available grip." },
  strings: { eyebrow: "CANADIAN TENNIS STRING MARKET", title: "Find the right feel, type, and gauge." },
  balls: { eyebrow: "CANADIAN TENNIS BALL MARKET", title: "The right ball for every court." },
  accessories: { eyebrow: "RACQUET ACCESSORIES ACROSS CANADA", title: "Everything around the frame, in one place." },
  guide: { eyebrow: "THE RACQUET TRANSLATOR", title: "What racquet numbers feel like on court." },
  "string-guide": { eyebrow: "THE STRING TRANSLATOR", title: "What to put in the frame." },
};

const browseLegends: Partial<Record<BrandViewKey, React.ReactNode>> = {
  special: <><span className="special-dot" /> Verified grip-level stock <span className="stock-dot" /> In stock</>,
  strings: <><span className="string-dot" /> Canadian prices <span className="stock-dot" /> In stock</>,
  balls: <><span className="string-dot" /> Package-matched prices <span className="stock-dot" /> In stock</>,
  accessories: <><span className="accessory-dot" /> Canadian prices <span className="stock-dot" /> In stock</>,
  guide: <><span className="string-dot" /> Plain language <span className="stock-dot" /> Published specs vary by setup</>,
  "string-guide": <><span className="string-dot" /> Plain language <span className="stock-dot" /> Published specs vary by setup</>,
};

export function BaselineApp() {
  const [activeMarket, setActiveMarket] = useState<MarketTab>("retail");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [modelFetching, setModelFetching] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState<Set<string>>(() => new Set());
  const modelRefreshTimes = useRef(new Map<string, number>());
  const [modelFetchMessage, setModelFetchMessage] = useState("");
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installContext, setInstallContext] = useState<InstallContext>("browser");
  const [activeBrand, setActiveBrand] = useState<BrandViewKey>("all");
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [retailerModelKey, setRetailerModelKey] = useState<string | null>(null);
  const [imagePreviewKey, setImagePreviewKey] = useState<string | null>(null);
  const [opportunityMode, setOpportunityMode] = useState<OpportunityMode>("target");

  const resolvedRacquetSpecs = useMemo(() => resolveRacquetSpecs(data), [data]);
  const catalogueMetrics = useMemo(() => computeCatalogueMetrics(data), [data]);
  const opportunityChoices = useMemo(() => computeOpportunityChoices(data), [data]);
  const marketplaceHealth = useMemo(() => computeMarketplaceHealth(data), [data]);
  const retailerModelOffers = useMemo(() => retailerModelKey ? uniqueRetailerOffers((data?.offers ?? []).filter((offer) => offer.modelKey === retailerModelKey && offer.currentPrice !== null && (offer.inStock || /pre[- ]?order|coming soon/i.test(offer.title)))) : [], [data, retailerModelKey]);

  const catalogue = useRacquetCatalogue(data, resolvedRacquetSpecs, catalogueMetrics, activeBrand);
  const specialEditions = useSpecialEditions(data?.specialOffers ?? data?.offers, data?.gripSize ?? "L3");
  const stringMarket = useStringMarket(data?.stringOffers);
  const ballMarket = useBallMarket(data?.ballOffers);
  const accessoryMarket = useAccessoryMarket(data?.accessoryOffers);
  const usedBoard = useUsedBoard(data);

  const coachModels = useMemo(() => computeCoachModels(data, resolvedRacquetSpecs), [data, resolvedRacquetSpecs]);
  const coachStrings = useMemo<CoachString[]>(() => stringMarket.allGroups.map((group) => ({
    key: group.key,
    title: group.title,
    brand: group.brand,
    type: group.type,
    gauges: group.gauges,
    format: group.format,
    price: group.bestOffer.currentPrice ?? 0,
    store: group.bestOffer.store,
    url: group.bestOffer.url,
  })).filter((item) => item.price > 0), [stringMarket.allGroups]);

  const load = useCallback(async () => {
    const response = await fetch("/api/tracker", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load prices");
    setData(applyPublicPreferences(await response.json() as Dashboard));
  }, []);

  const trackAnalytics = useCallback((event: string, detail?: string) => {
    if (!data?.publicPreview || navigator.doNotTrack === "1") return;
    const query = new URLSearchParams({ event });
    if (detail) query.set("detail", detail);
    void fetch(`/api/analytics?${query.toString()}`, { cache: "no-store", keepalive: true }).catch(() => undefined);
  }, [data?.publicPreview]);

  const openAnalytics = useCallback(async () => {
    setAnalyticsOpen(true);
    setAnalyticsLoading(true);
    try {
      const response = await fetch("/api/analytics", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load analytics");
      setAnalytics(await response.json() as AnalyticsSummary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("market") === "used") setActiveMarket("used");
      load().catch((caught) => setError(caught.message)).finally(() => setLoading(false));
      setNotifications(localStorage.getItem("baseline-notifications") === "on" && Notification.permission === "granted");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (data?.publicPreview) trackAnalytics("page_view");
  }, [data?.publicPreview, trackAnalytics]);

  useEffect(() => {
    if (!data?.publicPreview || activeBrand === "all") return;
    trackAnalytics("browse_section", activeBrand);
  }, [activeBrand, data?.publicPreview, trackAnalytics]);

  useEffect(() => {
    if (data?.publicPreview && activeMarket === "used") trackAnalytics("used_market");
  }, [activeMarket, data?.publicPreview, trackAnalytics]);

  useEffect(() => {
    if (data?.publicPreview && retailerModelKey) trackAnalytics("retailer_open");
  }, [data?.publicPreview, retailerModelKey, trackAnalytics]);

  useEffect(() => {
    if (data?.publicPreview && comparisonOpen) trackAnalytics("comparison_open");
  }, [comparisonOpen, data?.publicPreview, trackAnalytics]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const capacitor = (window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setInstallContext(capacitor?.isNativePlatform?.() ? "native" : standalone ? "installed" : ios ? "ios" : "browser");
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstallPrompt(null);
      setInstallContext("installed");
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  useEffect(() => {
    if (!retailerModelKey) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setRetailerModelKey(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [retailerModelKey]);

  const installBaseline = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallContext("installed");
    setInstallPrompt(null);
  };

  const fetchNewModels = async () => {
    if (data?.publicPreview) {
      setModelFetchMessage("The public beta refreshes its catalogue automatically. New model scans are managed by Baseline.");
      return;
    }
    setModelFetching(true);
    setModelFetchMessage("Starting an official catalogue scan...");
    setError("");
    try {
      let response = await fetch("/api/tracker?action=models", { method: "POST" });
      if (!response.ok) throw new Error("The model catalogue refresh could not start.");
      let next = await response.json() as Dashboard;
      setData(next);
      for (let attempt = 0; attempt < 100 && next.modelRefresh?.status === "running"; attempt += 1) {
        setModelFetchMessage("Checking official manufacturer catalogues... You can keep browsing.");
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        response = await fetch("/api/tracker", { cache: "no-store" });
        if (!response.ok) continue;
        next = await response.json() as Dashboard;
        setData(next);
      }
      const result = next.modelRefresh;
      if (result?.status === "failed") throw new Error("The official catalogue scan did not finish. Please try again.");
      if (result?.status === "running") {
        setModelFetchMessage("The scan is continuing in the background. Results will appear automatically.");
      } else if (result) {
        setModelFetchMessage(`Catalogue refreshed: ${result.scanned} models checked, ${result.verified} officially verified, ${result.images} official images updated.`);
      } else {
        setModelFetchMessage("Catalogue and retailer listings refreshed.");
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The model catalogue refresh failed.";
      setError(message);
      setModelFetchMessage(message);
    } finally {
      setModelFetching(false);
    }
  };

  const checkNow = async () => {
    if (data?.publicPreview) return;
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

  const saveTarget = async (modelKey: string, market: "new" | "used" = "new") => {
    const value = Number(targetDraft);
    if (!Number.isFinite(value) || value <= 0) return;
    if (data?.publicPreview) {
      setData((current) => {
        if (!current) return current;
        const next = market === "used"
          ? { ...current, usedTargets: { ...current.usedTargets, [modelKey]: value } }
          : { ...current, targets: { ...current.targets, [modelKey]: value } };
        writePublicPreferences(publicPreferencesFromDashboard(next));
        return next;
      });
      setEditing(null);
      return;
    }
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelKey, targetPrice: value, market }),
    });
    if (response.ok) setData(await response.json());
    setEditing(null);
  };

  const targetEditor: TargetEditor = {
    editingKey: editing,
    draft: targetDraft,
    setDraft: setTargetDraft,
    start: (editingKey, target) => { setEditing(editingKey); setTargetDraft(String(target)); },
    save: saveTarget,
  };

  const toggleRetailer = async (retailerKey: string, enabled: boolean) => {
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retailerKey, enabled }),
    });
    if (response.ok) setData(await response.json());
  };

  const changeGripSize = async (gripSize: GripSize) => {
    catalogue.resetPaging();
    if (data?.publicPreview) {
      setData((current) => {
        if (!current) return current;
        const next = { ...current, gripSize };
        writePublicPreferences(publicPreferencesFromDashboard(next));
        return next;
      });
      return;
    }
    const response = await fetch("/api/tracker", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ gripSize }),
    });
    if (response.ok) setData(await response.json());
  };

  const refreshSelectedModel = useCallback(async (modelKey: string) => {
    if (data?.publicPreview) return;
    const lastRefresh = modelRefreshTimes.current.get(modelKey) ?? 0;
    if (Date.now() - lastRefresh < 10 * 60 * 1000) return;
    modelRefreshTimes.current.set(modelKey, Date.now());
    setRefreshingModels((current) => new Set(current).add(modelKey));
    try {
      const response = await fetch(`/api/tracker?action=model&modelKey=${encodeURIComponent(modelKey)}`, { method: "POST" });
      if (response.ok) setData(await response.json());
      else modelRefreshTimes.current.delete(modelKey);
    } catch {
      modelRefreshTimes.current.delete(modelKey);
    } finally {
      setRefreshingModels((current) => {
        const next = new Set(current);
        next.delete(modelKey);
        return next;
      });
    }
  }, [data?.publicPreview]);

  const replaceFrame = async (slot: number, selectedModelKey: string) => {
    if (data?.publicPreview) {
      setData((current) => {
        if (!current) return current;
        const modelOrder = [...current.modelOrder];
        if (modelOrder.some((modelKey, index) => index !== slot && modelKey === selectedModelKey)) return current;
        modelOrder[slot] = selectedModelKey;
        const next = { ...current, modelOrder };
        writePublicPreferences(publicPreferencesFromDashboard(next));
        return next;
      });
      return;
    }
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, selectedModelKey }),
    });
    if (response.ok) setData(await response.json());
    void refreshSelectedModel(selectedModelKey);
  };

  const replaceFeaturedFrame = async (featuredBrand: Exclude<BrandKey, "all">, featuredSlot: number, selectedModelKey: string) => {
    const response = await fetch("/api/tracker", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ featuredBrand, featuredSlot, selectedModelKey }),
    });
    if (response.ok) setData(await response.json());
    void refreshSelectedModel(selectedModelKey);
  };

  const changeMarket = (market: MarketTab) => {
    setActiveMarket(market);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const toggleCompare = (modelKey: string) => {
    const isAdding = !compareKeys.includes(modelKey) && compareKeys.length < maxCompareFrames;
    if (isAdding) void refreshSelectedModel(modelKey);
    setCompareKeys((current) => current.includes(modelKey)
      ? current.filter((key) => key !== modelKey)
      : current.length < maxCompareFrames ? [...current, modelKey] : current);
  };

  const compareCoachPicks = (modelKeys: string[]) => {
    const uniqueKeys = [...new Set(modelKeys)].slice(0, maxCompareFrames);
    setActiveMarket("retail");
    setCompareKeys(uniqueKeys);
    setComparisonOpen(uniqueKeys.length >= 2);
    uniqueKeys.forEach((modelKey) => { void refreshSelectedModel(modelKey); });
  };

  const racquetCards: RacquetCardContext = {
    data,
    specs: resolvedRacquetSpecs,
    loading,
    activeBrand,
    compareKeys,
    refreshingModels,
    targetEditor,
    onToggleCompare: toggleCompare,
    onDealOpen: () => trackAnalytics("deal_open"),
    onShowRetailers: setRetailerModelKey,
    onPreviewImage: setImagePreviewKey,
  };
  const racquetBrandActive = activeBrand === "catalogue" || brandList.includes(activeBrand as Exclude<BrandKey, "all">);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href={activeMarket === "retail" ? "#top" : "#used-top"} aria-label="Baseline home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          BASELINE
        </a>
        <nav className="market-tabs" aria-label="Marketplace view">
          <button className={activeMarket === "retail" ? "active" : ""} aria-pressed={activeMarket === "retail"} onClick={() => changeMarket("retail")}>New retail</button>
          <button className={activeMarket === "used" ? "active" : ""} aria-pressed={activeMarket === "used"} onClick={() => changeMarket("used")}>Used market</button>
        </nav>
        <div className="top-actions">
          <span className="status-dot"><i /> {activeMarket === "retail" ? `Watching ${data?.stores.length ?? 5} stores` : `${data?.usedOffers.length ?? 0} verified used listings`}</span>
          {data?.publicPreview && <span className="beta-badge">Public beta</span>}
          {!data?.publicPreview && <button className="analytics-button" onClick={openAnalytics}>Analytics</button>}
          <label className="top-grip-select">
            <span>Grip</span>
            <select value={data?.gripSize ?? "L3"} onChange={(event) => changeGripSize(event.target.value as GripSize)} aria-label="Preferred grip size">
              {gripOptions.map((option) => <option value={option.key} key={`top-${option.key}`}>{option.key} — {option.inches}</option>)}
            </select>
          </label>
          <button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label={data?.publicPreview ? "Open my Baseline preferences" : "Open tracker settings"}><span className="settings-desktop-label">{data?.publicPreview ? "My picks" : "Settings"}</span><span className="settings-mobile-label" aria-hidden="true">☰</span></button>
          {activeMarket === "retail" ? (
            !data?.publicPreview && <button className={`alert-toggle ${notifications ? "on" : ""}`} onClick={toggleNotifications}>
              <span aria-hidden="true">{notifications ? "●" : "○"}</span>
              {notifications ? "Alerts on" : "Turn on alerts"}
            </button>
          ) : <a className="alert-toggle buyer-link" href="#buyer-checklist">Buyer checklist</a>}
        </div>
      </header>

      {analyticsOpen && !data?.publicPreview && <AnalyticsPanel analytics={analytics} loading={analyticsLoading} onClose={() => setAnalyticsOpen(false)} />}

      {settingsOpen && <SettingsPanel
        data={data}
        marketplaces={marketplaceHealth}
        installContext={installContext}
        installPrompt={installPrompt}
        onInstall={installBaseline}
        onReplaceFrame={replaceFrame}
        onReplaceFeaturedFrame={replaceFeaturedFrame}
        onGripSizeChange={changeGripSize}
        onToggleRetailer={toggleRetailer}
        onClose={() => setSettingsOpen(false)}
      />}

      {activeMarket === "retail" ? <>
      <RetailHero
        data={data}
        loading={loading}
        checking={checking}
        error={error}
        opportunities={opportunityChoices}
        opportunityMode={opportunityMode}
        specs={resolvedRacquetSpecs}
        onCheckNow={checkNow}
        onOpportunityModeChange={setOpportunityMode}
        onShowRetailers={setRetailerModelKey}
      />

      <section className="watchlist" id="browse-market">
        <div className="browse-navigation">
          <nav className="brand-nav" aria-label="Browse equipment categories">
            <button className={activeBrand === "all" ? "active" : ""} aria-pressed={activeBrand === "all"} onClick={() => setActiveBrand("all")}>My watchlist</button>
            <button className={racquetBrandActive ? "active" : ""} aria-pressed={racquetBrandActive} onClick={() => { setActiveBrand("catalogue"); catalogue.resetPaging(); }}>Racquets</button>
            <button className={activeBrand === "special" ? "active" : ""} aria-pressed={activeBrand === "special"} onClick={() => setActiveBrand("special")}>Special editions</button>
            <button className={activeBrand === "strings" ? "active" : ""} aria-pressed={activeBrand === "strings"} onClick={() => { setActiveBrand("strings"); stringMarket.resetPaging(); }}>Strings</button>
            <button className={activeBrand === "balls" ? "active" : ""} aria-pressed={activeBrand === "balls"} onClick={() => { setActiveBrand("balls"); ballMarket.resetPaging(); }}>Balls</button>
            <button className={activeBrand === "accessories" ? "active" : ""} aria-pressed={activeBrand === "accessories"} onClick={() => { setActiveBrand("accessories"); accessoryMarket.resetPaging(); }}>Accessories</button>
            <button className={activeBrand === "guide" ? "active" : ""} aria-pressed={activeBrand === "guide"} onClick={() => setActiveBrand("guide")}>Racquet guide</button>
            <button className={activeBrand === "string-guide" ? "active" : ""} aria-pressed={activeBrand === "string-guide"} onClick={() => setActiveBrand("string-guide")}>String guide</button>
          </nav>
          {racquetBrandActive && <label className="racquet-brand-picker">
            <span>Brand</span>
            <select value={activeBrand} onChange={(event) => { setActiveBrand(event.target.value as BrandViewKey); catalogue.resetPaging(); }} aria-label="Choose a racquet brand">
              <option value="catalogue">All brands</option>
              {alphabeticalBrandList.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
            </select>
          </label>}
        </div>
        <SourceHealth data={data} />
        <div className="section-heading">
          <div>
            <p className="eyebrow">{browseHeadings[activeBrand]?.eyebrow ?? `${activeBrand.toUpperCase()} RACQUETS`}</p>
            <h2>{browseHeadings[activeBrand]?.title ?? `The best of ${activeBrand}, in one place.`}</h2>
          </div>
          <div className="legend">{browseLegends[activeBrand] ?? <><span className="deal-dot" /> Below target <span className="stock-dot" /> In stock</>}</div>
        </div>

        {activeBrand === "guide" ? <RacquetGuide />
          : activeBrand === "string-guide" ? <StringGuide examples={stringMarket.guideExamples} />
          : activeBrand === "strings" ? <StringMarket market={stringMarket} loading={loading} />
          : activeBrand === "balls" ? <BallMarket market={ballMarket} loading={loading} />
          : activeBrand === "accessories" ? <AccessoryMarket market={accessoryMarket} loading={loading} />
          : activeBrand === "special" ? <SpecialEditionMarket market={specialEditions} gripSize={data?.gripSize ?? "L3"} loading={loading} specs={resolvedRacquetSpecs} onPreviewImage={setImagePreviewKey} />
          : <RacquetBrowser
            catalogue={catalogue}
            cards={racquetCards}
            modelFetch={{ fetching: modelFetching, checking, message: modelFetchMessage, onFetch: fetchNewModels }}
            onGripSizeChange={changeGripSize}
          />}
      </section>

      <section className="how-it-works">
        <p className="eyebrow">HOW IT WORKS</p>
        <div className="steps">
          <div><span>01</span><strong>We check</strong><p>Enabled Canadian retailers, every 3 hours.</p></div>
          <div><span>02</span><strong>We compare</strong><p>{activeBrand === "accessories" ? "Only in-stock racquet accessories in CAD, grouped across retailers." : activeBrand === "balls" ? "Only matching tennis-ball packages in CAD—never a single can against a case." : activeBrand === "strings" ? "Only in-stock tennis strings in CAD, grouped by family and gauge." : "Only new, in-stock frames in CAD—no demo noise."}</p></div>
          <div><span>03</span><strong>You save</strong><p>Set your price and jump directly to the retailer.</p></div>
        </div>
      </section>
      </> : <UsedMarket
        board={usedBoard}
        data={data}
        loading={loading}
        checking={checking}
        marketplaces={marketplaceHealth}
        specs={resolvedRacquetSpecs}
        targetEditor={targetEditor}
        onCheckNow={checkNow}
        onGripSizeChange={changeGripSize}
        onPreviewImage={setImagePreviewKey}
      />}

      <nav className="mobile-dock" aria-label="Quick navigation">
        <button onClick={() => { setActiveMarket("retail"); setActiveBrand("all"); document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }); }}><span aria-hidden="true">⌂</span>Home</button>
        <button onClick={() => { setActiveMarket("retail"); setActiveBrand("catalogue"); document.getElementById("browse-market")?.scrollIntoView({ behavior: "smooth" }); }}><span aria-hidden="true">⌕</span>Browse</button>
        <button onClick={() => changeMarket("used")}><span aria-hidden="true">♲</span>Used</button>
        <button disabled={compareKeys.length < 2} onClick={() => setComparisonOpen(true)}><span aria-hidden="true">⇄</span>Compare{compareKeys.length ? ` (${compareKeys.length})` : ""}</button>
      </nav>

      {imagePreviewKey && <ImagePreviewDialog
        modelKey={imagePreviewKey}
        modelName={data?.modelNames[imagePreviewKey] ?? imagePreviewKey}
        spec={resolvedRacquetSpecs[imagePreviewKey]}
        onClose={() => setImagePreviewKey(null)}
      />}

      {retailerModelKey && <RetailerDialog
        modelKey={retailerModelKey}
        data={data}
        offers={retailerModelOffers}
        spec={resolvedRacquetSpecs[retailerModelKey]}
        onPreviewImage={setImagePreviewKey}
        onClose={() => setRetailerModelKey(null)}
      />}

      {activeMarket === "retail" && compareKeys.length > 0 && <CompareTray
        compareKeys={compareKeys}
        modelNames={data?.modelNames}
        onRemove={toggleCompare}
        onClear={() => setCompareKeys([])}
        onOpen={() => setComparisonOpen(true)}
      />}

      {comparisonOpen && <ComparisonDialog
        compareKeys={compareKeys}
        data={data}
        specs={resolvedRacquetSpecs}
        refreshingModels={refreshingModels}
        onPreviewImage={setImagePreviewKey}
        onClose={() => setComparisonOpen(false)}
      />}

      <BaselineCoach
        models={coachModels}
        strings={coachStrings}
        gripLabel={gripLabel(data?.gripSize ?? "L3")}
        raised={activeMarket === "retail" && compareKeys.length > 0}
        onCompare={compareCoachPicks}
        onOpen={() => trackAnalytics("coach_open")}
      />

      <footer>
        <a className="brand footer-brand" href={activeMarket === "retail" ? "#top" : "#used-top"}><span className="brand-mark"><i /><i /><i /></span> BASELINE</a>
        <p>{activeMarket === "retail" ? "Prices can change between checks. Shipping and tax are confirmed at the retailer." : "Used listings can change quickly. Inspect the frame and use buyer-protected payment."}</p>
        <span>CAD · CANADA</span>
      </footer>
    </main>
  );
}
