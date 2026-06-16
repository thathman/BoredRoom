import type { WhotCard as WhotCardType, WhotShape } from '@/lib/transport/types';
import { motion } from 'framer-motion';

interface WhotCardProps {
  card: WhotCardType;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  highlight?: 'none' | 'legal' | 'blocked';
}

const SHAPE_LABEL: Record<WhotShape, string> = {
  circle: 'Circle',
  triangle: 'Triangle',
  cross: 'Cross',
  square: 'Square',
  star: 'Star',
  whot: 'Whot',
};

const SIZE: Record<NonNullable<WhotCardProps['size']>, { w: number; h: number; v: string; seal: string; corner: string; center: string }> = {
  sm: { w: 52, h: 74, v: 'text-sm', seal: 'text-[7px]', corner: 'h-2 w-2', center: 'h-7 w-7' },
  md: { w: 72, h: 104, v: 'text-xl', seal: 'text-[8px]', corner: 'h-2.5 w-2.5', center: 'h-10 w-10' },
  lg: { w: 104, h: 148, v: 'text-3xl', seal: 'text-[10px]', corner: 'h-3.5 w-3.5', center: 'h-16 w-16' },
};

export function WhotCardView({
  card,
  size = 'md',
  onClick,
  disabled,
  selected,
  highlight = 'none',
}: WhotCardProps) {
  const dims = SIZE[size];
  const interactive = !!onClick && !disabled;
  const isWhot = card.isWhot;

  const highlightClass =
    highlight === 'legal'
      ? 'ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_8px_20px_hsl(var(--primary)/0.2)]'
      : highlight === 'blocked'
        ? 'ring-2 ring-destructive/60 opacity-80'
        : 'ring-1 ring-whot-ink/40';

  return (
    <motion.button
      type="button"
      whileTap={interactive ? { scale: 0.93 } : undefined}
      whileHover={interactive ? { y: -4 } : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-label={`${SHAPE_LABEL[card.shape]} ${card.value}${isWhot ? ' wildcard' : ''}`}
      className={`relative overflow-hidden rounded-lg flex flex-col items-center justify-between border border-whot-ink/50 bg-whot-paper p-2 font-display font-bold text-whot-red shadow-[0_8px_18px_hsl(var(--background)/0.35)] transition-all ${
        interactive ? 'cursor-pointer' : 'cursor-default'
      } ${disabled ? 'opacity-50' : ''} ${selected ? 'ring-2 ring-primary' : highlightClass}`}
      style={{ width: dims.w, height: dims.h }}
    >
      <Corner value={card.value} shape={card.shape} isWhot={isWhot} className="self-start" textClass={dims.v} shapeClass={dims.corner} />
      <div className="absolute inset-[24%] flex items-center justify-center">
        <div className={dims.center}>
          {isWhot ? <WhotSeal /> : <ShapeMark shape={card.shape} />}
        </div>
      </div>
      <Corner value={card.value} shape={card.shape} isWhot={isWhot} className="self-end rotate-180" textClass={dims.v} shapeClass={dims.corner} />
      {isWhot && (
        <span className={`absolute inset-x-0 bottom-1 text-center uppercase tracking-wide text-whot-red ${dims.seal}`}>
          WHOT 20
        </span>
      )}
    </motion.button>
  );
}

function Corner({
  value,
  shape,
  isWhot,
  className,
  textClass,
  shapeClass,
}: {
  value: number;
  shape: WhotShape;
  isWhot: boolean;
  className: string;
  textClass: string;
  shapeClass: string;
}) {
  return (
    <span className={`z-10 flex flex-col items-center leading-none ${className}`}>
      <span className={`${textClass} leading-none`}>{value}</span>
      {isWhot ? (
        <span className="mt-0.5 text-[7px] tracking-wide uppercase">WHOT</span>
      ) : (
        <span className={`mt-0.5 ${shapeClass}`}>
          <ShapeMark shape={shape} />
        </span>
      )}
    </span>
  );
}

function ShapeMark({ shape }: { shape: WhotShape }) {
  if (shape === 'whot') return <StarSvg />;
  if (shape === 'circle') return <CircleSvg />;
  if (shape === 'triangle') return <TriangleSvg />;
  if (shape === 'cross') return <CrossSvg />;
  if (shape === 'square') return <SquareSvg />;
  return <StarSvg />;
}

function CircleSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <circle cx="50" cy="50" r="40" fill="hsl(var(--whot-red))" />
    </svg>
  );
}

function TriangleSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <path d="M50 10 92 86H8Z" fill="hsl(var(--whot-red))" />
    </svg>
  );
}

function CrossSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <path d="M37 8h26v29h29v26H63v29H37V63H8V37h29Z" fill="hsl(var(--whot-red))" />
    </svg>
  );
}

function SquareSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <path d="M18 18h64v64H18Z" fill="hsl(var(--whot-red))" />
    </svg>
  );
}

function StarSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <path
        d="m50 8 12.7 25.7 28.3 4.1-20.5 20 4.8 28.2L50 72.7 24.7 86l4.8-28.2L9 37.8l28.3-4.1Z"
        fill="hsl(var(--whot-red))"
      />
    </svg>
  );
}

function WhotSeal() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <circle cx="50" cy="50" r="40" fill="hsl(var(--whot-red))" />
        <circle cx="50" cy="22" r="6" fill="hsl(var(--whot-red))" />
        <circle cx="78" cy="50" r="6" fill="hsl(var(--whot-red))" />
        <circle cx="50" cy="78" r="6" fill="hsl(var(--whot-red))" />
        <circle cx="22" cy="50" r="6" fill="hsl(var(--whot-red))" />
      </svg>
      <span className="absolute rounded-full border border-whot-paper/80 bg-whot-paper px-2 py-0.5 text-[9px] uppercase tracking-wide leading-none text-whot-red shadow-sm">
        WHOT
      </span>
    </div>
  );
}

export function WhotCardBack({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = SIZE[size];
  return (
    <div
      className="relative overflow-hidden rounded-md border border-whot-ink/50 bg-whot-red ring-1 ring-border shadow-[0_8px_18px_hsl(var(--background)/0.35)]"
      style={{ width: dims.w, height: dims.h }}
    >
      <div className="absolute inset-2 rounded-sm border border-whot-paper/60" />
      <div className="absolute inset-3 grid grid-cols-2 gap-1 opacity-85">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="text-center text-[8px] font-display font-bold tracking-wide uppercase text-whot-paper/80">
            WHOT
          </span>
        ))}
      </div>
      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-[10px] font-bold uppercase tracking-[0.2em] text-whot-paper">
        WHOT WHOT
      </span>
    </div>
  );
}
