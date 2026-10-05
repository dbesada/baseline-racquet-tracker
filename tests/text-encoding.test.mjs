import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// UTF-8 text that was once decoded as Windows-1252 and saved again turns "↗"
// into "â†—" and "ö" into "Ã¶": a lead character Â, Ã or â followed by a
// Windows-1252 punctuation or Latin-1 symbol. Real copy never contains these
// pairs, so any match is a garbled character.
const garbled = /[ÂÃâ][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]/u;

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceDirectories = ["app", "scripts", "worker"];
const sourceFile = /\.(?:[cm]?js|tsx?|css|json|html)$/;

async function sourceFiles(directory) {
  const entries = await readdir(join(root, directory), { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && sourceFile.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

test("the garbled-character check recognizes the patterns it guards against", () => {
  assert.match("â†—", garbled, "a mis-decoded ↗");
  assert.match("vÃ¶lkl", garbled, "a mis-decoded ö");
  assert.doesNotMatch("Völkl ↗ · — – ’ “ ” × ² ⌂ ♲ ⇄ é à", garbled, "correct characters pass");
});

test("source files contain no garbled UTF-8 characters", async () => {
  const problems = [];
  for (const directory of sourceDirectories) {
    for (const file of await sourceFiles(directory)) {
      const lines = (await readFile(file, "utf8")).split("\n");
      lines.forEach((line, index) => {
        const match = line.match(garbled);
        if (match) problems.push(`${relative(root, file).replaceAll("\\", "/")}:${index + 1} "${line.slice(Math.max(0, match.index - 20), match.index + 20).trim()}"`);
      });
    }
  }
  assert.deepEqual(problems, []);
});
