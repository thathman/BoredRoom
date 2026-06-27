// Per-session anti-repeat memory for AI-generated content. Keeps a rolling window of recently
// used prompts/items per (session, game) so AI generation can avoid repeats across a whole night
// — and across consecutive plays of the same game. In-memory only; cleared when the session ends.

const MAX_REMEMBERED = 120;
const store = new Map<string, string[]>();

function key(sessionId: string, gameId: string): string {
  return `${sessionId}:${gameId}`;
}

function norm(prompt: string): string {
  return prompt.toLowerCase().trim();
}

export function recentPromptsFor(sessionId: string, gameId: string): string[] {
  return store.get(key(sessionId, gameId)) ?? [];
}

export function rememberPrompts(sessionId: string, gameId: string, prompts: string[]): void {
  const k = key(sessionId, gameId);
  const existing = store.get(k) ?? [];
  const seen = new Set(existing.map(norm));
  for (const p of prompts) {
    const n = norm(p);
    if (n && !seen.has(n)) { existing.push(p); seen.add(n); }
  }
  // Keep only the most recent window.
  store.set(k, existing.slice(-MAX_REMEMBERED));
}

export function clearContentMemory(sessionId: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(`${sessionId}:`)) store.delete(k);
  }
}
