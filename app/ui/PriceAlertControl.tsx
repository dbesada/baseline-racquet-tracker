"use client";

import { useEffect, useState } from "react";
import { money } from "./baseline-catalogue";
import { listAlerts, pushSupport, removeAlert, saveAlert, type AlertMode, type PushSupport, type SavedAlert } from "./price-alerts";

// "Price alert" in a racquet's pop-up: a browser notification when the
// racquet reaches the visitor's target price, or on any price drop.
export function PriceAlertControl({ modelKey, target, onSaved }: { modelKey: string; target: number; onSaved?: (mode: AlertMode) => void }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [saved, setSaved] = useState<SavedAlert | null>(null);
  const [mode, setMode] = useState<AlertMode>("target");
  const [targetDraft, setTargetDraft] = useState(target > 0 ? String(target) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const found = pushSupport();
    // Browser-only checks, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(found);
    if (found === "ready") {
      listAlerts().then((alerts) => {
        if (!active || !alerts[modelKey]) return;
        setSaved(alerts[modelKey]);
        setMode(alerts[modelKey].mode);
        if (alerts[modelKey].target) setTargetDraft(String(alerts[modelKey].target));
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [modelKey]);

  const save = async () => {
    const value = Number(targetDraft);
    if (mode === "target" && !(Number.isFinite(value) && value > 0)) { setMessage("Enter the price you'd like to pay."); return; }
    setBusy(true);
    setMessage("");
    try {
      const alerts = await saveAlert(modelKey, mode, mode === "target" ? value : undefined);
      setSaved(alerts[modelKey] ?? null);
      setMessage(mode === "target" ? `We'll notify you when it's ${money.format(value)} or less.` : "We'll notify you whenever the best price drops.");
      onSaved?.(mode);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The alert could not be saved.");
      setSupport(pushSupport());
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await removeAlert(modelKey);
      setSaved(null);
      setMessage("Alert turned off.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The alert could not be turned off.");
    } finally {
      setBusy(false);
    }
  };

  if (support === null) return null;
  return <section className="price-alert" aria-label="Price alert">
    <div className="price-alert-head">
      <strong>🔔 Price alert</strong>
      {saved && <span className="price-alert-on">On · {saved.mode === "target" ? `at ${money.format(saved.target ?? 0)}` : "any drop"}</span>}
    </div>
    {support === "ready" ? <>
      <div className="price-alert-modes" role="radiogroup" aria-label="When to notify me">
        <label className={mode === "target" ? "active" : ""}>
          <input type="radio" name={`alert-${modelKey}`} checked={mode === "target"} onChange={() => setMode("target")} />
          <span>When it reaches my target</span>
          <span className="price-alert-target">$<input inputMode="decimal" value={targetDraft} onChange={(event) => { setTargetDraft(event.target.value); setMode("target"); }} aria-label="Target price in Canadian dollars" /></span>
        </label>
        <label className={mode === "drop" ? "active" : ""}>
          <input type="radio" name={`alert-${modelKey}`} checked={mode === "drop"} onChange={() => setMode("drop")} />
          <span>On any price drop</span>
        </label>
      </div>
      <div className="price-alert-actions">
        <button className="price-alert-save" onClick={save} disabled={busy}>{busy ? "Saving…" : saved ? "Update alert" : "Notify me"}</button>
        {saved && <button className="price-alert-off" onClick={turnOff} disabled={busy}>Turn off</button>}
      </div>
      <p className="price-alert-note">Prices are checked every 3 hours. Notifications come from this browser; no email or account needed.</p>
    </> : <p className="price-alert-note">{support === "ios-install"
      ? "On iPhone and iPad, add Baseline to your Home Screen (Share → Add to Home Screen), open it from there, and you can turn on alerts."
      : support === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser's site settings to get alerts."
        : "This browser can't show notifications. Open Baseline in Chrome, Edge, Firefox or Safari to get alerts."}</p>}
    {message && <p className="price-alert-message" role="status">{message}</p>}
  </section>;
}
