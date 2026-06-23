// Pack registry + pack-aware catalog (Phase 2).
//
// Packs own which games appear, their theme, and safety metadata. The landing/setup flow is
// pack-first (constitution Art. IV / roadmap Phase 3). PackManifest/PackTheme are mirrors of the
// canonical Zod schemas in @boredroom/shared (shared/src/contracts/pack.ts); the mirror is
// validated against the Zod schema in src/test/packs.test.ts so it cannot drift.

import { getGameMeta } from '@/lib/games';
import { getNewGameMeta } from '@/lib/newGames';

// Common display shape across legacy (Colyseus) games and Phase 8 adapter games.
export interface PackGame {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  /** 'legacy' = has a Colyseus room; 'adapter' = runs via the GameAdapter registry. */
  kind: 'legacy' | 'adapter';
}

function resolvePackGame(slug: string): PackGame | null {
  const legacy = getGameMeta(slug);
  if (legacy && legacy.enabled !== false) {
    return {
      slug: legacy.slug,
      name: legacy.name,
      emoji: legacy.emoji,
      tagline: legacy.tagline,
      minPlayers: legacy.minPlayers,
      maxPlayers: legacy.maxPlayers,
      kind: 'legacy',
    };
  }
  const fresh = getNewGameMeta(slug);
  if (fresh) return { ...fresh, kind: 'adapter' };
  return null;
}

export interface PackTheme {
  id: string;
  name: string;
  tokenSet: string;
  preview?: string;
}

export interface PackManifest {
  id: string;
  name: string;
  version: string;
  category: string;
  ageRating: 'kids' | 'family' | 'teen' | 'adult';
  description: string;
  games: string[];
  contentPacks: string[];
  themes: string[];
  defaultThemeId?: string;
  hostPersonalities: string[];
  requiresModeration: boolean;
  supportsAudience: boolean;
  supportsVoice: boolean;
  offlineReady: boolean;
}

export const PACK_THEMES: PackTheme[] = [
  { id: 'theme.naija', name: 'Naija Street', tokenSet: 'naija' },
  { id: 'theme.faith', name: 'Faith & Family', tokenSet: 'faith' },
  { id: 'theme.market', name: 'Market Day', tokenSet: 'market' },
];

// Seed packs group the existing, shipped games. New packs (Faith, Market) get their own games
// in Phase 8; for now they reuse compatible existing games so the pack-first flow is real today.
export const PACK_REGISTRY: PackManifest[] = [
  {
    id: 'pack.naija',
    name: 'Naija Party',
    version: '1.0.0',
    category: 'party',
    ageRating: 'family',
    description: 'The full Naija game night: cards, board, word, and reflex games.',
    games: ['whot', 'ludo', 'landlord', 'word-wahala', 'color-wahala', 'half-half', 'hustle', 'logo'],
    contentPacks: [],
    themes: ['theme.naija'],
    defaultThemeId: 'theme.naija',
    hostPersonalities: ['gist-master'],
    requiresModeration: false,
    supportsAudience: true,
    supportsVoice: false,
    offlineReady: false,
  },
  {
    id: 'pack.classics',
    name: 'Quick Classics',
    version: '1.0.0',
    category: 'classics',
    ageRating: 'kids',
    description: 'Fast, tactical face-offs anyone can pick up.',
    games: ['connect-4', 'ettt', 'ludo'],
    contentPacks: [],
    themes: ['theme.market'],
    defaultThemeId: 'theme.market',
    hostPersonalities: [],
    requiresModeration: false,
    supportsAudience: true,
    supportsVoice: false,
    offlineReady: true,
  },
  {
    id: 'pack.brains',
    name: 'Brain Box',
    version: '1.0.0',
    category: 'knowledge',
    ageRating: 'teen',
    description: 'Trivia and word challenges to test the table.',
    games: ['trivia', 'word-wahala', 'logo'],
    contentPacks: [],
    themes: ['theme.faith'],
    defaultThemeId: 'theme.faith',
    hostPersonalities: ['quiz-master'],
    requiresModeration: false,
    supportsAudience: true,
    supportsVoice: false,
    offlineReady: false,
  },
  {
    id: 'pack.faith',
    name: 'Faith & Family',
    version: '1.0.0',
    category: 'faith',
    ageRating: 'family',
    description: 'Church-night favourites: feud, scripture timelines, and trivia.',
    games: ['faith-feud', 'bible-timeline', 'trivia'],
    contentPacks: [],
    themes: ['theme.faith'],
    defaultThemeId: 'theme.faith',
    hostPersonalities: ['pastor-mc'],
    requiresModeration: false,
    supportsAudience: true,
    supportsVoice: false,
    offlineReady: false,
  },
  {
    id: 'pack.market',
    name: 'Market Day',
    version: '1.0.0',
    category: 'lifestyle',
    ageRating: 'family',
    description: 'Naija street-smarts: prices, pidgin, and quick wits.',
    games: ['market-price', 'pidgin-translator', 'color-wahala'],
    contentPacks: [],
    themes: ['theme.market'],
    defaultThemeId: 'theme.market',
    hostPersonalities: ['market-mama'],
    requiresModeration: false,
    supportsAudience: true,
    supportsVoice: false,
    offlineReady: false,
  },
];

const PACK_BY_ID = new Map(PACK_REGISTRY.map((p) => [p.id, p]));
const THEME_BY_ID = new Map(PACK_THEMES.map((t) => [t.id, t]));

export function getPack(id: string | undefined | null): PackManifest | null {
  return (id && PACK_BY_ID.get(id)) || null;
}

export function getPackTheme(id: string | undefined | null): PackTheme | null {
  return (id && THEME_BY_ID.get(id)) || null;
}

// Pack-aware catalog: the games a pack exposes, in pack order, resolving legacy + adapter games.
export function getGamesForPack(packId: string): PackGame[] {
  const pack = getPack(packId);
  if (!pack) return [];
  return pack.games
    .map((slug) => resolvePackGame(slug))
    .filter((g): g is PackGame => g !== null);
}

// Union catalog across a selection of packs (de-duped, pack order preserved).
export function getGamesForPacks(packIds: string[]): PackGame[] {
  const seen = new Set<string>();
  const out: PackGame[] = [];
  for (const id of packIds) {
    for (const slug of getPack(id)?.games ?? []) {
      if (seen.has(slug)) continue;
      const game = resolvePackGame(slug);
      if (game) {
        seen.add(slug);
        out.push(game);
      }
    }
  }
  return out;
}

export function resolvePackTheme(packId: string): PackTheme | null {
  const pack = getPack(packId);
  if (!pack) return null;
  return getPackTheme(pack.defaultThemeId ?? pack.themes[0]);
}
