import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  createAccessVerifier,
  isAdminRequest,
  isPrivateOrLoopbackAddress,
  parseLoginList,
} from "../scripts/access-control.mjs";

const TEAM = "example-team.cloudflareaccess.com";
const AUD = "test-audience-tag";
const NOW = 1_800_000_000_000;

function makeKeys(kid) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" } };
}

function b64url(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

function sign(keys, claims, headerOverrides = {}) {
  const header = { alg: "RS256", kid: keys.kid, typ: "JWT", ...headerOverrides };
  const body = `${b64url(header)}.${b64url(claims)}`;
  const signature = createSign("RSA-SHA256").update(body).sign(keys.privateKey).toString("base64url");
  return `${body}.${signature}`;
}

const goodClaims = () => ({
  iss: `https://${TEAM}`,
  aud: [AUD],
  exp: Math.floor(NOW / 1000) + 300,
  nbf: Math.floor(NOW / 1000) - 10,
  email: "owner@example.com",
});

function verifierFor(keys, extra = {}) {
  return createAccessVerifier({
    teamDomain: TEAM,
    audience: AUD,
    now: () => NOW,
    fetchJwks: async () => ({ keys: [keys.jwk] }),
    ...extra,
  });
}

test("accepts a valid Cloudflare Access token", async () => {
  const keys = makeKeys("k1");
  const claims = await verifierFor(keys).verify(sign(keys, goodClaims()));
  assert.equal(claims?.email, "owner@example.com");
});

test("rejects tokens that are forged, tampered, expired or meant for someone else", async () => {
  const keys = makeKeys("k1");
  const other = makeKeys("k1"); // same kid, different private key
  const verifier = verifierFor(keys);
  const good = sign(keys, goodClaims());

  assert.equal(await verifier.verify(sign(other, goodClaims())), null, "signed with the wrong key");
  assert.equal(await verifier.verify(sign(keys, { ...goodClaims(), aud: ["someone-else"] })), null, "wrong audience");
  assert.equal(await verifier.verify(sign(keys, { ...goodClaims(), iss: "https://evil.cloudflareaccess.com" })), null, "wrong issuer");
  assert.equal(await verifier.verify(sign(keys, { ...goodClaims(), exp: Math.floor(NOW / 1000) - 3600 })), null, "expired");
  assert.equal(await verifier.verify(sign(keys, { ...goodClaims(), nbf: Math.floor(NOW / 1000) + 3600 })), null, "not yet valid");
  assert.equal(await verifier.verify(sign(keys, goodClaims(), { alg: "none" })), null, "alg none");
  assert.equal(await verifier.verify(sign(keys, goodClaims(), { kid: "unknown" })), null, "unknown key id");

  const [header, , signature] = good.split(".");
  const tamperedPayload = b64url({ ...goodClaims(), email: "attacker@example.com" });
  assert.equal(await verifier.verify(`${header}.${tamperedPayload}.${signature}`), null, "tampered payload");

  for (const junk of ["", "abc", "a.b", "a.b.c", "....", undefined, null, 42, "x".repeat(9000)]) {
    assert.equal(await verifier.verify(junk), null, `junk ${String(junk).slice(0, 12)}`);
  }
});

test("refuses to build a verifier from missing or unsafe configuration", () => {
  assert.equal(createAccessVerifier({ teamDomain: "", audience: AUD }), null);
  assert.equal(createAccessVerifier({ teamDomain: TEAM, audience: "" }), null);
  assert.equal(createAccessVerifier({ teamDomain: "attacker.example.com", audience: AUD }), null);
  assert.equal(createAccessVerifier({ teamDomain: `${TEAM}.evil.com`, audience: AUD }), null);
});

test("a failing key endpoint fails closed", async () => {
  const keys = makeKeys("k1");
  const verifier = verifierFor(keys, { fetchJwks: async () => { throw new Error("offline"); } });
  assert.equal(await verifier.verify(sign(keys, goodClaims())), null);
});

test("classifies private and loopback addresses", () => {
  for (const ok of ["127.0.0.1", "::1", "::ffff:192.168.50.20", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1"]) {
    assert.equal(isPrivateOrLoopbackAddress(ok), true, ok);
  }
  for (const bad of ["8.8.8.8", "172.32.0.1", "192.169.0.1", "300.1.1.1", "", undefined, "fe80::1"]) {
    assert.equal(isPrivateOrLoopbackAddress(bad), false, String(bad));
  }
});

test("a forged Cloudflare header no longer makes a request admin", async () => {
  const keys = makeKeys("k1");
  const verifier = verifierFor(keys);
  const forged = { host: "baseline.example.net", "cf-ray": "abc", "cf-access-jwt-assertion": "not-a-real-token" };
  assert.equal(await isAdminRequest({ headers: forged, remoteAddress: "127.0.0.1", verifier }), false);

  const tokenOnly = { host: "baseline.example.net", "cf-access-jwt-assertion": sign(makeKeys("k1"), goodClaims()) };
  assert.equal(await isAdminRequest({ headers: tokenOnly, remoteAddress: "127.0.0.1", verifier }), false, "token from another key");
});

test("a valid Access token through Cloudflare is admin, but only when configured", async () => {
  const keys = makeKeys("k1");
  const headers = { host: "baseline.example.net", "cf-ray": "abc", "cf-access-jwt-assertion": sign(keys, goodClaims()) };
  assert.equal(await isAdminRequest({ headers, remoteAddress: "127.0.0.1", verifier: verifierFor(keys) }), true);
  assert.equal(await isAdminRequest({ headers, remoteAddress: "127.0.0.1", verifier: null }), false, "no verifier configured");
});

test("spoofed forwarding or host headers cannot claim to be the local network", async () => {
  const base = { remoteAddress: "203.0.113.9", verifier: null };
  assert.equal(await isAdminRequest({ ...base, headers: { host: "baseline.example.net", "x-forwarded-host": "localhost" } }), false);
  assert.equal(await isAdminRequest({ ...base, headers: { host: "localhost", "cf-ray": "abc" } }), false, "cf header wins over Host");
  assert.equal(await isAdminRequest({ ...base, headers: { host: "localhost", "x-forwarded-for": "1.2.3.4" }, remoteAddress: "127.0.0.1" }), false, "proxied");
  assert.equal(await isAdminRequest({ ...base, headers: { host: "localhost" } }), false, "public internet peer");
});

test("direct LAN administration still works", async () => {
  const lan = { headers: { host: "192.168.50.230:4600" }, remoteAddress: "192.168.50.20", verifier: null };
  assert.equal(await isAdminRequest(lan), true);
  assert.equal(await isAdminRequest({ ...lan, headers: { host: "localhost:4600" }, remoteAddress: "::ffff:127.0.0.1" }), true);
  assert.equal(await isAdminRequest({ ...lan, headers: { host: "unknown.local" } }), false);
});

test("the public preview marker and public hostnames always win", async () => {
  const lan = { remoteAddress: "192.168.50.20", verifier: null };
  assert.equal(await isAdminRequest({ ...lan, headers: { host: "192.168.50.230", "x-baseline-public-preview": "true" } }), false);
  assert.equal(await isAdminRequest({ ...lan, headers: { host: "192.168.50.230", "x-forwarded-host": "baseline-beta.besada.net" } }), false);
});

test("Tailscale Serve admin needs an allowlisted login from the local proxy", async () => {
  const base = { verifier: null, tailscaleAdmins: ["owner@example.com"] };
  const viaServe = (login, extra = {}) => ({
    host: "nas.tail1234.ts.net",
    "tailscale-user-login": login,
    "x-forwarded-for": "100.64.0.7",
    ...extra,
  });
  assert.equal(await isAdminRequest({ ...base, headers: viaServe("owner@example.com"), remoteAddress: "127.0.0.1" }), true);
  assert.equal(await isAdminRequest({ ...base, headers: viaServe("Owner@Example.com"), remoteAddress: "::ffff:127.0.0.1" }), true, "login is case-insensitive");
  assert.equal(await isAdminRequest({ ...base, headers: viaServe("guest@example.com"), remoteAddress: "127.0.0.1" }), false, "not on the allowlist");
  assert.equal(await isAdminRequest({ ...base, headers: viaServe("owner@example.com"), remoteAddress: "192.168.50.20" }), false, "header sent straight from the LAN");
  assert.equal(await isAdminRequest({ ...base, tailscaleAdmins: [], headers: viaServe("owner@example.com"), remoteAddress: "127.0.0.1" }), false, "no allowlist configured");
  assert.equal(await isAdminRequest({ ...base, headers: viaServe("owner@example.com", { "cf-ray": "abc" }), remoteAddress: "127.0.0.1" }), false, "Cloudflare traffic still needs its token");
  assert.equal(await isAdminRequest({ ...base, headers: { host: "nas.tail1234.ts.net", "x-forwarded-for": "203.0.113.9" }, remoteAddress: "127.0.0.1" }), false, "Funnel traffic carries no login");
});

test("parses the Tailscale admin list", () => {
  assert.deepEqual(parseLoginList(" Owner@Example.com, ,second@example.com "), ["owner@example.com", "second@example.com"]);
  assert.deepEqual(parseLoginList(undefined), []);
});
