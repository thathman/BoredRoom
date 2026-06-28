import type { GameRuntime } from '../../shared/src/contracts/gameRuntime.js';

const MODEL = process.env.DEEPSEEK_MODEL?.trim() || process.env.AI_MODEL?.trim() || 'deepseek-v4-flash';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 6000);

// DeepSeek's OpenAI-compatible API. Read at call-time so deployments/tests can override safely.
function aiBaseUrl(): string {
  return (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '');
}
function aiApiKey(): string {
  return process.env.DEEPSEEK_API_KEY?.trim() || '';
}
function aiCompletionsUrl(): string {
  return `${aiBaseUrl()}/chat/completions`;
}

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
  minimum?: number;
  maximum?: number;
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
  enabled: Boolean(aiApiKey()),
  model: MODEL,
  status: aiApiKey() ? 'active' : 'offline',
  lastLatencyMs: null,
  lastError: aiApiKey() ? null : 'AI provider credential is not configured',
  rateLimitRemaining: null,
  creditStatus: 'unknown',
  fallbackActive: !aiApiKey(),
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
  return { ...health, enabled: Boolean(aiApiKey()), model: MODEL };
}

function markUnavailable(error: string, started?: number, status: AiHealth['status'] = 'offline'): void {
  health = {
    ...health,
    enabled: Boolean(aiApiKey()),
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
  const apiKey = aiApiKey();
  if (!apiKey) {
    markUnavailable('AI provider credential is not configured');
    return null;
  }
  const started = Date.now();
  try {
    const response = await fetch(aiCompletionsUrl(), {
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
            content: `${system}\nReturn only valid JSON matching this schema: ${JSON.stringify(schema.schema)}. Do not include markdown or prose outside JSON.`,
          },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
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
        lastError: `ai_provider_${response.status}`,
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
  if (response?.text) return response.text;
  const state = isRecord(input.publicState) ? input.publicState : {};
  const action = sanitize(state.lastAction, 92);
  if (!action) return 'The table is set. Make your move!';
  const openers = ['Table don hot!', 'No dulling!', 'This one is getting serious!', 'Everybody watch this move!'];
  const seed = [...action].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `${openers[seed % openers.length]} ${action}`.slice(0, 140);
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
  const describeIntent = (intent: Record<string, unknown>): string => {
    if (typeof intent.label === 'string' && intent.label.trim()) return intent.label.trim();
    if (intent.type === 'draw') return 'Go to market and pick the required card(s).';
    if (intent.type === 'play_card') return 'Play one of the highlighted cards in your hand.';
    return 'Use the highlighted legal move on your controller.';
  };
  const fallback = describeIntent(input.legalIntents[0]);
  const response = await completeStructured(
    hintSchema(input.legalIntents.length - 1),
    'You are a private game coach. Use only the supplied public state, this player private state, rules and server-generated legal intents. Select exactly one legal intent by index. Never invent a move.',
    `Game: ${input.gameName}\nRules: ${input.rules}\nPublic: ${JSON.stringify(input.publicState).slice(0, 3500)}\nPrivate: ${JSON.stringify(input.privateState).slice(0, 2500)}\nLegal intents: ${JSON.stringify(input.legalIntents)}`,
    120,
  );
  if (!response) return fallback;
  const selected = input.legalIntents[response.selectedIntentIndex] ?? input.legalIntents[0];
  return `${response.text} ${describeIntent(selected)}`;
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

// Private rules explanation for the in-controller assistant. Returns a short, friendly
// how-to-play for this game; fails soft to the game's static rule summary so it always works.
export async function generateRulesExplanation(input: {
  gameName: string;
  rules: string;
}): Promise<string> {
  const fallback = input.rules || `Have fun playing ${input.gameName}! Follow the prompts on your screen.`;
  const response = await completeStructured(
    recapSchema,
    'You are a friendly Nigerian game-night assistant. Explain how to play a game in 2-3 short, fun sentences for a first-time player. Use only the supplied rule summary; do not invent rules.',
    `Game: ${input.gameName}\nRules summary: ${input.rules}`,
    180,
  );
  return response ? `${response.headline}. ${response.paragraph}` : fallback;
}

// AI trivia-question content generation. Returns validated multiple-choice questions for a game
// (with the correct answer index) or [] on any failure — gameplay then uses the local bank.
// The caller passes `avoid` (recent prompts) so AI content does not repeat across a session.
interface AiTriviaQuestion { prompt: string; options: string[]; answer: number; explanation?: string }

function validateTriviaBatch(value: unknown): { questions: AiTriviaQuestion[] } | null {
  if (!isRecord(value) || !Array.isArray(value.questions)) return null;
  const questions: AiTriviaQuestion[] = [];
  for (const q of value.questions) {
    if (!isRecord(q)) continue;
    const prompt = typeof q.prompt === 'string' ? sanitize(q.prompt, 160) : '';
    const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string').map((o) => sanitize(o, 60)) : [];
    const answer = Number(q.answer);
    if (!prompt || options.length < 2 || options.length > 6) continue;
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
    const explanation = typeof q.explanation === 'string' ? sanitize(q.explanation, 160) : undefined;
    questions.push({ prompt, options, answer, ...(explanation ? { explanation } : {}) });
  }
  return questions.length ? { questions } : null;
}

const triviaBatchSchema: StructuredSchema<{ questions: AiTriviaQuestion[] }> = {
  name: 'boredroom_trivia_batch',
  validate: validateTriviaBatch,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        maxItems: 12,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['prompt', 'options', 'answer'],
          properties: {
            prompt: { type: 'string', maxLength: 160 },
            options: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string', maxLength: 60 } },
            answer: { type: 'integer', minimum: 0 },
            explanation: { type: 'string', maxLength: 160 },
          },
        },
      },
    },
  },
};

