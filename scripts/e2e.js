import { createServer } from "node:http";
import { chromium } from "playwright";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suspicious = "cmd /c echo test && calc";
const pasteText = "cmd /c echo first\ncalc\n";
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Clip Guard E2E</title>
<button id="copy-legitimate">Copiar npm install lodash</button>
<button id="fullscreen-copy">Fullscreen write</button>
<input id="paste-input"><textarea id="paste-textarea"></textarea>
<div id="paste-editable" contenteditable="true"></div>
<div id="paste-shadow"></div>
<script>
  document.querySelector("#copy-legitimate").addEventListener("click", async () =>
    navigator.clipboard.writeText("npm install lodash"));
  document.querySelector("#fullscreen-copy").addEventListener("click", async () => {
    await document.documentElement.requestFullscreen();
    await navigator.clipboard.writeText(${JSON.stringify(suspicious)});
  });
  document.querySelector("#paste-shadow").attachShadow({mode:"open"}).innerHTML =
    '<textarea id="paste-shadow-field"></textarea><button id="copy-shadow">Copy from shadow</button>';
  document.querySelector("#paste-shadow").shadowRoot.querySelector("#copy-shadow")
    .addEventListener("click", () => navigator.clipboard.writeText(${JSON.stringify(suspicious)}));
</script></html>`;
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});
const outcomes = [];
let context;

async function composedText(page) {
  let protocol = page._clipGuardProtocol;
  if (!protocol) {
    protocol = await context.newCDPSession(page);
    page._clipGuardProtocol = protocol;
  }
  const { root: documentNode } = await protocol.send("DOM.getDocument", { depth: -1, pierce: true });
  const textOf = (node) => [
    node.nodeValue || "",
    ...(node.children || []).map(textOf),
    ...(node.shadowRoots || []).map(textOf),
    ...(node.contentDocument ? [textOf(node.contentDocument)] : [])
  ].join(" ");
  return textOf(documentNode);
}

async function waitForText(page, text, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await composedText(page)).includes(text)) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`Não apareceu: ${text}`);
}

async function waitForAlert(pageOrFrame) {
  try {
    await pageOrFrame.waitForFunction(
      () => document.querySelector('[aria-live="polite"][data-clip-guard-state="alert"]'),
      undefined,
      { timeout: 7000 }
    );
  } catch (error) {
    const details = await pageOrFrame.evaluate(() => ({
      url: location.href,
      origin: location.origin,
      hostCount: document.querySelectorAll('[aria-live="polite"]').length,
      state: document.querySelector('[aria-live="polite"]')?.getAttribute("data-clip-guard-state"),
      hookInstalled: Boolean(window.__clip_guard_hook_state__)
    })).catch(() => null);
    throw new Error(`${String(error?.message || error).split("\n")[0]} ${JSON.stringify(details)}`);
  }
}

async function clickShadowButton(page, label) {
  const protocol = page._clipGuardProtocol || await context.newCDPSession(page);
  page._clipGuardProtocol = protocol;
  const { root: documentNode } = await protocol.send("DOM.getDocument", { depth: -1, pierce: true });
  const textOf = (node) => [
    node.nodeValue || "",
    ...(node.children || []).map(textOf),
    ...(node.shadowRoots || []).map(textOf)
  ].join(" ");
  const visit = (node) => [
    node,
    ...(node.children || []).flatMap(visit),
    ...(node.shadowRoots || []).flatMap(visit)
  ];
  const button = visit(documentNode).find((node) =>
    node.nodeName === "BUTTON" && textOf(node).trim() === label
  );
  if (!button) throw new Error(`Botão não encontrado: ${label}`);
  const { model } = await protocol.send("DOM.getBoxModel", { nodeId: button.nodeId });
  const [left, top, right, bottom] = [
    Math.min(model.content[0], model.content[2], model.content[4], model.content[6]),
    Math.min(model.content[1], model.content[3], model.content[5], model.content[7]),
    Math.max(model.content[0], model.content[2], model.content[4], model.content[6]),
    Math.max(model.content[1], model.content[3], model.content[5], model.content[7])
  ];
  await page.mouse.click((left + right) / 2, (top + bottom) / 2);
}

async function newBasePage() {
  const page = await context.newPage();
  await page.goto(`http://localhost:${server.address().port}/`);
  return page;
}

