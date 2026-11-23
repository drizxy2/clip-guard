const api = globalThis.clipGuardApi;
const badgeKey = "alertCounts";
const writeDiagnosticsKey = "writeDiagnostics";

api.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "CLIP_GUARD_WRITE_DIAGNOSTIC") {
    const tabId = sender.tab?.id;
    const diagnostic = message.diagnostic;
    if (!Number.isInteger(tabId) || !diagnostic ||
        typeof diagnostic.origin !== "string" ||
        typeof diagnostic.method !== "string" ||
        !["none", "low", "high"].includes(diagnostic.level) ||
        !Array.isArray(diagnostic.reasons) ||
        !Number.isFinite(diagnostic.time)) return;
    const entry = {
      origin: diagnostic.origin,
      method: diagnostic.method.slice(0, 100),
      level: diagnostic.level,
      blocked: diagnostic.blocked === true,
      reasons: diagnostic.reasons.filter((reason) => typeof reason === "string").slice(0, 20),
      time: diagnostic.time
    };
    api.storage.local.get(writeDiagnosticsKey).then((value) => {
      const diagnostics = value[writeDiagnosticsKey] &&
        typeof value[writeDiagnosticsKey] === "object"
        ? { ...value[writeDiagnosticsKey] }
        : {};
      const previous = diagnostics[String(tabId)];
      const events = Array.isArray(previous) ? previous : previous ? [previous] : [];
      diagnostics[String(tabId)] = [...events, entry].slice(-100);
      return api.storage.local.set({ [writeDiagnosticsKey]: diagnostics });
    }).catch((error) => {
      console.error("Clip Guard: falha ao salvar diagnóstico de escrita.", error);
    });
    return;
  }

  if (message?.type !== "CLIP_GUARD_ALERT" || !Number.isInteger(sender.tab?.id)) return;
  const tabId = sender.tab.id;
  api.storage.session.get(badgeKey).then((value) => {
    const counts = value[badgeKey] || {};
    counts[tabId] = (counts[tabId] || 0) + 1;
    return api.storage.session.set({ [badgeKey]: counts }).then(() =>
      api.action.setBadgeText({ tabId, text: String(counts[tabId]) })
    );
  }).catch(() => {});
});

api.tabs.onRemoved.addListener((tabId) => {
  api.storage.session.get(badgeKey).then((value) => {
    const counts = value[badgeKey] || {};
    delete counts[tabId];
    return api.storage.session.set({ [badgeKey]: counts });
  }).catch(() => {});
  api.storage.local.get(writeDiagnosticsKey).then((value) => {
    const diagnostics = value[writeDiagnosticsKey] &&
      typeof value[writeDiagnosticsKey] === "object"
      ? { ...value[writeDiagnosticsKey] }
      : {};
    delete diagnostics[String(tabId)];
    return api.storage.local.set({ [writeDiagnosticsKey]: diagnostics });
  }).catch((error) => {
    console.error("Clip Guard: falha ao limpar diagnóstico de escrita.", error);
  });
});
