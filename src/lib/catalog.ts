// Unified game catalog. Runtime implementation details never appear in this public shape.

import { GAME_REGISTRY } from '@/lib/games';
import { NEW_GAME_CATALOG } from '@/lib/newGames';
import { getAdapter } from '@/lib/adapters';

export interface CatalogGame {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  available: boolean;
  capabilities: {
    bots: boolean;
    audience: boolean;
    hints: boolean;
    restore: boolean;
  };
}

export function getAllGames(): CatalogGame[] {
  const builtIn: CatalogGame[] = GAME_REGISTRY.filter((g) => g.enabled !== false).map((g) => ({
    slug: g.slug,
    name: g.name,
    emoji: g.emoji,
    tagline: g.tagline,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    available: true,
    capabilities: {
      bots: getAdapter(g.slug)?.capabilities.bots ?? false,
      audience: getAdapter(g.slug)?.capabilities.audience ?? true,
      hints: getAdapter(g.slug)?.capabilities.hints ?? false,
      restore: getAdapter(g.slug)?.capabilities.restore ?? false,
    },
  }));
  const additional: CatalogGame[] = Object.values(NEW_GAME_CATALOG).map((g) => ({
    slug: g.slug,
    name: g.name,
    emoji: g.emoji,
    tagline: g.tagline,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    available: true,
    capabilities: {
      bots: getAdapter(g.slug)?.capabilities.bots ?? false,
      audience: getAdapter(g.slug)?.capabilities.audience ?? true,
      hints: getAdapter(g.slug)?.capabilities.hints ?? false,
      restore: getAdapter(g.slug)?.capabilities.restore ?? false,
    },
  }));
  return [...builtIn, ...additional];
}
