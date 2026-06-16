// Hand-drawn SVG markers for Hustle board squares.
// Replaces emoji (🪜🐍🛒🇬🇧🇨🇦🇺🇸) with inline strokes that inherit currentColor
// for theme consistency. Sized to slot into the tiny board cells.

interface MarkerProps {
  className?: string;
  size?: number;
}

const baseProps = (size = 14) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
});

export function LadderMark({ size = 14, className }: MarkerProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M7 22 L9 2" />
      <path d="M15 22 L17 2" />
      <path d="M7.6 18 L15.4 18" />
      <path d="M8 14 L16 14" />
      <path d="M8.4 10 L16 10" />
      <path d="M8.7 6 L16.5 6" />
    </svg>
  );
}

export function SnakeMark({ size = 14, className }: MarkerProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M5 4 q6 2 3 7 q-3 5 3 7 q6 2 3 5" />
      <circle cx="5" cy="4" r="1.4" fill="currentColor" stroke="none" />
      <path d="M16 4 q-1 1 -2 0" strokeWidth="1.2" />
    </svg>
  );
}

export function MarketMark({ size = 14, className }: MarkerProps) {
  // Stylised market basket / stall awning
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M3 8 L21 8 L19 20 L5 20 Z" />
      <path d="M8 8 L8 5 a4 4 0 0 1 8 0 L16 8" />
      <path d="M3 8 L5 5 L8 5" strokeWidth="1.2" />
      <path d="M21 8 L19 5 L16 5" strokeWidth="1.2" />
    </svg>
  );
}

export function FlagUkMark({ size = 14, className }: MarkerProps) {
  // Abstract Union Jack — diagonals + cross, no actual flag colours
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="1.5" fill="hsl(var(--primary) / 0.12)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 5 L22 19 M22 5 L2 19" stroke="currentColor" strokeWidth="1" />
      <path d="M12 5 V19 M2 12 H22" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function FlagCaMark({ size = 14, className }: MarkerProps) {
  // Maple-leaf abstraction: vertical bands + a centered diamond
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="1.5" fill="hsl(var(--destructive) / 0.12)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="5" width="5" height="14" fill="currentColor" opacity="0.25" />
      <rect x="17" y="5" width="5" height="14" fill="currentColor" opacity="0.25" />
      <path d="M12 8 L14 11 L17 12 L14 13 L12 16 L10 13 L7 12 L10 11 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FlagUsMark({ size = 14, className }: MarkerProps) {
  // Stripes + star
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="1.5" fill="hsl(45 80% 60% / 0.12)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 8 H22 M2 11 H22 M2 14 H22 M2 17 H22" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
      <rect x="2" y="5" width="9" height="7" fill="currentColor" opacity="0.18" />
      <path d="M6.5 7 L7 8.3 L8.4 8.3 L7.3 9.1 L7.7 10.4 L6.5 9.6 L5.3 10.4 L5.7 9.1 L4.6 8.3 L6 8.3 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
