import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const lines = (file) => read(file).split(/\r?\n/).map((line) => line.trim());

test("env files can never be baked into the Docker image", () => {
  const ignored = lines(".dockerignore");
  assert.ok(ignored.includes(".env"), ".dockerignore must exclude .env");
  assert.ok(ignored.includes(".env.*"), ".dockerignore must exclude .env.*");
});

test("the documented .env.example exists and is not ignored by git", () => {
  assert.ok(fs.existsSync(new URL("../.env.example", import.meta.url)), ".env.example is missing");
  assert.ok(lines(".gitignore").includes("!.env.example"), ".gitignore must allow .env.example");
  assert.match(read(".env.example"), /^CF_ACCESS_AUD=/m);
});

test("the release archive leaves env files out", () => {
  assert.match(read("scripts/release-truenas.ps1"), /--exclude=\.env\b/);
});

test("release scripts do not switch off TLS verification unless asked", () => {
  for (const file of ["scripts/truenas-registry-release.mjs", "scripts/truenas-sync-cloudflare-token.mjs"]) {
    const source = read(file);
    const assignments = source.match(/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*"0"/g) ?? [];
    assert.equal(assignments.length, 1, `${file} should only disable TLS behind the opt-in`);
    assert.match(source, /if \(process\.env\.BASELINE_ALLOW_INSECURE_TLS === "1"\) \{[^}]*NODE_TLS_REJECT_UNAUTHORIZED/s);
  }
});

test("the TrueNAS deployment keeps the UI on loopback behind the relay", () => {
  const compose = read("deploy/truenas-compose.yml");
  assert.match(compose, /"start:loopback"/);
  assert.match(read("package.json"), /"start:loopback":\s*"[^"]*--ip 127\.0\.0\.1"/);
  assert.match(compose, /CF_ACCESS_TEAM_DOMAIN/);
});

test("the relay no longer trusts client-supplied host forwarding for admin", () => {
  const relay = read("scripts/baseline-relay.mjs");
  assert.doesNotMatch(relay, /cf-access-jwt-assertion"\]\s*&&/);
  assert.match(relay, /isAdminRequest/);
});

test("the registry password is passed in a private file, never in the app config", () => {
  const source = read("scripts/truenas-registry-release.mjs");
  assert.doesNotMatch(source, /REGISTRY_PASS/, "no REGISTRY_PASS variable in the generated compose");
  assert.match(source, /--password-stdin < \$\{containerPasswordFile\}/);
  assert.match(source, /trap 'rm -f \$\{containerPasswordFile\}' EXIT/);
  assert.match(source, /mode: 0o600/);
  assert.ok(
    source.indexOf("await uploadRegistryPassword()") < source.indexOf("custom_compose_config_string: builderCompose()"),
    "the password file must be uploaded before the builder app starts",
  );
});

test("the relay reads the Tailscale admin allowlist from the deployment", () => {
  assert.match(read("scripts/baseline-relay.mjs"), /BASELINE_TAILSCALE_ADMINS/);
  assert.match(read("deploy/truenas-compose.yml"), /BASELINE_TAILSCALE_ADMINS:/);
});

test("the running app does not mount the Docker socket", () => {
  // The socket gives full control of Docker on the NAS. It was only used to
  // set up the Tailscale routes, which the README now documents.
  assert.doesNotMatch(read("deploy/truenas-compose.yml"), /docker\.sock/);
});
