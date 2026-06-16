import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { LudoState, getMovableTokensForChoice, DieChoice } from '@/game/ludoEngine';
import { ReactionBar, ReactionAckEvent } from '@/components/game/Reactions';
import { ReactionPolicy, TauntPolicy } from '@/lib/transport/types';
import { CoachHint } from '@/components/game/CoachHint';
import { vibrate, sounds } from '@/lib/sounds';
import { toast } from 'sonner';
import { SoundControls } from '@/components/system/SoundControls';
import type { PauseState } from '@/lib/transport/types';

interface PlayerControllerProps {
  gameState: LudoState;
  playerId: string;
  onAction: (type: string, data?: { tokenId?: number; dieChoice?: DieChoice }) => void;
  onReact: (emoji: string, clientNonce?: string) => void;
  syncPending?: boolean;
  reactionPolicy?: ReactionPolicy;
  tauntPolicy?: TauntPolicy;
  onReactionAck?: (fn: (ack: ReactionAckEvent) => void) => () => void;
  onRequestPause?: () => void;
  onResume?: () => void;
  onRequestLeave?: () => void;
  pauseState?: PauseState;
}

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function StaticDie({ value, dim }: { value: number; dim?: boolean }) {
  const dots = DICE_DOTS[value] ?? [];
  return (
    <div
      className="rounded-lg"
      style={{
        width: 56,
        height: 56,
        background: 'hsl(var(--card))',
        border: '2px solid hsl(var(--border))',
        padding: 6,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        placeItems: 'center',
        opacity: dim ? 0.35 : 1,
        transition: 'opacity 0.2s',
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
              width: has ? 9 : 0,
              height: has ? 9 : 0,
              borderRadius: '50%',
              background: has ? 'hsl(var(--primary))' : 'transparent',
            }}
          />
        );
      })}
    </div>
  );
}

