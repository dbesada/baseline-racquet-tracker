// Browser side of price alerts: checks whether this browser can show
// notifications, subscribes it with the relay's public key, and saves or
// removes one racquet's alert. The relay sends the notifications.

export type AlertMode = "target" | "drop";
export type SavedAlert = { mode: AlertMode; target?: number };
export type PushSupport = "ready" | "ios-install" | "denied" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function post(path: string, body: unknown): Promise<Record<string, SavedAlert>> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as { error?: string; alerts?: Record<string, SavedAlert> };
  if (!response.ok || result.error) throw new Error(result.error ?? "The alert could not be saved. Please try again.");
  return result.alerts ?? {};
}

// The existing subscription, without asking for permission.
export async function currentSubscription() {
  if (pushSupport() !== "ready") return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function subscribe() {
  const existing = await currentSubscription();
  if (existing) return existing;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked for this site. Allow them in your browser settings to get alerts.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const response = await fetch("/api/push/key", { cache: "no-store" });
  if (!response.ok) throw new Error("Alerts are not available right now.");
  const { publicKey } = await response.json() as { publicKey: string };
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}

export async function listAlerts(): Promise<Record<string, SavedAlert>> {
  const subscription = await currentSubscription();
  return subscription ? post("/api/push/alerts", { subscription: subscription.toJSON() }) : {};
}

export async function saveAlert(modelKey: string, mode: AlertMode, target?: number) {
  const subscription = await subscribe();
  return post("/api/push/alert", { subscription: subscription.toJSON(), modelKey, mode, target });
}

export async function removeAlert(modelKey: string): Promise<Record<string, SavedAlert>> {
  const subscription = await currentSubscription();
  if (!subscription) return {};
  return post("/api/push/remove", { subscription: subscription.toJSON(), modelKey });
}
