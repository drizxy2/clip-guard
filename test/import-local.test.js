import test from "node:test";
import assert from "node:assert/strict";
import { formatReport } from "../scripts/import-local.js";

test("agrega medições por origem, nível e motivos sem incluir texto", () => {
  const report = formatReport({
    "https://example.invalid": [
      {
        date: "2026-11-12T10:00:00.000Z",
        level: "high",
        reasons: ["cmd /c", "encadeamento &&"],
        text: "private command payload"
      },
      {
        date: "2026-11-12T10:01:00.000Z",
        level: "high",
        reasons: ["encadeamento &&", "cmd /c"],
        text: "another private command"
      }
    ]
  });

  assert.match(report, /\| https:\/\/example\.invalid \| high \| cmd \/c, encadeamento && \| 2 \|/);
  assert.doesNotMatch(report, /private command/);
});

test("rejeita origens ou registros inválidos", () => {
  assert.throws(() => formatReport({ "not an origin": [] }), /Origem inválida/);
  assert.throws(() => formatReport({ "https://example.invalid": [{ level: "high" }] }), /Registro inválido/);
});
