import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "src", "compat.js"), "utf8");

test("compatibility layer selects the Firefox browser namespace", () => {
  const browser = {};
  const context = vm.createContext({ browser, chrome: {} });
  vm.runInContext(source, context);
  assert.equal(context.clipGuardApi, browser);
});

test("compatibility layer selects the Chromium chrome namespace", () => {
  const chrome = {};
  const context = vm.createContext({ chrome });
  vm.runInContext(source, context);
  assert.equal(context.clipGuardApi, chrome);
});

test("compatibility layer fails explicitly when no WebExtension API exists", () => {
  assert.throws(() => vm.runInNewContext(source), /WebExtension API indisponível/);
});
