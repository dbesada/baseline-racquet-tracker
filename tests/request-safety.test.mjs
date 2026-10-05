import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isOwnKey, readJsonObject } from "../app/lib/request-body.js";
import { createAuditLog } from "../scripts/audit-log.mjs";

const jsonRequest = (body) => new Request("http://localhost/api/tracker", { method: "PATCH", body });

test("readJsonObject accepts a JSON object", async () => {
  assert.deepEqual(await readJsonObject(jsonRequest('{"gripSize":"L2"}')), { gripSize: "L2" });
});

test("readJsonObject rejects bodies the PATCH handler cannot use", async () => {
  for (const body of ["", "{not json", "null", "[]", "42", '"L2"']) {
    assert.equal(await readJsonObject(jsonRequest(body)), null, `body ${JSON.stringify(body)}`);
  }
});

test("isOwnKey ignores inherited names", () => {
  const names = { "blade-v9": "Wilson Blade 98 v9" };
  assert.equal(isOwnKey(names, "blade-v9"), true);
  for (const key of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
    assert.equal(key in names, true, `${key} passes the old \`in\` check`);
    assert.equal(isOwnKey(names, key), false, `${key} is rejected`);
  }
  assert.equal(isOwnKey(names, undefined), false);
  assert.equal(isOwnKey(names, ["blade-v9"]), false);
});

test("the tracker API validates PATCH bodies and model keys", async () => {
  const route = await readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8");
  assert.match(route, /await readJsonObject\(request\)/);
  assert.doesNotMatch(route, /await request\.json\(\)/);
  assert.doesNotMatch(route, /\bin (?:modelNames|defaultTargets)\b/, "model keys are checked with isOwnKey, not `in`");
});

test("the tracker API leaves price checks to the relay", async () => {
  const route = await readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8");
  const post = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function PATCH"));
  assert.match(post, /^export async function POST\(request: Request\) \{\s*if \(isPublicPreview\(request\)\) return publicPreviewDenied\(\);/, "the public beta is refused first");
  assert.match(post, /\{ status: 501 \}\);\s*\}\s*$/, "everyone else is told checks run through the relay");
  assert.doesNotMatch(route, /\b(?:runCheck|checkRunning|activeGripSize)\b/, "no price-check state is left in the route");
});

test("the audit log rotates when it reaches its size cap", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "baseline-audit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "audit.log");
  await writeFile(path, "x".repeat(200));
  const audit = createAuditLog({ path, maxBytes: 100 });

  assert.equal(await audit("first after rotation"), true);
  assert.equal((await stat(`${path}.1`)).size, 200, "the full log moved aside");
  assert.match(await readFile(path, "utf8"), /^\S+ first after rotation\n$/);

  await audit("second");
  assert.equal((await readFile(path, "utf8")).split("\n").filter(Boolean).length, 2);
});

test("the audit log writes throttled entries at most once per interval", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "baseline-audit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "audit.log");
  let clock = 1_800_000_000_000;
  const audit = createAuditLog({ path, throttleMs: 60_000, now: () => clock });

  assert.equal(await audit("probe", { throttleKey: "probe" }), true);
  assert.equal(await audit("probe", { throttleKey: "probe" }), false);
  assert.equal(await audit("challenge"), true, "entries without a key are never throttled");
  clock += 60_000;
  assert.equal(await audit("probe", { throttleKey: "probe" }), true);
  assert.equal((await readFile(path, "utf8")).split("\n").filter(Boolean).length, 3);
});

test("the audit log never throws when it cannot write", async () => {
  const audit = createAuditLog({ path: join(tmpdir(), "baseline-missing-dir", "nested", "audit.log") });
  assert.equal(await audit("probe"), false);
});

test("the relay writes eBay callback entries through the capped audit log", async () => {
  const relay = await readFile(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8");
  assert.match(relay, /createAuditLog\(\{ path: "\/app\/\.data\/ebay-callback-audit\.log" \}\)/);
  assert.doesNotMatch(relay, /appendFile/);
});
