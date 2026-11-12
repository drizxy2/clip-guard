const enabledKey = "fpMeasurementEnabled";
const logKey = "fpMeasurementLog";
const checkbox = document.querySelector("#measurement-enabled");
const status = document.querySelector("#status");
const tableBody = document.querySelector("#measurements");
const exportButton = document.querySelector("#export");
let measurementLog = {};

function render() {
  tableBody.replaceChildren();
  const rows = Object.entries(measurementLog)
    .flatMap(([origin, entries]) => entries.map((entry) => ({ origin, ...entry })))
    .sort((left, right) => right.date.localeCompare(left.date));
  for (const entry of rows) {
    const row = document.createElement("tr");
    for (const value of [
      entry.origin,
      entry.level,
      entry.reasons.join(", "),
      entry.date
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    tableBody.append(row);
  }
  exportButton.disabled = rows.length === 0;
}

async function loadOptions() {
  const values = await chrome.storage.local.get([enabledKey, logKey]);
  checkbox.checked = values[enabledKey] === true;
  measurementLog = values[logKey] && typeof values[logKey] === "object"
    ? values[logKey]
    : {};
  render();
}

checkbox.addEventListener("change", async () => {
  checkbox.disabled = true;
  try {
    await chrome.storage.local.set({ [enabledKey]: checkbox.checked });
    status.textContent = checkbox.checked
      ? "Medição local ativada."
      : "Medição local desativada.";
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    status.textContent = `Não foi possível salvar a opção: ${error.message}`;
  } finally {
    checkbox.disabled = false;
  }
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([`${JSON.stringify(measurementLog, null, 2)}\n`], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "clip-guard-measurements.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[logKey]) return;
  const updatedLog = changes[logKey].newValue;
  measurementLog = updatedLog && typeof updatedLog === "object" ? updatedLog : {};
  render();
});

try {
  await loadOptions();
} catch (error) {
  checkbox.disabled = true;
  exportButton.disabled = true;
  status.textContent = `Não foi possível carregar as opções: ${error.message}`;
}
