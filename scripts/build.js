import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const locales = [
  "en", "zh_CN", "hi", "es", "ar", "fr", "bn", "pt_BR", "id", "ur",
  "ru", "de", "ja", "pcm", "ar_EG", "mr", "vi", "te", "sw", "ha"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name.replaceAll("\\", "/"));
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const crc = crc32(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + body.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function walk(directory, relative = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const childRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path.join(directory, entry.name), childRelative));
    else result.push(childRelative);
  }
  return result;
}

await rm(dist, { recursive: true, force: true });
const classifier = (await readFile(path.join(root, "src", "classifier.js"), "utf8"))
  .replace(/^export\s+/gm, "");
const hook = (await readFile(path.join(root, "src", "hook-main.js"), "utf8"))
  .replace(/^import\s+\{\s*classify\s*\}\s+from\s+["'][^"']+["'];\s*/m, "");
assert(!/^\s*import\s/m.test(hook), "hook MAIN contém import não compilado");

const ui = (await readFile(path.join(root, "src", "ui.js"), "utf8"))
  .replace(/^export\s+/gm, "");
const i18n = (await readFile(path.join(root, "src", "i18n.js"), "utf8"))
  .replace(/^export\s+/gm, "");
const bridge = (await readFile(path.join(root, "src", "bridge.js"), "utf8"))
  .replace(/^import\s+\{\s*createUI\s*\}\s+from\s+["'][^"']+["'];\s*/m, "");
assert(!/^\s*import\s/m.test(bridge), "bridge ISOLATED contém import não compilado");
const compiledUI = ui.replace(
  /^import\s+\{\s*isRightToLeft,\s*translateMethod,\s*translateReason\s*\}\s+from\s+["'][^"']+["'];\s*/m,
  ""
);
assert(!/^\s*import\s/m.test(compiledUI), "UI ISOLATED contém import não compilado");

const baseManifest = JSON.parse(await readFile(path.join(root, "build", "manifest.base.json"), "utf8"));
const targets = ["chromium", "firefox"];

for (const browser of targets) {
  const browserDiff = JSON.parse(await readFile(
    path.join(root, "build", `manifest.${browser}.json`),
    "utf8"
  ));
  const manifest = { ...baseManifest, ...browserDiff };
  assert(manifest.manifest_version === 3, `${browser}: manifest_version precisa ser 3`);
  assert(manifest.default_locale === "en", `${browser}: default_locale precisa ser en`);
  assert(manifest.name === "__MSG_extensionName__" &&
    manifest.description === "__MSG_extensionDescription__",
  `${browser}: nome/descrição precisam usar mensagens i18n`);
  assert(manifest.permissions?.includes("storage"), `${browser}: manifesto precisa da permissão storage`);
  assert(manifest.content_scripts?.some((script) =>
    script.all_frames && script.match_about_blank && script.match_origin_as_fallback &&
      script.run_at === "document_start" && script.world === "MAIN"
  ), `${browser}: hook MAIN precisa rodar em todos os frames no document_start`);
  assert(manifest.content_scripts?.some((script) =>
    script.all_frames && script.match_about_blank && script.match_origin_as_fallback &&
      script.run_at === "document_start" && script.world === "ISOLATED" &&
      script.js?.[0] === "src/compat.js"
  ), `${browser}: bridge ISOLATED precisa rodar em todos os frames no document_start`);
  if (browser === "chromium") {
    assert(manifest.background?.service_worker, "Chromium precisa de service_worker");
  } else {
    assert(manifest.background?.scripts?.includes("src/background.js"),
      "Firefox precisa de background.scripts");
    assert(manifest.background.scripts.indexOf("src/compat.js") <
      manifest.background.scripts.indexOf("src/background.js"),
    "Firefox precisa carregar a compatibilidade antes do background");
    assert(manifest.browser_specific_settings?.gecko?.id === "clip-guard@drizxy2.github.io",
      "Firefox precisa do ID Gecko configurado");
    assert(manifest.browser_specific_settings.gecko.strict_min_version === "128.0",
      "Firefox precisa da versão mínima 128.0");
    assert(manifest.browser_specific_settings.gecko_android?.strict_min_version === "142.0",
      "Firefox para Android precisa da versão mínima 142.0");
  }

  const output = path.join(dist, browser);
  await mkdir(path.join(output, "src"), { recursive: true });
  for (const file of ["package.json", "README.md"]) {
    await copyFile(path.join(root, file), path.join(output, file));
  }
  await copyFile(path.join(root, "options.html"), path.join(output, "options.html"));
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const file of ["classifier.js", "ui.js", "i18n.js", "compat.js", "options.js"]) {
    await copyFile(path.join(root, "src", file), path.join(output, "src", file));
  }
  if (browser === "chromium") {
    const compat = await readFile(path.join(root, "src", "compat.js"), "utf8");
    const background = await readFile(path.join(root, "src", "background.js"), "utf8");
    await writeFile(path.join(output, "src", "background.js"), `${compat}\n${background}`);
  } else {
    await copyFile(
      path.join(root, "src", "background.js"),
      path.join(output, "src", "background.js")
    );
  }
  await writeFile(path.join(output, "src", "hook-main.js"), `${classifier}\n${hook}`);
  await writeFile(path.join(output, "src", "bridge.js"), `${i18n}\n${compiledUI}\n${bridge}`);

  for (const locale of locales) {
    const localeDirectory = path.join(output, "_locales", locale);
    await mkdir(localeDirectory, { recursive: true });
    await copyFile(
      path.join(root, "_locales", locale, "messages.json"),
      path.join(localeDirectory, "messages.json")
    );
  }

  const files = await walk(output);
  const entries = [];
  for (const relative of files) {
    const data = await readFile(path.join(output, relative));
    entries.push({ name: relative, data });
  }
  const archive = zipStored(entries);
  const archivePath = path.join(dist, `${browser}.zip`);
  await writeFile(archivePath, archive);

  if (browser === "chromium") {
    await writeFile(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  for (const relative of files) {
    const data = await readFile(path.join(output, relative));
    console.log(`${createHash("sha256").update(data).digest("hex")}  dist/${browser}/${relative.replaceAll("\\", "/")}`);
  }
  console.log(`${createHash("sha256").update(archive).digest("hex")}  dist/${browser}.zip`);
}

const chromiumArchive = path.join(dist, "chromium.zip");
const releaseArchive = path.join(dist, "clip-guard.zip");
await copyFile(chromiumArchive, releaseArchive);
const releaseHash = createHash("sha256")
  .update(await readFile(releaseArchive))
  .digest("hex");
console.log(`${releaseHash}  dist/clip-guard.zip`);
