// Central registry of supported games. Used to scope routing and
// validate :game URL params. Keep this list in sync with shared GameType.

import type { GameType } from '@/lib/transport/types';

export type GameCategory = 'board' | 'cards' | 'trivia' | 'arcade';

export interface CategoryMeta {
  id: GameCategory;
  label: string;
  emoji: string;
  description: string;
}

export const GAME_CATEGORIES: CategoryMeta[] = [
  { id: 'board', label: 'Board games', emoji: '🎲', description: 'Roll, move, and race your tokens.' },
  { id: 'cards', label: 'Card games', emoji: '🃏', description: 'Match, bluff, and outplay the table.' },
  { id: 'trivia', label: 'Trivia', emoji: '🧠', description: 'Test your knowledge against friends.' },
  { id: 'arcade', label: 'Arcade & classics', emoji: '🕹️', description: 'Quick tactical face-offs.' },
];

export interface GameMeta {
  slug: GameType;
  name: string;
  tagline: string;
  emoji: string;
  category: GameCategory;
  /** Runtime-gating: set false to hide a not-yet-shipped game. */
  enabled?: boolean;
  minPlayers: number;
  maxPlayers: number;
  rules: string[];
  supportsBots?: boolean;
}

export const GAME_REGISTRY: GameMeta[] = [
  {
    slug: 'ludo',
    name: 'Ludo',
    tagline: 'The classic 2–4 player race home.',
    emoji: '🎲',
    category: 'board',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 4,
    rules: [
      'Roll and move tokens around the board.',
      'You need a single die showing 6 to leave base.',
      'Get all 4 tokens home before everyone else.',
    ],
    supportsBots: true,
  },
  {
    slug: 'whot',
    name: 'Whot',
    tagline: 'Nigerian shape-and-number showdown.',
    emoji: '🃏',
    category: 'cards',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 8,
    rules: [
      'Match by shape or value; Whot 20 calls suit.',
      '2, 5 and 14 can streak in same-rank chains.',
      'Announce Last Card before final play.',
    ],
    supportsBots: true,
  },
  {
    slug: 'trivia',
    name: 'Who Sabi Pass?',
    tagline: 'Naija trivia showdown — culture, history, music, Nollywood and more.',
    emoji: '🇳🇬',
    category: 'trivia',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 8,
    rules: [
      'Answer quickly for more points.',
      'Correct streaks increase momentum.',
      'Highest score at the end wins.',
    ],
    supportsBots: false,
  },
  {
    slug: 'connect-4',
    name: 'Connect 4',
    tagline: 'Tag-team showdown — 2v2. Drop your team\'s discs and connect four.',
    emoji: '🔴',
    category: 'arcade',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 4,
    rules: [
      'Two teams (red vs yellow) take alternating turns.',
      'Teams auto-balance when the host starts the match.',
      'First team to connect four discs in a line wins.',
    ],
    supportsBots: false,
  },
  {
    slug: 'ettt',
    name: 'Endless Tic Tac Toe',
    tagline: 'Tag-team 3x3 with rolling 3-piece team memory. 2v2 chaos.',
    emoji: '✕',
    category: 'arcade',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 4,
    rules: [
      'Two teams (X vs O) alternate placing marks.',
      'Each team only keeps its latest 3 marks — older ones disappear.',
      'First team to line up 3 of their marks wins.',
    ],
    supportsBots: false,
  },
  {
    slug: 'logo',
    name: 'Logo Guesser',
    tagline: 'Silhouette un-blurs round-by-round. Type the brand or pick from four.',
    emoji: '🔎',
    category: 'trivia',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 8,
    rules: [
      'Identify logos before time expires.',
      'Faster and correct answers score more.',
    ],
    supportsBots: false,
  },
  {
    slug: 'landlord',
    name: 'Oga Landlord',
    tagline: 'Naija Monopoly-lite. Roll dice, race round Lagos & Abuja, dodge Kirikiri.',
    emoji: '🏘️',
    category: 'board',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 4,
    rules: [
      'Roll, move, and manage properties.',
      'Collect rent and avoid bankruptcy.',
    ],
    supportsBots: false,
  },
  {
    slug: 'half-half',
    name: 'Half & Half',
    tagline: 'Find the perfect midpoint. Closest cut wins the round.',
    emoji: '✂️',
    category: 'arcade',
    enabled: false,
    minPlayers: 2,
    maxPlayers: 8,
    rules: [
      'Guess the exact halfway point.',
      'Closest guess wins the round bonus.',
    ],
    supportsBots: false,
  },
  {
    slug: 'color-wahala',
    name: 'Color Wahala',
    tagline: 'Stroop-effect speed game. Read the word, ignore the ink. 6-color tap pad.',
    emoji: '🎨',
    category: 'arcade',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 8,
    rules: [
      'Tap the ink color, not the written word.',
      'Speed and accuracy both matter.',
    ],
    supportsBots: false,
  },
  {
    slug: 'hustle',
    name: 'Hustle',
    tagline: 'Naija snakes-and-ladders. Climb come-ups, dodge wahala, japa first.',
    emoji: '🪜',
    category: 'board',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 4,
    rules: [
      'Roll the die and race to square 60.',
      'Ladders are come-ups; snakes are setbacks.',
      'Bumping a player on your square pushes them back.',
      'Hustle cards drip in as you advance — play them tactically.',
    ],
    supportsBots: false,
  },
  {
    slug: 'word-wahala',
    name: 'Word Wahala',
    tagline: 'Naija Scrabble. Pidgin and indigenous words score more.',
    emoji: '🔤',
    category: 'board',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 4,
    rules: [
      'Place tiles to form words across the 15×15 board.',
      'First play must cover the center Jollof star.',
      'Pidgin (1.5×) and indigenous/slang (2×) words score more.',
      'Owambe = triple word, Suya = triple letter.',
    ],
    supportsBots: false,
  },
];

export function getCategoryMeta(id: GameCategory): CategoryMeta | undefined {
  return GAME_CATEGORIES.find((c) => c.id === id);
}

export function getGamesByCategory(id: GameCategory): GameMeta[] {
  return GAME_REGISTRY.filter((g) => g.category === id);
}


const SLUGS = new Set<string>(GAME_REGISTRY.map((g) => g.slug));

export function isSupportedGame(slug: string | undefined | null): slug is GameType {
  return !!slug && SLUGS.has(slug);
}

export function getGameMeta(slug: string | undefined | null): GameMeta | null {
  if (!isSupportedGame(slug)) return null;
  return GAME_REGISTRY.find((g) => g.slug === slug) ?? null;
}

export function isGameEnabled(slug: string | undefined | null): boolean {
  const meta = getGameMeta(slug);
  if (!meta) return false;
  return meta.enabled !== false;
}

/**
 * Heuristic: phone-class device → controller (join);
 * tablet landscape + desktop → display (host).
 * Mirrors the previous global Index logic, now scoped per-game.
 */
export function classifyDeviceForGame(): 'host' | 'join' {
  if (typeof window === 'undefined') return 'join';
  const width = window.innerWidth;
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (isCoarsePointer && width < 1024) return 'join';
  if (width >= 1200) return 'host';
  if (width >= 768 && width < 1200 && isLandscape && isFinePointer) return 'host';
  return 'join';
}
