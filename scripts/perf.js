import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { classify } from "../src/classifier.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeText(length) {
  const phrase = "ordinary documentation text. ";
  return phrase.repeat(Math.ceil(length / phrase.length)).slice(0, length);
}

function percentile(samples, value) {
  return samples[Math.max(0, Math.ceil(samples.length * value) - 1)];
}

function measure(length, iterations) {
  const text = makeText(length);
  for (let index = 0; index < Math.min(50, iterations); index++) classify(text);
  const timings = [];
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    classify(text);
    timings.push(performance.now() - start);
  }
  timings.sort((left, right) => left - right);
  return {
    length,
    iterations,
    meanMs: timings.reduce((sum, duration) => sum + duration, 0) / timings.length,
    p99Ms: percentile(timings, 0.99)
  };
}

const results = [
  measure(100, 5000),
  measure(10 * 1024, 1000),
  measure(1024 * 1024, 300)
];
const report = [
  "# Desempenho do classificador",
  "",
  `Executado em ${new Date().toISOString()} com Node.js ${process.version}; medidas locais, ${results.map(({ iterations }) => iterations).join("/")} iterações (100 caracteres/10 KiB/1 MiB).`,
  "Para entradas acima de 100 KiB, `classify()` examina somente os primeiros e últimos 50 KiB.",
  "",
  "| Tamanho | Média (ms) | p99 (ms) |",
  "| --- | ---: | ---: |",
  ...results.map(({ length, meanMs, p99Ms }) =>
    `| ${length.toLocaleString("en-US")} caracteres | ${meanMs.toFixed(4)} | ${p99Ms.toFixed(4)} |`
  ),
  ""
].join("\n");
await mkdir(path.join(root, "reports"), { recursive: true });
await writeFile(path.join(root, "reports", "perf.md"), report);
console.log(report);
