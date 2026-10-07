import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { racquetHash, racquetKeyFromHash } from "../app/ui/racquet-link.js";

test("racquet links round-trip and reject anything that is not a model key", () => {
  assert.equal(racquetHash("blade-98-v9"), "#racquet-blade-98-v9");
  assert.equal(racquetKeyFromHash("#racquet-blade-98-v9"), "blade-98-v9");
  for (const hash of ["", "#top", "#racquet-", "#racquet-<script>", "#racquet-%E0%A4%A", "#racquet-Blade", "#racquet-a/b", null]) {
    assert.equal(racquetKeyFromHash(hash), null, String(hash));
  }
});

test("the page opens a racquet from its link, keeps the address in step, and offers Copy link", async () => {
  const [app, dialogs] = await Promise.all([
    readFile(new URL("../app/ui/BaselineApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/RacquetDialogs.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /window\.addEventListener\("hashchange", openFromLink\)/);
  assert.match(app, /if \(modelKey && modelNames\?\.\[modelKey\]\) \{ setRacquetTab\("specs"\); setRetailerModelKey\(modelKey\); \}/, "only known racquets open");
  assert.match(app, /window\.history\.replaceState\(null, "", racquetHash\(retailerModelKey\)\)/);
  assert.match(app, /else if \(linkedRacquet\.current && racquetKeyFromHash\(window\.location\.hash\)\)/, "closing clears only a racquet link the page set");
  assert.match(dialogs, /<CopyRacquetLink modelKey=\{modelKey\} \/>/);
});