async function record(name, action) {
  try {
    await action();
    outcomes.push({ name, passed: true });
  } catch (error) {
    outcomes.push({ name, passed: false, error: String(error?.message || error).split("\n")[0] });
  }
}

async function writeInFrame(page, selector, frameUrl, frameContent = "") {
  await page.evaluate(({ selector, frameUrl, frameContent }) => {
    const frame = document.createElement("iframe");
    frame.id = "test-frame";
    if (frameContent) frame.srcdoc = frameContent;
    else if (frameUrl) frame.src = frameUrl;
    document.querySelector(selector).append(frame);
  }, { selector, frameUrl, frameContent });
  await page.waitForTimeout(400);
  const frame = page.frames().find((candidate) =>
    candidate !== page.mainFrame() && (
      frameUrl ? candidate.url().startsWith(frameUrl) :
        candidate.url() === "about:srcdoc" || candidate.url() === "about:blank"
    )
  );
  if (!frame) throw new Error("Frame de teste não carregou");
  await observeTopMessages(page);
  const result = await writeFromFrame(frame);
  await waitForAlert(frame).catch(() => waitForAlert(page)).catch(async (error) => {
    const relay = await page.evaluate(() => window.__clipGuardTopMessages);
    throw new Error(`${error.message} write=${JSON.stringify(result)} relay=${JSON.stringify(relay)}`);
  });
}

async function observeTopMessages(page) {
  await page.evaluate(() => {
    window.__clipGuardTopMessages = [];
    addEventListener("message", (event) => {
      if (event.data?.__clip_guard__ === true) {
        window.__clipGuardTopMessages.push({ type: event.data.type, origin: event.origin });
      }
    });
  });
}

async function writeFromFrame(frame) {
  await frame.evaluate(() => {
    window.__clipGuardMessages = [];
    addEventListener("message", (event) => {
      if (event.data?.__clip_guard__ === true) window.__clipGuardMessages.push(event.data.type);
    });
  });
  await frame.evaluate((text) => {
    const button = document.createElement("button");
    button.id = "frame-write";
    button.textContent = "Write clipboard";
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        button.dataset.result = "clipboard.writeText";
      } catch {
        const field = document.createElement("textarea");
        field.value = text;
        field.style.cssText = "position:fixed;left:-10000px;top:-10000px";
        document.body.append(field);
        field.focus();
        field.select();
        button.dataset.result = `execCommand:${document.execCommand("copy")}`;
      }
    });
    document.body.append(button);
  }, suspicious);
  await frame.locator("#frame-write").click();
  await frame.waitForFunction(
    () => document.querySelector("#frame-write")?.dataset.result,
    undefined,
    { timeout: 5000 }
  );
  return frame.evaluate(() => ({
    result: document.querySelector("#frame-write")?.dataset.result,
    lastWrite: Boolean(window.__clip_guard_hook_state__?.lastWrite),
    messages: window.__clipGuardMessages
  }));
}

async function triggerPaste(page, text) {
  const prevented = await page.evaluate((value) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", value);
    const event = new ClipboardEvent("paste", {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true
    });
    document.activeElement.dispatchEvent(event);
    return event.defaultPrevented;
  }, text);
  if (!prevented) throw new Error("O hook não bloqueou o evento paste");
}

