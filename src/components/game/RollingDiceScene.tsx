import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

interface RollingDiceSceneProps {
  dice: [number, number] | null;
  turnNumber: number;
}

const FACE_ROTATIONS: { rx: number; ry: number }[] = [
  { rx: 0, ry: 0 },     // 1 — front
  { rx: 0, ry: 180 },   // 2 — back
  { rx: 0, ry: -90 },   // 3 — right
  { rx: 0, ry: 90 },    // 4 — left
  { rx: -90, ry: 0 },   // 5 — top
  { rx: 90, ry: 0 },    // 6 — bottom
];

const DIE_SIZE = 96;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function DieFace({ value }: { value: number }) {
  const dots = DICE_DOTS[value] ?? [];
  const cell = (DIE_SIZE - 16) / 3;
  return (
    <div
      style={{
        width: DIE_SIZE,
        height: DIE_SIZE,
        background: 'hsl(var(--card))',
        border: '2px solid hsl(var(--neon-glow) / 0.6)',
        borderRadius: 14,
        padding: 8,
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${cell}px)`,
        gridTemplateRows: `repeat(3, ${cell}px)`,
        placeItems: 'center',
        boxShadow: '0 0 20px hsl(var(--neon-glow) / 0.5), inset 0 0 12px hsl(var(--neon-glow) / 0.15)',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const has = dots.some(([dr, dc]) => dr === r && dc === c);
        return (
          <div
            key={i}
            style={{
              width: has ? 14 : 0,
              height: has ? 14 : 0,
              borderRadius: '50%',
              background: has ? 'hsl(var(--primary))' : 'transparent',
              boxShadow: has ? '0 0 10px hsl(var(--primary) / 0.8)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

function Die3D({ value }: { value: number }) {
  // Render all 6 faces in a 3D cube, rotated so `value` is forward.
  const target = FACE_ROTATIONS[(value - 1) % 6];
  const half = DIE_SIZE / 2;
  return (
    <div
      style={{
        width: DIE_SIZE,
        height: DIE_SIZE,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${-target.rx}deg) rotateY(${-target.ry}deg)`,
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((face) => {
        const rot = FACE_ROTATIONS[face - 1];
        return (
          <div
            key={face}
            style={{
              position: 'absolute',
              inset: 0,
              transform: `rotateX(${rot.rx}deg) rotateY(${rot.ry}deg) translateZ(${half}px)`,
              backfaceVisibility: 'hidden',
            }}
          >
            <DieFace value={face} />
          </div>
        );
      })}
    </div>
  );
}

export function RollingDiceScene({ dice, turnNumber }: RollingDiceSceneProps) {
  const [visible, setVisible] = useState(false);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const key = dice ? `${turnNumber}-${dice[0]}-${dice[1]}` : 'idle';

  useEffect(() => {
    if (!dice) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), reduced ? 1800 : 2400);
    return () => clearTimeout(t);
  }, [key, dice, reduced]);

  if (!dice) return null;
  const [d1, d2] = dice;
  const sum = d1 + d2;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
          style={{ perspective: 800 }}
        >
          {/* Backdrop dim */}
          <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />

          <div className="relative flex flex-col items-center gap-6">
            <div className="flex items-center gap-10" style={{ perspective: 800 }}>
              <motion.div
                initial={reduced ? { opacity: 0 } : { x: '-60vw', y: -120, rotate: -180, opacity: 0 }}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : {
                        x: 0,
                        y: [0, -40, 0, -20, 0],
                        rotate: 720,
                        opacity: 1,
                      }
                }
                transition={
                  reduced
                    ? { duration: 0.3 }
                    : { duration: 1.4, ease: [0.16, 0.84, 0.3, 1], times: [0, 0.3, 0.55, 0.75, 1] }
                }
              >
                <Die3D value={d1} />
              </motion.div>
              <motion.div
                initial={reduced ? { opacity: 0 } : { x: '60vw', y: -160, rotate: 180, opacity: 0 }}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : {
                        x: 0,
                        y: [0, -50, 0, -15, 0],
                        rotate: -720,
                        opacity: 1,
                      }
                }
                transition={
                  reduced
                    ? { duration: 0.3, delay: 0.05 }
                    : { duration: 1.5, delay: 0.08, ease: [0.16, 0.84, 0.3, 1], times: [0, 0.3, 0.55, 0.75, 1] }
                }
              >
                <Die3D value={d2} />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: reduced ? 0.2 : 1.5, duration: 0.4, type: 'spring', stiffness: 200 }}
              className="px-6 py-3 rounded-2xl glass neon-box"
            >
              <span className="font-display text-2xl md:text-3xl font-bold neon-text tabular-nums">
                Rolled {d1} + {d2} = {sum}
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
