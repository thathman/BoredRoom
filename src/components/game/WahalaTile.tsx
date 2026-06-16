// Scrabble-style bevelled tile for Word Wahala.
// Renders the glyph plus a tiny point-value subscript using design tokens.
// Shared between display board, controller mini-board, and rack.

import { tileDef, type TileLetter } from '../../../shared/src/games/wordwahala/tiles';

interface WahalaTileProps {
  letter: TileLetter;
  /** Override the displayed glyph (e.g. wildcard chose 'a'). */
  wildAs?: string | null;
  /** Visual size in px. Tile scales typography from this. */
  size?: number;
  /** State variant — affects bevel/shadow palette. */
  variant?: 'rack' | 'pending' | 'placed' | 'swap-pick';
  /** Optional click handler — turns the tile into a button. */
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  ariaLabel?: string;
}

const VARIANT_BG: Record<NonNullable<WahalaTileProps['variant']>, string> = {
  rack:        'bg-[hsl(45_88%_78%)] text-[hsl(30_55%_18%)]',
  pending:     'bg-[hsl(150_70%_72%)] text-[hsl(150_60%_15%)]',
  placed:      'bg-[hsl(45_82%_72%)] text-[hsl(30_55%_18%)]',
  'swap-pick': 'bg-[hsl(0_70%_72%)] text-[hsl(0_60%_15%)]',
};

const VARIANT_BEVEL: Record<NonNullable<WahalaTileProps['variant']>, string> = {
  rack:        'shadow-[inset_0_-2px_0_hsl(30_45%_45%/0.5),inset_0_1px_0_hsl(45_100%_92%/0.7),0_2px_3px_hsl(0_0%_0%/0.35)]',
  pending:     'shadow-[inset_0_-2px_0_hsl(150_50%_35%/0.6),inset_0_1px_0_hsl(150_90%_88%/0.8),0_2px_4px_hsl(150_70%_30%/0.4),0_0_0_2px_hsl(150_70%_45%)]',
  placed:      'shadow-[inset_0_-2px_0_hsl(30_45%_45%/0.4),inset_0_1px_0_hsl(45_100%_92%/0.6),0_1px_2px_hsl(0_0%_0%/0.25)]',
  'swap-pick': 'shadow-[inset_0_-2px_0_hsl(0_55%_30%/0.6),inset_0_1px_0_hsl(0_90%_88%/0.7),0_2px_3px_hsl(0_0%_0%/0.3),0_0_0_2px_hsl(0_70%_50%)]',
};

export function WahalaTile({
  letter,
  wildAs,
  size = 44,
  variant = 'rack',
  onClick,
  disabled,
  selected,
  ariaLabel,
}: WahalaTileProps) {
  const def = tileDef(letter);
  const isWild = def.isWild;
  // Wild displays the chosen letter but always with 0 points (and a faint star).
  const displayChar = wildAs
    ? wildAs.toUpperCase()
    : isWild
      ? '★'
      : def.glyph;
  const points = isWild ? 0 : def.points;

  const Tag = onClick ? 'button' : 'div';

  // Type-scale: tile size 44 → 18px main, 9px points
  const mainFontSize = Math.round(size * 0.42);
  const pointsFontSize = Math.max(8, Math.round(size * 0.2));

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? `Tile ${displayChar}${points ? `, ${points} points` : ''}`}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center rounded-md font-display font-bold
        select-none shrink-0 transition
        ${VARIANT_BG[variant]} ${VARIANT_BEVEL[variant]}
        ${selected ? 'scale-110 -translate-y-1 ring-2 ring-primary z-10' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}
      `}
    >
      <span style={{ fontSize: mainFontSize, lineHeight: 1 }} className="tracking-tight">
        {displayChar}
      </span>
      {points > 0 && (
        <span
          aria-hidden="true"
          style={{ fontSize: pointsFontSize }}
          className="absolute bottom-0.5 right-1 font-mono opacity-70"
        >
          {points}
        </span>
      )}
      {isWild && !wildAs && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 left-1 text-[8px] font-mono uppercase tracking-wider opacity-70"
        >
          P
        </span>
      )}
    </Tag>
  );
}
