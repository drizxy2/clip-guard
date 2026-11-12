import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).reduce((pairs, value, index, values) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
  return pairs;
}, []));
const split = args.get("split");
const classifierPath = args.get("classifier");
if (!["dev", "holdout"].includes(split) || !classifierPath) {
  throw new Error("Uso: node scripts/evaluate-corpus.js --split dev|holdout --classifier <arquivo>");
}

const { classify } = await import(pathToFileURL(path.resolve(root, classifierPath)).href);
const load = async (name) => JSON.parse(await readFile(
  path.join(root, "test", "corpus", `${split}-${name}.json`), "utf8"
));
const benign = await load("benign");
const malicious = await load("malicious-sim");
const fp = benign.filter(({ text }) => classify(text).level !== "none");
const ambiguous = benign.filter(({ category }) => category === "ambiguous");
const ambiguousFp = ambiguous.filter(({ text }) => classify(text).level !== "none");
const fn = malicious.filter(({ text }) => classify(text).level === "none");
const percent = (count, total) => total ? Number((count / total * 100).toFixed(2)) : 0;
const stats = {
  evaluatedAt: new Date().toISOString(),
  split,
  classifier: path.relative(root, path.resolve(root, classifierPath)).replaceAll("\\", "/"),
  fp: { count: fp.length, total: benign.length, ratePercent: percent(fp.length, benign.length) },
  ambiguousFp: {
    count: ambiguousFp.length,
    total: ambiguous.length,
    ratePercent: percent(ambiguousFp.length, ambiguous.length)
  },
  fn: { count: fn.length, total: malicious.length, ratePercent: percent(fn.length, malicious.length) }
};

if (split === "holdout") {
  const output = args.get("output") ?? "reports/holdout-pre.json";
  await writeFile(path.resolve(root, output), `${JSON.stringify(stats, null, 2)}\n`);
}
console.log(JSON.stringify(stats, null, 2));
