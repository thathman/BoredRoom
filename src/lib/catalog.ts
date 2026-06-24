// Unified game catalog: every game available on this server, regardless of whether it's a built-in
// (legacy Colyseus) game or an adapter game contributed by an installed pack. The room-creation flow
// and /games list read from here — you create a room and pick ANY installed game (packs are an
// install mechanism, not a play-time choice).

import { GAME_REGISTRY } from '@/lib/games';
import { NEW_GAME_CATALOG } from '@/lib/newGames';

export interface CatalogGame {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  kind: 'legacy' | 'adapter';
}

export function getAllGames(): CatalogGame[] {
  const legacy: CatalogGame[] = GAME_REGISTRY.filter((g) => g.enabled !== false).map((g) => ({
    slug: g.slug,
    name: g.name,
    emoji: g.emoji,
    tagline: g.tagline,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    kind: 'legacy',
  }));
  const adapter: CatalogGame[] = Object.values(NEW_GAME_CATALOG).map((g) => ({
    slug: g.slug,
    name: g.name,
    emoji: g.emoji,
    tagline: g.tagline,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    kind: 'adapter',
  }));
  return [...legacy, ...adapter];
}
