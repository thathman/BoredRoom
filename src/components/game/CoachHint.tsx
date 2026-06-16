import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Loader2 } from 'lucide-react';
import { LudoState, getMovableTokens } from '@/game/ludoEngine';
import { getHint } from '@/lib/ai';

interface CoachHintProps {
  gameState: LudoState;
  playerId: string;
}

export function CoachHint({ gameState, playerId }: CoachHintProps) {
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myPlayer = gameState.players.find(p => p.id === playerId);
  const movable = gameState.diceValue && isMyTurn
    ? getMovableTokens(currentPlayer, gameState.diceValue)
    : [];

  // Only show when there's an actual choice to make
  if (!isMyTurn || gameState.phase !== 'moving' || movable.length < 2 || !myPlayer) {
    return null;
  }

  const ask = async () => {
    setLoading(true);
    setError(false);
    setHint(null);
    const result = await getHint({
      playerId,
      deviceId: playerId,
      diceValue: gameState.diceValue ?? 0,
      myColor: myPlayer.color,
      myTokens: myPlayer.tokens.map(t => ({ id: t.id, position: t.position })),
      movableTokenIds: movable,
      opponentsSummary: gameState.players
        .filter(p => p.id !== playerId)
        .map(p => ({ color: p.color, tokensHome: p.finishedTokens })),
    });
    setLoading(false);
    if (result) setHint(result);
    else setError(true);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={ask}
        disabled={loading}
        className="w-full min-h-[44px] rounded-xl border border-border bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-center gap-2 text-sm font-display"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Lightbulb className="w-4 h-4 text-accent" />
        )}
        <span>{loading ? 'Thinking…' : 'Ask Coach'}</span>
      </button>
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-3 text-sm leading-snug border border-accent/30"
          >
            <span className="text-accent font-display mr-1">💡</span>
            {hint}
          </motion.div>
        )}
        {error && !hint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground text-center"
          >
            Coach is taking a breather. Try again in a moment.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
