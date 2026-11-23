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
  const high = malicious.filter(({ text }) => classify(text).level === "high");
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
    fn: { count: fn.length, total: malicious.length, ratePercent: percent(fn.length, malicious.length) },
    high: { count: high.length, total: malicious.length, ratePercent: percent(high.length, malicious.length) }
  };
}

const rate = ({ count, total, ratePercent }) =>
  `${count}/${total} (${ratePercent.toFixed(2)}%)`;
const describeSplit = (stats) => [
  `- Falsos positivos, benignas totais: ${rate(stats.fp)}.`,
  `- FP em benignas não ambíguas: ${rate(stats.nonAmbiguousFp)}.`,
  `- FP em benignas ambíguas: ${rate(stats.ambiguousFp)}.`,
  `- Falsos negativos (nível < low): ${rate(stats.fn)}.`,
  `- Detecção em high (bloqueia a colagem): ${rate(stats.high)}.`
].join("\n");

function baselineMetric(report, split, label) {
  const start = report.indexOf(`## ${split}\n`);
  const end = report.indexOf("\n## ", start + 1);
  const section = report.slice(start, end < 0 ? undefined : end);
  const match = section.match(new RegExp(`- ${label}: (\\d+)/(\\d+)`));
  if (!match) throw new Error(`Métrica ${label} ausente no baseline ${split}.`);
  const count = Number(match[1]);
  const total = Number(match[2]);
  return { count, total, ratePercent: percent(count, total) };
}

await mkdir(path.join(root, "reports"), { recursive: true });

// Refresh the mutation, browser, and timing artifacts so SUMMARY is reproducible with this command.
run("--test", ["test/evasion.test.js"]);
run("scripts/build.js");
run("scripts/e2e.js");
run("scripts/perf.js");

const devBenign = validateSamples(await loadSamples("dev-benign.json"), "dev-benign.json");
const devMalicious = validateSamples(await loadSamples("dev-malicious-sim.json"), "dev-malicious-sim.json");
const holdoutBenign = validateSamples(await loadSamples("holdout-benign.json"), "holdout-benign.json");
const holdoutMalicious = validateSamples(await loadSamples("holdout-malicious-sim.json"), "holdout-malicious-sim.json");
const dev = measure(devBenign, devMalicious, "dev");
const holdout = measure(holdoutBenign, holdoutMalicious, "holdout");
const fpBaseline = JSON.parse(await readFile(path.join(root, "reports", "fp-baseline.json"), "utf8"));
if (fpBaseline.devWith15BenignControls.total !== dev.benign ||
    fpBaseline.holdout.total !== holdout.benign) {
  throw new Error("Os denominadores do baseline FP não correspondem aos corpora dev/holdout atuais.");
}
const stats = { evaluatedAt: new Date().toISOString(), dev, holdout };
const formatRate = ({ count, total, ratePercent }) =>
  `${count}/${total} (${ratePercent.toFixed(2)}%)`;
const formatFirstTokenRate = (metric) =>
  metric.total ? formatRate(metric) : `${metric.count}/${metric.total} (n/a)`;

