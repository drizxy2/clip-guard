const api = globalThis.clipGuardApi;
const contextHealth = globalThis.clipGuardContextHealth;
const badgeKey = "alertCounts";
const writeDiagnosticsKey = "writeDiagnostics";

function getLocal(key) {
  return contextHealth.call(() => api.storage.local.get(key), {});
}

function setLocal(value) {
  return contextHealth.call(() => api.storage.local.set(value));
}

function getSession(key) {
  return contextHealth.call(() => api.storage.session.get(key), {});
}

function setSession(value) {
  return contextHealth.call(() => api.storage.session.set(value));
}

contextHealth.listen(() => api.runtime.onMessage, (message, sender) => {
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
    getLocal(writeDiagnosticsKey).then((value) => {
      const diagnostics = value[writeDiagnosticsKey] &&
        typeof value[writeDiagnosticsKey] === "object"
        ? { ...value[writeDiagnosticsKey] }
        : {};
      const previous = diagnostics[String(tabId)];
      const events = Array.isArray(previous) ? previous : previous ? [previous] : [];
      diagnostics[String(tabId)] = [...events, entry].slice(-100);
      return setLocal({ [writeDiagnosticsKey]: diagnostics });
    }).catch((error) => {
      if (!contextHealth.isInvalidated()) {
        console.error("Clip Guard: falha ao salvar diagnóstico de escrita.", error);
      }
    });
    return;
  }

  if (message?.type !== "CLIP_GUARD_ALERT" || !Number.isInteger(sender.tab?.id)) return;
  const tabId = sender.tab.id;
  getSession(badgeKey).then((value) => {
    const counts = value[badgeKey] || {};
    counts[tabId] = (counts[tabId] || 0) + 1;
    return setSession({ [badgeKey]: counts }).then(() =>
      contextHealth.call(() =>
        api.action.setBadgeText({ tabId, text: String(counts[tabId]) })
      )
    );
  }).catch(() => {});
});

contextHealth.listen(() => api.tabs.onRemoved, (tabId) => {
  getSession(badgeKey).then((value) => {
    const counts = value[badgeKey] || {};
    delete counts[tabId];
    return setSession({ [badgeKey]: counts });
  }).catch(() => {});
  getLocal(writeDiagnosticsKey).then((value) => {
    const diagnostics = value[writeDiagnosticsKey] &&
      typeof value[writeDiagnosticsKey] === "object"
      ? { ...value[writeDiagnosticsKey] }
      : {};
    delete diagnostics[String(tabId)];
    return setLocal({ [writeDiagnosticsKey]: diagnostics });
  }).catch((error) => {
    if (!contextHealth.isInvalidated()) {
      console.error("Clip Guard: falha ao limpar diagnóstico de escrita.", error);
    }
  });
});
