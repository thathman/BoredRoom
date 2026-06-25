import type { GameRuntime } from '../../shared/src/contracts/gameRuntime.js';

const MODEL = process.env.AI_MODEL?.trim() || 'google/gemini-2.5-flash-lite';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface AiHealth {
  enabled: boolean;
  model: string;
  status: 'active' | 'offline' | 'degraded';
  lastLatencyMs: number | null;
  lastError: string | null;
  rateLimitRemaining: number | null;
  creditStatus: 'available' | 'exhausted' | 'unknown';
  fallbackActive: boolean;
}

let health: AiHealth = {
  enabled: Boolean(process.env.OPENROUTER_API_KEY),
  model: MODEL,
  status: process.env.OPENROUTER_API_KEY ? 'active' : 'offline',
  lastLatencyMs: null,
  lastError: process.env.OPENROUTER_API_KEY ? null : 'AI provider credential is not configured',
  rateLimitRemaining: null,
  creditStatus: 'unknown',
  fallbackActive: !process.env.OPENROUTER_API_KEY,
};

const banned = /\b(fuck(?:ing|ed|er|s)?|shit(?:ty|s)?|bitch(?:es)?|asshole(?:s)?|cunt(?:s)?|nigger(?:s)?|faggot(?:s)?|retard(?:ed|s)?)\b/i;

function sanitize(value: unknown, maxLength = 240): string {
  return String(value ?? '')
    .replace(new RegExp(banned.source, 'gi'), '***')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function getAiHealth(): AiHealth {
  return { ...health, enabled: Boolean(process.env.OPENROUTER_API_KEY), model: MODEL };
}

async function complete(system: string, user: string, maxTokens = 180): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    health = {
      ...health,
      enabled: false,
      status: 'offline',
      lastError: 'AI provider credential is not configured',
      fallbackActive: true,
    };
    return null;
  }
  const started = Date.now();
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'HTTP-Referer': process.env.AI_APP_URL ?? 'https://party.hendrix.com.ng',
        'X-Title': process.env.AI_APP_NAME ?? 'BoredRoom',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.55,
      }),
    });
    const latency = Date.now() - started;
    if (!response.ok) {
      health = {
        enabled: true,
        model: MODEL,
        status: response.status === 402 || response.status === 429 ? 'degraded' : 'offline',
        lastLatencyMs: latency,
        lastError: `openrouter_${response.status}`,
        rateLimitRemaining: Number(response.headers.get('x-ratelimit-remaining')) || null,
        creditStatus: response.status === 402 ? 'exhausted' : health.creditStatus,
        fallbackActive: true,
      };
      return null;
    }
    const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const text = sanitize(body.choices?.[0]?.message?.content);
    health = {
      enabled: true,
      model: MODEL,
      status: 'active',
      lastLatencyMs: latency,
      lastError: null,
      rateLimitRemaining: Number(response.headers.get('x-ratelimit-remaining')) || null,
      creditStatus: 'available',
      fallbackActive: false,
    };
    return text || null;
  } catch (error) {
    health = {
      enabled: true,
      model: MODEL,
      status: 'offline',
      lastLatencyMs: Date.now() - started,
      lastError: error instanceof Error ? error.message : 'ai_request_failed',
      rateLimitRemaining: health.rateLimitRemaining,
      creditStatus: health.creditStatus,
      fallbackActive: true,
    };
    return null;
  }
}

export async function generateCommentary(input: {
  gameName: string;
  publicState: unknown;
}): Promise<string | null> {
  return complete(
    'You are the family-friendly BoredRoom game-night MC. Write one energetic line under 110 characters. Use light Nigerian flavour without caricature. Never reveal hidden state or give strategy.',
    `Game: ${input.gameName}\nPublic state only: ${JSON.stringify(input.publicState).slice(0, 5000)}`,
    80,
  );
}

export async function generatePacingSuggestion(input: {
  gameName: string;
  publicState: unknown;
}): Promise<string | null> {
  return complete(
    'You are the BoredRoom host assistant. Suggest one optional pacing action in under 100 characters. Use only public state. Never issue the action yourself.',
    `Game: ${input.gameName}\nPublic state only: ${JSON.stringify(input.publicState).slice(0, 5000)}`,
    80,
  );
}

export async function generatePrivateHint(input: {
  gameName: string;
  rules: string;
  publicState: unknown;
  privateState: unknown;
  legalIntents: Array<Record<string, unknown>>;
}): Promise<string | null> {
  if (input.legalIntents.length === 0) return null;
  const fallback = `Try ${JSON.stringify(input.legalIntents[0])}. It is a legal move for the current state.`;
  const response = await complete(
    'You are a private game coach. Use only the supplied public state, this player private state, rules and server-generated legal intents. Recommend exactly one legal intent in one short sentence. Never invent a move.',
    `Game: ${input.gameName}\nRules: ${input.rules}\nPublic: ${JSON.stringify(input.publicState).slice(0, 3500)}\nPrivate: ${JSON.stringify(input.privateState).slice(0, 2500)}\nLegal intents: ${JSON.stringify(input.legalIntents)}`,
    120,
  );
  return response ?? fallback;
}

