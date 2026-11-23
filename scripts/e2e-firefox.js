import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { By, Builder, Key, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { start as startGeckodriver } from "geckodriver";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const firefoxPath = "C:\\Program Files\\Mozilla Firefox\\firefox.exe";
const extensionPath = path.join(root, "dist", "firefox.zip");
const page = await readFile(path.join(root, "test", "pages", "clickfix-demo.html"));
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(page);
});
const outcomes = [];
let driver;
let geckodriver;
let firefoxVersion = "desconhecida";
let failure;

async function waitForState(state) {
  try {
    await driver.wait(async () => driver.executeScript(
      "return document.querySelector('[data-clip-guard-state]')?.getAttribute('data-clip-guard-state') === arguments[0]",
      state
    ), 7000);
  } catch {
    const details = await driver.executeScript(async () => {
      const hook = window.__clip_guard_hook_state__;
      let clipboard;
      try {
        clipboard = await navigator.clipboard.readText();
      } catch (error) {
        clipboard = `readText failed: ${error.message}`;
      }
      return {
        state: document.querySelector("[data-clip-guard-state]")?.getAttribute("data-clip-guard-state"),
        clipboard,
        lastWrite: hook?.lastWrite && {
          level: hook.lastWrite.level,
          origin: hook.lastWrite.origin
        },
        pendingPaste: Boolean(hook?.pendingPaste)
      };
    });
    throw new Error(`Esperava diálogo/estado ${state}: ${JSON.stringify(details)}`);
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

async function copySuspicious() {
  await driver.findElement(By.id("fake-check")).click();
  await driver.wait(until.elementTextContains(
    driver.findElement(By.id("status")),
    "Texto de demonstração copiado"
  ), 7000);
  await waitForState("block-dialog");
}

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  geckodriver = await startGeckodriver({ port: 4444, spawnOpts: { stdio: "ignore" } });
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch("http://127.0.0.1:4444/status")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const options = new firefox.Options()
    .setBinary(firefoxPath)
    .addArguments("-headless")
    .setPreference("dom.events.testing.asyncClipboard", true)
    .setPreference("dom.events.asyncClipboard.clipboardItem", true);
  driver = await new Builder()
    .usingServer("http://127.0.0.1:4444")
    .forBrowser("firefox")
    .setFirefoxOptions(options)
    .build();
  firefoxVersion = (await driver.getCapabilities()).get("browserVersion") || firefoxVersion;
  await driver.installAddon(extensionPath, true);
  await driver.get(`http://127.0.0.1:${server.address().port}/test/pages/clickfix-demo.html`);

  await record("writeText bloqueia sem alterar o clipboard", async () => {
    await driver.executeScript("return navigator.clipboard.writeText('sentinela')");
    await copySuspicious();
    const clipboard = await driver.executeScript("return navigator.clipboard.readText()");
    if (clipboard !== "sentinela") throw new Error(`Clipboard alterado: ${clipboard}`);
    await driver.actions().sendKeys(Key.ESCAPE).perform();
    const afterEscape = await driver.executeScript("return navigator.clipboard.readText()");
    if (afterEscape !== "sentinela") throw new Error(`Escape permitiu a gravação: ${afterEscape}`);
  });

  await record("Permitir mesmo assim grava o texto retido", async () => {
    await driver.executeScript("return navigator.clipboard.writeText('sentinela')");
    await copySuspicious();
    await driver.actions().sendKeys(Key.TAB, Key.ENTER).perform();
    await driver.wait(async () => driver.executeScript(
      "return document.querySelector('[data-clip-guard-state]')?.getAttribute('data-clip-guard-state') === 'alert'"
    ), 7000);
    const clipboard = await driver.executeScript("return navigator.clipboard.readText()");
    if (clipboard !== "cmd /c echo test && calc") {
      throw new Error(`Permissão não gravou o conteúdo: ${clipboard}`);
    }
  });

  await record("Texto benigno copia normalmente", async () => {
    await driver.get(`http://127.0.0.1:${server.address().port}/test/pages/clickfix-demo.html`);
    await driver.findElement(By.id("copy-legitimate")).click();
    await driver.wait(until.elementTextContains(
      driver.findElement(By.id("status")),
      "Comando legítimo copiado"
    ), 7000);
    const clipboard = await driver.executeScript("return navigator.clipboard.readText()");
    if (clipboard !== "npm install lodash") throw new Error(`Texto benigno não copiado: ${clipboard}`);
    const state = await driver.executeScript(
      "return document.querySelector('[data-clip-guard-state]')?.getAttribute('data-clip-guard-state')"
    );
    if (state === "block-dialog") throw new Error("Alerta indevido para texto benigno");
  });

  await record("Iframe same-origin bloqueia writeText", async () => {
    await driver.get(`http://127.0.0.1:${server.address().port}/test/pages/clickfix-demo.html`);
    await driver.executeScript((url) => {
      const frame = document.createElement("iframe");
      frame.id = "document-write-frame";
      frame.src = url;
      document.body.append(frame);
    }, `http://127.0.0.1:${server.address().port}/test/pages/clickfix-demo.html`);
    await driver.executeScript("return navigator.clipboard.writeText('npm install lodash')");
    await driver.wait(until.elementLocated(By.id("document-write-frame")), 7000);
    const frame = await driver.findElement(By.id("document-write-frame"));
    await driver.switchTo().frame(frame);
    await driver.wait(until.elementLocated(By.id("try-write-text")), 7000);
    await driver.wait(async () => driver.executeScript(
      "return Boolean(window.__clip_guard_hook_state__?.listenersInstalled)"
    ), 7000);
    await driver.findElement(By.id("try-write-text")).click();
    await driver.switchTo().defaultContent();
    await waitForState("block-dialog");
    const clipboard = await driver.executeScript("return navigator.clipboard.readText()");
    if (clipboard !== "npm install lodash") {
      throw new Error(`Iframe alterou o clipboard: ${clipboard}`);
    }
    await driver.actions().sendKeys(Key.ESCAPE).perform();
  });

  await record("Ctrl+C manual bloqueia a seleção", async () => {
    await driver.get(`http://127.0.0.1:${server.address().port}/test/pages/clickfix-demo.html`);
    await driver.executeScript("return navigator.clipboard.writeText('sentinela')");
    await driver.executeScript(() => {
      const paragraph = document.createElement("p");
      paragraph.id = "manual-copy";
      paragraph.textContent = "cmd /c echo test && calc";
      document.body.append(paragraph);
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await driver.actions().keyDown(Key.CONTROL).sendKeys("c").keyUp(Key.CONTROL).perform();
    await waitForState("block-dialog");
    const clipboard = await driver.executeScript("return navigator.clipboard.readText()");
    if (clipboard !== "sentinela") throw new Error(`Ctrl+C alterou o clipboard: ${clipboard}`);
    await driver.actions().sendKeys(Key.ESCAPE).perform();
  });

  await record("legitimate npm install lodash copy has no alert", async () => {
    await driver.get(`http://127.0.0.1:${server.address().port}/test/pages/clickfix-demo.html`);
    await driver.findElement(By.id("copy-legitimate")).click();
    await driver.wait(until.elementTextContains(
      driver.findElement(By.id("status")),
      "Comando legítimo copiado"
    ), 7000);
    await driver.sleep(1000);
    const state = await driver.executeScript(
      "return document.querySelector('[data-clip-guard-state]')?.getAttribute('data-clip-guard-state')"
    );
    if (state === "alert") throw new Error("Alerta indevido para npm install lodash");
  });
} catch (error) {
  failure = String(error?.stack || error);
} finally {
  await driver?.quit().catch(() => {});
  geckodriver?.kill();
  await new Promise((resolve) => server.close(resolve));
}

const passed = outcomes.filter((outcome) => outcome.passed).length;
const lines = [
  "# Firefox E2E",
  "",
  `Firefox: ${firefoxVersion}.`,
  `Resultado: ${passed}/${outcomes.length} cenários passaram.`,
  "",
  ...outcomes.map((outcome) =>
    `- ${outcome.passed ? "PASSOU" : "FALHOU"}: ${outcome.name}${outcome.error ? ` — ${outcome.error}` : ""}`
  ),
  ...(failure ? ["", "## Falha ao iniciar ou executar", "", `\`\`\`\n${failure}\n\`\`\``] : []),
  ""
];
await writeFile(path.join(root, "reports", "firefox-e2e.md"), lines.join("\n"));
console.log(lines.join("\n"));
if (failure || passed !== outcomes.length) process.exitCode = 1;
