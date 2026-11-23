import { createUI } from "./ui.js";

(() => {
  "use strict";

  const api = globalThis.clipGuardApi;
  const PREFIX = "__clip_guard__";
  const ui = createUI();
  let channel = null;
  const frameChannels = new Set();
  const frameSources = new Map();
  const processedMessages = new Map();
  const trustedOriginsKey = "trustedOrigins";
  const protectionModeKey = "protectionMode";
  const freeConfirmationsKey = "showFreeConfirmations";
  const measurementEnabledKey = "fpMeasurementEnabled";
  const measurementLogKey = "fpMeasurementLog";
  const targetOrigin = location.origin === "null" ? "*" : location.origin;
  const isTopFrame = window === window.top;

  function send(type, data = {}) {
    if (!channel) return;
    try {
      window.postMessage({ [PREFIX]: true, channel, type, ...data }, targetOrigin);
    } catch {}
  }

  function getTrustedOrigins() {
    return api.storage.local.get(trustedOriginsKey).then((value) =>
      Array.isArray(value[trustedOriginsKey]) ? value[trustedOriginsKey] : []
    );
  }

  function notifyBackground() {
    try {
      const response = api.runtime.sendMessage({ type: "CLIP_GUARD_ALERT" });
      response?.catch?.(() => {});
    } catch {}
  }

  async function applyProtectionMode() {
    try {
      const values = await api.storage.local.get(protectionModeKey);
      send("SETTINGS", {
        protectionMode: values[protectionModeKey] === "warn" ? "warn" : "block"
      });
    } catch (error) {
      console.error("Clip Guard: falha ao carregar o modo de proteção.", error);
      send("SETTINGS", { protectionMode: "block" });
    }
  }

  function recordWriteDiagnostic(diagnostic, messageOrigin = location.origin) {
    if (!diagnostic || typeof diagnostic !== "object" ||
        (diagnostic.origin !== location.origin &&
          diagnostic.origin !== messageOrigin && diagnostic.origin !== "null") ||
        typeof diagnostic.method !== "string" ||
        !["none", "low", "high"].includes(diagnostic.level)) return;
    const safeDiagnostic = {
      origin: diagnostic.origin,
      method: diagnostic.method.slice(0, 100),
      level: diagnostic.level,
      blocked: diagnostic.blocked === true,
      reasons: Array.isArray(diagnostic.reasons)
        ? diagnostic.reasons.filter((reason) => typeof reason === "string").slice(0, 20)
        : [],
      time: Number.isFinite(diagnostic.time) ? diagnostic.time : Date.now()
    };
    try {
      const response = api.runtime.sendMessage({
        type: "CLIP_GUARD_WRITE_DIAGNOSTIC",
        diagnostic: safeDiagnostic
      });
      response?.catch?.((error) => {
        console.error("Clip Guard: falha ao encaminhar diagnóstico de escrita.", error);
      });
    } catch (error) {
      console.error("Clip Guard: falha ao encaminhar diagnóstico de escrita.", error);
    }
  }

  function clearClipboard() {
    try {
      navigator.clipboard.writeText("").catch(() => {});
    } catch {}
  }

  function trustOrigin(origin) {
    return getTrustedOrigins().then((origins) => {
      const updated = [...new Set([...origins, origin])];
      return api.storage.local.set({ [trustedOriginsKey]: updated });
    });
  }

  function recordMeasurement(alert) {
    const origin = typeof alert.origin === "string" ? alert.origin : location.origin;
    const entry = {
      level: typeof alert.level === "string" ? alert.level : "unknown",
      reasons: Array.isArray(alert.reasons)
        ? alert.reasons.filter((reason) => typeof reason === "string")
        : [],
      date: new Date(Number.isFinite(alert.time) ? alert.time : Date.now()).toISOString()
    };
    api.storage.local.get([measurementEnabledKey, measurementLogKey]).then((values) => {
      if (values[measurementEnabledKey] !== true) return;
      const log = values[measurementLogKey] &&
        typeof values[measurementLogKey] === "object"
        ? { ...values[measurementLogKey] }
        : {};
      const entries = Array.isArray(log[origin]) ? log[origin] : [];
      const duplicate = entries.some((previous) =>
        previous.date === entry.date &&
        previous.level === entry.level &&
        JSON.stringify(previous.reasons) === JSON.stringify(entry.reasons)
      );
      if (duplicate) return;
      log[origin] = [...entries, entry];
      return api.storage.local.set({ [measurementLogKey]: log });
    }).catch((error) => {
      console.error("Clip Guard: falha ao salvar medição local.", error);
    });
  }

  function handleAlert(alert, messageOrigin = location.origin) {
    if (!alert || (alert.origin !== location.origin &&
        alert.origin !== messageOrigin && alert.origin !== "null")) return;
    getTrustedOrigins().then((origins) => {
      if (origins.includes(alert.origin)) return;
      recordMeasurement(alert);
      notifyBackground();
      ui.showToast(alert, {
        onView: () => ui.showDetails(alert),
        onClear: clearClipboard
      });
    }).catch(() => {
      recordMeasurement(alert);
      notifyBackground();
      ui.showToast(alert, {
        onView: () => ui.showDetails(alert),
        onClear: clearClipboard
      });
    });
  }

  function handleBlockRequest(message, requestOrigin, respond) {
    const { id, alert } = message;
    if (typeof id !== "string" || !alert ||
        (alert.origin !== location.origin && alert.origin !== requestOrigin &&
          alert.origin !== "null") ||
        !["low", "high"].includes(alert.level)) return;
    const safeAlert = {
      ...alert,
      id,
      blocked: true,
      preview: typeof alert.preview === "string" ? alert.preview.slice(0, 120) : "",
      reasons: Array.isArray(alert.reasons)
        ? alert.reasons.filter((reason) => typeof reason === "string").slice(0, 20)
        : []
    };
    recordMeasurement(safeAlert);
    notifyBackground();
    ui.showBlockDialog(safeAlert, {
      onKeepBlocked: () => respond("BLOCK_RESPONSE", { id, action: "keep" }),
      onAllow: () => respond("BLOCK_RESPONSE", { id, action: "allow" })
    });
  }

  function handlePasteRequest(message, requestOrigin, respond) {
    const { id, alert } = message;
    if (typeof id !== "string" || !alert ||
        (alert.origin !== location.origin && alert.origin !== requestOrigin &&
          alert.origin !== "null")) return;
    recordMeasurement(alert);
    notifyBackground();
    ui.showPasteBlockDialog(alert, {
      onPaste: () => respond("PASTE_RESPONSE", { id, action: "paste" }),
      onKeepBlocked: () => respond("PASTE_RESPONSE", { id, action: "keep" })
    });
  }

  function showFreeConfirmation(kind) {
    api.storage.local.get(freeConfirmationsKey).then((values) => {
      if (values[freeConfirmationsKey] !== false) ui.showFreeConfirmation(kind);
    }).catch((error) => {
      console.error("Clip Guard: falha ao carregar a opção de confirmações livres.", error);
    });
  }

  function respondToFrame(source, origin, message, type, data) {
    try {
      const target = frameSources.get(message.channel)?.source ?? source;
      const targetOriginForFrame = frameSources.get(message.channel)?.origin ?? origin;
      target.postMessage({
        [PREFIX]: true,
        channel: message.channel,
        id: message.id,
        type,
        ...data
      }, targetOriginForFrame === "null" ? "*" : targetOriginForFrame);
    } catch {}
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (typeof message.id === "string" && [
      "ALERT", "BLOCK_REQUEST", "BLOCK_RESULT", "WRITE_DIAGNOSTIC",
      "COPY_OK", "PASTE_OK", "PASTE_WARNING", "PASTE_REQUEST"
    ].includes(message.type)) {
      const deduplicationKey = `${message.type}:${message.id}`;
      if (processedMessages.has(deduplicationKey)) return;
      processedMessages.set(deduplicationKey, Date.now());
      if (processedMessages.size > 200) {
        const oldest = processedMessages.keys().next().value;
        processedMessages.delete(oldest);
      }
    }
    const ownWindow = event.source === window;
    const childFrame = !ownWindow && Array.from(window.frames).includes(event.source);
    const parentFrame = !ownWindow && event.source === window.parent && !isTopFrame;
    if (parentFrame && message[PREFIX] === true && typeof message.channel === "string") {
      if (message.type === "PASTE_RESPONSE" || message.type === "BLOCK_RESPONSE") {
        const route = frameSources.get(message.channel);
        if (route) {
          route.source.postMessage(message, route.origin === "null" ? "*" : route.origin);
          return;
        }
        if (message.channel === channel) {
          send(message.type, { id: message.id, action: message.action });
          return;
        }
      }
    }
    if (!ownWindow && !childFrame) return;
    if (message[PREFIX] === true) {
      if (childFrame && typeof message.channel === "string") {
        frameSources.set(message.channel, { source: event.source, origin: event.origin });
        if (frameSources.size > 200) frameSources.delete(frameSources.keys().next().value);
        if (!isTopFrame) {
          frameChannels.add(message.channel);
          try {
            window.parent.postMessage(message, "*");
          } catch (error) {
            console.error("Clip Guard: falha ao encaminhar evento de frame.", error);
          }
          return;
        }
      }
      if (message.type === "HELLO" && typeof message.channel === "string") {
        if (ownWindow) {
          if (channel === null) channel = message.channel;
          if (channel === message.channel) applyProtectionMode();
        }
        if (childFrame) frameChannels.add(message.channel);
        return;
      }
      if (typeof message.channel === "string" &&
          (message.type === "ALERT" || message.type === "PASTE_REQUEST" ||
            message.type === "BLOCK_REQUEST" || message.type === "BLOCK_RESULT" ||
              message.type === "WRITE_DIAGNOSTIC" || message.type === "COPY_OK" ||
              message.type === "PASTE_OK" || message.type === "PASTE_WARNING")) {
        if (ownWindow && channel === null) {
          channel = message.channel;
          applyProtectionMode();
        }
        if (childFrame) frameChannels.add(message.channel);
      }
      const expectedChannel = ownWindow
        ? channel === message.channel
        : frameChannels.has(message.channel);
      if (!expectedChannel && (
        message.type === "ALERT" || message.type === "PASTE_REQUEST" ||
        message.type === "BLOCK_REQUEST" || message.type === "BLOCK_RESULT" ||
        message.type === "WRITE_DIAGNOSTIC" || message.type === "COPY_OK" ||
        message.type === "PASTE_OK" || message.type === "PASTE_WARNING"
      )) {
        if (isTopFrame && message.type === "ALERT") handleAlert(message.alert, event.origin);
        if (isTopFrame && message.type === "PASTE_REQUEST") {
          handlePasteRequest(
            message,
            event.origin,
            (type, data) => respondToFrame(event.source, event.origin, message, type, data)
          );
        }
        if (isTopFrame && message.type === "BLOCK_REQUEST") {
          handleBlockRequest(
            message,
            event.origin,
            (type, data) => respondToFrame(event.source, event.origin, message, type, data)
          );
        }
        if (isTopFrame && message.type === "BLOCK_RESULT") ui.completeBlock(message.id, message);
        if (isTopFrame && message.type === "WRITE_DIAGNOSTIC") {
          recordWriteDiagnostic(message.diagnostic, event.origin);
        }
        if (isTopFrame && message.type === "COPY_OK") showFreeConfirmation("copy");
        if (isTopFrame && message.type === "PASTE_OK") showFreeConfirmation("paste");
        if (isTopFrame && message.type === "PASTE_WARNING") ui.showWarning(message.alert);
        return;
      }
      if (!expectedChannel) return;
      if (!isTopFrame && ownWindow) return;
      if (message.type === "ALERT") handleAlert(message.alert, event.origin);
      if (message.type === "BLOCK_REQUEST") {
        handleBlockRequest(message, event.origin, send);
      }
      if (message.type === "BLOCK_RESULT") ui.completeBlock(message.id, message);
      if (message.type === "WRITE_DIAGNOSTIC") {
        recordWriteDiagnostic(message.diagnostic, event.origin);
      }
      if (message.type === "PASTE_REQUEST") {
        const respond = ownWindow
          ? send
          : (type, data) => respondToFrame(event.source, event.origin, message, type, data);
        handlePasteRequest(message, event.origin, respond);
      }
      if (message.type === "COPY_OK") showFreeConfirmation("copy");
      if (message.type === "PASTE_OK") showFreeConfirmation("paste");
      if (message.type === "PASTE_WARNING") ui.showWarning(message.alert);
      return;
    }
  });
  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[protectionModeKey]) return;
    send("SETTINGS", {
      protectionMode: changes[protectionModeKey].newValue === "warn" ? "warn" : "block"
    });
  });
  window.postMessage({ type: "CG_INIT" }, targetOrigin);
})();
