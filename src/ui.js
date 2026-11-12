export function createUI() {
  const host = document.createElement("div");
  host.setAttribute("aria-live", "polite");
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .toast, .dialog { font: 14px/1.45 system-ui, sans-serif; color: #172033; }
    .toast { position: fixed; z-index: 2147483647; right: 20px; bottom: 20px; width: min(390px, calc(100vw - 32px)); padding: 16px; border: 1px solid #d5dbea; border-radius: 12px; background: #fff; box-shadow: 0 8px 32px #0004; }
    .dialog-backdrop { position: fixed; z-index: 2147483647; inset: 0; display: grid; place-items: center; padding: 20px; background: #10182899; }
    .dialog { width: min(480px, 100%); padding: 20px; border-radius: 14px; background: #fff; box-shadow: 0 12px 40px #0005; }
    h2 { margin: 0 0 8px; font-size: 17px; }
    p { margin: 8px 0 12px; overflow-wrap: anywhere; }
    .preview { padding: 10px; border-radius: 8px; background: #f2f4f8; font: 12px/1.4 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .reasons { color: #475467; font-size: 12px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    button { border: 1px solid #b7c0d0; border-radius: 8px; padding: 8px 11px; background: #fff; color: #172033; cursor: pointer; font: inherit; }
    button.primary { color: #fff; border-color: #b42318; background: #b42318; }
    button:focus-visible { outline: 3px solid #84caff; outline-offset: 2px; }
  `;
  shadow.append(style);

  function ensureHost() {
    if (host.isConnected) return;
    if (document.documentElement) {
      document.documentElement.append(host);
      return;
    }
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement?.append(host);
    }, { once: true });
  }
  ensureHost();

  function details(alert, title, showPreview = false) {
    const box = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = title;
    const source = document.createElement("p");
    source.textContent = `${alert.origin} colocou um comando de sistema na área de transferência.`;
    const reasons = document.createElement("p");
    reasons.className = "reasons";
    reasons.textContent = `Sinais: ${(alert.reasons || []).join(", ") || "nenhum"}`;
    box.append(heading, source);
    if (showPreview && alert.preview) {
      const preview = document.createElement("div");
      preview.className = "preview";
      preview.textContent = alert.preview;
      box.append(preview);
    }
    box.append(reasons);
    return box;
  }

  function button(label, action, callback, primary = false) {
    const element = document.createElement("button");
    element.textContent = label;
    if (primary) element.className = "primary";
    element.addEventListener("click", callback, { once: true });
    action.append(element);
    return element;
  }

  function showToast(alert, callbacks) {
    ensureHost();
    host.setAttribute("data-clip-guard-state", "alert");
    const box = document.createElement("section");
    box.className = "toast";
    box.append(details(alert, "Clip Guard: área de transferência alterada"));
    const actions = document.createElement("div");
    actions.className = "buttons";
    button("Ver", actions, () => callbacks.onView());
    button("Limpar", actions, () => callbacks.onClear());
    box.append(actions);
    shadow.append(box);
    setTimeout(() => box.remove(), 8000);
  }

  function showDetails(alert) {
    ensureHost();
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
    const panel = document.createElement("section");
    panel.className = "dialog";
    panel.append(details(alert, "Detalhes do alerta", true));
    const actions = document.createElement("div");
    actions.className = "buttons";
    button("Fechar", actions, () => backdrop.remove());
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
    panel.append(details(alert, "Colagem bloqueada por segurança", true));
    const actions = document.createElement("div");
    actions.className = "buttons";
    const dismiss = (callback) => {
      backdrop.remove();
      host.setAttribute("data-clip-guard-state", "alert");
      callback();
    };
    button("Colar mesmo assim", actions, () => {
      dismiss(callbacks.onPaste);
    }, true);
    button("Limpar área de transferência", actions, () => {
      dismiss(callbacks.onClear);
    });
    button("Cancelar", actions, () => {
      dismiss(callbacks.onCancel);
    });
    button("Confiar neste site", actions, () => {
      dismiss(callbacks.onTrust);
    });
    panel.append(actions);
    backdrop.append(panel);
    shadow.append(backdrop);
    actions.querySelector("button")?.focus();
  }

  return { showToast, showDetails, showDialog };
}
