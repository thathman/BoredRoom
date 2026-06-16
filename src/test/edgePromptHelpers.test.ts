import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const commentary = readFileSync('supabase/functions/ai-commentary/index.ts', 'utf8');
const recap = readFileSync('supabase/functions/ai-recap/index.ts', 'utf8');

describe('edge AI prompt helpers', () => {
  it('commentary edge function defaults unknown gameType to Ludo and contains Whot prompt guidance', () => {
    expect(commentary).toContain("value === 'whot' ? 'whot' : 'ludo'");
    expect(commentary).toContain('pick chain');
    expect(commentary).toContain('Whot 20');
    expect(commentary).toContain('last card');
  });

  it('recap edge function includes Whot-specific signals and sanitizer guard rails', () => {
    expect(recap).toContain('signalsLine');
    expect(recap).toContain('pick chains');
    expect(recap).toContain('sanitizeRecap');
    expect(recap).toContain('No profanity, slurs, player-directed abuse, or strategy coaching');
  });
});