export async function generateTriviaQuestions(input: {
  topic: string;
  count: number;
  avoid?: string[];
}): Promise<AiTriviaQuestion[]> {
  const count = Math.min(12, Math.max(1, input.count));
  const avoid = (input.avoid ?? []).slice(0, 40).join('; ');
  const response = await completeStructured(
    triviaBatchSchema,
    'You generate fun, accurate multiple-choice trivia for a Nigerian party-game. Each question has 4 options and exactly one correct answer (by index). Keep it family-friendly. Never reuse a listed avoided question.',
    `Topic: ${input.topic}\nCount: ${count}\nAvoid these prompts: ${avoid || '(none)'}`,
    700,
  );
  // Drop any AI question that duplicates an avoided prompt (defence in depth).
  const avoidSet = new Set((input.avoid ?? []).map((p) => p.toLowerCase().trim()));
  return (response?.questions ?? []).filter((q) => !avoidSet.has(q.prompt.toLowerCase().trim())).slice(0, count);
}

// AI survey generation for Faith Feud (Family-Feud-style): a question and ranked answers with
// points. Validated and point-normalised; [] on failure so the local survey packs are used.
interface AiSurvey { question: string; answers: Array<{ text: string; points: number; aliases?: string[] }> }

function validateSurveyBatch(value: unknown): { surveys: AiSurvey[] } | null {
  if (!isRecord(value) || !Array.isArray(value.surveys)) return null;
  const surveys: AiSurvey[] = [];
  for (const s of value.surveys) {
    if (!isRecord(s)) continue;
    const question = typeof s.question === 'string' ? sanitize(s.question, 160) : '';
    const rawAnswers = Array.isArray(s.answers) ? s.answers : [];
    const answers = rawAnswers.flatMap((a) => {
      if (!isRecord(a)) return [];
      const text = typeof a.text === 'string' ? sanitize(a.text, 60) : '';
      const points = Number(a.points);
      if (!text || !Number.isFinite(points) || points <= 0) return [];
      const aliases = Array.isArray(a.aliases) ? a.aliases.filter((x): x is string => typeof x === 'string').map((x) => sanitize(x, 40)) : [];
      return [{ text, points: Math.round(points), aliases }];
    }).slice(0, 6);
    if (question && answers.length >= 3) surveys.push({ question, answers });
  }
  return surveys.length ? { surveys } : null;
}

