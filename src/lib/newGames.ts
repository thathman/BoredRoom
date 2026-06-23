// Catalog metadata for Phase 8 adapter-driven games. These are NOT legacy Colyseus-room games
// (GameType), so they live outside GAME_REGISTRY; they run via the GameAdapter registry. Packs
// resolve display metadata from here in addition to the legacy catalog.

export interface NewGameMeta {
  slug: string; // adapter slug (matches src/lib/adapters GAME_ADAPTERS keys)
  name: string;
  emoji: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
}

export const NEW_GAME_CATALOG: Record<string, NewGameMeta> = {
  'market-price': {
    slug: 'market-price', name: 'Market Price', emoji: '🛒',
    tagline: 'Guess the Naija market price.', minPlayers: 1, maxPlayers: 12,
  },
  'pidgin-translator': {
    slug: 'pidgin-translator', name: 'Pidgin Translator', emoji: '🗣️',
    tagline: 'Translate between English and Pidgin.', minPlayers: 1, maxPlayers: 12,
  },
  'faith-feud': {
    slug: 'faith-feud', name: 'Faith Feud', emoji: '⛪',
    tagline: 'Survey says — guess the top answers.', minPlayers: 2, maxPlayers: 12,
  },
  'bible-timeline': {
    slug: 'bible-timeline', name: 'Bible Timeline Rush', emoji: '📜',
    tagline: 'Put the events in order, fast.', minPlayers: 1, maxPlayers: 12,
  },
};

export function getNewGameMeta(slug: string): NewGameMeta | null {
  return NEW_GAME_CATALOG[slug] ?? null;
}
