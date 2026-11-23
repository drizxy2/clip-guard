import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { isRightToLeft } from "../src/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const locales = [
  "en", "zh_CN", "hi", "es", "ar", "fr", "bn", "pt_BR", "id", "ur",
  "ru", "de", "ja", "pcm", "ar_EG", "mr", "vi", "te", "sw", "ha"
];
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
  assert.deepEqual(
    (await readdir(path.join(root, "_locales"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    [...locales].sort(),
    "supported locale directories"
  );
  assert.deepEqual(
    (await readdir(path.join(root, "docs", "locales")))
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.slice(0, -3))
      .sort(),
    [...locales].sort(),
    "localized user guides"
  );
  for (const locale of locales) {
    for (const key of englishKeys) {
      const placeholders = (value) => [...value.matchAll(/\{[0-9]+\}/g)]
        .map(([placeholder]) => placeholder)
        .sort();
      assert.deepEqual(
        placeholders(messages.get(locale)[key].message),
        placeholders(messages.get("en")[key].message),
        `${locale}.${key} placeholders`
      );
    }
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

test("right-to-left languages are detected from browser locale tags", () => {
  assert.equal(isRightToLeft("ar"), true);
  assert.equal(isRightToLeft("ar-EG"), true);
  assert.equal(isRightToLeft("ar_EG"), true);
  assert.equal(isRightToLeft("ur-PK"), true);
  assert.equal(isRightToLeft("en-US"), false);
  assert.equal(isRightToLeft("zh_CN"), false);
});