const surveyBatchSchema: StructuredSchema<{ surveys: AiSurvey[] }> = {
  name: 'boredroom_survey_batch',
  validate: validateSurveyBatch,
  schema: {
    type: 'object', additionalProperties: false, required: ['surveys'],
    properties: {
      surveys: {
        type: 'array', maxItems: 6,
        items: {
          type: 'object', additionalProperties: false, required: ['question', 'answers'],
          properties: {
            question: { type: 'string', maxLength: 160 },
            answers: {
              type: 'array', minItems: 3, maxItems: 6,
              items: {
                type: 'object', additionalProperties: false, required: ['text', 'points'],
                properties: {
                  text: { type: 'string', maxLength: 60 },
                  points: { type: 'integer', minimum: 1, maximum: 60 },
                  aliases: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 40 } },
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function generateFeudSurveys(input: { count: number; avoid?: string[] }): Promise<AiSurvey[]> {
  const count = Math.min(6, Math.max(1, input.count));
  const avoid = (input.avoid ?? []).slice(0, 30).join('; ');
  const response = await completeStructured(
    surveyBatchSchema,
    'You write Family-Feud-style survey questions for a Nigerian/faith party-game. Each survey has a "Name something…" question and 3-5 ranked answers whose points sum near 100 (most popular highest). Family-friendly. Never reuse an avoided question.',
    `Count: ${count}\nAvoid: ${avoid || '(none)'}`,
    800,
  );
  const avoidSet = new Set((input.avoid ?? []).map((p) => p.toLowerCase().trim()));
  return (response?.surveys ?? []).filter((s) => !avoidSet.has(s.question.toLowerCase().trim())).slice(0, count);
}

// --- Logo Guesser AI items (brand + hint + category) --------------------------------------
interface AiLogoItem { name: string; hint: string; category: string }

function validateLogoBatch(value: unknown): { logos: AiLogoItem[] } | null {
  if (!isRecord(value) || !Array.isArray(value.logos)) return null;
  const logos: AiLogoItem[] = [];
  for (const l of value.logos) {
    if (!isRecord(l)) continue;
    const name = typeof l.name === 'string' ? sanitize(l.name, 60) : '';
    const hint = typeof l.hint === 'string' ? sanitize(l.hint, 80) : '';
    const category = typeof l.category === 'string' ? sanitize(l.category, 40) : 'Brands';
    if (name && hint) logos.push({ name, hint, category });
  }
  return logos.length ? { logos } : null;
}

const logoBatchSchema: StructuredSchema<{ logos: AiLogoItem[] }> = {
  name: 'boredroom_logo_batch',
  validate: validateLogoBatch,
  schema: {
    type: 'object', additionalProperties: false, required: ['logos'],
    properties: {
      logos: {
        type: 'array', maxItems: 12,
        items: {
          type: 'object', additionalProperties: false, required: ['name', 'hint', 'category'],
          properties: {
            name: { type: 'string', maxLength: 60 },
            hint: { type: 'string', maxLength: 80 },
            category: { type: 'string', maxLength: 40 },
          },
        },
      },
    },
  },
};

export async function generateLogoItems(input: { count: number; avoid?: string[] }): Promise<AiLogoItem[]> {
  const count = Math.min(12, Math.max(1, input.count));
  const avoid = (input.avoid ?? []).slice(0, 40).join('; ');
  const response = await completeStructured(
    logoBatchSchema,
    'You list well-known brands (Nigerian and global) for a "guess the brand" party-game. Each item has the brand name, a one-line slogan/hint, and a category. Family-friendly, real brands only. Never reuse an avoided brand.',
    `Count: ${count}\nAvoid: ${avoid || '(none)'}`,
    600,
  );
  const avoidSet = new Set((input.avoid ?? []).map((p) => p.toLowerCase().trim()));
  return (response?.logos ?? []).filter((l) => !avoidSet.has(l.name.toLowerCase().trim())).slice(0, count);
}

// --- Bible Timeline AI events (event + chronological position) ----------------------------
interface AiBibleEvent { event: string; position: number }

function validateBibleBatch(value: unknown): { events: AiBibleEvent[] } | null {
  if (!isRecord(value) || !Array.isArray(value.events)) return null;
  const events: AiBibleEvent[] = [];
  for (const e of value.events) {
    if (!isRecord(e)) continue;
    const event = typeof e.event === 'string' ? sanitize(e.event, 80) : '';
    const position = Number(e.position);
    if (event && Number.isFinite(position)) events.push({ event, position });
  }
  // Need at least 3 to make an ordering round.
  return events.length >= 3 ? { events } : null;
}

const bibleBatchSchema: StructuredSchema<{ events: AiBibleEvent[] }> = {
  name: 'boredroom_bible_batch',
  validate: validateBibleBatch,
  schema: {
    type: 'object', additionalProperties: false, required: ['events'],
    properties: {
      events: {
        type: 'array', maxItems: 12,
        items: {
          type: 'object', additionalProperties: false, required: ['event', 'position'],
          properties: {
            event: { type: 'string', maxLength: 80 },
            position: { type: 'integer', minimum: 0, maximum: 10000 },
          },
        },
      },
    },
  },
};

export async function generateBibleEvents(input: { count: number; avoid?: string[] }): Promise<AiBibleEvent[]> {
  const count = Math.min(12, Math.max(3, input.count));
  const avoid = (input.avoid ?? []).slice(0, 40).join('; ');
  const response = await completeStructured(
    bibleBatchSchema,
    'You list Bible events for a chronological-ordering game. Each event has a short label and a "position" integer that is its chronological order (smaller = earlier). Accurate canonical order. Never reuse an avoided event.',
    `Count: ${count}\nAvoid: ${avoid || '(none)'}`,
    600,
  );
  const avoidSet = new Set((input.avoid ?? []).map((p) => p.toLowerCase().trim()));
  return (response?.events ?? []).filter((e) => !avoidSet.has(e.event.toLowerCase().trim()));
}

// Only games that consume the multiple-choice question shape are routed to trivia generation.
// market-price (real Naira prices) and color-wahala (procedural Stroop + curated flag facts)
// stay on curated/procedural data on purpose — AI-invented prices/flags would be wrong.
const GAME_TRIVIA_TOPICS: Record<string, string> = {
  trivia: 'Nigerian general knowledge, culture, history, music, sports and food',
};

// One entry point the server uses for any AI-capable content game. Returns plain content arrays
// the runtimes merge ahead of their local banks; always empty on failure (fail-soft).
export interface GameContent {
  questions: AiTriviaQuestion[];
  surveys: AiSurvey[];
  logos: AiLogoItem[];
  events: AiBibleEvent[];
}
const EMPTY_CONTENT: GameContent = { questions: [], surveys: [], logos: [], events: [] };

export async function generateGameContent(input: {
  gameId: string;
  count: number;
  avoid?: string[];
}): Promise<GameContent> {
  if (input.gameId === 'faith-feud') {
    return { ...EMPTY_CONTENT, surveys: await generateFeudSurveys({ count: input.count, avoid: input.avoid }) };
  }
  if (input.gameId === 'logo') {
    return { ...EMPTY_CONTENT, logos: await generateLogoItems({ count: input.count, avoid: input.avoid }) };
  }
  if (input.gameId === 'bible-timeline') {
    return { ...EMPTY_CONTENT, events: await generateBibleEvents({ count: input.count, avoid: input.avoid }) };
  }
  const topic = GAME_TRIVIA_TOPICS[input.gameId];
  if (!topic) return EMPTY_CONTENT;
  return { ...EMPTY_CONTENT, questions: await generateTriviaQuestions({ topic, count: input.count, avoid: input.avoid }) };
}

export async function generateRecap(input: {
  gameName: string;
  winnerNames: string[];
  signals: Record<string, unknown>;
}): Promise<{ headline: string; paragraph: string }> {
  const votes = Array.isArray(input.signals.majorVotes) ? input.signals.majorVotes as Array<{ winner?: string; overridden?: boolean }> : [];
  const voteLine = votes.length
    ? ` The house voted along the way${votes[0]?.winner ? ` — ${votes[0].winner} carried the room${votes[0].overridden ? ' after a host override' : ''}.` : '.'}`
    : '';
  const fallback = {
    headline: `${input.gameName} complete`,
    paragraph: (input.winnerNames.length
      ? `${input.winnerNames.join(', ')} finished on top. Everyone stays connected for the next game.`
      : 'The run is complete. Everyone stays connected for the next game.') + voteLine,
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
