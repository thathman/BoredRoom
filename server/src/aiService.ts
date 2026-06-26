import type { GameRuntime } from '../../shared/src/contracts/gameRuntime.js';

const MODEL = process.env.AI_MODEL?.trim() || 'google/gemini-2.5-flash-lite';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 6000);

type JsonSchema = {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  enum?: string[];
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
};

type StructuredSchema<T> = {
  name: string;
  schema: JsonSchema;
  validate: (value: unknown) => T | null;
};

type StructuredLine = {
  text: string;
};

type StructuredHint = {
  text: string;
  selectedIntentIndex: number;
};

type StructuredRecap = {
  headline: string;
  paragraph: string;
};

type StructuredRecommendations = {
  recommendations: Array<{ gameId: string; reason: string }>;
};

type StructuredModeration = {
  allowed: boolean;
  reason?: string;
};

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

function markUnavailable(error: string, started?: number, status: AiHealth['status'] = 'offline'): void {
  health = {
    ...health,
    enabled: Boolean(process.env.OPENROUTER_API_KEY),
    model: MODEL,
    status,
    lastLatencyMs: started ? Date.now() - started : health.lastLatencyMs,
    lastError: error,
    fallbackActive: true,
  };
}

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validateLine(value: unknown): StructuredLine | null {
  if (!isRecord(value) || typeof value.text !== 'string') return null;
  const text = sanitize(value.text, 140);
  return text ? { text } : null;
}

function validateHint(value: unknown, maxIndex: number): StructuredHint | null {
  if (!isRecord(value) || typeof value.text !== 'string' || typeof value.selectedIntentIndex !== 'number') return null;
  const selectedIntentIndex = Math.trunc(value.selectedIntentIndex);
  if (selectedIntentIndex < 0 || selectedIntentIndex > maxIndex) return null;
  const text = sanitize(value.text, 220);
  return text ? { text, selectedIntentIndex } : null;
}

function validateRecap(value: unknown): StructuredRecap | null {
  if (!isRecord(value) || typeof value.headline !== 'string' || typeof value.paragraph !== 'string') return null;
  const headline = sanitize(value.headline, 80);
  const paragraph = sanitize(value.paragraph, 360);
  return headline && paragraph ? { headline, paragraph } : null;
}

function validateModeration(value: unknown): StructuredModeration | null {
  if (!isRecord(value) || typeof value.allowed !== 'boolean') return null;
  const reason = typeof value.reason === 'string' ? sanitize(value.reason, 180) : undefined;
  return reason ? { allowed: value.allowed, reason } : { allowed: value.allowed };
}

const lineSchema: StructuredSchema<StructuredLine> = {
  name: 'boredroom_line',
  validate: validateLine,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: {
      text: { type: 'string', maxLength: 140 },
    },
  },
};

const recapSchema: StructuredSchema<StructuredRecap> = {
  name: 'boredroom_recap',
  validate: validateRecap,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'paragraph'],
    properties: {
      headline: { type: 'string', maxLength: 80 },
      paragraph: { type: 'string', maxLength: 360 },
    },
  },
};

const moderationSchema: StructuredSchema<StructuredModeration> = {
  name: 'boredroom_moderation',
  validate: validateModeration,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['allowed'],
    properties: {
      allowed: { type: 'boolean' },
      reason: { type: 'string', maxLength: 180 },
    },
  },
};

function hintSchema(maxIndex: number): StructuredSchema<StructuredHint> {
  return {
    name: 'boredroom_hint',
    validate: (value) => validateHint(value, maxIndex),
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['text', 'selectedIntentIndex'],
      properties: {
        text: { type: 'string', maxLength: 220 },
        selectedIntentIndex: { type: 'integer', description: `Zero-based index from 0 to ${maxIndex} into the supplied legalIntents array.` },
      },
    },
  };
}

function recommendationsSchema(allowedIds: Set<string>): StructuredSchema<StructuredRecommendations> {
  return {
    name: 'boredroom_game_recommendations',
    validate: (value) => {
      if (!isRecord(value) || !Array.isArray(value.recommendations)) return null;
      const recommendations = value.recommendations.flatMap((item) => {
        if (!isRecord(item) || typeof item.gameId !== 'string' || typeof item.reason !== 'string') return [];
        if (!allowedIds.has(item.gameId)) return [];
        const reason = sanitize(item.reason, 160);
        return reason ? [{ gameId: item.gameId, reason }] : [];
      }).slice(0, 3);
      return { recommendations };
    },
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['recommendations'],
      properties: {
        recommendations: {
          type: 'array',
          minItems: 0,
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['gameId', 'reason'],
            properties: {
              gameId: { type: 'string', enum: [...allowedIds] },
              reason: { type: 'string', maxLength: 160 },
            },
          },
        },
      },
    },
  };
}

