import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const version = process.argv[2]?.trim();
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) throw new Error("Pass a semantic version, for example 0.1.6");
const deployOnly = process.argv.includes("--deploy-only");
const localArchive = process.argv[3];
if (!deployOnly && (!localArchive || !fs.existsSync(localArchive))) throw new Error("The release source archive was not provided");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiKey = fs.readFileSync(truenasApiKeyFile, "utf8").trim();
const registryUri = "https://index.docker.io/v1";
const registryHost = "docker.io";
const image = `dbesada/baseline-racquet-tracker:${version}`;
let registryCredentials;
const appName = "baseline-price-checker";
const builderName = `baseline-publisher-${version.replaceAll(".", "-")}`;
const remoteArchive = `/mnt/pool0/apps/baseline/inbox/baseline-src-${version}.tar.gz`;
const marker = `/mnt/pool0/apps/baseline/inbox/baseline-registry-${version}-ready`;
const containerArchive = `/release/baseline-src-${version}.tar.gz`;
const containerMarker = `/release/baseline-registry-${version}-ready`;
const persistentSettingsPath = "/mnt/pool0/apps/baseline/direct-data/baseline-settings.json";

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
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
  });
}

async function waitJob(id, timeoutMs = 20 * 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await rpc("core.get_jobs", [[['id', '=', Number(id)]], { get: true, extra: { raw_result: true } }]);
    if (job.state === "SUCCESS") return job.result;
    if (job.state === "FAILED" || job.state === "ABORTED") throw new Error(job.error || `${job.method} failed`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Job ${id} did not finish in time`);
}

async function deleteApp(name) {
  const found = await rpc("app.query", [[['name', '=', name]]]);
  if (!found.length) return;
  try {
    await waitJob(await rpc("app.delete", [name]));
  } catch (error) {
    if (!String(error.message).includes("ENOENT")) throw error;
  }
}

async function ensureRegistry() {
  const registries = await rpc("app.registry.query", [[], {}]);
  registryCredentials = registries.find((entry) => String(entry.uri).replace(/\/$/, "") === registryUri);
  if (!registryCredentials?.username || !registryCredentials?.password) {
    throw new Error("Docker Hub credentials are not configured in TrueNAS");
  }
}

async function backupLiveSettings() {
  try {
    const response = await fetch(`http://${truenasHost}:4600/api/tracker`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const dashboard = await response.json();
    const settings = {
      version: 1,
      savedAt: new Date().toISOString(),
      gripSize: dashboard.gripSize ?? "L3",
      targets: dashboard.targets ?? {},
      usedTargets: dashboard.usedTargets ?? {},
      modelOrder: dashboard.modelOrder ?? [],
      brandPicks: dashboard.brandPicks ?? {},
      retailers: (dashboard.retailers ?? []).map(({ key, name, enabled }) => ({ key, name, enabled: Boolean(enabled) })),
    };
    const upload = new FormData();
    upload.set("data", JSON.stringify({ method: "filesystem.put", params: [persistentSettingsPath] }));
    upload.set("file", new Blob([JSON.stringify(settings, null, 2)]), "baseline-settings.json");
    const uploadResponse = await fetch(`https://${truenasHost}/_upload/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upload,
      signal: AbortSignal.timeout(30_000),
    });
    if (!uploadResponse.ok) throw new Error(`upload HTTP ${uploadResponse.status}`);
    console.log("Backed up persistent Baseline settings");
  } catch (error) {
    console.warn(`Could not refresh the settings backup; preserving the existing persistent copy (${error.message})`);
  }
}

function builderCompose() {
  return [
    "services:",
    "  publisher:",
    "    image: docker:27-cli",
    "    restart: \"no\"",
    "    entrypoint: [\"/bin/sh\", \"-lc\"]",
    "    environment:",
    `      REGISTRY_USER: ${JSON.stringify(registryCredentials.username)}`,
    `      REGISTRY_PASS: ${JSON.stringify(registryCredentials.password)}`,
    "    volumes:",
    "      - /var/run/docker.sock:/var/run/docker.sock",
    "      - /mnt/pool0/apps/baseline/inbox:/release",
    "    command:",
    "      - >-",
    `        exec > /release/baseline-publisher-${version}.log 2>&1; set -e; rm -f ${containerMarker};`,
    "        rm -rf /tmp/baseline-src && mkdir -p /tmp/baseline-src;",
    `        tar -xzf ${containerArchive} -C /tmp/baseline-src;`,
    '        printf \'%s\' "$$REGISTRY_PASS" | docker login ' + registryHost + ' --username "$$REGISTRY_USER" --password-stdin;',
    `        docker build --pull -t ${image} /tmp/baseline-src;`,
    `        docker push ${image};`,
    `        touch ${containerMarker}`,
    "",
  ].join("\n");
}

async function waitForMarker(timeoutMs = 20 * 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await rpc("filesystem.stat", [marker]);
      return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Registry publisher did not finish in time");
}

async function main() {
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  await rpc("auth.login_with_api_key", [apiKey]);
  await backupLiveSettings();

  if (!deployOnly) {
    const upload = new FormData();
    upload.set("data", JSON.stringify({ method: "filesystem.put", params: [remoteArchive] }));
    upload.set("file", new Blob([fs.readFileSync(localArchive)]), path.basename(localArchive));
    try {
      const uploadResponse = await fetch(`https://${truenasHost}/_upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upload,
        signal: AbortSignal.timeout(45_000),
      });
      if (!uploadResponse.ok) throw new Error(`Source upload returned HTTP ${uploadResponse.status}`);
    } catch (error) {
      console.warn(`Upload response did not close cleanly; verifying the uploaded file (${error.message})`);
    }
    const uploaded = await rpc("filesystem.stat", [remoteArchive]);
    if (!uploaded?.size) throw new Error("The source archive was not written to TrueNAS");

    await ensureRegistry();
    await deleteApp(builderName);

    console.log(`Publishing ${image}`);
    await waitJob(await rpc("app.create", [{ app_name: builderName, custom_app: true, custom_compose_config_string: builderCompose() }]));
    await waitForMarker();
    await deleteApp(builderName);
  }

  const template = fs.readFileSync(path.join(root, "deploy", "truenas-compose.yml"), "utf8");
  const compose = template.replaceAll("__IMAGE__", image);
  const existing = await rpc("app.query", [[['name', '=', appName]]]);
  if (existing.length && existing[0].state !== "STOPPED") await waitJob(await rpc("app.stop", [appName]));
  const deployJob = existing.length
    ? await rpc("app.update", [appName, { custom_compose_config_string: compose }])
    : await rpc("app.create", [{ app_name: appName, custom_app: true, custom_compose_config_string: compose }]);
  await waitJob(deployJob);
  const deployed = await rpc("app.query", [[['name', '=', appName]]]);
  if (deployed[0]?.state === "STOPPED") await waitJob(await rpc("app.start", [appName]));

  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      // Verify the deployed relay directly on the LAN. The public URLs can
      // legitimately redirect through Cloudflare Access or depend on the
      // current Tailscale client, which caused healthy releases to be marked
      // as failed after deployment had already completed.
      const response = await fetch(`http://${truenasHost}:4600/`, { signal: AbortSignal.timeout(10_000) });
      if (response.ok) { healthy = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (!healthy) throw new Error("Deployment completed, but the public health check failed");
  console.log(`Deployed and verified ${image}`);
}

try {
  await main();
} finally {
  socket.close();
}
