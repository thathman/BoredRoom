// ============================================================
// BoredRoom — Game Adapter Registry
// Replaces giant switch statements with adapter pattern.
// Source of truth: BoredRoom-Spec/07-technical-architecture/01-game-adapter-contract.md
// ============================================================

import type { GameAdapter } from "./gameAdapter";

const registry = new Map<string, GameAdapter>();

/**
 * Register a game adapter. Call once at app boot, typically
 * from each pack's index file.
 */
export function registerAdapter(adapter: GameAdapter): void {
  if (registry.has(adapter.gameType)) {
    console.warn(
      `[AdapterRegistry] Overwriting adapter for gameType: ${adapter.gameType}`
    );
  }
  registry.set(adapter.gameType, adapter);
}

/**
 * Retrieve a registered adapter by game type.
 * Throws if the adapter is not found — callers must register before use.
 */
export function getAdapter(gameType: string): GameAdapter {
  const adapter = registry.get(gameType);
  if (!adapter) {
    throw new Error(
      `[AdapterRegistry] No adapter registered for gameType: "${gameType}". ` +
        `Did you forget to call registerAdapter()?`
    );
  }
  return adapter;
}

/** List all registered game types. */
export function listAdapters(): string[] {
  return Array.from(registry.keys());
}

/** Check if an adapter is registered. */
export function hasAdapter(gameType: string): boolean {
  return registry.has(gameType);
}