export async function explainRejectedIntent(input: {
  gameName: string;
  rules: string;
  intent: Record<string, unknown>;
  runtime: GameRuntime;
}): Promise<string> {
  const deterministic = input.runtime.explainIntent?.(input.intent)
    ?? `That action is not legal in the current ${input.gameName} state.`;
  return await complete(
    'Explain why a game action was rejected using only the supplied rule summary and deterministic explanation. One sentence. Do not invent rules.',
    `Rules: ${input.rules}\nIntent: ${JSON.stringify(input.intent)}\nDeterministic explanation: ${deterministic}`,
    100,
  ) ?? deterministic;
}

export async function generateRecap(input: {
  gameName: string;
  winnerNames: string[];
  signals: Record<string, unknown>;
}): Promise<{ headline: string; paragraph: string }> {
  const fallback = {
    headline: `${input.gameName} complete`,
    paragraph: input.winnerNames.length
      ? `${input.winnerNames.join(', ')} finished on top. Everyone stays connected for the next game.`
      : 'The run is complete. Everyone stays connected for the next game.',
  };
  const response = await complete(
    'Return two plain-text lines: a short game-night recap headline, then one short paragraph. Family-friendly, no strategy, no hidden information.',
    `Game: ${input.gameName}\nWinners: ${input.winnerNames.join(', ') || 'none'}\nPublic recap signals: ${JSON.stringify(input.signals).slice(0, 3500)}`,
    180,
  );
  if (!response) return fallback;
  const [headline, ...rest] = response.split('\n').map((line) => line.trim()).filter(Boolean);
  return { headline: sanitize(headline, 80) || fallback.headline, paragraph: sanitize(rest.join(' '), 320) || fallback.paragraph };
}

export async function generateSessionStory(input: {
  playerNames: string[];
  completedGames: Array<{ gameName: string; status: string; winners: string[] }>;
}): Promise<{ headline: string; paragraph: string }> {
  const fallback = {
    headline: 'One room, one game night',
    paragraph: `${input.playerNames.length} players shared ${input.completedGames.length} completed game${input.completedGames.length === 1 ? '' : 's'}.`,
  };
  const response = await complete(
    'Return two plain-text lines: a short family-friendly session-story headline, then one paragraph. Use only supplied public history.',
    `Players: ${input.playerNames.join(', ')}\nGames: ${JSON.stringify(input.completedGames).slice(0, 5000)}`,
    180,
  );
  if (!response) return fallback;
  const [headline, ...rest] = response.split('\n').map((line) => line.trim()).filter(Boolean);
  return {
    headline: sanitize(headline, 80) || fallback.headline,
    paragraph: sanitize(rest.join(' '), 360) || fallback.paragraph,
  };
}

export async function recommendGames(input: {
  installedGames: Array<{ id: string; name: string; minPlayers: number; maxPlayers: number }>;
  playerCount: number;
  recentGameIds: string[];
}): Promise<Array<{ gameId: string; reason: string }>> {
  const eligible = input.installedGames
    .filter((game) => input.playerCount >= game.minPlayers && input.playerCount <= game.maxPlayers)
    .sort((a, b) => Number(input.recentGameIds.includes(a.id)) - Number(input.recentGameIds.includes(b.id)))
    .slice(0, 3);
  const fallback = eligible.map((game) => ({ gameId: game.id, reason: `Fits ${input.playerCount} players and is ready on this server.` }));
  if (eligible.length === 0) return [];
  const response = await complete(
    'Recommend up to three games from the supplied eligible list. Return one line per game as gameId | short reason. Never name a game outside the list.',
    `Players: ${input.playerCount}\nRecent games: ${input.recentGameIds.join(', ')}\nEligible: ${JSON.stringify(eligible)}`,
    180,
  );
  if (!response) return fallback;
  const allowed = new Set(eligible.map((game) => game.id));
  const parsed = response.split('\n').flatMap((line) => {
    const [gameId, reason] = line.split('|').map((part) => part.trim());
    return allowed.has(gameId) && reason ? [{ gameId, reason: sanitize(reason, 160) }] : [];
  }).slice(0, 3);
  return parsed.length ? parsed : fallback;
}

export async function moderateOwnerContent(text: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!text.trim()) return { allowed: false, reason: 'empty_content' };
  if (banned.test(text)) return { allowed: false, reason: 'blocked_language' };
  const response = await complete(
    'Classify owner-supplied party-game content. Reply ALLOW or BLOCK followed by a short reason. Block slurs, targeted abuse, sexual content involving minors, or instructions for violence.',
    sanitize(text, 4000),
    80,
  );
  if (!response) return { allowed: true };
  return response.toUpperCase().startsWith('BLOCK')
    ? { allowed: false, reason: sanitize(response, 180) }
    : { allowed: true };
}
