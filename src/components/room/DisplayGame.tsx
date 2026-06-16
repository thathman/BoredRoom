import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef } from 'react';
import { RoomState, AIStatus, PendingJoinRequest } from '@/lib/realtimeRoom';
import { LudoBoard } from '@/components/game/LudoBoard';
import { RollingDiceScene } from '@/components/game/RollingDiceScene';
import { CommentaryTicker } from '@/components/game/CommentaryTicker';
import { AIStatusChip } from '@/components/game/AIStatusChip';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { HostReactionPanel } from '@/components/room/HostReactionPanel';
import { ReactionPolicy, ReactionStats, TauntPolicy } from '@/lib/transport/types';

interface DisplayGameProps {
  roomState: RoomState;
  onReact?: (emoji: string) => void;
  commentaryLine?: string | null;
  presenceMap?: Record<string, number>;
  aiStatus?: AIStatus;
  transportKind?: 'supabase' | 'supabase-fallback' | 'colyseus';
  onApproveJoin?: (requestId: string, mode: 'spectator' | 'transfer' | 'spawn', targetSeatId?: string) => void;
  onRejectJoin?: (requestId: string) => void;
  onReplaceBotWithHuman?: (botId: string, humanDeviceId: string) => void;
  reactionPolicy?: ReactionPolicy;
  tauntPolicy?: TauntPolicy;
  reactionStats?: ReactionStats;
  rendererMode?: string;
  onSetReactionPolicy?: (policy: Partial<ReactionPolicy>) => void;
  onSetTauntPolicy?: (policy: Partial<TauntPolicy>) => void;
  onClearReactions?: () => void;
  onPauseGame?: () => void;
  onEndGame?: () => void;
}