async function pasteTarget(name, action) {
  await record(`Colagem em ${name}: Colar mesmo assim reinsere o texto exato`, async () => {
    const page = await newBasePage();
    try {
      await preparePasteTarget(page, name);
      await page.evaluate((text) => navigator.clipboard.writeText(text), pasteText);
      await waitForText(page, "Clip Guard: área de transferência alterada");
      await triggerPaste(page, pasteText);
      await waitForText(page, "Colagem bloqueada por segurança");
      await clickShadowButton(page, "Colar mesmo assim");
      await page.waitForTimeout(200);
      const actual = await readPasteTarget(page, name);
      const expected = name === "input" ? `prefix${pasteText.replace(/\n/g, "")}suffix` :
        `prefix${pasteText}suffix`;
      if (actual !== expected) throw new Error(`Texto reinscrito diferente: ${JSON.stringify(actual)}`);
    } finally {
      await page.close();
    }
  });
  await record(`Colagem em ${name}: Cancelar mantém o campo intacto`, async () => {
    const page = await newBasePage();
    try {
      await preparePasteTarget(page, name);
      await page.evaluate((text) => navigator.clipboard.writeText(text), pasteText);
      await waitForText(page, "Clip Guard: área de transferência alterada");
      await triggerPaste(page, pasteText);
      await waitForText(page, "Colagem bloqueada por segurança");
      await clickShadowButton(page, "Cancelar");
      const actual = await readPasteTarget(page, name);
      if (actual !== "prefixTARGETsuffix") throw new Error(`Cancelar alterou o campo: ${JSON.stringify(actual)}`);
    } finally {
      await page.close();
    }
  });
}

async function preparePasteTarget(page, name) {
  await page.evaluate((name) => {
    const value = "prefixTARGETsuffix";
    if (name === "input") {
      const field = document.querySelector("#paste-input");
      field.value = value;
      field.focus();
      field.setSelectionRange(6, 12);
      return;
    }
    if (name === "textarea") {
      const field = document.querySelector("#paste-textarea");
      field.value = value;
      field.focus();
      field.setSelectionRange(6, 12);
      return;
    }
    if (name === "contenteditable") {
      const field = document.querySelector("#paste-editable");
      field.textContent = value;
      const range = document.createRange();
      range.setStart(field.firstChild, 6);
      range.setEnd(field.firstChild, 12);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      field.focus();
      return;
    }
    const field = document.querySelector("#paste-shadow").shadowRoot.querySelector("textarea");
    field.value = value;
    field.focus();
    field.setSelectionRange(6, 12);
  }, name);
}

