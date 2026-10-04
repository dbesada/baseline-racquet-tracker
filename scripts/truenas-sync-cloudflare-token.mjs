import fs from "node:fs";

// TrueNAS ships a self-signed certificate. Trust it explicitly by starting Node
// with NODE_EXTRA_CA_CERTS pointing at that certificate file, instead of turning
// verification off. As a temporary escape hatch on a trusted LAN, set
// BASELINE_ALLOW_INSECURE_TLS=1 to restore the old behaviour for one run.
if (process.env.BASELINE_ALLOW_INSECURE_TLS === "1") {
  console.warn("TLS certificate verification is DISABLED for this run (BASELINE_ALLOW_INSECURE_TLS=1).");
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
const truenasHost = process.env.TRUENAS_HOST ?? "192.168.50.230";
const truenasApiKeyFile = process.env.TRUENAS_API_KEY_FILE ?? "C:/AI/.codex/truenas-api-key.txt";

const token = process.env.BASELINE_CLOUDFLARE_TUNNEL_TOKEN?.trim();
if (!token || token.length < 100 || /\s/.test(token)) {
  throw new Error("BASELINE_CLOUDFLARE_TUNNEL_TOKEN is missing or invalid");
}

const apiKey = fs.readFileSync(truenasApiKeyFile, "utf8").trim();
const destination = "/mnt/pool0/apps/baseline/direct-data/cloudflare-tunnel-token";
let nextId = 1;
const pending = new Map();
const socket = new WebSocket(`wss://${truenasHost}/api/current`);

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
});

function rpc(method, params = [], timeoutMs = 60_000) {
  const id = nextId++;
  socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
    timer.unref();
  });
}

async function main() {
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  await rpc("auth.login_with_api_key", [apiKey]);

  const upload = new FormData();
  upload.set("data", JSON.stringify({ method: "filesystem.put", params: [destination] }));
  upload.set("file", new Blob([token]), "cloudflare-tunnel-token");
  try {
    const response = await fetch(`https://${truenasHost}/_upload/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upload,
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`Secret upload returned HTTP ${response.status}`);
  } catch (error) {
    console.warn(`Upload response did not close cleanly; verifying the credential (${error.message})`);
  }

  const uploaded = await rpc("filesystem.stat", [destination]);
  if (!uploaded?.size || uploaded.size < 100) throw new Error("The tunnel credential was not written to TrueNAS");
  console.log("Cloudflare tunnel credential synced to TrueNAS private storage");
}

try {
  await main();
} finally {
  socket.close();
}