export function PlayerController({
  gameState,
  playerId,
  onAction,
  onReact,
  syncPending = false,
  reactionPolicy,
  tauntPolicy,
  onReactionAck,
  onRequestPause,
  onResume,
  onRequestLeave,
  pauseState,
}: PlayerControllerProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myPlayer = gameState.players.find(p => p.id === playerId);

  // Surface skip / forfeit reasons.
  const lastSeenAction = useRef<string | undefined>(undefined);
  useEffect(() => {
    const action = gameState.lastAction;
    if (!action || action === lastSeenAction.current) return;
    lastSeenAction.current = action;
    const lower = action.toLowerCase();
    if (
      lower.includes('no valid move') ||
      lower.includes('no moves') ||
      lower.includes('forfeited') ||
      lower.includes('3 sixes')
    ) {
      toast(action, { duration: 3500 });
    }
  }, [gameState.lastAction]);

  const dice = gameState.dice;
  const remaining = gameState.diceRemaining ?? [];

  // Build per-die move groups from remaining values.
  const groups: { choice: DieChoice; value: number; tokenIds: number[] }[] = [];
  if (dice && isMyTurn && gameState.phase === 'moving' && currentPlayer) {
    const [d1, d2] = dice;
    if (remaining.includes(d1)) {
      groups.push({ choice: 'd1', value: d1, tokenIds: getMovableTokensForChoice(gameState, currentPlayer, d1, 'd1') });
    }
    // d2: if d1===d2, skip duplicate row (the d1 row already covers same value).
    if (d1 !== d2 && remaining.includes(d2)) {
      groups.push({ choice: 'd2', value: d2, tokenIds: getMovableTokensForChoice(gameState, currentPlayer, d2, 'd2') });
    }
    if (remaining.length === 2) {
      groups.push({ choice: 'sum', value: d1 + d2, tokenIds: getMovableTokensForChoice(gameState, currentPlayer, d1 + d2, 'sum') });
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        {/* Status */}
        <div className="text-center">
          {isMyTurn ? (
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-2">
              <div className="text-4xl font-display font-bold neon-text">YOUR TURN</div>
              <p className="text-muted-foreground">
                {gameState.phase === 'rolling' ? 'Tap to roll the dice' : 'Pick a token to move'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              <div className="text-2xl font-display text-muted-foreground">Waiting...</div>
              <p className="text-lg font-display" style={{ color: getColorHsl(currentPlayer?.color) }}>
                {currentPlayer?.displayName} is playing
              </p>
            </div>
          )}
        </div>

        {/* Static dice result card */}
        {dice && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${gameState.turnNumber}-${dice[0]}-${dice[1]}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-2xl p-4 flex flex-col items-center gap-3"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {isMyTurn ? 'You rolled' : 'Roll'}
              </div>
              <div className="flex items-center gap-3">
                <StaticDie value={dice[0]} dim={!remaining.includes(dice[0])} />
                <span className="text-2xl font-display font-bold text-muted-foreground">+</span>
                <StaticDie value={dice[1]} dim={dice[0] !== dice[1] ? !remaining.includes(dice[1]) : remaining.length < 2} />
                <span className="text-2xl font-display font-bold text-muted-foreground">=</span>
                <span className="text-3xl font-display font-bold neon-text tabular-nums">
                  {dice[0] + dice[1]}
                </span>
              </div>
              {remaining.length > 0 && gameState.phase === 'moving' && (
                <div className="text-[11px] text-muted-foreground">
                  Remaining to play: {remaining.join(', ')}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {syncPending && (
          <p className="text-xs text-muted-foreground font-display text-center">Syncing turn…</p>
        )}

        {/* Actions */}
        {isMyTurn && gameState.phase === 'rolling' && (
          <motion.button
            whileTap={syncPending ? undefined : { scale: 0.95 }}
            whileHover={syncPending ? undefined : { scale: 1.02 }}
            disabled={syncPending}
            onClick={() => { if (syncPending) return; vibrate(30); sounds.click(); onAction('roll_dice'); }}
            className="w-full min-h-[80px] text-2xl font-display font-bold rounded-2xl bg-primary text-primary-foreground active:bg-primary/80 transition-colors neon-box disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎲 ROLL
          </motion.button>
        )}

        {isMyTurn && gameState.phase === 'moving' && groups.length > 0 && (
          <div className="space-y-4">
            {groups.map((g) =>
              g.tokenIds.length === 0 ? null : (
                <div key={g.choice} className="space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Move with {g.choice === 'sum' ? 'sum' : g.choice === 'd1' ? 'die 1' : 'die 2'}</span>
                    <span className="px-2 py-0.5 rounded-md bg-muted font-display font-bold text-foreground tabular-nums">
                      {g.value}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {g.tokenIds.map((tokenId) => {
                      const token = myPlayer?.tokens[tokenId];
                      const label = token && token.position === -1
                        ? 'Leave Base'
                        : `Token ${tokenId + 1}`;
                      return (
                        <motion.button
                          key={`${g.choice}-${tokenId}`}
                          whileTap={syncPending ? undefined : { scale: 0.95 }}
                          disabled={syncPending}
                          onClick={() => {
                            if (syncPending) return;
                            vibrate(20);
                            sounds.click();
                            onAction('move_token', { tokenId, dieChoice: g.choice });
                          }}
                          className="min-h-[60px] text-base font-display font-bold rounded-xl bg-muted text-foreground hover:bg-muted/80 active:scale-95 transition-all border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* My tokens status */}
        {myPlayer && (
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Your tokens</span>
              <span className="text-sm font-display" style={{ color: getColorHsl(myPlayer.color) }}>
                {myPlayer.color.toUpperCase()}
              </span>
            </div>
            <div className="flex gap-3 justify-center">
              {myPlayer.tokens.map(token => (
                <div
                  key={token.id}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: getColorHsl(myPlayer.color),
                    color: 'hsl(var(--background))',
                    opacity: token.position === 58 ? 0.4 : 1,
                  }}
                >
                  {token.position === -1 ? '🏠' : token.position === 58 ? '★' : token.id + 1}
                </div>
              ))}
            </div>
          </div>
        )}

        <CoachHint gameState={gameState} playerId={playerId} />

        <div className="grid grid-cols-2 gap-2">
          <ButtonLike
            onClick={pauseState?.paused ? onResume : onRequestPause}
            label={pauseState?.paused ? 'Resume' : 'Pause'}
          />
          <ButtonLike onClick={onRequestLeave} label="Leave" />
        </div>

        <SoundControls />

        <ReactionBar onReact={onReact} reactionPolicy={reactionPolicy} tauntPolicy={tauntPolicy} onReactionAck={onReactionAck} />
      </motion.div>
    </div>
  );
}

function ButtonLike({ onClick, label }: { onClick?: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-xl border border-border bg-card/70 px-3 py-3 text-sm font-display font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function getColorHsl(color?: string): string {
  const map: Record<string, string> = {
    red: 'hsl(0, 80%, 55%)',
    green: 'hsl(140, 70%, 45%)',
    yellow: 'hsl(45, 100%, 55%)',
    blue: 'hsl(210, 80%, 55%)',
  };
  return map[color || ''] || 'hsl(var(--foreground))';
}