async function completeStructured<T>(
  schema: StructuredSchema<T>,
  system: string,
  user: string,
  maxTokens = 180,
): Promise<T | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    markUnavailable('AI provider credential is not configured');
    return null;
  }
  const started = Date.now();
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'HTTP-Referer': process.env.AI_APP_URL ?? 'https://party.hendrix.com.ng',
        'X-Title': process.env.AI_APP_NAME ?? 'BoredRoom',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `${system}\nReturn only JSON that matches the provided schema. Do not include markdown or prose outside JSON.`,
          },
          { role: 'user', content: user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: schema.name,
            strict: true,
            schema: schema.schema,
          },
        },
        max_tokens: maxTokens,
        temperature: 0.25,
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
    const parsed = schema.validate(safeJsonParse(body.choices?.[0]?.message?.content));
    if (!parsed) {
      health = {
        enabled: true,
        model: MODEL,
        status: 'degraded',
        lastLatencyMs: latency,
        lastError: 'ai_schema_validation_failed',
        rateLimitRemaining: Number(response.headers.get('x-ratelimit-remaining')) || null,
        creditStatus: 'available',
        fallbackActive: true,
      };
      return null;
    }
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
    return parsed;
  } catch (error) {
    markUnavailable(error instanceof Error ? error.message : 'ai_request_failed', started);
    return null;
  }
}

export async function generateCommentary(input: {
  gameName: string;
  publicState: unknown;
}): Promise<string | null> {
  const response = await completeStructured(
    lineSchema,
    'You are the family-friendly BoredRoom game-night MC. Write one energetic line under 110 characters. Use light Nigerian flavour without caricature. Never reveal hidden state or give strategy.',
    `Game: ${input.gameName}\nPublic state only: ${JSON.stringify(input.publicState).slice(0, 5000)}`,
    80,
  );
  return response?.text ?? null;
}

export async function generatePacingSuggestion(input: {
  gameName: string;
  publicState: unknown;
}): Promise<string | null> {
  const response = await completeStructured(
    lineSchema,
    'You are the BoredRoom host assistant. Suggest one optional pacing action in under 100 characters. Use only public state. Never issue the action yourself.',
    `Game: ${input.gameName}\nPublic state only: ${JSON.stringify(input.publicState).slice(0, 5000)}`,
    80,
  );
  return response?.text ?? null;
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
  const response = await completeStructured(
    hintSchema(input.legalIntents.length - 1),
    'You are a private game coach. Use only the supplied public state, this player private state, rules and server-generated legal intents. Select exactly one legal intent by index. Never invent a move.',
    `Game: ${input.gameName}\nRules: ${input.rules}\nPublic: ${JSON.stringify(input.publicState).slice(0, 3500)}\nPrivate: ${JSON.stringify(input.privateState).slice(0, 2500)}\nLegal intents: ${JSON.stringify(input.legalIntents)}`,
    120,
  );
  if (!response) return fallback;
  const selected = input.legalIntents[response.selectedIntentIndex] ?? input.legalIntents[0];
  return `${response.text} Legal move: ${JSON.stringify(selected)}.`;
}

export async function explainRejectedIntent(input: {
  gameName: string;
  rules: string;
  intent: Record<string, unknown>;
  runtime: GameRuntime;
}): Promise<string> {
  const deterministic = input.runtime.explainIntent?.(input.intent)
    ?? `That action is not legal in the current ${input.gameName} state.`;
  const response = await completeStructured(
    lineSchema,
    'Explain why a game action was rejected using only the supplied rule summary and deterministic explanation. One sentence. Do not invent rules.',
    `Rules: ${input.rules}\nIntent: ${JSON.stringify(input.intent)}\nDeterministic explanation: ${deterministic}`,
    100,
  );
  return response?.text ?? deterministic;
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
  const response = await completeStructured(
    recapSchema,
    'Return a short game-night recap. Family-friendly, no strategy, no hidden information.',
    `Game: ${input.gameName}\nWinners: ${input.winnerNames.join(', ') || 'none'}\nPublic recap signals: ${JSON.stringify(input.signals).slice(0, 3500)}`,
    180,
  );
  return response ?? fallback;
}

export async function generateSessionStory(input: {
  playerNames: string[];
  completedGames: Array<{ gameName: string; status: string; winners: string[] }>;
}): Promise<{ headline: string; paragraph: string }> {
  const fallback = {
    headline: 'One room, one game night',
    paragraph: `${input.playerNames.length} players shared ${input.completedGames.length} completed game${input.completedGames.length === 1 ? '' : 's'}.`,
  };
  const response = await completeStructured(
    recapSchema,
    'Return a short family-friendly session-story headline and paragraph. Use only supplied public history.',
    `Players: ${input.playerNames.join(', ')}\nGames: ${JSON.stringify(input.completedGames).slice(0, 5000)}`,
    180,
  );
  return response ?? fallback;
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
  const allowed = new Set(eligible.map((game) => game.id));
  const response = await completeStructured(
    recommendationsSchema(allowed),
    'Recommend up to three games from the supplied eligible list. Never name a game outside the list.',
    `Players: ${input.playerCount}\nRecent games: ${input.recentGameIds.join(', ')}\nEligible: ${JSON.stringify(eligible)}`,
    180,
  );
  return response?.recommendations.length ? response.recommendations : fallback;
}

export async function moderateOwnerContent(text: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!text.trim()) return { allowed: false, reason: 'empty_content' };
  if (banned.test(text)) return { allowed: false, reason: 'blocked_language' };
  const response = await completeStructured(
    moderationSchema,
    'Classify owner-supplied party-game content. Block slurs, targeted abuse, sexual content involving minors, or instructions for violence.',
    sanitize(text, 4000),
    80,
  );
  return response ?? { allowed: true };
}
