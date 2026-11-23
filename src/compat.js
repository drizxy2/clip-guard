(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  if (!api) throw new Error("Clip Guard: WebExtension API indisponível.");
  Object.defineProperty(globalThis, "clipGuardApi", { value: api });
})();
