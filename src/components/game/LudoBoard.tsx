import { motion, AnimatePresence } from 'framer-motion';
import { LudoState, getBoardPosition, SAFE_ZONES, MAIN_PATH, PlayerColor } from '@/game/ludoEngine';

interface LudoBoardProps {
  gameState: LudoState;
  isDisplay?: boolean;
}

const COLOR_MAP: Record<PlayerColor, string> = {
  red: 'hsl(var(--player-red))',
  green: 'hsl(var(--player-green))',
  yellow: 'hsl(var(--player-yellow))',
  blue: 'hsl(var(--player-blue))',
};

const BG_COLOR_MAP: Record<PlayerColor, string> = {
  red: 'hsl(0 80% 55% / 0.15)',
  green: 'hsl(140 70% 45% / 0.15)',
  yellow: 'hsl(45 100% 55% / 0.15)',
  blue: 'hsl(210 80% 55% / 0.15)',
};

export function LudoBoard({ gameState, isDisplay = false }: LudoBoardProps) {
  const size = isDisplay ? 600 : 320;
  const cellSize = size / 15;
  const tokenSize = cellSize * 0.6;

  return (
    <div
      className="relative rounded-2xl neon-box overflow-hidden"
      style={{
        width: size,
        height: size,
        background: 'hsl(var(--card))',
        border: '2px solid hsl(var(--border))',
      }}
    >
      {/* Base areas */}
      <BaseArea color="red" cellSize={cellSize} x={0} y={0} />
      <BaseArea color="green" cellSize={cellSize} x={9} y={0} />
      <BaseArea color="yellow" cellSize={cellSize} x={9} y={9} />
      <BaseArea color="blue" cellSize={cellSize} x={0} y={9} />

      {/* Center home triangle */}
      <div
        className="absolute"
        style={{
          left: 6 * cellSize,
          top: 6 * cellSize,
          width: 3 * cellSize,
          height: 3 * cellSize,
          background: 'hsl(var(--muted))',
          border: '1px solid hsl(var(--border))',
        }}
      />

      {/* Main path cells */}
      {MAIN_PATH.map((pos, i) => (
        <div
          key={`path-${i}`}
          className="absolute"
          style={{
            left: pos.x * cellSize,
            top: pos.y * cellSize,
            width: cellSize,
            height: cellSize,
            background: SAFE_ZONES.includes(i)
              ? 'hsl(var(--neon-glow) / 0.1)'
              : 'hsl(var(--muted) / 0.3)',
            border: '0.5px solid hsl(var(--border) / 0.3)',
          }}
        >
          {SAFE_ZONES.includes(i) && (
            <div className="w-full h-full flex items-center justify-center text-xs opacity-40">★</div>
          )}
        </div>
      ))}

      {/* Home stretch cells */}
      {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map(color =>
        Array.from({ length: 6 }, (_, step) => {
          const pos = getHomeStretchPos(color, step);
          return (
            <div
              key={`hs-${color}-${step}`}
              className="absolute"
              style={{
                left: pos.x * cellSize,
                top: pos.y * cellSize,
                width: cellSize,
                height: cellSize,
                background: BG_COLOR_MAP[color],
                border: '0.5px solid hsl(var(--border) / 0.3)',
              }}
            />
          );
        })
      )}

      {/* Tokens */}
      <AnimatePresence>
        {gameState.players.map(player =>
          player.tokens.map((token, tokenIdx) => {
            const pos = getBoardPosition(player.color, token.position);
            // Offset tokens in same position
            const offset = tokenIdx * (tokenSize * 0.3);
            
            // For base tokens, arrange in a 2x2 grid
            let baseOffsetX = 0;
            let baseOffsetY = 0;
            if (token.position === -1) {
              baseOffsetX = (tokenIdx % 2) * cellSize * 1.5;
              baseOffsetY = Math.floor(tokenIdx / 2) * cellSize * 1.5;
            }

            return (
              <motion.div
                key={`${player.color}-${token.id}`}
                layout
                initial={{ scale: 0 }}
                animate={{
                  scale: 1,
                  left: pos.x * cellSize + (cellSize - tokenSize) / 2 + (token.position === -1 ? baseOffsetX : 0),
                  top: pos.y * cellSize + (cellSize - tokenSize) / 2 + (token.position === -1 ? baseOffsetY : 0),
                }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="absolute rounded-full"
                style={{
                  width: tokenSize,
                  height: tokenSize,
                  background: COLOR_MAP[player.color],
                  boxShadow: `0 0 10px ${COLOR_MAP[player.color]}80`,
                  border: '2px solid hsl(var(--foreground) / 0.3)',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: tokenSize * 0.4,
                  fontWeight: 'bold',
                  color: 'hsl(var(--background))',
                }}
              >
                {token.position === 58 ? '★' : token.id + 1}
              </motion.div>
            );
          })
        )}
      </AnimatePresence>
    </div>
  );
}

function BaseArea({ color, cellSize, x, y }: { color: PlayerColor; cellSize: number; x: number; y: number }) {
  return (
    <div
      className="absolute rounded-lg"
      style={{
        left: x * cellSize,
        top: y * cellSize,
        width: 6 * cellSize,
        height: 6 * cellSize,
        background: BG_COLOR_MAP[color],
        border: `1px solid ${COLOR_MAP[color]}40`,
      }}
    />
  );
}

function getHomeStretchPos(color: PlayerColor, step: number): { x: number; y: number } {
  const stretches: Record<PlayerColor, { x: number; y: number }[]> = {
    red: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }],
    green: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }],
    yellow: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }],
    blue: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }],
  };
  return stretches[color][step];
}
