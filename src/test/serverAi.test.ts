import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generatePrivateHint,
  getAiHealth,
  generateGameContent,
  generateTriviaQuestions,
  moderateOwnerContent,
  recommendGames,
} from '../../server/src/aiService';
import { recentPromptsFor, rememberPrompts, clearContentMemory } from '../../server/src/aiContentMemory';

let previousKey: string | undefined;
let previousFetch: typeof globalThis.fetch | undefined;

function mockOpenRouter(content: unknown, status = 200) {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    expect(body).toMatchObject({
      response_format: {
        type: 'json_schema',
      },
    });
    return new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: typeof content === 'string' ? content : JSON.stringify(content),
          },
        },
      ],
    }), {
      status,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '42',
      },
    });
  }) as typeof globalThis.fetch;
}

describe('server-side AI fallback and isolation', () => {
  beforeEach(() => {
    previousKey = process.env.OPENROUTER_API_KEY;
    previousFetch = globalThis.fetch;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
    if (previousFetch) globalThis.fetch = previousFetch;
  });

  it('reports offline without exposing a credential', () => {
    const health = getAiHealth();
    expect(health.enabled).toBe(false);
    expect(health.model).toBe('google/gemini-2.5-flash-lite');
    expect(JSON.stringify(health)).not.toMatch(/api[_-]?key/i);
  });

  it('falls back to a server-generated legal intent for private hints', async () => {
    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 1 }],
    });
    expect(hint).toContain('"optionIndex":1');
  });

  it('blocks unsafe owner content before an LLM call', async () => {
    await expect(moderateOwnerContent('You are a fucking idiot')).resolves.toMatchObject({ allowed: false });
  });

  it('uses structured private hints and returns only a server-generated legal intent', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockOpenRouter({ text: 'Take the safe scoring play.', selectedIntentIndex: 1 });

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false, hiddenAnswer: 'private' },
      legalIntents: [
        { type: 'answer', optionIndex: 0 },
        { type: 'answer', optionIndex: 2 },
      ],
    });

    expect(hint).toContain('Take the safe scoring play.');
    expect(hint).toContain('"optionIndex":2');
    expect(hint).not.toContain('"optionIndex":99');
    expect(getAiHealth()).toMatchObject({ enabled: true, status: 'active', fallbackActive: false, rateLimitRemaining: 42 });
  });

  it('falls back when the provider returns schema-invalid private hints', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockOpenRouter({ text: 'Invent a move.', selectedIntentIndex: 99 });

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 1 }],
    });

    expect(hint).toContain('"optionIndex":1');
    expect(getAiHealth()).toMatchObject({ status: 'degraded', lastError: 'ai_schema_validation_failed', fallbackActive: true });
  });

  it('fails soft and marks degraded on a 429 rate limit', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    globalThis.fetch = (async () => new Response('{}', {
      status: 429,
      headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '0' },
    })) as typeof globalThis.fetch;

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 1 }],
    });
    // Gameplay never blocks: still returns a server-generated legal intent.
    expect(hint).toContain('"optionIndex":1');
    expect(getAiHealth()).toMatchObject({ status: 'degraded' });
  });

  it('marks credit exhausted on a 402 and still returns a legal fallback', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    globalThis.fetch = (async () => new Response('{}', {
      status: 402,
      headers: { 'content-type': 'application/json' },
    })) as typeof globalThis.fetch;

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 0 }],
    });
    expect(hint).toContain('"optionIndex":0');
    expect(getAiHealth()).toMatchObject({ status: 'degraded', creditStatus: 'exhausted' });
  });

  it('fails soft when the provider call times out / throws', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    globalThis.fetch = (async () => { throw new DOMException('The operation timed out', 'TimeoutError'); }) as typeof globalThis.fetch;

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 1 }],
    });
    expect(hint).toContain('"optionIndex":1');
    expect(getAiHealth()).toMatchObject({ status: 'offline' });
  });

  it('parses structured moderation decisions', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockOpenRouter({ allowed: false, reason: 'targeted abuse' });

    await expect(moderateOwnerContent('custom submitted phrase')).resolves.toEqual({
      allowed: false,
      reason: 'targeted abuse',
    });
  });

  it('filters recommendations to eligible supplied games only', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockOpenRouter({
      recommendations: [
        { gameId: 'word-wahala', reason: 'Good for this group.' },
        { gameId: 'not-installed', reason: 'Should be ignored.' },
      ],
    });

    await expect(recommendGames({
      installedGames: [
        { id: 'word-wahala', name: 'Word Wahala', minPlayers: 2, maxPlayers: 8 },
        { id: 'ludo', name: 'Ludo', minPlayers: 2, maxPlayers: 4 },
      ],
      playerCount: 6,
      recentGameIds: [],
    })).resolves.toEqual([
      { gameId: 'word-wahala', reason: 'Good for this group.' },
    ]);
  });

  it('generates validated trivia questions and drops malformed ones', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockOpenRouter({ questions: [
      { prompt: 'Capital of Nigeria?', options: ['Abuja', 'Lagos', 'Kano', 'Jos'], answer: 0 },
      { prompt: 'Bad — only one option', options: ['x'], answer: 0 }, // dropped
      { prompt: 'Bad answer index', options: ['a', 'b'], answer: 9 }, // dropped
    ] });
    const out = await generateTriviaQuestions({ topic: 'Nigeria', count: 5 });
    expect(out).toHaveLength(1);
    expect(out[0].prompt).toBe('Capital of Nigeria?');
  });

  it('routes faith-feud to survey generation and trivia to questions', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockOpenRouter({ surveys: [{ question: 'Name a Nigerian food', answers: [
      { text: 'Jollof', points: 40 }, { text: 'Eba', points: 30 }, { text: 'Suya', points: 20 },
    ] }] });
    const feud = await generateGameContent({ gameId: 'faith-feud', count: 3 });
    expect(feud.surveys.length).toBe(1);
    expect(feud.questions.length).toBe(0);
    // market-price has no AI topic → no generation (curated prices stay authoritative)
    const market = await generateGameContent({ gameId: 'market-price', count: 3 });
    expect(market.questions.length).toBe(0);
    expect(market.surveys.length).toBe(0);
  });

  it('fails soft to empty content when AI is unavailable (gameplay uses local bank)', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const out = await generateGameContent({ gameId: 'trivia', count: 5 });
    expect(out.questions).toEqual([]);
    expect(out.surveys).toEqual([]);
    expect(out.logos).toEqual([]);
    expect(out.events).toEqual([]);
  });

  it('routes logo to brand generation and bible-timeline to event generation', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockOpenRouter({ logos: [{ name: 'Jumia', hint: 'Online shopping', category: 'Ecommerce' }] });
    const logo = await generateGameContent({ gameId: 'logo', count: 4 });
    expect(logo.logos).toEqual([{ name: 'Jumia', hint: 'Online shopping', category: 'Ecommerce' }]);
    expect(logo.questions).toEqual([]);

    mockOpenRouter({ events: [
      { event: 'Creation', position: 1 }, { event: 'The Flood', position: 2 }, { event: 'Exodus', position: 3 },
    ] });
    const bible = await generateGameContent({ gameId: 'bible-timeline', count: 5 });
    expect(bible.events.length).toBe(3);
    expect(bible.questions).toEqual([]);
  });

  it('anti-repeat memory accumulates and de-dupes recent prompts per session', () => {
    clearContentMemory('s1');
    rememberPrompts('s1', 'trivia', ['Q1', 'Q2']);
    rememberPrompts('s1', 'trivia', ['Q2', 'Q3']); // Q2 deduped
    expect(recentPromptsFor('s1', 'trivia')).toEqual(['Q1', 'Q2', 'Q3']);
    // scoped per (session, game)
    expect(recentPromptsFor('s1', 'logo')).toEqual([]);
    clearContentMemory('s1');
    expect(recentPromptsFor('s1', 'trivia')).toEqual([]);
  });
});
