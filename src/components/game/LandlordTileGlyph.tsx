// Hand-drawn SVG glyphs for Oga Landlord property tiles.
// Replaces emoji (🏚️ 🏘️ 🏬 🏙️ 🏛️ 🏨 🌴 🏝️ 🚆 ⚡ 🎉 🟢 🎁 🧾 ⚠️ 🔒) so tiles
// inherit theme colour and stay crisp on tiny board cells.

import type { LandlordTile, LandlordGroup } from '@/lib/landlordBoard';

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
});

interface Props {
  tile: Pick<LandlordTile, 'id' | 'type' | 'group' | 'name'>;
  size?: number;
  className?: string;
}

/** Special-case glyphs by tile id (corners, taxes, chance, community). */
function specialGlyph(id: number, size: number, className?: string) {
  switch (id) {
    case 0: // GO
      return (
        <svg {...baseProps(size)} className={className}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 9h4M11 9v6M15 9v6M13 12h2" />
        </svg>
      );
    case 10: // Just Visiting / Jail
      return (
        <svg {...baseProps(size)} className={className}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 4v16M12 4v16M16 4v16" />
        </svg>
      );
    case 20: // Free Parking
      return (
        <svg {...baseProps(size)} className={className}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 16V8h4a3 3 0 0 1 0 6H9" />
        </svg>
      );
    case 30: // Go to Jail
      return (
        <svg {...baseProps(size)} className={className}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 4v16M16 4v16" />
          <path d="M9 13l3 3 3-5" strokeWidth="1.4" />
        </svg>
      );
    case 4:  // Income Tax
    case 38: // Luxury Tax
      return (
        <svg {...baseProps(size)} className={className}>
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    default:
      return null;
  }
}

/** Group-driven house silhouette (varying roofs/heights). */
function groupGlyph(group: LandlordGroup, size: number, className?: string) {
  const props = baseProps(size);
  switch (group) {
    case 'brown': // shanty / face-me-i-face-you
      return (
        <svg {...props} className={className}>
          <path d="M3 20h18M5 20V11l7-5 7 5v9" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'light-blue': // duplex
      return (
        <svg {...props} className={className}>
          <path d="M3 20h18M5 20v-9l5-3 5 3M14 11l5-3M19 8v12" />
          <path d="M8 20v-4h3v4M16 20v-4h2v4" />
        </svg>
      );
    case 'purple': // shop / store
      return (
        <svg {...props} className={className}>
          <path d="M4 9h16l-1 11H5z" />
          <path d="M4 9l2-4h12l2 4" />
          <path d="M10 14h4v6h-4z" />
        </svg>
      );
    case 'orange': // mid-rise
      return (
        <svg {...props} className={className}>
          <path d="M4 20V8l8-5 8 5v12" />
          <path d="M9 20v-5h6v5" />
          <path d="M9 11h2M13 11h2" />
        </svg>
      );
    case 'red': // institution / colonnade
      return (
        <svg {...props} className={className}>
          <path d="M3 20h18M4 10h16l-2-3H6z" />
          <path d="M6 20v-9M10 20v-9M14 20v-9M18 20v-9" />
        </svg>
      );
    case 'yellow': // hotel
      return (
        <svg {...props} className={className}>
          <path d="M3 20h18M5 20V8h14v12" />
          <path d="M8 12h2M14 12h2M8 16h2M14 16h2" />
          <path d="M11 20v-3h2v3" />
        </svg>
      );
    case 'green': // beachfront / palms
      return (
        <svg {...props} className={className}>
          <path d="M3 21h18" />
          <path d="M12 21V9" />
          <path d="M12 9q-4-3-7-1M12 9q4-3 7-1M12 9q-2-4-5-4M12 9q2-4 5-4" />
        </svg>
      );
    case 'blue': // luxury island
      return (
        <svg {...props} className={className}>
          <path d="M2 20q3-2 6-2t6 2 6-2" />
          <path d="M9 18V6l4-2 4 2v12" />
          <path d="M11 18v-3h2v3" />
        </svg>
      );
    case 'railroad': // train
      return (
        <svg {...props} className={className}>
          <rect x="4" y="6" width="16" height="10" rx="1.5" />
          <circle cx="8" cy="18" r="1.5" />
          <circle cx="16" cy="18" r="1.5" />
          <path d="M4 11h16M9 9h6" />
        </svg>
      );
    case 'utility': // bolt
      return (
        <svg {...props} className={className}>
          <path d="M13 3L5 14h6l-2 7 8-11h-6z" fill="currentColor" stroke="none" opacity="0.85" />
        </svg>
      );
    case 'special': // gift / chance — generic spark
      return (
        <svg {...props} className={className}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />
        </svg>
      );
    case 'corner':
      return (
        <svg {...props} className={className}>
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      );
  }
}

export function LandlordTileGlyph({ tile, size = 14, className }: Props) {
  const special = specialGlyph(tile.id, size, className);
  if (special) return special;
  return groupGlyph(tile.group, size, className) ?? (
    <svg {...baseProps(size)} className={className}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

/** Compact hotel glyph used when a property is fully developed (5 houses). */
export function HotelGlyph({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="9" width="18" height="12" rx="1" />
      <path d="M3 9l3-4h12l3 4" />
      <path d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2M15 17h2" />
    </svg>
  );
}
