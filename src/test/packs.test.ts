import { describe, expect, it } from 'vitest';
import {
  PACK_REGISTRY,
  PACK_THEMES,
  getGamesForPack,
  getGamesForPacks,
  resolvePackTheme,
} from '@/lib/packs';
import { isSupportedGame } from '@/lib/games';
import { getNewGameMeta } from '@/lib/newGames';
import { PackManifest, PackTheme } from '../../shared/src/contracts/pack';

// AC-2.1: pack-first catalog is driven by manifests (no hardcoded game list in the UI),
// and the client pack registry conforms to the canonical shared Zod schema (no drift).
describe('pack system', () => {
  it('every pack validates against the shared PackManifest schema', () => {
    for (const pack of PACK_REGISTRY) {
      expect(() => PackManifest.parse(pack)).not.toThrow();
    }
  });

  it('every theme validates against the shared PackTheme schema', () => {
    for (const theme of PACK_THEMES) {
      expect(() => PackTheme.parse(theme)).not.toThrow();
    }
  });

  it('every pack references a real legacy or adapter game slug', () => {
    for (const pack of PACK_REGISTRY) {
      for (const slug of pack.games) {
        const known = isSupportedGame(slug) || getNewGameMeta(slug) !== null;
        expect(known, `${pack.id} -> ${slug}`).toBe(true);
      }
    }
  });

  it('every pack references a theme it ships', () => {
    const themeIds = new Set(PACK_THEMES.map((t) => t.id));
    for (const pack of PACK_REGISTRY) {
      for (const id of pack.themes) expect(themeIds.has(id)).toBe(true);
      if (pack.defaultThemeId) expect(pack.themes).toContain(pack.defaultThemeId);
    }
  });

  it('pack-aware catalog returns games in pack order', () => {
    const games = getGamesForPack('pack.naija');
    expect(games.length).toBeGreaterThan(0);
    expect(games.map((g) => g.slug).slice(0, 2)).toEqual(['whot', 'ludo']);
  });

  it('union catalog de-dupes across packs', () => {
    const union = getGamesForPacks(['pack.naija', 'pack.classics']);
    const slugs = union.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('connect-4'); // from classics
    expect(slugs).toContain('whot'); // from naija
  });

  it('new adapter games are reachable through their packs', () => {
    const faith = getGamesForPack('pack.faith').map((g) => g.slug);
    expect(faith).toContain('faith-feud');
    expect(faith).toContain('bible-timeline');
    const market = getGamesForPack('pack.market');
    const mp = market.find((g) => g.slug === 'market-price');
    expect(mp?.available).toBe(true);
    expect(mp?.name).toBe('Market Price');
  });

  it('resolves a pack default theme', () => {
    expect(resolvePackTheme('pack.naija')?.tokenSet).toBe('naija');
    expect(resolvePackTheme('nope')).toBeNull();
  });
});