async function readPasteTarget(page, name) {
  return page.evaluate((name) => {
    if (name === "input") return document.querySelector("#paste-input").value;
    if (name === "textarea") return document.querySelector("#paste-textarea").value;
    if (name === "contenteditable") return document.querySelector("#paste-editable").textContent;
    return document.querySelector("#paste-shadow").shadowRoot.querySelector("textarea").value;
  }, name);
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const extensionPath = path.join(root, "dist");
  context = await chromium.launchPersistentContext("", {
    channel: "msedge",
    headless: false,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
  const base = `http://localhost:${server.address().port}`;
  const crossOrigin = `http://127.0.0.1:${server.address().port}`;
  await context.grantPermissions(
    ["clipboard-read", "clipboard-write"],
    { origin: base }
  );
  await context.grantPermissions(
    ["clipboard-read", "clipboard-write"],
    { origin: crossOrigin }
  );

  await record("Escrita em iframe cross-origin", async () => {
    const page = await newBasePage();
    try {
      await writeInFrame(page, "body", crossOrigin);
    } finally {
      await page.close();
    }
  });
  await record("Escrita em srcdoc", async () => {
    const page = await newBasePage();
    try {
      await writeInFrame(page, "body", "", "<!doctype html><meta charset=utf-8>");
    } finally {
      await page.close();
    }
  });
  await record("Escrita em about:blank", async () => {
    const page = await newBasePage();
    try {
      await writeInFrame(page, "body", "");
    } finally {
      await page.close();
    }
  });
  await record("Escrita em popup window.open", async () => {
    const page = await newBasePage();
    let popup;
    try {
      const popupEvent = context.waitForEvent("page");
      await page.evaluate(() => window.open("about:blank", "clip-guard-popup"));
      popup = await popupEvent;
      await popup.evaluate((text) => {
        const button = document.createElement("button");
        button.id = "popup-write";
        button.textContent = "Write clipboard";
        button.addEventListener("click", () => navigator.clipboard.writeText(text));
        document.body.append(button);
      }, suspicious);
      await popup.locator("#popup-write").click();
      await waitForAlert(popup);
    } finally {
      await popup?.close();
      await page.close();
    }
  });
  await record("document.write em iframe novo", async () => {
    const page = await newBasePage();
    try {
      await page.evaluate(() => {
        const frame = document.createElement("iframe");
        frame.id = "document-write-frame";
        frame.src = location.href;
        document.body.append(frame);
      });
      await page.waitForFunction(() =>
        document.querySelector("#document-write-frame")?.contentDocument?.readyState === "complete"
      );
      const frame = page.frames().find((candidate) =>
        candidate !== page.mainFrame() && candidate.url() === page.url()
      );
      if (!frame) throw new Error("Frame same-origin não carregou");
      await observeTopMessages(page);
      await frame.waitForFunction(
        () => document.querySelector('[aria-live="polite"]'),
        undefined,
        { timeout: 7000 }
      );
      await frame.evaluate(() => {
        document.open();
        document.write("<!doctype html><meta charset=utf-8><title>new document</title>");
        document.close();
      });
      const result = await writeFromFrame(frame);
      await waitForAlert(frame).catch(() => waitForAlert(page)).catch(async (error) => {
        const relay = await page.evaluate(() => window.__clipGuardTopMessages);
        throw new Error(`${error.message} write=${JSON.stringify(result)} relay=${JSON.stringify(relay)}`);
      });
    } finally {
      await page.close();
    }
  });
  await record("Escrita originada em Shadow DOM", async () => {
    const page = await newBasePage();
    try {
      await page.locator("#paste-shadow").locator("#copy-shadow").click();
      await waitForText(page, "Clip Guard: área de transferência alterada");
    } finally {
      await page.close();
    }
  });
  await record("Evento copy com DataTransfer.setData", async () => {
    const page = await newBasePage();
    try {
      await page.evaluate((text) => {
        const field = document.createElement("textarea");
        field.value = "ordinary text";
        document.body.append(field);
        field.focus();
        field.select();
        document.addEventListener("copy", (event) => {
          event.clipboardData.setData("text/plain", text);
          event.preventDefault();
        }, { once: true });
        document.execCommand("copy");
      }, suspicious);
      await waitForText(page, "Clip Guard: área de transferência alterada");
    } finally {
      await page.close();
    }
  });
  await record("execCommand('copy') com textarea oculto", async () => {
    const page = await newBasePage();
    try {
      await page.evaluate((text) => {
        const field = document.createElement("textarea");
        field.value = text;
        field.style.cssText = "position:fixed;left:-10000px;top:-10000px";
        document.body.append(field);
        field.focus();
        field.select();
        document.execCommand("copy");
      }, suspicious);
      await waitForText(page, "Clip Guard: área de transferência alterada");
    } finally {
      await page.close();
    }
  });
  await record("navigator.clipboard.write com ClipboardItem", async () => {
    const page = await newBasePage();
    try {
      await page.evaluate(async (text) => {
        const item = new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }) });
        await navigator.clipboard.write([item]);
      }, suspicious);
      await waitForText(page, "Clip Guard: área de transferência alterada");
    } finally {
      await page.close();
    }
  });
  await record("Escrita durante Fullscreen", async () => {
    const page = await newBasePage();
    try {
      await page.locator("#fullscreen-copy").click();
      await waitForText(page, "Clip Guard: área de transferência alterada");
    } finally {
      await page.evaluate(() => document.fullscreenElement && document.exitFullscreen()).catch(() => {});
      await page.close();
    }
  });

  for (const target of ["input", "textarea", "contenteditable", "campo em Shadow DOM"]) {
    await pasteTarget(target === "campo em Shadow DOM" ? "shadow" : target, target);
  }

  await record("Medição local desativada por padrão", async () => {
    let worker = context.serviceWorkers().find((serviceWorker) =>
      serviceWorker.url().startsWith("chrome-extension://")
    );
    if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 5000 });
    const extensionId = new URL(worker.url()).host;
    const options = await context.newPage();
    const page = await newBasePage();
    try {
      await options.goto(`chrome-extension://${extensionId}/options.html`);
      if (await options.locator("#measurement-enabled").isChecked()) {
        throw new Error("A medição local está ativada por padrão");
      }
      await page.evaluate((text) => navigator.clipboard.writeText(text), suspicious);
      await waitForText(page, "Clip Guard: área de transferência alterada");
      const log = await options.evaluate(() => chrome.storage.local.get("fpMeasurementLog"));
      if (log.fpMeasurementLog) throw new Error("O alerta foi salvo com a medição desativada");
    } finally {
      await page.close();
      await options.close();
    }
  });
  await record("Medição por origem e exportação JSON sem texto", async () => {
    const worker = context.serviceWorkers().find((serviceWorker) =>
      serviceWorker.url().startsWith("chrome-extension://")
    );
    if (!worker) throw new Error("Service worker da extensão indisponível");
    const extensionId = new URL(worker.url()).host;
    const options = await context.newPage();
    const page = await newBasePage();
    try {
      await options.goto(`chrome-extension://${extensionId}/options.html`);
      await options.locator("#measurement-enabled").check();
      await options.waitForFunction(async () =>
        (await chrome.storage.local.get("fpMeasurementEnabled")).fpMeasurementEnabled === true
      );
      await page.evaluate((text) => navigator.clipboard.writeText(text), suspicious);
      await waitForText(page, "Clip Guard: área de transferência alterada");
      await options.waitForFunction(async () => {
        const values = await chrome.storage.local.get("fpMeasurementLog");
        return Object.values(values.fpMeasurementLog || {}).some((entries) => entries.length > 0);
      });
      await options.waitForFunction(() => !document.querySelector("#export").disabled);
      const stored = await options.evaluate(async () =>
        (await chrome.storage.local.get("fpMeasurementLog")).fpMeasurementLog
      );
      const records = Object.values(stored).flat();
      if (!records.length) throw new Error("Nenhuma medição foi salva");
      for (const entry of records) {
        if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(["date", "level", "reasons"])) {
          throw new Error(`Campos inesperados no registro: ${JSON.stringify(Object.keys(entry))}`);
        }
      }
      const downloadEvent = options.waitForEvent("download");
      await options.locator("#export").click();
      const download = await downloadEvent;
      if (download.suggestedFilename() !== "clip-guard-measurements.json") {
        throw new Error(`Nome de exportação inesperado: ${download.suggestedFilename()}`);
      }
      const exported = JSON.parse((await readFile(await download.path())).toString("utf8"));
      if (JSON.stringify(exported) !== JSON.stringify(stored)) {
        throw new Error("O JSON exportado difere dos registros da tabela");
      }
      await options.locator("#measurement-enabled").uncheck();
    } finally {
      await page.close();
      await options.close();
    }
  });

  await record("Botão legítimo Copiar npm install lodash sem alerta", async () => {
    const page = await newBasePage();
    try {
      await page.locator("#copy-legitimate").click();
      await page.waitForTimeout(700);
      if ((await composedText(page)).includes("Clip Guard: área de transferência alterada")) {
        throw new Error("O botão legítimo gerou alerta");
      }
    } finally {
      await page.close();
    }
  });
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
}

const passed = outcomes.filter(({ passed }) => passed).length;
const report = [
  "# Resultados dos cenários E2E",
  "",
  `Executado em ${new Date().toISOString()} com Playwright e Microsoft Edge. Resultado: ${passed}/${outcomes.length} passaram.`,
  "",
  "| Cenário | Resultado | Observação |",
  "| --- | --- | --- |",
  ...outcomes.map(({ name, passed: result, error }) =>
    `| ${name} | ${result ? "PASSOU" : "FALHOU"} | ${error ?? ""} |`
  ),
  ""
].join("\n");
await mkdir(path.join(root, "reports"), { recursive: true });
await writeFile(path.join(root, "reports", "e2e.md"), report);
for (const outcome of outcomes) {
  console.log(`${outcome.passed ? "PASS" : "FAIL"} ${outcome.name}${outcome.error ? `: ${outcome.error}` : ""}`);
}
if (passed !== outcomes.length) process.exitCode = 1;
