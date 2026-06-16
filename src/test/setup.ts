import "@testing-library/jest-dom";

// jsdom serves pages from an opaque origin, so it does not expose Web Storage.
// Provide a minimal in-memory localStorage/sessionStorage so code (and tests)
// that touch storage work deterministically.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  setItem(key: string, value: string) { this.store.set(String(key), String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (typeof globalThis[name] === "undefined" || globalThis[name] === null) {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, name, { value: storage, writable: true, configurable: true });
    if (typeof window !== "undefined") {
      Object.defineProperty(window, name, { value: storage, writable: true, configurable: true });
    }
  }
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