export function DisplayGame({
  roomState,
  commentaryLine,
  presenceMap = {},
  aiStatus = 'active',
  transportKind = 'supabase',
  onApproveJoin,
  onRejectJoin,
  onReplaceBotWithHuman,
  reactionPolicy,
  tauntPolicy,
  reactionStats,
  rendererMode,
  onSetReactionPolicy,
  onSetTauntPolicy,
  onClearReactions,
  onPauseGame,
  onEndGame,
}: DisplayGameProps) {
  const gameState = roomState.gameState!;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const gameSlug = (roomState as { gameType?: string }).gameType ?? 'ludo';
  const joinUrl = `${window.location.origin}/${gameSlug}/join/${roomState.code}`;

  // Surface no-valid-move / 3-sixes / skip on the public display too.
  const lastSeenActionRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const action = gameState.lastAction;
    if (!action || action === lastSeenActionRef.current) return;
    lastSeenActionRef.current = action;
    const lower = action.toLowerCase();
    if (
      lower.includes('no valid move') ||
      lower.includes('no moves') ||
      lower.includes('3 sixes') ||
      lower.includes('three sixes') ||
      lower.includes('turn skipped')
    ) {
      toast(action, { duration: 3500 });
    }
  }, [gameState.lastAction]);

  // Toast on each new pending join request (Colyseus only).
  const seenRequestIdsRef = useRef<Set<string>>(new Set());
  const pending: PendingJoinRequest[] = useMemo(
    () => roomState.pendingJoinRequests ?? [],
    [roomState.pendingJoinRequests],
  );
  useEffect(() => {
    if (transportKind !== 'colyseus') return;
    for (const req of pending) {
      if (seenRequestIdsRef.current.has(req.id)) continue;
      seenRequestIdsRef.current.add(req.id);
      toast(`${req.displayName} wants to join`, { duration: 4000 });
    }
  }, [pending, transportKind]);

  const seatsAvailable = gameState.players.length < 4;
  const botSeats = roomState.members.filter((m) => m.isBot);
  void onReplaceBotWithHuman;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6 relative bg-[radial-gradient(ellipse_at_top,_hsl(160_60%_10%/0.14),transparent_46%),radial-gradient(ellipse_at_bottom,_hsl(220_60%_10%/0.2),transparent_52%)]">
      {/* Persistent in-game join affordance — latecomers & reconnects */}
      <div className="fixed top-4 right-4 z-30 glass rounded-2xl p-3 flex items-center gap-3 shadow-lg">
        <div className="bg-background/80 rounded-lg p-1.5">
          <QRCodeSVG
            value={joinUrl}
            size={64}
            bgColor="transparent"
            fgColor="hsl(160, 100%, 50%)"
            level="M"
          />
        </div>
        <div className="text-left pr-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
            Join code
          </div>
          <div className="font-display font-bold text-2xl tracking-widest neon-text leading-tight">
            {roomState.code}
          </div>
        </div>
      </div>

      {/* AI status chip — top-left */}
      <div className="fixed top-4 left-4 z-30">
        <AIStatusChip status={aiStatus} />
      </div>

      <div className="fixed top-20 right-4 lg:top-auto lg:bottom-4 z-[90] flex gap-2">
        {onPauseGame && (
          <Button size="sm" variant="outline" onClick={onPauseGame}>
            Pause
          </Button>
        )}
        {onEndGame && (
          <Button size="sm" variant="destructive" onClick={onEndGame}>
            End game
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="text-center">
        <motion.div
          key={gameState.turnNumber}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg text-muted-foreground"
        >
          Turn {gameState.turnNumber}
        </motion.div>
        <motion.div
          key={currentPlayer?.id}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="text-3xl md:text-5xl font-display font-bold"
          style={{ color: getPlayerCssColor(currentPlayer?.color) }}
        >
          {currentPlayer?.displayName}'s Turn
        </motion.div>
        <motion.p
          key={gameState.lastAction}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground mt-1"
        >
          {gameState.lastAction}
        </motion.p>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Board */}
        <div className="glass rounded-3xl p-3 border border-primary/20 shadow-[0_0_36px_hsl(var(--primary)/0.15)]">
          <LudoBoard gameState={gameState} isDisplay />
        </div>

        {/* Side panel */}
        <div className="space-y-6 min-w-[240px]">
          {/* Last roll chip — small, persistent */}
          {gameState.dice && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Last roll</div>
              <div className="px-4 py-2 rounded-xl bg-muted border border-border font-display font-bold text-2xl tabular-nums neon-text">
                {gameState.dice[0]} + {gameState.dice[1]} = {gameState.dice[0] + gameState.dice[1]}
              </div>
              {gameState.diceRemaining && gameState.diceRemaining.length > 0 && gameState.phase === 'moving' && (
                <div className="text-[11px] text-muted-foreground">
                  Remaining: {gameState.diceRemaining.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Scoreboard */}
          <div className="glass rounded-2xl p-4 space-y-3 border border-border/70">
            <h3 className="text-sm text-muted-foreground uppercase tracking-wider text-center">Players</h3>
            {gameState.players.map((p, i) => {
              const seenAt = presenceMap[p.id];
              const presence = derivePresenceState(seenAt);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    i === gameState.currentPlayerIndex ? 'bg-muted neon-border' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: getPlayerCssColor(p.color) }}
                    />
                    <span className="font-display font-bold text-sm">{p.displayName}</span>
                    <span
                      className="w-2 h-2 rounded-full"
                      title={presence.label}
                      style={{ background: presence.color, boxShadow: presence.glow }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{p.finishedTokens}/4 home</span>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Mid-game admission strip — Colyseus only */}
      {transportKind === 'colyseus' && pending.length > 0 && (
        <div className="w-full max-w-3xl space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider text-center">
            Pending join requests
          </div>
          <AnimatePresence initial={false}>
            {pending.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="glass rounded-xl p-3 flex flex-wrap items-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-primary shrink-0" />
                <span className="font-display font-bold text-sm flex-1 min-w-[120px]">
                  {req.displayName}
                </span>
                {seatsAvailable && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onApproveJoin?.(req.id, 'spawn')}
                    className="gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Spawn seat
                  </Button>
                )}
                {botSeats.length > 0 && (
                  <select
                    aria-label="Replace a bot with this player"
                    className="text-xs rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                    defaultValue=""
                    onChange={(e) => {
                      const botId = e.target.value;
                      if (!botId) return;
                      onReplaceBotWithHuman?.(botId, req.deviceId);
                      onApproveJoin?.(req.id, 'transfer', botId);
                      e.currentTarget.value = '';
                    }}
                  >
                    <option value="" disabled>Replace bot…</option>
                    {botSeats.map((b) => (
                      <option key={b.id} value={b.id}>
                        Take {b.displayName}'s seat
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApproveJoin?.(req.id, 'spectator')}
                >
                  Spectator
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRejectJoin?.(req.id)}
                  aria-label="Reject join request"
                  className="text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Host moderation drawer — Colyseus only, in-game compact */}
      {transportKind === 'colyseus' && onSetReactionPolicy && onSetTauntPolicy && onClearReactions && (
        <HostReactionPanel
          variant="drawer"
          reactionPolicy={reactionPolicy}
          tauntPolicy={tauntPolicy}
          reactionStats={reactionStats}
          rendererMode={rendererMode}
          members={roomState.members}
          onSetReactionPolicy={onSetReactionPolicy}
          onSetTauntPolicy={onSetTauntPolicy}
          onClearReactions={onClearReactions}
        />
      )}

      {/* Cinematic 2-dice roll overlay */}
      <RollingDiceScene dice={gameState.dice ?? null} turnNumber={gameState.turnNumber} />

      {/* AI commentary banner — public-only, host-broadcast */}
      <CommentaryTicker line={commentaryLine ?? null} />
    </div>
  );
}

function getPlayerCssColor(color?: string): string {
  const map: Record<string, string> = {
    red: 'hsl(0, 80%, 55%)',
    green: 'hsl(140, 70%, 45%)',
    yellow: 'hsl(45, 100%, 55%)',
    blue: 'hsl(210, 80%, 55%)',
  };
  return map[color || ''] || 'hsl(var(--foreground))';
}

function derivePresenceState(seenAt?: number): { color: string; glow: string; label: string } {
  if (!seenAt) {
    return { color: 'hsl(var(--muted-foreground))', glow: 'none', label: 'No signal yet' };
  }
  const age = Date.now() - seenAt;
  if (age < 6000) {
    return {
      color: 'hsl(var(--primary))',
      glow: '0 0 6px hsl(var(--primary) / 0.6)',
      label: 'Connected',
    };
  }
  if (age < 20000) {
    return { color: 'hsl(45, 100%, 55%)', glow: 'none', label: 'Reconnecting…' };
  }
  return { color: 'hsl(var(--muted-foreground))', glow: 'none', label: 'Disconnected' };
}
