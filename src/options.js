import { isRightToLeft, message, translateMethod, translateReason } from "./i18n.js";

const api = globalThis.clipGuardApi;
const contextHealth = globalThis.clipGuardContextHealth;
const enabledKey = "fpMeasurementEnabled";
const logKey = "fpMeasurementLog";
const diagnosticsKey = "writeDiagnostics";
const protectionModeKey = "protectionMode";
const freeConfirmationsKey = "showFreeConfirmations";
const protectionMode = document.querySelector("#protection-mode");
const checkbox = document.querySelector("#measurement-enabled");
const freeConfirmations = document.querySelector("#free-confirmations-enabled");
const status = document.querySelector("#status");
const tableBody = document.querySelector("#measurements");
const diagnosticsBody = document.querySelector("#write-diagnostics");
const exportButton = document.querySelector("#export");
let measurementLog = {};
let writeDiagnostics = {};

function getLocal(keys) {
  return contextHealth.call(() => api.storage.local.get(keys), {});
}

function setLocal(values) {
  return contextHealth.call(() => api.storage.local.set(values));
}

function t(key, substitutions) {
  return message((name, args) => api.i18n.getMessage(name, args), key, substitutions);
}

for (const element of document.querySelectorAll("[data-i18n]")) {
  element.textContent = t(element.dataset.i18n);
}
const uiLanguage = api.i18n.getUILanguage();
document.documentElement.lang = uiLanguage.replaceAll("_", "-");
document.documentElement.dir = isRightToLeft(uiLanguage) ? "rtl" : "ltr";

function translatedReasons(reasons) {
  return reasons.length
    ? reasons.map((reason) => translateReason(reason, (key, args) =>
      api.i18n.getMessage(key, args)
    )).join(", ")
    : t("noReasons");
}

function localizedLevel(level) {
  const key = { none: "levelNone", low: "levelLow", high: "levelHigh" }[level];
  return key ? t(key) : level;
}

function render() {
  tableBody.replaceChildren();
  const rows = Object.entries(measurementLog)
    .flatMap(([origin, entries]) => entries.map((entry) => ({ origin, ...entry })))
    .sort((left, right) => right.date.localeCompare(left.date));
  for (const entry of rows) {
    const row = document.createElement("tr");
    for (const value of [
      entry.origin,
      localizedLevel(entry.level),
      translatedReasons(entry.reasons),
      new Date(entry.date).toLocaleString(api.i18n.getUILanguage())
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    tableBody.append(row);
  }

  diagnosticsBody.replaceChildren();
  const diagnosticRows = Object.entries(writeDiagnostics)
    .flatMap(([tabId, value]) => (Array.isArray(value) ? value : [value])
      .map((diagnostic) => ({ tabId, diagnostic })))
    .sort((left, right) => right.diagnostic.time - left.diagnostic.time);
  for (const { tabId, diagnostic } of diagnosticRows) {
    const row = document.createElement("tr");
    for (const value of [
      t("tabValue", tabId),
      diagnostic.origin,
      translateMethod(diagnostic.method, (key, args) => api.i18n.getMessage(key, args)),
      localizedLevel(diagnostic.level),
      t(diagnostic.blocked ? "blockedValue" : "allowedValue"),
      translatedReasons(diagnostic.reasons),
      new Date(diagnostic.time).toLocaleString(api.i18n.getUILanguage())
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    diagnosticsBody.append(row);
  }
  exportButton.disabled = rows.length === 0;
}

async function loadOptions() {
  const values = await getLocal([
    enabledKey,
    logKey,
    diagnosticsKey,
    protectionModeKey,
    freeConfirmationsKey
  ]);
  protectionMode.value = values[protectionModeKey] === "warn" ? "warn" : "block";
  checkbox.checked = values[enabledKey] === true;
  freeConfirmations.checked = values[freeConfirmationsKey] !== false;
  measurementLog = values[logKey] && typeof values[logKey] === "object"
    ? values[logKey]
    : {};
  writeDiagnostics = values[diagnosticsKey] && typeof values[diagnosticsKey] === "object"
    ? values[diagnosticsKey]
    : {};
  render();
}

protectionMode.addEventListener("change", async () => {
  protectionMode.disabled = true;
  try {
    await setLocal({ [protectionModeKey]: protectionMode.value });
    if (!contextHealth.isHealthy()) return;
    status.textContent = t("saveModeSuccess");
  } catch (error) {
    if (contextHealth.isInvalidated()) return;
    protectionMode.value = protectionMode.value === "warn" ? "block" : "warn";
    status.textContent = t("saveError", error.message);
  } finally {
    protectionMode.disabled = false;
  }
});

checkbox.addEventListener("change", async () => {
  checkbox.disabled = true;
  try {
    await setLocal({ [enabledKey]: checkbox.checked });
    if (!contextHealth.isHealthy()) return;
    status.textContent = t(checkbox.checked ? "saveMeasurementOn" : "saveMeasurementOff");
  } catch (error) {
    if (contextHealth.isInvalidated()) return;
    checkbox.checked = !checkbox.checked;
    status.textContent = t("saveError", error.message);
  } finally {
    checkbox.disabled = false;
  }
});

freeConfirmations.addEventListener("change", async () => {
  freeConfirmations.disabled = true;
  try {
    await setLocal({ [freeConfirmationsKey]: freeConfirmations.checked });
    if (!contextHealth.isHealthy()) return;
    status.textContent = t(freeConfirmations.checked ? "saveToastsOn" : "saveToastsOff");
  } catch (error) {
    if (contextHealth.isInvalidated()) return;
    freeConfirmations.checked = !freeConfirmations.checked;
    status.textContent = t("saveError", error.message);
  } finally {
    freeConfirmations.disabled = false;
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

contextHealth.listen(() => api.storage.onChanged, (changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[logKey]) {
    const updatedLog = changes[logKey].newValue;
    measurementLog = updatedLog && typeof updatedLog === "object" ? updatedLog : {};
  }
  if (changes[diagnosticsKey]) {
    const updatedDiagnostics = changes[diagnosticsKey].newValue;
    writeDiagnostics = updatedDiagnostics && typeof updatedDiagnostics === "object"
      ? updatedDiagnostics
      : {};
  }
  if (changes[protectionModeKey]) {
    protectionMode.value = changes[protectionModeKey].newValue === "warn" ? "warn" : "block";
  }
  if (changes[freeConfirmationsKey]) {
    freeConfirmations.checked = changes[freeConfirmationsKey].newValue !== false;
  }
  render();
});

try {
  await loadOptions();
} catch (error) {
  checkbox.disabled = true;
  freeConfirmations.disabled = true;
  exportButton.disabled = true;
  protectionMode.disabled = true;
  status.textContent = t("loadError", error.message);
}