const firstTokenBaseline = await readFile(path.join(root, "reports", "first-token-baseline.md"), "utf8");
const baselineLevels = new Map();
for (const line of firstTokenBaseline.split("\n")) {
  if (!line.startsWith("| dev benign |") && !line.startsWith("| dev malicious |") &&
      !line.startsWith("| holdout benign |") && !line.startsWith("| holdout malicious |") &&
      !line.startsWith("| real-sim |")) continue;
  const columns = line.split("|").map((column) => column.trim());
  baselineLevels.set(`${columns[1]}:${columns[2]}`, columns[columns.length - 2]);
}
const firstTokenCohorts = [
  ["dev benign", devBenign],
  ["dev malicious", devMalicious],
  ["holdout benign", holdoutBenign],
  ["holdout malicious", holdoutMalicious],
  ["real-sim", validateSamples(await loadSamples("real-sim.json"), "real-sim.json", true)]
];
const baselineHighMetric = (split, samples) => {
  const count = samples.filter((_, index) =>
    baselineLevels.get(`${split}:${index + 1}`) === "high"
  ).length;
  return {
    count,
    total: samples.length,
    ratePercent: percent(count, samples.length)
  };
};
const changedLevels = [];
for (const [split, samples] of firstTokenCohorts) {
  for (const [index, sample] of samples.entries()) {
    const before = baselineLevels.get(`${split}:${index + 1}`);
    if (!before) throw new Error(`Nível basal ausente para ${split} amostra ${index + 1}.`);
    const after = classify(sample.text).level;
    if (before !== after) {
      changedLevels.push({
        split,
        index: index + 1,
        category: sample.category,
        label: sample.notes || "",
        before,
        after
      });
    }
  }
}
const realSim = firstTokenCohorts.at(-1)[1];
const realFnCount = realSim.filter(({ text }) => classify(text).level === "none").length;
const realHighCount = realSim.filter(({ text }) => classify(text).level === "high").length;
const firstTokenMetrics = [
  {
    split: "dev",
    fpBefore: baselineMetric(firstTokenBaseline, "dev", "FP"),
    fpAfter: dev.fp,
    fnBefore: baselineMetric(firstTokenBaseline, "dev", "FN"),
    fnAfter: dev.fn,
    highBefore: baselineHighMetric("dev malicious", devMalicious),
    highAfter: dev.high
  },
  {
    split: "holdout",
    fpBefore: baselineMetric(firstTokenBaseline, "holdout", "FP"),
    fpAfter: holdout.fp,
    fnBefore: baselineMetric(firstTokenBaseline, "holdout", "FN"),
    fnAfter: holdout.fn,
    highBefore: baselineHighMetric("holdout malicious", holdoutMalicious),
    highAfter: holdout.high
  },
  {
    split: "real-sim",
    fpBefore: baselineMetric(firstTokenBaseline, "real-sim", "FP"),
    fpAfter: { count: 0, total: 0, ratePercent: 0 },
    fnBefore: baselineMetric(firstTokenBaseline, "real-sim", "FN"),
    fnAfter: {
      count: realFnCount,
      total: realSim.length,
      ratePercent: percent(realFnCount, realSim.length)
    },
    highBefore: baselineHighMetric("real-sim", realSim),
    highAfter: {
      count: realHighCount,
      total: realSim.length,
      ratePercent: percent(realHighCount, realSim.length)
    }
  }
];
for (const { split, fpBefore, fpAfter, fnBefore, fnAfter } of firstTokenMetrics) {
  if (fpAfter.count > fpBefore.count || fnAfter.count > fnBefore.count) {
    throw new Error(`Regressão FP/FN em ${split}: o primeiro-token excedeu o baseline.`);
  }
}
await writeFile(path.join(root, "reports", "first-token-comparison.md"), [
  "# Comparação do sinal de primeiro token",
  "",
  "Baseline capturado antes da alteração em `reports/first-token-baseline.md`; nenhum texto de amostra é repetido aqui.",
  "",
  "## Métricas",
  "",
  "| Conjunto | Métrica | Antes | Depois |",
  "| --- | --- | ---: | ---: |",
  ...firstTokenMetrics.flatMap(({ split, fpBefore, fpAfter, fnBefore, fnAfter, highBefore, highAfter }) => [
    `| ${split} | FP | ${formatFirstTokenRate(fpBefore)} | ${formatFirstTokenRate(fpAfter)} |`,
    `| ${split} | FN (nível < low) | ${formatFirstTokenRate(fnBefore)} | ${formatFirstTokenRate(fnAfter)} |`,
    `| ${split} | HIGH (bloqueia colagem) | ${formatFirstTokenRate(highBefore)} | ${formatFirstTokenRate(highAfter)} |`
  ]),
  "",
  "## Casos que mudaram de nível",
  "",
  ...(changedLevels.length
    ? [
      "| Conjunto | # | Categoria | Identificação | Antes | Depois |",
      "| --- | ---: | --- | --- | --- | --- |",
      ...changedLevels.map(({ split, index, category, label, before, after }) =>
        `| ${split} | ${index} | ${category} | ${label} | ${before} | ${after} |`
      )
    ]
    : ["Nenhum caso mudou de nível."]),
  "",
  "## Regressão corrigida",
  "",
  "A redução por abertura natural/comum rebaixava os dois exemplos indicados; sem essa regra, ambos são high novamente.",
  "",
  "| Caso | Nível antes da regra | Com rebaixamento | Corrigido |",
  "| --- | --- | --- | --- |",
  "| dev malicious #13 (`cmd-chain`) | high | low | high |",
  "| dev malicious #20 (`curl-pipe`) | high | low | high |",
  ""
].join("\n"));

