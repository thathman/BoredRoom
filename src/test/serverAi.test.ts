import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generatePrivateHint,
  getAiHealth,
  moderateOwnerContent,
  recommendGames,
} from '../../server/src/aiService';

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
});
