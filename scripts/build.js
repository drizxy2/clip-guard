import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

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

const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assert(manifest.manifest_version === 3, "manifest_version precisa ser 3");
assert(manifest.permissions?.includes("storage"), "manifest precisa da permissão storage");
assert(manifest.content_scripts?.some((script) =>
  script.all_frames && script.match_about_blank && script.match_origin_as_fallback &&
    script.run_at === "document_start" && script.world === "MAIN"
), "hook MAIN precisa rodar em todos os frames no document_start");
assert(manifest.content_scripts?.some((script) =>
  script.all_frames && script.match_about_blank && script.match_origin_as_fallback &&
    script.run_at === "document_start" && script.world === "ISOLATED"
), "bridge ISOLATED precisa rodar em todos os frames no document_start");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "src"), { recursive: true });
await mkdir(path.join(dist, "test", "pages"), { recursive: true });
await mkdir(path.join(dist, "scripts"), { recursive: true });

for (const file of ["package.json", "README.md"]) {
  await copyFile(path.join(root, file), path.join(dist, file));
}
await copyFile(path.join(root, "options.html"), path.join(dist, "options.html"));
await copyFile(manifestPath, path.join(dist, "manifest.json"));
await copyFile(path.join(root, "src", "classifier.js"), path.join(dist, "src", "classifier.js"));
await copyFile(path.join(root, "src", "ui.js"), path.join(dist, "src", "ui.js"));
await copyFile(path.join(root, "src", "background.js"), path.join(dist, "src", "background.js"));
await copyFile(path.join(root, "src", "options.js"), path.join(dist, "src", "options.js"));
await copyFile(path.join(root, "test", "pages", "clickfix-demo.html"), path.join(dist, "test", "pages", "clickfix-demo.html"));

const classifier = (await readFile(path.join(root, "src", "classifier.js"), "utf8"))
  .replace(/^export\s+/gm, "");
const hook = (await readFile(path.join(root, "src", "hook-main.js"), "utf8"))
  .replace(/^import\s+\{\s*classify\s*\}\s+from\s+["'][^"']+["'];\s*/m, "");
assert(!/^\s*import\s/m.test(hook), "hook MAIN contém import não compilado");
await writeFile(path.join(dist, "src", "hook-main.js"), `${classifier}\n${hook}`);

const ui = (await readFile(path.join(root, "src", "ui.js"), "utf8"))
  .replace(/^export\s+/gm, "");
const bridge = (await readFile(path.join(root, "src", "bridge.js"), "utf8"))
  .replace(/^import\s+\{\s*createUI\s*\}\s+from\s+["'][^"']+["'];\s*/m, "");
assert(!/^\s*import\s/m.test(bridge), "bridge ISOLATED contém import não compilado");
await writeFile(path.join(dist, "src", "bridge.js"), `${ui}\n${bridge}`);

const files = await walk(dist);
const entries = [];
for (const relative of files) {
  const data = await readFile(path.join(dist, relative));
  entries.push({ name: relative, data });
}
const archive = zipStored(entries);
await writeFile(path.join(dist, "clip-guard.zip"), archive);

for (const relative of files) {
  const data = await readFile(path.join(dist, relative));
  console.log(`${createHash("sha256").update(data).digest("hex")}  dist/${relative.replaceAll("\\", "/")}`);
}
console.log(`${createHash("sha256").update(archive).digest("hex")}  dist/clip-guard.zip`);
