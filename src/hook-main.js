import { classify } from "./classifier.js";

(() => {
  "use strict";

  const PREFIX = "__clip_guard__";
  const STATE_KEY = "__clip_guard_hook_state__";
  const WRAPPED_KEY = "__clip_guard_wrapped__";

  function randomToken(win) {
    try {
      const bytes = new win.Uint8Array(16);
      win.crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      return `${Date.now()}-${Math.random()}`;
    }
  }

  function sha256(text, win) {
    const bytes = new win.TextEncoder().encode(text);
    const bitLength = bytes.length * 8;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const data = new win.Uint8Array(paddedLength);
    data.set(bytes);
    data[bytes.length] = 0x80;
    const view = new win.DataView(data.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(paddedLength - 4, bitLength >>> 0);

    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const words = new win.Uint32Array(64);
    const rotate = (value, bits) => (value >>> bits) | (value << (32 - bits));

    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4);
      for (let index = 16; index < 64; index++) {
        const x = words[index - 15];
        const y = words[index - 2];
        const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3);
        const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = state;
      for (let index = 0; index < 64; index++) {
        const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + sum1 + choose + constants[index] + words[index]) >>> 0;
        const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      state[0] = (state[0] + a) >>> 0;
      state[1] = (state[1] + b) >>> 0;
      state[2] = (state[2] + c) >>> 0;
      state[3] = (state[3] + d) >>> 0;
      state[4] = (state[4] + e) >>> 0;
      state[5] = (state[5] + f) >>> 0;
      state[6] = (state[6] + g) >>> 0;
      state[7] = (state[7] + h) >>> 0;
    }
    return state.map((word) => word.toString(16).padStart(8, "0")).join("");
  }

  function installHooks(win) {
    const existing = win[STATE_KEY];
    if (existing) {
      existing.install();
      return;
    }

    const state = {
      channel: randomToken(win),
      lastGestureAt: -Infinity,
      copyEventActive: false,
      lastWrite: null,
      pendingPaste: null,
      listenersInstalled: false,
      frameDiscoveryInstalled: false,
      frameObserver: null,
      observedFrames: new WeakSet(),
      install: null
    };
    Object.defineProperty(win, STATE_KEY, {
      value: state,
      configurable: false
    });
    const targetOrigin = win.location.origin === "null" ? "*" : win.location.origin;

    function post(type, data = {}) {
      const message = { [PREFIX]: true, channel: state.channel, type, ...data };
      try {
        win.postMessage(message, targetOrigin);
      } catch {}
      try {
        const origin = win.location.origin;
        if (win === win.top) return;
        const parentOrigin = origin === "null" ? "*" : win.parent.location.origin;
        if (origin === "null" || origin === parentOrigin) win.parent.postMessage(message, parentOrigin);
      } catch {}
    }

    function contextForWrite() {
      let crossOriginIframe = false;
      try {
        crossOriginIframe = win !== win.top && win.location.origin !== win.top.location.origin;
      } catch {
        crossOriginIframe = true;
      }
      return {
        fullscreen: Boolean(win.document.fullscreenElement),
        crossOriginIframe,
        msSinceClick: Number.isFinite(state.lastGestureAt)
          ? Date.now() - state.lastGestureAt
          : Infinity
      };
    }

    function recordWrite(text) {
      try {
        if (typeof text !== "string") return;
        const context = contextForWrite();
        const result = classify(text, context);
        if (result.level === "none") return;
        const now = Date.now();
        const risk = context.fullscreen || context.crossOriginIframe;
        state.lastWrite = {
          hash: sha256(text, win),
          origin: win.location.origin,
          level: result.level,
          reasons: result.reasons,
          time: now,
          risk
        };
        post("ALERT", { alert: state.lastWrite });
      } catch {}
    }

    function wrap(owner, key, inspect, after = false) {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(owner, key);
        const original = owner[key];
        if (typeof original !== "function" || !descriptor?.configurable || original[WRAPPED_KEY]) return;
        function wrapped(...args) {
          if (!after) {
            try {
              inspect(this, args);
            } catch {}
          }
          const result = Reflect.apply(original, this, args);
          if (after) {
            try {
              inspect(this, args);
            } catch {}
          }
          return result;
        }
        try {
          Object.defineProperty(wrapped, WRAPPED_KEY, { value: true });
          Object.defineProperty(wrapped, "toString", {
            value: () => Reflect.apply(Function.prototype.toString, original, []),
            configurable: true
          });
        } catch {}
        Object.defineProperty(owner, key, { ...descriptor, value: wrapped });
      } catch {}
    }

    function rememberGesture() {
      state.lastGestureAt = Date.now();
    }

    function installMethodHooks() {
      let clipboardPrototype = null;
      try {
        clipboardPrototype = Object.getPrototypeOf(win.navigator.clipboard);
      } catch {}
      wrap(clipboardPrototype, "writeText", (_clipboard, args) => recordWrite(args[0]));
      wrap(clipboardPrototype, "write", (_clipboard, args) => {
        try {
          for (const item of args[0] || []) {
            if (!item.types?.includes("text/plain")) continue;
            item.getType("text/plain")
              .then((blob) => blob.text())
              .then(recordWrite)
              .catch(() => {});
          }
        } catch {}
      });
      wrap(win.Document.prototype, "execCommand", (_document, args) => {
        try {
          if (String(args[0]).toLowerCase() !== "copy") return;
          const active = win.document.activeElement;
          if ((active instanceof win.HTMLInputElement || active instanceof win.HTMLTextAreaElement) &&
              Number.isInteger(active.selectionStart) && Number.isInteger(active.selectionEnd)) {
            recordWrite(active.value.slice(active.selectionStart, active.selectionEnd));
          } else {
            recordWrite(String(win.getSelection() || ""));
          }
        } catch {}
      });
      if (win.DataTransfer?.prototype) {
        wrap(win.DataTransfer.prototype, "setData", (_transfer, args) => {
          try {
            if (state.copyEventActive && String(args[0]).toLowerCase() === "text/plain") recordWrite(args[1]);
          } catch {}
        });
      }
      for (const method of ["open", "write", "writeln", "close"]) {
        wrap(win.Document.prototype, method, () => state.install(), true);
      }
    }

    function installFrame(frame) {
      try {
        if (state.observedFrames.has(frame)) return;
        state.observedFrames.add(frame);
        frame.addEventListener("load", () => {
          try {
            const child = frame.contentWindow;
            if (frame.contentDocument === child.document) installHooks(child);
          } catch {}
        });
        const child = frame.contentWindow;
        if (frame.contentDocument === child.document) installHooks(child);
      } catch {}
    }

    function scanFrames(node) {
      if (!node || typeof node.querySelectorAll !== "function") return;
      if (node.localName === "iframe") installFrame(node);
      for (const frame of node.querySelectorAll("iframe")) installFrame(frame);
    }

    function installFrameDiscovery() {
      try {
        if (win !== win.top) return;
      } catch {
        return;
      }
      if (!state.frameDiscoveryInstalled) {
        state.frameDiscoveryInstalled = true;
        wrap(win.Node.prototype, "appendChild", (_node, args) => scanFrames(args[0]));
        wrap(win.Node.prototype, "insertBefore", (_node, args) => scanFrames(args[0]));
      }
      state.frameObserver?.disconnect();
      state.frameObserver = new win.MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) scanFrames(node);
        }
      });
      state.frameObserver.observe(win.document, { childList: true, subtree: true });
      scanFrames(win.document);
    }

    function reinsertText(text, target, selection) {
      try {
        if (target instanceof win.HTMLInputElement || target instanceof win.HTMLTextAreaElement) {
          if (target.disabled || target.readOnly) return;
          target.focus();
          target.setRangeText(text, selection.start, selection.end, "end");
          target.dispatchEvent(new win.InputEvent("input", {
            bubbles: true,
            inputType: "insertFromPaste",
            data: text
          }));
          return;
        }
        if (target?.isContentEditable || target?.closest?.("[contenteditable='true']")) {
          target.focus?.();
          if (selection.range) {
            const range = selection.range;
            range.deleteContents();
            const inserted = win.document.createTextNode(text);
            range.insertNode(inserted);
            range.setStartAfter(inserted);
            range.collapse(true);
            const current = win.getSelection();
            current.removeAllRanges();
            current.addRange(range);
            target.dispatchEvent(new win.InputEvent("input", {
              bubbles: true,
              inputType: "insertFromPaste",
              data: text
            }));
            return;
          }
          win.document.execCommand("insertText", false, text);
          return;
        }
        win.document.execCommand("insertText", false, text);
      } catch {}
    }

    function onPaste(event) {
      try {
        if (!state.lastWrite || Date.now() - state.lastWrite.time > 120000) return;
        if (state.lastWrite.level !== "high" &&
            !(state.lastWrite.level === "low" && state.lastWrite.risk)) return;
        const text = event.clipboardData?.getData("text/plain");
        if (typeof text !== "string" || sha256(text, win) !== state.lastWrite.hash) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = event.target;
        const selection = {
          start: Number.isInteger(target?.selectionStart) ? target.selectionStart : 0,
          end: Number.isInteger(target?.selectionEnd) ? target.selectionEnd : 0,
          range: null
        };
        if (target?.isContentEditable || target?.closest?.("[contenteditable='true']")) {
          const selected = win.getSelection();
          if (selected?.rangeCount) selection.range = selected.getRangeAt(0).cloneRange();
        }
        const id = randomToken(win);
        state.pendingPaste = { id, text, target, selection };
        post("PASTE_REQUEST", {
          id,
          alert: {
            hash: state.lastWrite.hash,
            origin: state.lastWrite.origin,
            level: state.lastWrite.level,
            reasons: state.lastWrite.reasons,
            preview: text.slice(0, 80),
            time: state.lastWrite.time
          }
        });
        win.setTimeout(() => {
          if (state.pendingPaste?.id === id) state.pendingPaste = null;
        }, 30000);
      } catch {}
    }

    function onMessage(event) {
      try {
        const message = event.data;
        if (event.source !== win || !message || typeof message !== "object") return;
        if (message[PREFIX] !== true) {
          if (message.type === "CG_INIT") post("HELLO");
          return;
        }
        if (message.channel !== state.channel || message.type !== "PASTE_RESPONSE") return;
        if (!state.pendingPaste || state.pendingPaste.id !== message.id) return;
        const pending = state.pendingPaste;
        state.pendingPaste = null;
        if (message.action === "paste") reinsertText(pending.text, pending.target, pending.selection);
      } catch {}
    }

    state.install = () => {
      installMethodHooks();
      installFrameDiscovery();
      for (const name of ["click", "pointerdown", "keydown"]) {
        win.removeEventListener(name, rememberGesture, true);
        win.addEventListener(name, rememberGesture, true);
      }
      win.document.removeEventListener("copy", onCopy, true);
      win.document.addEventListener("copy", onCopy, true);
      win.removeEventListener("paste", onPaste, true);
      win.addEventListener("paste", onPaste, true);
      win.removeEventListener("message", onMessage);
      win.addEventListener("message", onMessage);
      post("HELLO");
      state.listenersInstalled = true;
    };

    function onCopy() {
      state.copyEventActive = true;
      win.queueMicrotask(() => { state.copyEventActive = false; });
    }

    state.install();
  }

  installHooks(window);
})();
