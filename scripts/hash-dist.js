import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const report = path.join(root, "reports", "sha256.txt");

async function listFiles(directory, relative = "") {
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(directory, child));
    else if (entry.isFile()) files.push(child);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function hashes() {
  const files = await listFiles(dist);
  if (!files.length) throw new Error("dist/ não contém arquivos para hashear.");
  return Promise.all(files.map(async (relative) => {
    const bytes = await readFile(path.join(dist, relative));
    const digest = createHash("sha256").update(bytes).digest("hex");
    const filename = `dist/${relative.replaceAll("\\", "/")}`;
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error(`SHA-256 inválido para ${filename}.`);
    }
    return `${digest}  ${filename}`;
  }));
}

const firstPass = await hashes();
await mkdir(path.dirname(report), { recursive: true });
const contents = `${firstPass.join("\n")}\n`;
await writeFile(report, contents);

const secondPass = await hashes();
if (JSON.stringify(firstPass) !== JSON.stringify(secondPass)) {
  throw new Error("Os hashes da segunda leitura diferem da primeira.");
}
const persisted = await readFile(report, "utf8");
if (persisted !== contents || persisted.trimEnd().split("\n").length !== firstPass.length) {
  throw new Error("reports/sha256.txt não corresponde à lista verificada.");
}
for (const line of persisted.trimEnd().split("\n")) {
  const [digest, filename] = line.split(/\s{2}/);
  if (!/^[a-f0-9]{64}$/.test(digest) || !filename.startsWith("dist/")) {
    throw new Error(`Linha de hash inválida: ${line}`);
  }
}

console.log(persisted);
