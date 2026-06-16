import { motion } from 'framer-motion';

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

interface DiceProps {
  value: number | null;
  rolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Dice({ value, rolling, size = 'md' }: DiceProps) {
  const sizeMap = { sm: 48, md: 80, lg: 120 };
  const dotSizeMap = { sm: 8, md: 12, lg: 18 };
  const s = sizeMap[size];
  const dotSize = dotSizeMap[size];
  const cellSize = (s - 16) / 3;

  const dots = value ? DICE_DOTS[value] : [];

  return (
    <motion.div
      animate={rolling ? { rotateX: [0, 360], rotateY: [0, 360] } : { rotateX: 0, rotateY: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="rounded-xl neon-box"
      style={{
        width: s,
        height: s,
        background: 'hsl(var(--card))',
        border: '2px solid hsl(var(--neon-glow) / 0.4)',
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${cellSize}px)`,
        gridTemplateRows: `repeat(3, ${cellSize}px)`,
        padding: 8,
        placeItems: 'center',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const hasDot = dots.some(([r, c]) => r === row && c === col);
        return (
          <div
            key={i}
            style={{
              width: hasDot ? dotSize : 0,
              height: hasDot ? dotSize : 0,
              borderRadius: '50%',
              background: hasDot ? 'hsl(var(--primary))' : 'transparent',
              boxShadow: hasDot ? '0 0 8px hsl(var(--neon-glow) / 0.6)' : 'none',
              transition: 'all 0.3s',
            }}
          />
        );
      })}
    </motion.div>
  );
}
