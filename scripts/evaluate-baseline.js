import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const classifierModule = new URL(process.argv[2] ?? "../src/classifier.js", import.meta.url);
const { classify } = await import(classifierModule.href);
const benign = JSON.parse(await readFile(path.join(root, "test", "corpus", "benign.json"), "utf8"));
const malicious = JSON.parse(await readFile(path.join(root, "test", "corpus", "malicious-sim.json"), "utf8"));
const classifyAll = (samples) => samples.map((sample) => ({
  ...sample,
  result: classify(sample.text)
}));
const benignResults = classifyAll(benign);
const maliciousResults = classifyAll(malicious);
const falsePositives = benignResults.filter(({ result }) => result.level !== "none");
const ambiguousResults = benignResults.filter(({ category }) => category === "ambiguous");
const ambiguousFalsePositives = ambiguousResults.filter(({ result }) => result.level !== "none");
const falseNegatives = maliciousResults.filter(({ result }) => result.level === "none");
const countByLevel = (samples, level) => samples.filter(({ result }) => result.level === level).length;
const percent = (count, total) => total ? Number((count / total * 100).toFixed(2)) : 0;
const benignHigh = countByLevel(benignResults, "high");
const benignLow = countByLevel(benignResults, "low");
const ambiguousHigh = countByLevel(ambiguousResults, "high");
const ambiguousLow = countByLevel(ambiguousResults, "low");

const report = {
  evaluatedAt: new Date().toISOString(),
  classifier: "current classifier, unchanged before baseline",
  corpus: {
    benign: benign.length,
    ambiguous: ambiguousResults.length,
    maliciousSimulated: malicious.length
  },
  falsePositives: {
    benign: {
      high: benignHigh,
      low: benignLow,
      any: falsePositives.length,
      ratePercent: percent(falsePositives.length, benign.length),
      highRatePercent: percent(benignHigh, benign.length),
      lowRatePercent: percent(benignLow, benign.length)
    },
    ambiguous: {
      total: ambiguousResults.length,
      high: ambiguousHigh,
      low: ambiguousLow,
      any: ambiguousFalsePositives.length,
      ratePercent: percent(ambiguousFalsePositives.length, ambiguousResults.length)
    }
  },
  falseNegatives: {
    count: falseNegatives.length,
    total: malicious.length,
    ratePercent: percent(falseNegatives.length, malicious.length)
  },
  errors: {
    falsePositives: falsePositives.map(({ category, text, result }) => ({ category, text, ...result })),
    falseNegatives: falseNegatives.map(({ category, text, result }) => ({ category, text, ...result }))
  }
};

const rate = (count, total) => `${count}/${total} (${percent(count, total).toFixed(2)}%)`;
const showErrors = (items) => items.length
  ? items.map(({ category, text, level, score, reasons }) =>
    `- [${category}] **${level}** (score ${score}; ${reasons.join(", ") || "sem motivo"}): \`${text.replaceAll("`", "\\`")}\``
  ).join("\n")
  : "- Nenhum.";
const markdown = [
  "# Relatório baseline do classificador",
  "",
  `Executado em ${report.evaluatedAt} sobre o classificador original, sem alterações.`,
  "",
  `- Corpus benigno: ${benign.length}; falsos positivos: ${rate(falsePositives.length, benign.length)}.`,
  `- FP benignos high: ${rate(benignHigh, benign.length)}; low: ${rate(benignLow, benign.length)}.`,
  `- Corpus ambíguo (incluído no benigno): ${ambiguousResults.length}; FP: ${rate(ambiguousFalsePositives.length, ambiguousResults.length)} (high ${ambiguousHigh}, low ${ambiguousLow}).`,
  `- Corpus simulado: ${malicious.length}; falsos negativos: ${rate(falseNegatives.length, malicious.length)}.`,
  "",
  "## Falsos positivos",
  "",
  showErrors(report.errors.falsePositives),
  "",
  "## Falsos negativos",
  "",
  showErrors(report.errors.falseNegatives),
  ""
].join("\n");

const reportDirectory = path.join(root, "reports");
await mkdir(reportDirectory, { recursive: true });
await writeFile(path.join(reportDirectory, "baseline.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(reportDirectory, "baseline.md"), markdown);
console.log(`Baseline saved: benign FP ${falsePositives.length}/${benign.length}; ambiguous FP ${ambiguousFalsePositives.length}/${ambiguousResults.length}; simulated FN ${falseNegatives.length}/${malicious.length}.`);
