import type { CapacitorConfig } from "@capacitor/cli";

const privateAppUrl = "https://nasbesada.tail0731b8.ts.net";
const publicAppUrl = "https://baseline.besada.net";
const productionBuild = process.env.BASELINE_BUILD === "production";
const configuredAppUrl = process.env.BASELINE_APP_URL?.trim();

const appUrl = configuredAppUrl ?? (productionBuild ? publicAppUrl : privateAppUrl);
if (!appUrl.startsWith("https://")) throw new Error("BASELINE_APP_URL must use HTTPS.");
const appHostname = new URL(appUrl).hostname.toLowerCase();
const privateProductionHost = appHostname.endsWith(".ts.net") || appHostname === "localhost" || appHostname === "127.0.0.1" || /^192\.168\./.test(appHostname) || /^10\./.test(appHostname);
if (productionBuild && privateProductionHost) {
  throw new Error("Production mobile builds require a publicly reachable HTTPS host, not Tailscale, localhost, or a private LAN address.");
}

const config: CapacitorConfig = {
  appId: "ca.baseline.racquetdeals",
  appName: "Baseline Racquet Deals",
  webDir: "www",
  server: {
    url: appUrl,
    cleartext: false,
    androidScheme: "https"
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: !productionBuild
  },
  ios: {
    backgroundColor: "#f4f1e8",
    contentInset: "automatic",
    preferredContentMode: "mobile",
    webContentsDebuggingEnabled: !productionBuild
  }
};

export default config;
