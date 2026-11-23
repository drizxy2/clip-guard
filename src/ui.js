import { isRightToLeft, translateMethod, translateReason } from "./i18n.js";

export function createUI() {
  const api = globalThis.clipGuardApi;
  const host = document.createElement("div");
  host.setAttribute("data-clip-guard-ui", "true");
  host.dir = isRightToLeft(api.i18n.getUILanguage()) ? "rtl" : "ltr";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .toast, .dialog { font: 14px/1.45 system-ui, sans-serif; color: #172033; }
    .toast { position: fixed; z-index: 2147483647; right: 20px; bottom: 20px; width: min(390px, calc(100vw - 32px)); padding: 16px; border: 1px solid #d5dbea; border-radius: 12px; background: #fff; box-shadow: 0 8px 32px #0004; }
    .free-toast { width: auto; max-width: min(390px, calc(100vw - 32px)); padding: 10px 14px; pointer-events: none; }
    .dialog-backdrop { position: fixed; z-index: 2147483647; inset: 0; display: grid; place-items: center; padding: 20px; background: #10182899; }
    .dialog { width: min(480px, 100%); padding: 20px; border-radius: 14px; background: #fff; box-shadow: 0 12px 40px #0005; }
    h2 { margin: 0 0 8px; font-size: 17px; }
    p { margin: 8px 0 12px; overflow-wrap: anywhere; }
    .preview { padding: 10px; border-radius: 8px; background: #f2f4f8; font: 12px/1.4 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .reasons { color: #475467; font-size: 12px; }
    .status { color: #b42318; font-size: 13px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    button { border: 1px solid #b7c0d0; border-radius: 8px; padding: 8px 11px; background: #fff; color: #172033; cursor: pointer; font: inherit; }
    button.primary { color: #fff; border-color: #b42318; background: #b42318; }
    button:focus-visible { outline: 3px solid #84caff; outline-offset: 2px; }
  `;
  shadow.append(style);

  function t(key, substitutions) {
    const value = api.i18n.getMessage(key, substitutions);
    if (!value) throw new Error(`Missing i18n message: ${key}`);
    return value;
  }

  let hostObserver = null;
  function ensureHost() {
    if (host.isConnected) return;
    if (document.documentElement) {
      document.documentElement.append(host);
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement?.append(host);
      }, { once: true });
    }
  }
  function observeHostReattachment() {
    if (hostObserver) return;
    if (!globalThis.MutationObserver) return;
    hostObserver = new MutationObserver((records) => {
      if (!host.isConnected) ensureHost();
      for (const record of records) {
        if (record.removedNodes?.length) {
          if (!host.isConnected) ensureHost();
          break;
        }
      }
    });
    try {
      hostObserver.observe(document, { childList: true, subtree: true });
    } catch {
      hostObserver = null;
    }
  }
  ensureHost();
  observeHostReattachment();

  function details(alert, title, sourceKey, showPreview = false) {
    const box = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = t(title);
    const source = document.createElement("p");
    source.textContent = t(sourceKey, alert.origin);
    const reasons = document.createElement("p");
    reasons.className = "reasons";
    const localizedReasons = (alert.reasons || []).map((reason) =>
      translateReason(reason, (key, substitutions) => api.i18n.getMessage(key, substitutions))
    );
    reasons.textContent = t(
      "reasonsLabel",
      localizedReasons.join(", ") || t("noReasons")
    );
    box.append(heading, source);
    if (alert.method) {
      const method = document.createElement("p");
      method.className = "reasons";
      method.textContent = t(
        "methodLabel",
        translateMethod(alert.method, (key, substitutions) =>
          api.i18n.getMessage(key, substitutions)
        )
      );
      box.append(method);
    }
    if (showPreview && alert.preview) {
      const preview = document.createElement("div");
      preview.className = "preview";
      preview.setAttribute("aria-label", t("previewLabel"));
      preview.textContent = alert.preview;
      box.append(preview);
    }
    box.append(reasons);
    return box;
  }

  function button(labelKey, action, callback, primary = false) {
    const element = document.createElement("button");
    element.textContent = t(labelKey);
    if (primary) element.className = "primary";
    element.addEventListener("click", callback, { once: true });
    action.append(element);
    return element;
  }

  let freeToast = null;
  let freeToastTimer = null;
  function showFreeConfirmation(kind) {
    ensureHost();
    if (["dialog", "paste-block-dialog", "block-dialog"].includes(
      host.getAttribute("data-clip-guard-state")
    )) return;
    host.setAttribute("data-clip-guard-state", `free-${kind}`);
    if (!freeToast) {
      freeToast = document.createElement("div");
      freeToast.className = "toast free-toast";
      freeToast.setAttribute("role", "status");
      freeToast.setAttribute("aria-live", "polite");
      shadow.append(freeToast);
    }
    freeToast.textContent = t(kind === "copy" ? "toastCopyOK" : "toastPasteOK");
    clearTimeout(freeToastTimer);
    freeToastTimer = setTimeout(() => {
      freeToast?.remove();
      freeToast = null;
      freeToastTimer = null;
    }, 2500);
  }

  function showWarning(alert) {
    ensureHost();
    host.setAttribute("data-clip-guard-state", "paste-warning");
    if (!freeToast) {
      freeToast = document.createElement("div");
      freeToast.className = "toast free-toast";
      freeToast.setAttribute("role", "status");
      freeToast.setAttribute("aria-live", "polite");
      shadow.append(freeToast);
    }
    freeToast.textContent = `${t("warnPasteTitle")}: ${alert.reasons
      .map((reason) => translateReason(reason, (key, substitutions) =>
        api.i18n.getMessage(key, substitutions)
      )).join(", ")}`;
    clearTimeout(freeToastTimer);
    freeToastTimer = setTimeout(() => {
      freeToast?.remove();
      freeToast = null;
      freeToastTimer = null;
    }, 5000);
  }

  function showToast(alert, callbacks) {
    ensureHost();
    host.setAttribute("data-clip-guard-state", "alert");
    const box = document.createElement("section");
    box.className = "toast";
    box.append(details(
      alert,
      "alertTitle",
      alert.blocked ? "alertCopyBlocked" : "alertCopyWarned"
    ));
    const actions = document.createElement("div");
    actions.className = "buttons";
    button("viewButton", actions, () => callbacks.onView());
    button("clearButton", actions, () => callbacks.onClear());
    box.append(actions);
    shadow.querySelector(".alert-toast")?.remove();
    box.classList.add("alert-toast");
    shadow.append(box);
    setTimeout(() => box.remove(), 8000);
  }

  function showDetails(alert) {
    ensureHost();
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
    const panel = document.createElement("section");
    panel.className = "dialog";
    panel.append(details(
      alert,
      "detailsTitle",
      alert.paste ? "alertPasteBlocked" : "alertCopyBlocked",
      true
    ));
    const actions = document.createElement("div");
    actions.className = "buttons";
    button("closeButton", actions, () => backdrop.remove());
    panel.append(actions);
    backdrop.append(panel);
    shadow.append(backdrop);
  }

  function showDialog(alert, callbacks) {
    ensureHost();
    host.setAttribute("data-clip-guard-state", "dialog");
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
    const panel = document.createElement("section");
    panel.className = "dialog";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");
    panel.append(details(alert, "pasteBlockedTitle", "alertPasteBlocked", true));
    const actions = document.createElement("div");
    actions.className = "buttons";
    const dismiss = (callback) => {
      backdrop.remove();
      host.setAttribute("data-clip-guard-state", "alert");
      callback();
    };
    button("allowOnceButton", actions, () => dismiss(callbacks.onPaste), true);
    button("clearButton", actions, () => dismiss(callbacks.onClear));
    button("closeButton", actions, () => dismiss(callbacks.onCancel));
    panel.append(actions);
    backdrop.append(panel);
    shadow.append(backdrop);
    actions.querySelector("button")?.focus();
  }

  function showPasteBlockDialog(alert, callbacks) {
    ensureHost();
    host.setAttribute("data-clip-guard-state", "paste-block-dialog");
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
    const panel = document.createElement("section");
    panel.className = "dialog";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");
    panel.append(details(alert, "pasteBlockedTitle", "alertPasteBlocked", true));
    const actions = document.createElement("div");
    actions.className = "buttons";
    const dismiss = (callback) => {
      backdrop.remove();
      host.setAttribute("data-clip-guard-state", "alert");
      callback();
    };
    const keep = button("keepBlockedButton", actions, () =>
      dismiss(callbacks.onKeepBlocked), true
    );
    button("allowOnceButton", actions, () => dismiss(callbacks.onPaste));
    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismiss(callbacks.onKeepBlocked);
    });
    panel.append(actions);
    backdrop.append(panel);
    shadow.append(backdrop);
    keep.focus();
  }

  const pendingBlocks = new Map();

  function showBlockDialog(alert, callbacks) {
    ensureHost();
    host.setAttribute("data-clip-guard-state", "block-dialog");
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
    const panel = document.createElement("section");
    panel.className = "dialog";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");
    panel.append(details(alert, "copyBlockedTitle", "alertCopyBlocked", true));
    const status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const actions = document.createElement("div");
    actions.className = "buttons";
    const entry = { backdrop, status, actions };
    pendingBlocks.set(alert.id, entry);
    const dismiss = (callback) => {
      backdrop.remove();
      pendingBlocks.delete(alert.id);
      host.setAttribute("data-clip-guard-state", "alert");
      callback();
    };
    const keep = button("keepBlockedButton", actions, () =>
      dismiss(callbacks.onKeepBlocked), true
    );
    const allow = button("allowWriteButton", actions, () => {
      allow.disabled = true;
      keep.disabled = true;
      status.textContent = t("waitWrite");
      callbacks.onAllow();
    });
    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismiss(callbacks.onKeepBlocked);
    });
    panel.append(status, actions);
    backdrop.append(panel);
    shadow.append(backdrop);
    keep.focus();
  }

  function completeBlock(id, result) {
    const entry = pendingBlocks.get(id);
    if (!entry) return;
    if (!result.success) {
      entry.status.textContent = t(
        "writeFailed",
        result.error || t("permissionDenied")
      );
      for (const control of entry.actions.querySelectorAll("button")) control.disabled = false;
      entry.actions.querySelectorAll("button")[1]?.focus();
      return;
    }
    entry.backdrop.remove();
    pendingBlocks.delete(id);
    host.setAttribute("data-clip-guard-state", "alert");
  }

  return {
    showToast,
    showDetails,
    showDialog,
    showBlockDialog,
    showPasteBlockDialog,
    showFreeConfirmation,
    showWarning,
    completeBlock
  };
}
