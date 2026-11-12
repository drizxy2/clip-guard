import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levels = new Set(["none", "low", "high", "unknown"]);

export function formatReport(log) {
  if (!log || typeof log !== "object" || Array.isArray(log)) {
    throw new Error("O JSON exportado precisa ser um objeto de origens.");
  }

  const groups = new Map();
  for (const [origin, entries] of Object.entries(log)) {
    if (origin !== "null") {
      let parsed;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`Origem inválida no JSON: ${origin}`);
      }
      if (parsed.origin !== origin) throw new Error(`Origem inválida no JSON: ${origin}`);
    }
    if (!Array.isArray(entries)) throw new Error(`Registros inválidos para a origem ${origin}.`);
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || !levels.has(entry.level) ||
          !Array.isArray(entry.reasons) ||
          !entry.reasons.every((reason) => typeof reason === "string") ||
          typeof entry.date !== "string" || !Number.isFinite(Date.parse(entry.date))) {
        throw new Error(`Registro inválido para a origem ${origin}.`);
      }
      const reasons = [...new Set(entry.reasons)].sort();
      const key = JSON.stringify([origin, entry.level, reasons]);
      const group = groups.get(key) ?? { origin, level: entry.level, reasons, count: 0 };
      group.count++;
      groups.set(key, group);
    }
  }

  const rows = [...groups.values()].sort((left, right) =>
    left.origin.localeCompare(right.origin) ||
    left.level.localeCompare(right.level) ||
    left.reasons.join(", ").localeCompare(right.reasons.join(", "))
  );
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return [
    "# Importação de medições locais",
    "",
    `Alertas agregados: ${total}. Nenhum texto de amostra foi incluído.`,
    "",
    "| Origem | Nível | Motivos | Alertas |",
    "| --- | --- | --- | ---: |",
    ...rows.map(({ origin, level, reasons, count }) =>
      `| ${origin} | ${level} | ${reasons.join(", ") || "nenhum"} | ${count} |`
    ),
    ""
  ].join("\n");
}

async function main() {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3) {
    throw new Error("Uso: npm run import-local -- <arquivo.json>");
  }
  const data = JSON.parse(await readFile(path.resolve(input), "utf8"));
  const report = formatReport(data);
  const output = path.join(root, "reports", "local-fp.md");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, report);
  console.log(`Relatório agregado gravado em ${path.relative(root, output).replaceAll("\\", "/")}.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
