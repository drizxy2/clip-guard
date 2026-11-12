import { createUI } from "./ui.js";

(() => {
  "use strict";

  const PREFIX = "__clip_guard__";
  const ui = createUI();
  let channel = null;
  const frameChannels = new Set();
  const trustedOriginsKey = "trustedOrigins";
  const measurementEnabledKey = "fpMeasurementEnabled";
  const measurementLogKey = "fpMeasurementLog";
  const targetOrigin = location.origin === "null" ? "*" : location.origin;

  function send(type, data = {}) {
    if (!channel) return;
    try {
      window.postMessage({ [PREFIX]: true, channel, type, ...data }, targetOrigin);
    } catch {}
  }

  function getTrustedOrigins() {
    return chrome.storage.local.get(trustedOriginsKey).then((value) =>
      Array.isArray(value[trustedOriginsKey]) ? value[trustedOriginsKey] : []
    );
  }

  function notifyBackground() {
    try {
      const response = chrome.runtime.sendMessage({ type: "CLIP_GUARD_ALERT" });
      response?.catch?.(() => {});
    } catch {}
  }

  function clearClipboard() {
    try {
      navigator.clipboard.writeText("").catch(() => {});
    } catch {}
  }

  function trustOrigin(origin) {
    return getTrustedOrigins().then((origins) => {
      const updated = [...new Set([...origins, origin])];
      return chrome.storage.local.set({ [trustedOriginsKey]: updated });
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
    chrome.storage.local.get([measurementEnabledKey, measurementLogKey]).then((values) => {
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
      return chrome.storage.local.set({ [measurementLogKey]: log });
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

  function handlePasteRequest(message, requestOrigin, respond) {
    const { id, alert } = message;
    if (typeof id !== "string" || !alert ||
        (alert.origin !== location.origin && alert.origin !== requestOrigin &&
          alert.origin !== "null")) return;
    getTrustedOrigins().then((origins) => {
      if (origins.includes(alert.origin)) {
        respond("PASTE_RESPONSE", { id, action: "paste" });
        return;
      }
      ui.showDialog(alert, {
        onPaste: () => respond("PASTE_RESPONSE", { id, action: "paste" }),
        onCancel: () => respond("PASTE_RESPONSE", { id, action: "cancel" }),
        onClear: () => {
          clearClipboard();
          respond("PASTE_RESPONSE", { id, action: "cancel" });
        },
        onTrust: () => {
          trustOrigin(alert.origin)
            .then(() => respond("PASTE_RESPONSE", { id, action: "cancel" }))
            .catch(() => respond("PASTE_RESPONSE", { id, action: "cancel" }));
        }
      });
    }).catch(() => {
      ui.showDialog(alert, {
        onPaste: () => respond("PASTE_RESPONSE", { id, action: "paste" }),
        onCancel: () => respond("PASTE_RESPONSE", { id, action: "cancel" }),
        onClear: () => {
          clearClipboard();
          respond("PASTE_RESPONSE", { id, action: "cancel" });
        },
        onTrust: () => respond("PASTE_RESPONSE", { id, action: "cancel" })
      });
    });
  }

  function respondToFrame(source, origin, message, type, data) {
    try {
      source.postMessage({
        [PREFIX]: true,
        channel: message.channel,
        type,
        ...data
      }, origin === "null" ? "*" : origin);
    } catch {}
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    const ownWindow = event.source === window;
    const childFrame = !ownWindow &&
      (event.origin === location.origin || event.origin === "null");
    if (!ownWindow && !childFrame) return;
    if (message[PREFIX] === true) {
      if (message.type === "HELLO" && typeof message.channel === "string") {
        if (ownWindow && channel === null) channel = message.channel;
        if (childFrame) frameChannels.add(message.channel);
        return;
      }
      if (typeof message.channel === "string" &&
          (message.type === "ALERT" || message.type === "PASTE_REQUEST")) {
        if (ownWindow && channel === null) channel = message.channel;
        if (childFrame) frameChannels.add(message.channel);
      }
      const expectedChannel = ownWindow
        ? channel === message.channel
        : frameChannels.has(message.channel);
      if (!expectedChannel &&
          (message.type === "ALERT" || message.type === "PASTE_REQUEST")) {
        if (message.type === "ALERT") handleAlert(message.alert, event.origin);
        if (message.type === "PASTE_REQUEST") {
          handlePasteRequest(
            message,
            event.origin,
            (type, data) => respondToFrame(event.source, event.origin, message, type, data)
          );
        }
        return;
      }
      if (!expectedChannel) return;
      if (message.type === "ALERT") handleAlert(message.alert, event.origin);
      if (message.type === "PASTE_REQUEST") {
        const respond = ownWindow
          ? send
          : (type, data) => respondToFrame(event.source, event.origin, message, type, data);
        handlePasteRequest(message, event.origin, respond);
      }
      return;
    }
  });
  window.postMessage({ type: "CG_INIT" }, targetOrigin);
})();
