// Hand-crafted SVG glyphs for each game tile. Uses currentColor so they
// inherit per-card neon accent. No emojis.

import type { GameType } from '@/lib/transport/types';

interface Props {
  slug: GameType;
  className?: string;
}

export function GameGlyph({ slug, className = 'w-16 h-16' }: Props) {
  const common = {
    className,
    viewBox: '0 0 64 64',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (slug) {
    case 'ludo':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="6" y="6" width="52" height="52" rx="6" />
          <path d="M6 32h52M32 6v52" />
          <circle cx="19" cy="19" r="4" fill="currentColor" />
          <circle cx="45" cy="19" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="19" cy="45" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="45" cy="45" r="4" fill="currentColor" />
        </svg>
      );
    case 'whot':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="10" y="6" width="34" height="48" rx="4" transform="rotate(-8 27 30)" />
          <rect x="20" y="10" width="34" height="48" rx="4" transform="rotate(8 37 34)" fill="hsl(var(--background))" />
          <text x="37" y="40" textAnchor="middle" fontFamily="monospace" fontSize="14" fontWeight="700" fill="currentColor" stroke="none">20</text>
        </svg>
      );
    case 'trivia':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="32" cy="32" r="24" />
          <path d="M24 26a8 8 0 1 1 12 7c-2 1-4 3-4 6" />
          <circle cx="32" cy="46" r="2" fill="currentColor" />
        </svg>
      );
    case 'connect-4':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="6" y="10" width="52" height="44" rx="4" />
          <circle cx="18" cy="22" r="4" />
          <circle cx="32" cy="22" r="4" fill="currentColor" />
          <circle cx="46" cy="22" r="4" />
          <circle cx="18" cy="34" r="4" />
          <circle cx="32" cy="34" r="4" fill="currentColor" />
          <circle cx="46" cy="34" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="18" cy="46" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="32" cy="46" r="4" fill="currentColor" />
          <circle cx="46" cy="46" r="4" />
        </svg>
      );
    case 'ettt':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M24 8v48M40 8v48M8 24h48M8 40h48" />
          <path d="M12 12l8 8M20 12l-8 8" />
          <circle cx="32" cy="32" r="5" />
          <path d="M44 44l8 8M52 44l-8 8" />
        </svg>
      );
    case 'logo':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="28" cy="28" r="16" />
          <path d="M40 40l14 14" />
          <path d="M22 28h12M28 22v12" opacity="0.5" />
        </svg>
      );
    case 'landlord':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M10 30L32 12l22 18" />
          <rect x="16" y="30" width="32" height="22" />
          <rect x="26" y="38" width="12" height="14" fill="currentColor" opacity="0.4" />
          <path d="M22 38h4M38 38h4" />
        </svg>
      );
    case 'half-half':
      return (
        <svg {...common} aria-hidden="true">
          <ellipse cx="32" cy="32" rx="22" ry="14" />
          <path d="M32 18v28" strokeDasharray="3 3" />
          <path d="M14 24l4-6M50 24l-4-6" />
        </svg>
      );
    case 'color-wahala':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="22" cy="22" r="10" fill="currentColor" opacity="0.85" />
          <circle cx="42" cy="22" r="10" fill="currentColor" opacity="0.55" />
          <circle cx="32" cy="42" r="10" fill="currentColor" opacity="0.3" />
        </svg>
      );
    case 'hustle':
      // Snakes & ladders + naira sign — the come-up + setback motif.
      return (
        <svg {...common} aria-hidden="true">
          {/* ladder */}
          <path d="M14 54 L26 10" />
          <path d="M22 54 L34 10" />
          <path d="M16 46 L24 46" />
          <path d="M18 38 L26 38" />
          <path d="M20 30 L28 30" />
          <path d="M22 22 L30 22" />
          <path d="M24 14 L32 14" />
          {/* serpent */}
          <path d="M40 12 q10 4 4 12 q-6 8 4 12 q10 4 4 12 q-4 6 4 8" strokeWidth="2.5" />
          <circle cx="40" cy="12" r="2" fill="currentColor" stroke="none" />
          {/* naira */}
          <text x="50" y="56" fontFamily="monospace" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">₦</text>
        </svg>
      );
    case 'word-wahala':
      // Three Scrabble-style tiles spelling implied "WAH" with subtle stack.
      return (
        <svg {...common} aria-hidden="true">
          <rect x="8" y="22" width="16" height="20" rx="2" transform="rotate(-6 16 32)" />
          <rect x="24" y="20" width="16" height="20" rx="2" />
          <rect x="40" y="22" width="16" height="20" rx="2" transform="rotate(6 48 32)" />
          <text x="16" y="36" fontFamily="monospace" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle" transform="rotate(-6 16 32)">W</text>
          <text x="32" y="34" fontFamily="monospace" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">A</text>
          <text x="48" y="36" fontFamily="monospace" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle" transform="rotate(6 48 32)">H</text>
          {/* tiny point markers */}
          <circle cx="22" cy="40" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="38" cy="38" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden="true">
          <rect x="10" y="10" width="44" height="44" rx="6" />
        </svg>
      );
  }
}
