import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suspicious = "cmd /c echo test && calc";
const html = "<!doctype html><meta charset=utf-8><title>docwrite diagnostic</title>";
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});
let context;

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const extensionPath = path.join(root, "dist", "chromium");
  context = await chromium.launchPersistentContext("", {
    channel: "msedge",
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
  const origin = `http://localhost:${server.address().port}`;
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  await page.goto(origin);
  await page.evaluate((source) => {
    const frame = document.createElement("iframe");
    frame.id = "diagnostic-frame";
    frame.src = source;
    document.body.append(frame);
  }, origin);
  const frame = page.frames()[1];
  await frame.waitForFunction(() => document.querySelector('[aria-live="polite"]'), undefined, { timeout: 7000 });

  await page.evaluate(() => {
    const child = document.querySelector("#diagnostic-frame").contentWindow;
    window.__beforeDocWrite = {
      writeText: child.navigator.clipboard.writeText,
      write: child.navigator.clipboard.write,
      execCommand: child.Document.prototype.execCommand,
      setData: child.DataTransfer.prototype.setData
    };
  });
  await frame.evaluate(() => {
    document.open();
    document.write("<!doctype html><meta charset=utf-8><title>after write</title><textarea id=copy-target>ordinary</textarea>");
    document.close();
    window.__clipGuardObserved = [];
    addEventListener("message", (event) => {
      if (event.data?.__clip_guard__ === true) window.__clipGuardObserved.push(event.data.type);
    });
    const button = (id, action) => {
      const element = document.createElement("button");
      element.id = id;
      element.textContent = id;
      element.addEventListener("click", action);
      document.body.append(element);
    };
    button("write-text", () => navigator.clipboard.writeText("cmd /c echo test && calc"));
    button("write-item", () => navigator.clipboard.write([
      new ClipboardItem({ "text/plain": new Blob(["cmd /c echo test && calc"], { type: "text/plain" }) })
    ]));
    button("exec-copy", () => {
      const target = document.querySelector("#copy-target");
      target.value = "cmd /c echo test && calc";
      target.focus();
      target.select();
      document.execCommand("copy");
    });
    button("set-data", () => {
      const target = document.querySelector("#copy-target");
      target.value = "ordinary text";
      target.focus();
      target.select();
      document.addEventListener("copy", (event) => {
        event.clipboardData.setData("text/plain", "cmd /c echo test && calc");
        event.preventDefault();
      }, { once: true });
      document.execCommand("copy");
    });
  });

  const operations = [];
  for (const [id, label] of [
    ["write-text", "navigator.clipboard.writeText"],
    ["write-item", "navigator.clipboard.write"],
    ["exec-copy", "Document.execCommand"],
    ["set-data", "DataTransfer.setData during copy"]
  ]) {
    const before = await frame.evaluate(() => window.__clipGuardObserved.length);
    await frame.locator(`#${id}`).click();
    await page.waitForTimeout(200);
    const after = await frame.evaluate(() => window.__clipGuardObserved.slice());
    operations.push({ label, detected: after.slice(before).includes("ALERT") });
  }
  await frame.locator("#write-text").click();
  const pastePrevented = await frame.evaluate((text) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", text);
    const event = new ClipboardEvent("paste", {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true
    });
    document.querySelector("#copy-target").dispatchEvent(event);
    return event.defaultPrevented;
  }, suspicious);
  const identity = await page.evaluate(() => {
    const child = document.querySelector("#diagnostic-frame").contentWindow;
    return {
      writeText: window.__beforeDocWrite.writeText === child.navigator.clipboard.writeText,
      write: window.__beforeDocWrite.write === child.navigator.clipboard.write,
      execCommand: window.__beforeDocWrite.execCommand === child.Document.prototype.execCommand,
      setData: window.__beforeDocWrite.setData === child.DataTransfer.prototype.setData
    };
  });
  const messages = await frame.evaluate(() => window.__clipGuardObserved);

  const report = [
    "# Cobertura após rearmamento de document.write",
    "",
    `Diagnóstico pós-rearme executado em ${new Date().toISOString()} com Edge/Playwright. Após document.open()/write()/close(), referências às funções embrulhadas foram comparadas com as capturadas antes; ALERT/PASTE_REQUEST foram observados por postMessage e a prevenção de paste foi verificada no evento.`,
    "",
    "| Hook/listener | Referência do wrapper persistiu | Detecção funcional depois de document.write |",
    "| --- | --- | --- |",
    ...operations.map(({ label, detected }) =>
      `| ${label} | ${identity[label === "navigator.clipboard.writeText" ? "writeText" : label === "navigator.clipboard.write" ? "write" : label === "Document.execCommand" ? "execCommand" : "setData"] ? "sim" : "não"} | ${detected ? "sim" : "não"} |`
    ),
    `| listener de paste | n/a | ${pastePrevented ? "preventDefault ativo" : "não bloqueou"} |`,
    `| listener de copy | n/a | ${messages.includes("ALERT") && operations[3].detected ? "ativo" : "inativo"} |`,
    "",
    `Mensagens MAIN observadas: ${messages.length ? messages.join(", ") : "nenhuma"}.`,
    "",
    "## Cobertura restante",
    "",
    "- Não cobre páginas especiais/restritas do navegador, escritas iniciadas em workers ou contextos sem permissão de clipboard.",
    "- O conteúdo de páginas pode forjar mensagens da ponte e provocar alertas falsos; a ponte não deve permitir que a página suprima os alertas.",
    ""
  ].join("\n");
  await mkdir(path.join(root, "reports"), { recursive: true });
  await writeFile(path.join(root, "reports", "coverage.md"), report);
  console.log(JSON.stringify({ identity, operations, pastePrevented, messages }, null, 2));
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
}
