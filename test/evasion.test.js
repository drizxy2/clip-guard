import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classify } from "../src/classifier.js";
import { classify as classifyBefore } from "../reports/pre-holdout-classifier.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpus = JSON.parse(await readFile(path.join(root, "test", "corpus", "dev-malicious-sim.json"), "utf8"));
const realClickFix = JSON.parse(await readFile(path.join(root, "test", "corpus", "real-sim.json"), "utf8"));
const awaitBaselineReport = await readFile(path.join(root, "reports", "first-token-baseline.md"), "utf8");
const shellToken = /\b(?:powershell(?:\.exe)?|pwsh(?:\.exe)?|cmd(?:\.exe)?|mshta(?:\.exe)?|certutil(?:\.exe)?|bitsadmin(?:\.exe)?|curl|wget|bash)\b/i;
const urlPattern = /https?:\/\/(?:www\.)?example\.invalid[^\s"'|;&]*/i;

function mapMatching(samples, predicate, mutate) {
  return samples.filter((sample) => predicate(sample.text)).map((sample) => ({
    category: sample.category,
    text: mutate(sample.text)
  }));
}

function alternateCase(text) {
  let upper = true;
  return text.replace(/[a-z]/gi, (character) => {
    const changed = upper ? character.toUpperCase() : character.toLowerCase();
    upper = !upper;
    return changed;
  });
}

const encodedUtf16 = Buffer.from("cmd /c echo calc", "utf16le").toString("base64");
const firstTokenEvasionCases = [
  ["sem prefixo", "cmd /c echo test && calc"],
  ["prefixo isca (set/echo/cd)", 'set "MODE=docs" & echo ready & cd %TEMP% & cmd /c echo test && calc'],
  ["espaços + aspas + @/&", '  @& "cmd"   /c   echo test && calc'],
  ["comentário REM antes do comando", "REM exemplo de documentação\ncmd /c echo test && calc"],
  ["nova linha inicial", "\n  cmd /c echo test && calc"]
];
const firstTokenEvasionResults = firstTokenEvasionCases.map(([mutation, text]) => ({
  mutation,
  before: readBaselineEvasionLevel(mutation),
  after: classify(text).level
}));
const mutations = {
  "mixed case": corpus.map(({ category, text }) => ({ category, text: alternateCase(text) })),
  "cmd caret": mapMatching(corpus, (text) => /\bpowershell\b/i.test(text), (text) =>
    text.replace(/\bpowershell\b/i, "po^wer^shell")),
  "quoted token": mapMatching(corpus, (text) => /\bpowershell\b/i.test(text), (text) =>
    text.replace(/\bpowershell\b/i, 'pow""ershell')),
  "string concatenation": mapMatching(corpus, (text) => /\bpowershell\b/i.test(text), (text) =>
    text.replace(/\bpowershell\b/i, "'power'+'shell'")),
  "variable expression": [{ category: "mutation", text: "$a='ie';& ($a+'x'); echo calc" }],
  "environment substring": [{ category: "mutation", text: "%COMSPEC:~-7,3% /c echo calc" }],
  "unicode whitespace": corpus.map(({ category, text }) => ({ category, text: text.replace(/ /g, "\u2003") })),
  "homoglyph": mapMatching(corpus, (text) => /\bpowershell\b/i.test(text), (text) =>
    text.replace(/\bpowershell\b/i, "p\u043ewershell")),
  "zero-width characters": mapMatching(corpus, (text) => /\bpowershell\b/i.test(text), (text) =>
    text.replace(/\bpowershell\b/i, "power\u200Bshell")),
  "command split across lines": mapMatching(corpus, (text) => shellToken.test(text), (text) =>
    text.replace(shellToken, (token) => `${token.slice(0, Math.ceil(token.length / 2))}\n${token.slice(Math.ceil(token.length / 2))}`)),
  "long verification prefix": corpus.map(({ category, text }) => ({
    category,
    text: `Human verification check: ${"Please confirm the displayed information. ".repeat(30)}${text}`
  })),
  "UTF-16LE base64 -enc": [
    { category: "mutation", text: `powershell -enc ${encodedUtf16}` },
    { category: "mutation", text: `pwsh.exe -EncodedCommand ${encodedUtf16}` }
  ],
  "shortened URL": mapMatching(corpus, (text) => urlPattern.test(text), (text) =>
    text.replace(urlPattern, "https://bit.ly/demo-check")),
  "decimal IP URL": mapMatching(corpus, (text) => urlPattern.test(text), (text) =>
    text.replace(urlPattern, "http://2130706433/demo")),
  "hex IP URL": mapMatching(corpus, (text) => urlPattern.test(text), (text) =>
    text.replace(urlPattern, "http://0x7f000001/demo")),
  "ClickFix cmd/curl.exe": realClickFix
};

function readBaselineEvasionLevel(mutation) {
  const report = awaitBaselineReport;
  const row = report.split("\n").find((line) => line.startsWith(`| ${mutation} |`));
  if (!row) throw new Error(`O baseline não contém a evasão "${mutation}".`);
  return row.split("|")[2].trim();
}

const results = Object.entries(mutations).map(([type, samples]) => {
  const before = samples.filter(({ text }) => classifyBefore(text).level !== "none").length;
  const after = samples.filter(({ text }) => classify(text).level !== "none").length;
  return { type, total: samples.length, before, after, missed: samples.length - after };
});

test("normaliza concatenação, homógrafos, quebra de linha e substring de COMSPEC", () => {
  for (const type of ["string concatenation", "homoglyph", "command split across lines", "environment substring"]) {
    const result = results.find((entry) => entry.type === type);
    assert.ok(result.total > 0, `nenhuma amostra para ${type}`);
    assert.equal(result.missed, 0, `${type}: ${result.missed}/${result.total} indetectáveis`);
  }
});

test("normaliza mutações de caixa, caret, aspas, whitespace Unicode e zero-width", () => {
  for (const type of ["mixed case", "cmd caret", "quoted token", "unicode whitespace", "zero-width characters"]) {
    const result = results.find((entry) => entry.type === type);
    assert.ok(result.total > 0, `nenhuma amostra para ${type}`);
    assert.equal(result.missed, 0, `${type}: ${result.missed}/${result.total} indetectáveis`);
  }
});

test("detecta todas as variantes ClickFix cmd neutralizadas", () => {
  const result = results.find((entry) => entry.type === "ClickFix cmd/curl.exe");
  assert.equal(result.total, realClickFix.length);
  assert.equal(result.missed, 0, `${result.missed}/${result.total} indetectáveis`);
});

test("resiste às evasões de prefixo isca, espaços, comentário e nova linha", () => {
  for (const { mutation, before, after } of firstTokenEvasionResults) {
    assert.ok(after !== "none", `${mutation}: continuou indetectável`);
    assert.ok(["none", "low", "high"].includes(before), `${mutation}: baseline inválido`);
  }
});

test("inspeciona comandos -enc codificados em UTF-16LE", () => {
  const result = classify(`powershell -enc ${encodedUtf16}`);
  assert.ok(result.reasons.includes("cmd /c"));
});

test("não decodifica conteúdo acima do limite de 64 KiB", () => {
  const oversized = Buffer.from(`cmd /c echo calc ${"x".repeat(65 * 1024)}`, "utf16le").toString("base64");
  const result = classify(`powershell -enc ${oversized}`);
  assert.ok(!result.reasons.includes("cmd /c"));
});

test("grava taxas antes/depois usando somente o corpus dev", async () => {
  assert.ok(corpus.length >= 40);
  assert.ok(results.every(({ total }) => total > 0));
  const report = [
    "# Avaliação de evasão por mutação",
    "",
    `Amostras-base: ${corpus.length} simuladas do conjunto dev; nenhuma amostra holdout foi usada para ajuste.`,
    "As taxas antes/depois usam as mesmas mutações e o classificador congelado em `pre-holdout` como referência.",
    "",
    "| Mutação | Antes | Depois |",
    "| --- | ---: | ---: |",
    ...results.map(({ type, total, before, after }) =>
      `| ${type} | ${before}/${total} (${(before / total * 100).toFixed(2)}%) | ${after}/${total} (${(after / total * 100).toFixed(2)}%) |`
    ),
    "",
    "## Limitações conhecidas",
    "",
    ...results.flatMap(({ type, total, missed }) => missed
      ? [`- ${type}: ${missed}/${total} amostras indetectáveis após o ajuste.`]
      : []),
    ...(results.every(({ missed }) => missed === 0)
      ? ["Nenhuma das mutações avaliadas no conjunto dev permaneceu indetectável.", ""]
      : ["A construção dinâmica de variáveis que não pertence às mutações obrigatórias continua fora do escopo de reconstrução sem executar o comando.", ""]),
    "## Evasões de primeiro token",
    "",
    "Comparação com os níveis registrados em `reports/first-token-baseline.md` antes da alteração.",
    "",
    "| Caso | Antes | Depois |",
    "| --- | --- | --- |",
    ...firstTokenEvasionResults.map(({ mutation, before, after }) =>
      `| ${mutation} | ${before} | ${after} |`
    ),
    ""
  ].join("\n");
  await mkdir(path.join(root, "reports"), { recursive: true });
  await writeFile(path.join(root, "reports", "evasion.md"), report);
  console.log(results.map(({ type, total, before, after }) =>
    `${type}: ${before}/${total} -> ${after}/${total}`
  ).join("; "));
});
