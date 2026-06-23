import { describe, expect, it } from 'vitest';
import {
  THEME_TOKENS,
  REQUIRED_TOKENS,
  applyTheme,
  isTokenSet,
  type TokenSet,
} from '@/lib/theme/tokens';
import { PACK_THEMES } from '@/lib/packs';

// AC-7.1: theme tokens drive Faith/Naija/Market via pack manifests.
describe('design tokens', () => {
  const sets: TokenSet[] = ['naija', 'faith', 'market'];

  it('every theme defines all required tokens', () => {
    for (const set of sets) {
      for (const key of REQUIRED_TOKENS) {
        expect(THEME_TOKENS[set][key], `${set}.${key}`).toBeTruthy();
      }
    }
  });

  it('token values are valid HSL triples', () => {
    for (const set of sets) {
      for (const key of REQUIRED_TOKENS) {
        expect(THEME_TOKENS[set][key]).toMatch(/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/);
      }
    }
  });

  it('every pack theme references a real token set', () => {
    for (const theme of PACK_THEMES) {
      expect(isTokenSet(theme.tokenSet), theme.id).toBe(true);
    }
  });

  it('applyTheme writes every token as a CSS variable', () => {
    const written: Record<string, string> = {};
    const fakeTarget = { style: { setProperty: (p: string, v: string) => { written[p] = v; } } };
    applyTheme('faith', fakeTarget);
    expect(written['--primary']).toBe(THEME_TOKENS.faith.primary);
    expect(Object.keys(written)).toHaveLength(REQUIRED_TOKENS.length);
  });

  it('isTokenSet guards unknown sets', () => {
    expect(isTokenSet('naija')).toBe(true);
    expect(isTokenSet('disco')).toBe(false);
    expect(isTokenSet(undefined)).toBe(false);
  });

  it('themes are visually distinct (different primaries)', () => {
    const primaries = sets.map((s) => THEME_TOKENS[s].primary);
    expect(new Set(primaries).size).toBe(primaries.length);
  });
});
