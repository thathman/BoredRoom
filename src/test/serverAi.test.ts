import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generatePrivateHint,
  getAiHealth,
  generateGameContent,
  generateTriviaQuestions,
  generateRulesExplanation,
  moderateOwnerContent,
  recommendGames,
} from '../../server/src/aiService';
import { recentPromptsFor, rememberPrompts, clearContentMemory } from '../../server/src/aiContentMemory';

let previousKey: string | undefined;
let previousFetch: typeof globalThis.fetch | undefined;

function mockDeepSeek(content: unknown, status = 200) {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    expect(body).toMatchObject({
      response_format: {
        type: 'json_object',
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
    previousKey = process.env.DEEPSEEK_API_KEY;
    previousFetch = globalThis.fetch;
    delete process.env.DEEPSEEK_API_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    if (previousFetch) globalThis.fetch = previousFetch;
    delete process.env.DEEPSEEK_BASE_URL;
  });

  it('uses the configured DeepSeek endpoint and key', async () => {
    process.env.DEEPSEEK_BASE_URL = 'https://my-llm.example/v1';
    process.env.DEEPSEEK_API_KEY = 'custom-key';
    let calledUrl = '';
    let authHeader = '';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(input);
      const h = (init?.headers ?? {}) as Record<string, string>;
      authHeader = String(h.authorization ?? h.Authorization ?? '');
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ allowed: true }) } }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }) as typeof globalThis.fetch;
    await moderateOwnerContent('a clean custom phrase');
    expect(calledUrl).toBe('https://my-llm.example/v1/chat/completions');
    expect(authHeader).toContain('custom-key');
  });

  it('reports offline without exposing a credential', () => {
    const health = getAiHealth();
    expect(health.enabled).toBe(false);
    expect(health.model).toBe('deepseek-v4-flash');
    expect(JSON.stringify(health)).not.toMatch(/api[_-]?key/i);
  });

  it('falls back to a server-generated legal intent for private hints', async () => {
    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 1, label: 'Choose option B' }],
    });
    expect(hint).toBe('Choose option B');
  });

  it('blocks unsafe owner content before an LLM call', async () => {
    await expect(moderateOwnerContent('You are a fucking idiot')).resolves.toMatchObject({ allowed: false });
  });

  it('uses structured private hints and returns only a server-generated legal intent', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockDeepSeek({ text: 'Take the safe scoring play.', selectedIntentIndex: 1 });

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false, hiddenAnswer: 'private' },
      legalIntents: [
        { type: 'answer', optionIndex: 0, label: 'Choose option A' },
        { type: 'answer', optionIndex: 2, label: 'Choose option C' },
      ],
    });

    expect(hint).toContain('Take the safe scoring play.');
    expect(hint).toContain('Choose option C');
    expect(hint).not.toMatch(/optionIndex|\{/);
    expect(getAiHealth()).toMatchObject({ enabled: true, status: 'active', fallbackActive: false, rateLimitRemaining: 42 });
  });

  it('falls back when the provider returns schema-invalid private hints', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockDeepSeek({ text: 'Invent a move.', selectedIntentIndex: 99 });

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 1, label: 'Choose option B' }],
    });

    expect(hint).toBe('Choose option B');
    expect(getAiHealth()).toMatchObject({ status: 'degraded', lastError: 'ai_schema_validation_failed', fallbackActive: true });
  });

  it('fails soft and marks degraded on a 429 rate limit', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    globalThis.fetch = (async () => new Response('{}', {
      status: 429,
      headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '0' },
    })) as typeof globalThis.fetch;

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 1, label: 'Choose option B' }],
    });
    // Gameplay never blocks: still returns a server-generated legal intent.
    expect(hint).toBe('Choose option B');
    expect(getAiHealth()).toMatchObject({ status: 'degraded' });
  });

  it('marks credit exhausted on a 402 and still returns a legal fallback', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    globalThis.fetch = (async () => new Response('{}', {
      status: 402,
      headers: { 'content-type': 'application/json' },
    })) as typeof globalThis.fetch;

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 0, label: 'Choose option A' }],
    });
    expect(hint).toBe('Choose option A');
    expect(getAiHealth()).toMatchObject({ status: 'degraded', creditStatus: 'exhausted' });
  });

  it('fails soft when the provider call times out / throws', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    globalThis.fetch = (async () => { throw new DOMException('The operation timed out', 'TimeoutError'); }) as typeof globalThis.fetch;

    const hint = await generatePrivateHint({
      gameName: 'Test game',
      rules: 'Choose one legal option.',
      publicState: { phase: 'playing' },
      privateState: { submitted: false },
      legalIntents: [{ type: 'answer', optionIndex: 1, label: 'Choose option B' }],
    });
    expect(hint).toBe('Choose option B');
    expect(getAiHealth()).toMatchObject({ status: 'offline' });
  });

  it('parses structured moderation decisions', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockDeepSeek({ allowed: false, reason: 'targeted abuse' });

    await expect(moderateOwnerContent('custom submitted phrase')).resolves.toEqual({
      allowed: false,
      reason: 'targeted abuse',
    });
  });

  it('filters recommendations to eligible supplied games only', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockDeepSeek({
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
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockDeepSeek({ questions: [
      { prompt: 'Capital of Nigeria?', options: ['Abuja', 'Lagos', 'Kano', 'Jos'], answer: 0 },
      { prompt: 'Bad — only one option', options: ['x'], answer: 0 }, // dropped
      { prompt: 'Bad answer index', options: ['a', 'b'], answer: 9 }, // dropped
    ] });
    const out = await generateTriviaQuestions({ topic: 'Nigeria', count: 5 });
    expect(out).toHaveLength(1);
    expect(out[0].prompt).toBe('Capital of Nigeria?');
  });

  it('rules explanation falls soft to the static summary with no AI key', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const text = await generateRulesExplanation({ gameName: 'Whot', rules: 'Match shape or number; special cards bite.' });
    expect(text).toBe('Match shape or number; special cards bite.');
  });

  it('rules explanation uses the AI line when available', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockDeepSeek({ headline: 'Whot is easy', paragraph: 'Match the top card by shape or number.' });
    const text = await generateRulesExplanation({ gameName: 'Whot', rules: 'rules' });
    expect(text).toContain('Whot is easy');
    expect(text).toContain('Match the top card');
  });

  it('routes faith-feud to survey generation and trivia to questions', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockDeepSeek({ surveys: [{ question: 'Name a Nigerian food', answers: [
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
    delete process.env.DEEPSEEK_API_KEY;
    const out = await generateGameContent({ gameId: 'trivia', count: 5 });
    expect(out.questions).toEqual([]);
    expect(out.surveys).toEqual([]);
    expect(out.logos).toEqual([]);
    expect(out.events).toEqual([]);
  });

  it('routes logo to brand generation and bible-timeline to event generation', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockDeepSeek({ logos: [{ name: 'Jumia', hint: 'Online shopping', category: 'Ecommerce' }] });
    const logo = await generateGameContent({ gameId: 'logo', count: 4 });
    expect(logo.logos).toEqual([{ name: 'Jumia', hint: 'Online shopping', category: 'Ecommerce' }]);
    expect(logo.questions).toEqual([]);

    mockDeepSeek({ events: [
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
