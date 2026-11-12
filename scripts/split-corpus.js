import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seed = 20261112;

function randomGenerator(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function splitSamples(samples, random) {
  const groups = new Map();
  for (const sample of samples) {
    const category = groups.get(sample.category) ?? [];
    category.push(sample);
    groups.set(sample.category, category);
  }
  const dev = [];
  const holdout = [];

  for (const category of [...groups.keys()].sort()) {
    const shuffled = [...groups.get(category)];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }

    let devCount = Math.round(shuffled.length * 0.7);
    if (shuffled.length > 1) devCount = Math.min(shuffled.length - 1, Math.max(1, devCount));
    dev.push(...shuffled.slice(0, devCount));
    holdout.push(...shuffled.slice(devCount));
  }
  return { dev, holdout };
}

await mkdir(path.join(root, "test", "corpus"), { recursive: true });
const report = [`# Divisão determinística dos corpora`, "", `- Seed: ${seed}.`,
  "- Estratégia: embaralhamento Fisher-Yates com seed fixa, estratificado por categoria.",
  "- Proporção alvo: 70% dev / 30% holdout; categorias com ao menos duas amostras aparecem nos dois conjuntos.",
  ""];

for (const name of ["benign", "malicious-sim"]) {
  const sourcePath = path.join(root, "test", "corpus", `${name}.json`);
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const { dev, holdout } = splitSamples(source, randomGenerator(seed ^ name.length));
  for (const [split, samples] of [["dev", dev], ["holdout", holdout]]) {
    await writeFile(
      path.join(root, "test", "corpus", `${split}-${name}.json`),
      `${JSON.stringify(samples, null, 2)}\n`
    );
  }
  report.push(`- ${name}: ${dev.length}/${holdout.length} amostras (dev/holdout) de ${source.length}.`);
}

await writeFile(path.join(root, "reports", "split.md"), `${report.join("\n")}\n`);
