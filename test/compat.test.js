import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "src", "compat.js"), "utf8");
const bridgeSource = (await readFile(path.join(root, "src", "bridge.js"), "utf8"))
  .replace(/^import\s+\{\s*createUI\s*\}\s+from\s+["'][^"']+["'];\s*/m, "");

test("compatibility layer selects the Firefox browser namespace", () => {
  const browser = {};
  const context = vm.createContext({ browser, chrome: {} });
  vm.runInContext(source, context);
  assert.equal(context.clipGuardApi, browser);
});

test("compatibility layer selects the Chromium chrome namespace", () => {
  const chrome = {};
  const context = vm.createContext({ chrome });
  vm.runInContext(source, context);
  assert.equal(context.clipGuardApi, chrome);
});

test("compatibility layer fails explicitly when no WebExtension API exists", () => {
  assert.throws(() => vm.runInNewContext(source), /WebExtension API indisponível/);
});

function createHealthContext(api) {
  const context = vm.createContext({ chrome: api });
  vm.runInContext(source, context);
  return context.clipGuardContextHealth;
}

test("context health stops API calls when runtime.id becomes unavailable", async () => {
  const api = { runtime: { id: "extension-id" } };
  const health = createHealthContext(api);
  let calls = 0;

  await health.call(() => ++calls);
  api.runtime.id = undefined;
  assert.equal(await health.call(() => ++calls), undefined);
  api.runtime.id = "extension-id";
  assert.equal(await health.call(() => ++calls), undefined);

  assert.equal(calls, 1);
  assert.equal(health.isInvalidated(), true);
});

test("context health handles synchronous and rejected invalidation errors once", async () => {
  const health = createHealthContext({ runtime: { id: "extension-id" } });
  let calls = 0;
  const invalidation = new Error("Extension context invalidated.");

  assert.equal(await health.call(() => {
    calls += 1;
    throw invalidation;
  }, "fallback"), "fallback");
  assert.equal(await health.call(() => {
    calls += 1;
    return Promise.reject(new Error("context invalidated"));
  }, "fallback"), "fallback");

  assert.equal(calls, 1);
  assert.equal(health.isInvalidated(), true);
});

test("context health prevents registered listeners from running after invalidation", () => {
  const api = { runtime: { id: "extension-id" } };
  const health = createHealthContext(api);
  let callback;
  let calls = 0;
  health.listen(() => ({
    addListener(listener) {
      callback = listener;
    }
  }), () => {
    calls += 1;
  });

  callback();
  api.runtime.id = undefined;
  callback();
  callback();

  assert.equal(calls, 1);
  assert.equal(health.isInvalidated(), true);
});

test("bridge stops storage, messaging, listeners, and error logs after invalidation", async () => {
  const handlers = {};
  let changedListener;
  let storageCalls = 0;
  let messageCalls = 0;
  let toastCalls = 0;
  let errorLogs = 0;
  const api = {
    runtime: {
      id: "extension-id",
      sendMessage() {
        messageCalls += 1;
        return Promise.resolve();
      }
    },
    storage: {
      local: {
        get() {
          storageCalls += 1;
          throw new Error("Extension context invalidated.");
        },
        set() {
          throw new Error("storage.set should not be called");
        }
      },
      onChanged: {
        addListener(listener) {
          changedListener = listener;
        }
      }
    }
  };
  const window = {
    addEventListener(type, listener) {
      handlers[type] = listener;
    },
    postMessage() {},
    frames: []
  };
  window.top = window;
  window.parent = window;
  const context = vm.createContext({
    chrome: api,
    window,
    location: { origin: "https://example.test" },
    createUI: () => ({
      showToast() {
        toastCalls += 1;
      },
      showDetails() {},
      showBlockDialog() {},
      showPasteBlockDialog() {},
      completeBlock() {},
      showFreeConfirmation() {},
      showWarning() {}
    }),
    console: { error() { errorLogs += 1; } }
  });
  vm.runInContext(source, context);
  vm.runInContext(bridgeSource, context);

  handlers.message({
    data: {
      __clip_guard__: true,
      channel: "channel-1",
      type: "ALERT",
      alert: {
        origin: "https://example.test",
        level: "high",
        reasons: [],
        time: Date.now()
      }
    },
    source: window,
    origin: "https://example.test"
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  changedListener({ protectionMode: { newValue: "warn" } }, "local");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(storageCalls, 1);
  assert.equal(messageCalls, 0);
  assert.equal(toastCalls, 1);
  assert.equal(errorLogs, 0);
  assert.equal(context.clipGuardContextHealth.isInvalidated(), true);
});
