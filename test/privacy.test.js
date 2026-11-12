import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const networkApis = [
  /\bfetch\b/i,
  /\bXMLHttpRequest\b/i,
  /\bWebSocket\b/i,
  /\bsendBeacon\b/i,
  /\bnavigator\s*\.\s*sendBeacon\b/i
];

test("src não contém APIs de rede", async () => {
  const files = await readdir(path.join(root, "src"));
  const violations = [];
  for (const file of files.filter((name) => name.endsWith(".js"))) {
    const source = await readFile(path.join(root, "src", file), "utf8");
    for (const pattern of networkApis) {
      if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
    }
  }
  assert.deepEqual(violations, []);
});
