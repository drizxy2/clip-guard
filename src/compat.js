(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  if (!api) throw new Error("Clip Guard: WebExtension API indisponível.");

  let invalidated = false;
  let runtimeId;

  function isInvalidationError(error) {
    const message = String(error?.message ?? error).toLowerCase();
    return message.includes("extension context invalidated") ||
      message.includes("context invalidated");
  }

  function invalidate() {
    invalidated = true;
  }

  function isHealthy() {
    if (invalidated) return false;
    try {
      const currentId = api.runtime?.id;
      if (typeof currentId !== "string" || currentId.length === 0 ||
          (runtimeId !== undefined && currentId !== runtimeId)) {
        invalidate();
        return false;
      }
      if (runtimeId === undefined) runtimeId = currentId;
      return true;
    } catch {
      invalidate();
      return false;
    }
  }

  function call(operation, fallback) {
    if (!isHealthy()) return Promise.resolve(fallback);
    let result;
    try {
      result = operation();
    } catch (error) {
      if (isInvalidationError(error)) {
        invalidate();
        return Promise.resolve(fallback);
      }
      return Promise.reject(error);
    }
    return Promise.resolve(result).catch((error) => {
      if (isInvalidationError(error)) {
        invalidate();
        return fallback;
      }
      throw error;
    });
  }

  function listen(eventProvider, listener) {
    if (!isHealthy()) return false;
    try {
      const event = eventProvider();
      if (!event || typeof event.addListener !== "function") return false;
      event.addListener((...args) => {
        if (isHealthy()) listener(...args);
      });
      return true;
    } catch (error) {
      if (isInvalidationError(error)) {
        invalidate();
        return false;
      }
      throw error;
    }
  }

  Object.defineProperty(globalThis, "clipGuardApi", { value: api });
  Object.defineProperty(globalThis, "clipGuardContextHealth", {
    value: Object.freeze({
      call,
      isHealthy,
      isInvalidated: () => invalidated,
      listen
    })
  });
})();
