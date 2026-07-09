export function safeId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    // Basic UUID v4 implementation using getRandomValues
    return ("10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        Number(c) ^
        (globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
      ).toString(16)
    ));
  }
  // Fallback if no crypto available (e.g. over HTTP in some browsers)
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