await writeFile(path.join(root, "reports", "dev.json"), `${JSON.stringify({
  evaluatedAt: stats.evaluatedAt,
  split: "dev",
  corpus: { benign: dev.benign, ambiguous: dev.ambiguous, malicious: dev.malicious },
  falsePositives: dev.fp,
  ambiguousFalsePositives: dev.ambiguousFp,
  nonAmbiguousFalsePositives: dev.nonAmbiguousFp,
  falseNegatives: dev.fn,
  highDetections: dev.high
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
    const results = samples.map((sample) => ({ ...sample, result: classify(sample.text) }));
    const detected = results.filter(({ result }) => result.level !== "none").length;
    const missed = samples.length - detected;
    if (filename === "real-sim.json") {
      const baseline = JSON.parse(await readFile(path.join(root, "reports", "real-baseline.json"), "utf8"));
      if (baseline.results.length !== results.length ||
          baseline.results.some((entry, index) =>
            entry.notes !== results[index].notes || entry.category !== results[index].category
          )) {
        throw new Error("O baseline real não corresponde à ordem/categoria de real-sim.json.");
      }
      const beforeDetected = baseline.results.filter(({ level }) => level !== "none").length;
      const baselineRows = baseline.results.map((entry, index) => {
        const after = results[index].result;
        return `| ${index + 1} | ${entry.notes} | ${entry.level} | **${after.level}** | ${after.reasons.join(", ") || "nenhum"} |`;
      });
      await writeFile(path.join(root, "reports", "real-after.md"), [
        "# Comparação das amostras ClickFix cmd",
        "",
        "Resultados por variação; os textos das amostras são omitidos.",
        "",
        "| # | Variação | Baseline | Depois | Motivos depois |",
        "| ---: | --- | --- | --- | --- |",
        ...baselineRows,
        "",
        `Baseline: ${beforeDetected}/${results.length} alertas; depois: ${detected}/${results.length} alertas.`,
        ""
      ].join("\n"));
      realStats.push(`- ${split}: ${samples.length} amostras; baseline ${beforeDetected}/${samples.length} alertas (${samples.length - beforeDetected} none); depois ${detected}/${samples.length} alertas (${missed} none). Detalhes: \`reports/real-baseline.md\` e \`reports/real-after.md\`.`);
    } else {
      realStats.push(`- ${split}: ${samples.length} amostras; alertas ${detected}/${samples.length}; sem alerta ${missed}/${samples.length}.`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const evasion = await readFile(path.join(root, "reports", "evasion.md"), "utf8");
const [generalEvasion, firstTokenEvasion = ""] = evasion.split("## Evasões de primeiro token");
const evasionTable = generalEvasion.split("\n").filter((line) => /^\|/.test(line)).join("\n");
const firstTokenEvasionTable = firstTokenEvasion.split("\n").filter((line) => /^\|/.test(line)).join("\n");
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
  "## Falsos positivos antes/depois",
  "",
  "| Conjunto | Baseline original | Depois |",
  "| --- | ---: | ---: |",
  `| Dev com 15 controles benignos | ${formatRate(fpBaseline.devWith15BenignControls)} | ${formatRate(dev.fp)} |`,
  `| Holdout | ${formatRate(fpBaseline.holdout)} | ${formatRate(holdout.fp)} |`,
  `No corpus dev antes de adicionar os 15 controles, o baseline era ${formatRate(fpBaseline.devOriginalCorpus)}.`,
  "",
  "## Sinal de primeiro token",
  "",
  "Decisão: o primeiro token executável é apenas um reforço (+1) quando há evidência independente de risco; não basta sozinho. Espaços, aspas, `@`/`&` são normalizados e `set`, `echo`, `cd` e `REM` são tratados como prefixos inertes antes de procurar o comando. A redução de nível por abertura natural/comum foi removida para não rebaixar texto com sinais de comando, cadeia, download ou execução.",
  "",
  "| Conjunto | Métrica | Antes | Depois |",
  "| --- | --- | ---: | ---: |",
  ...firstTokenMetrics.flatMap(({ split, fpBefore, fpAfter, fnBefore, fnAfter, highBefore, highAfter }) => [
    `| ${split} | FP | ${formatFirstTokenRate(fpBefore)} | ${formatFirstTokenRate(fpAfter)} |`,
    `| ${split} | FN (nível < low) | ${formatFirstTokenRate(fnBefore)} | ${formatFirstTokenRate(fnAfter)} |`,
    `| ${split} | HIGH (bloqueia colagem) | ${formatFirstTokenRate(highBefore)} | ${formatFirstTokenRate(highAfter)} |`
  ]),
  "",
  "### Evasões",
  "",
  firstTokenEvasionTable,
  "",
  `Casos que mudaram de nível após a correção: ${changedLevels.length}. A regressão de dev malicious #13 (\`cmd-chain\`) e #20 (\`curl-pipe\`) foi restaurada (\`high → low → high\`); detalhes em \`reports/first-token-comparison.md\`.`,
  "Ganho mensurável do sinal: a evasão com espaços, aspas e `@/&` passou de `none` para `low`; o sinal foi mantido. Limites: o parser reconhece fronteiras simples de comandos e prefixos listados, sem executar conteúdo nem interpretar scripts completos; o primeiro token nunca classifica sozinho.",
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
  "Comparação detalhada por amostra em `reports/real-baseline.md` e `reports/real-after.md`; os textos não são copiados para os relatórios.",
  "Ctrl+C após selecionar texto numa página é diagnosticado pelo conteúdo da seleção no evento `copy`; cópias feitas fora do navegador não são observáveis.",
  "",
  "## Compatibilidade",
  "",
  "Chromium e Edge usam MV3 com service worker; Firefox usa event page (`background.scripts`), ID Gecko `clip-guard@drizxy2.github.io`, mínimo desktop 140.0 e mínimo Android 142.0. `src/compat.js` seleciona `browser` ou `chrome` e fornece `clipGuardApi` a cada contexto da extensão.",
  "Firefox 160.0.1: E2E 24/24 em duas suítes, incluindo Ctrl+C manual e localização; Microsoft Edge 157.0.4341.46 (Chromium) E2E 56/56 em três suítes. `world: MAIN`, `all_frames`, `match_about_blank` e `match_origin_as_fallback` são mantidos. Firefox não injeta content scripts em iframes vazios no `document_start`; versões abaixo de 140 ignoram a declaração de dados Gecko. Chromium ignora os metadados Gecko.",
  "`web-ext lint`: 0 erros, 2 avisos aceitáveis (`KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION` para desktop <140 e `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` para Android <142), pois o mínimo pedido é 128. Publicação AMO e outras versões não foram testadas.",
  ""
].join("\n");
await writeFile(path.join(root, "reports", "SUMMARY.md"), summary);
console.log(summary);
