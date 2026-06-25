import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generatePrivateHint, getAiHealth, moderateOwnerContent } from '../../server/src/aiService';

let previousKey: string | undefined;

describe('server-side AI fallback and isolation', () => {
  beforeEach(() => {
    previousKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  it('reports offline without exposing a credential', () => {
    const health = getAiHealth();
    expect(health.enabled).toBe(false);
    expect(health.model).toBe('google/gemini-2.0-flash-001');
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
});
