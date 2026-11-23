import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const locales = ["en", "pt_BR", "es"];
const sourceFiles = [
  "options.html",
  "src/options.js",
  "src/ui.js",
  "src/i18n.js"
];

test("all i18n keys used by extension UI exist in every locale", async () => {
  const messages = new Map();
  for (const locale of locales) {
    messages.set(locale, JSON.parse(await readFile(
      path.join(root, "_locales", locale, "messages.json"),
      "utf8"
    )));
  }
  const englishKeys = Object.keys(messages.get("en")).sort();
  for (const locale of locales.slice(1)) {
    assert.deepEqual(Object.keys(messages.get(locale)).sort(), englishKeys, `${locale} keys`);
  }

  const source = (await Promise.all(sourceFiles.map((file) =>
    readFile(path.join(root, file), "utf8")
  ))).join("\n");
  const usedKeys = new Set([
    ...source.matchAll(/data-i18n="([A-Za-z][A-Za-z0-9]+)"/g)
  ].map((match) => match[1]));
  for (const pattern of [
    /\bt\(["']([A-Za-z][A-Za-z0-9]+)["']/g,
    /message\(getMessage,\s*["']([A-Za-z][A-Za-z0-9]+)["']/g,
    /\["(?:[^"\\]|\\.)+",\s*"((?:reason|method)[A-Z][A-Za-z0-9]+)"\]/g,
    /:\s*"((?:reason|method)[A-Z][A-Za-z0-9]+)"/g
  ]) {
    for (const match of source.matchAll(pattern)) usedKeys.add(match[1]);
  }
  for (const key of usedKeys) {
    assert.ok(messages.get("en")[key], `Missing i18n key ${key}`);
    for (const locale of locales) {
      assert.ok(messages.get(locale)[key]?.message, `Missing ${locale} message ${key}`);
    }
  }
});

test("localized free-confirmation copy matches requested UI language strings", async () => {
  const expected = {
    en: ["Clip Guard: Copy OK ✅", "Clip Guard: Paste OK ✅"],
    pt_BR: ["Clip Guard: Cópia Livre ✅", "Clip Guard: Cola Livre ✅"],
    es: ["Clip Guard: Copia libre ✅", "Clip Guard: Pegado libre ✅"]
  };
  for (const [locale, values] of Object.entries(expected)) {
    const messages = JSON.parse(await readFile(
      path.join(root, "_locales", locale, "messages.json"),
      "utf8"
    ));
    assert.equal(messages.toastCopyOK.message, values[0]);
    assert.equal(messages.toastPasteOK.message, values[1]);
  }
});
