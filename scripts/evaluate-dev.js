import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classify } from "../src/classifier.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = path.join(root, "test", "corpus");

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} terminou com código ${result.status}`);
}

function validateSamples(samples, filename, includeMetadata = false) {
  if (!Array.isArray(samples)) throw new Error(`${filename} precisa conter uma lista JSON`);
  for (const [index, sample] of samples.entries()) {
    const requiredFields = includeMetadata
      ? ["text", "source", "category", "notes"]
      : ["text", "category"];
    if (!sample || requiredFields.some((key) =>
      typeof sample[key] !== "string"
    )) {
      throw new Error(`${filename}[${index}] precisa dos campos ${requiredFields.join(", ")} como texto`);
    }
  }
  return samples;
}

async function loadSamples(filename) {
  return JSON.parse(await readFile(path.join(corpusRoot, filename), "utf8"));
}

function percent(count, total) {
  return total ? Number((count / total * 100).toFixed(2)) : 0;
}

function measure(benign, malicious, split) {
  const ambiguous = benign.filter(({ category }) => category === "ambiguous");
  const fp = benign.filter(({ text }) => classify(text).level !== "none");
  const ambiguousFp = ambiguous.filter(({ text }) => classify(text).level !== "none");
  const nonAmbiguous = benign.filter(({ category }) => category !== "ambiguous");
  const nonAmbiguousFp = nonAmbiguous.filter(({ text }) => classify(text).level !== "none");
  const fn = malicious.filter(({ text }) => classify(text).level === "none");
  return {
    split,
    benign: benign.length,
    ambiguous: ambiguous.length,
    malicious: malicious.length,
    fp: { count: fp.length, total: benign.length, ratePercent: percent(fp.length, benign.length) },
    ambiguousFp: {
      count: ambiguousFp.length,
      total: ambiguous.length,
      ratePercent: percent(ambiguousFp.length, ambiguous.length)
    },
    nonAmbiguousFp: {
      count: nonAmbiguousFp.length,
      total: nonAmbiguous.length,
      ratePercent: percent(nonAmbiguousFp.length, nonAmbiguous.length)
    },
    fn: { count: fn.length, total: malicious.length, ratePercent: percent(fn.length, malicious.length) }
  };
}

const rate = ({ count, total, ratePercent }) =>
  `${count}/${total} (${ratePercent.toFixed(2)}%)`;
const describeSplit = (stats) => [
  `- Falsos positivos, benignas totais: ${rate(stats.fp)}.`,
  `- FP em benignas não ambíguas: ${rate(stats.nonAmbiguousFp)}.`,
  `- FP em benignas ambíguas: ${rate(stats.ambiguousFp)}.`,
  `- Falsos negativos: ${rate(stats.fn)}.`
].join("\n");

await mkdir(path.join(root, "reports"), { recursive: true });

// Refresh the mutation, browser, and timing artifacts so SUMMARY is reproducible with this command.
run("--test", ["test/evasion.test.js"]);
run("scripts/build.js");
run("scripts/e2e.js");
run("scripts/perf.js");

const dev = measure(
  validateSamples(await loadSamples("dev-benign.json"), "dev-benign.json"),
  validateSamples(await loadSamples("dev-malicious-sim.json"), "dev-malicious-sim.json"),
  "dev"
);
const holdout = measure(
  validateSamples(await loadSamples("holdout-benign.json"), "holdout-benign.json"),
  validateSamples(await loadSamples("holdout-malicious-sim.json"), "holdout-malicious-sim.json"),
  "holdout"
);
const stats = { evaluatedAt: new Date().toISOString(), dev, holdout };
await writeFile(path.join(root, "reports", "dev.json"), `${JSON.stringify({
  evaluatedAt: stats.evaluatedAt,
  split: "dev",
  corpus: { benign: dev.benign, ambiguous: dev.ambiguous, malicious: dev.malicious },
  falsePositives: dev.fp,
  ambiguousFalsePositives: dev.ambiguousFp,
  nonAmbiguousFalsePositives: dev.nonAmbiguousFp,
  falseNegatives: dev.fn
}, null, 2)}\n`);
await writeFile(path.join(root, "reports", "dev.md"), [
  "# Avaliação do conjunto dev",
  "",
  `Executado em ${stats.evaluatedAt}; classificador sem ajustes nesta avaliação.`,
  describeSplit(dev),
  ""
].join("\n"));

const realStats = [];
for (const [filename, split] of [["real-sim.json", "simuladas"], ["real-benign.json", "benignas"]]) {
  try {
    const samples = validateSamples(await loadSamples(filename), filename, true);
    const detected = samples.filter(({ text }) => classify(text).level !== "none").length;
    const missed = samples.length - detected;
    realStats.push(`- ${split}: ${samples.length} amostras; alertas ${detected}/${samples.length}; sem alerta ${missed}/${samples.length}.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const evasion = await readFile(path.join(root, "reports", "evasion.md"), "utf8");
const evasionTable = evasion.split("\n").filter((line) => /^\|/.test(line)).join("\n");
const e2e = await readFile(path.join(root, "reports", "e2e.md"), "utf8");
const e2eResult = e2e.match(/Resultado: [^\n]+/)?.[0] ?? "Resultado E2E indisponível.";
const e2eTable = e2e.split("\n").filter((line) => /^\|/.test(line)).join("\n");
const perf = await readFile(path.join(root, "reports", "perf.md"), "utf8");
const perfDetails = perf.split("\n").filter((line) =>
  line.startsWith("Executado em ") || line.startsWith("Para entradas ") || /^\|/.test(line)
).join("\n");

const realSection = realStats.length ? realStats.join("\n") : "Nenhum arquivo real opcional foi encontrado.";
const summary = [
  "# Resumo de avaliação do Clip Guard",
  "",
  `Gerado em ${stats.evaluatedAt} por \`npm run eval\`. As métricas usam o classificador atual, sem ajustar suas regras.`,
  "",
  "## Dev",
  "",
  `Amostras: ${dev.benign} benignas (${dev.ambiguous} ambíguas), ${dev.malicious} simuladas.`,
  describeSplit(dev),
  "",
  "## Holdout",
  "",
  `Amostras: ${holdout.benign} benignas (${holdout.ambiguous} ambíguas), ${holdout.malicious} simuladas.`,
  describeSplit(holdout),
  "",
  "## Evasão",
  "",
  "Taxas antes/depois por mutação; cada denominador mostra o n avaliado.",
  "",
  evasionTable,
  "",
  "## E2E",
  "",
  e2eResult,
  "",
  e2eTable,
  "",
  "## Desempenho",
  "",
  perfDetails,
  "",
  "## Amostras reais",
  "",
  realSection,
  "Os textos das amostras não são copiados para este relatório.",
  ""
].join("\n");
await writeFile(path.join(root, "reports", "SUMMARY.md"), summary);
console.log(summary);
