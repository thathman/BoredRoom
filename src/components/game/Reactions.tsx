import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import {
  bucketReactions,
  ReactionItem,
  ComboGroup,
} from '@/lib/reactionFeed';
import {
  DEFAULT_REACTION_POLICY,
  DEFAULT_TAUNT_POLICY,
  ReactionPolicy,
  ReactionRejectReason,
  TauntPolicy,
} from '@/lib/transport/types';
import { toast } from 'sonner';

// ──────────────────────────────────────────────────────────────────────────
// Display overlay: adaptive (CSS3D+Framer) + WebGL-aware capability gate.
// Enforces max concurrent visual nodes with deterministic drop-oldest.
// Honors prefers-reduced-motion.
// ──────────────────────────────────────────────────────────────────────────

const MAX_CONCURRENT_NODES = 24;

interface ReactionsOverlayProps {
  reactions: ReactionItem[];
  /** Server-broadcast hype moments (de-duplicated by id on the display side). */
  moments?: { id: string; emoji: string; count: number }[];
  rendererMode?: 'auto' | 'css3d' | 'webgl-hybrid';
  /** Notified once with the resolved renderer ('webgl-hybrid' | 'css3d'). */
  onRendererResolved?: (mode: 'webgl-hybrid' | 'css3d') => void;
}

interface VisibleSingle {
  kind: 'single';
  key: string;
  emoji: string;
  isText: boolean;
  x: number;
  bornAt: number;
}

interface VisibleCombo {
  kind: 'combo';
  key: string;
  emoji: string;
  count: number;
  x: number;
  bornAt: number;
}

type VisibleItem = VisibleSingle | VisibleCombo;

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

function detectReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ReactionsOverlay({
  reactions,
  moments,
  rendererMode = 'auto',
  onRendererResolved,
}: ReactionsOverlayProps) {
  const [visible, setVisible] = useState<VisibleItem[]>([]);
  const [hypeChip, setHypeChip] = useState<{ emoji: string; count: number; key: number } | null>(null);
  const seenSingleKeys = useRef<Set<string>>(new Set());
  const seenComboKeys = useRef<Set<string>>(new Set());
  const lastHypeKeyRef = useRef<string | null>(null);
  const seenServerMomentIdsRef = useRef<Set<string>>(new Set());

  // Capability flags — computed once.
  const webglAvailable = useMemo(() => detectWebGL(), []);
  const reduced = useMemo(() => detectReducedMotion(), []);
  const useWebGLHybrid = useMemo(() => {
    if (rendererMode === 'css3d') return false;
    if (rendererMode === 'webgl-hybrid') return webglAvailable;
    return webglAvailable; // auto
  }, [rendererMode, webglAvailable]);

  // Notify parent of resolved renderer (once per change).
  useEffect(() => {
    onRendererResolved?.(useWebGLHybrid ? 'webgl-hybrid' : 'css3d');
  }, [useWebGLHybrid, onRendererResolved]);

  // Surface server-broadcast hype moments. Handles reconnect replay for
  // free — a late-joining display will see the most recent moment as a chip.
  useEffect(() => {
    if (!moments || moments.length === 0) return;
    const latest = moments[moments.length - 1];
    if (seenServerMomentIdsRef.current.has(latest.id)) return;
    seenServerMomentIdsRef.current.add(latest.id);
    const chip = { emoji: latest.emoji, count: latest.count, key: Date.now() };
    setHypeChip(chip);
    const ttl = reduced ? 1400 : 2600;
    const t = window.setTimeout(() => {
      setHypeChip(prev => (prev?.key === chip.key ? null : prev));
    }, ttl);
    return () => window.clearTimeout(t);
  }, [moments, reduced]);

  const isText = (emoji: string) => emoji.length > 3;

  const bucket = useMemo(() => bucketReactions(reactions, Date.now()), [reactions]);

  useEffect(() => {
    const newItems: VisibleItem[] = [];
    const width = typeof window !== 'undefined' ? window.innerWidth * 0.7 : 400;
    const now = Date.now();

    bucket.combos.forEach((g: ComboGroup) => {
      const key = `c:${g.emoji}:${g.lastTimestamp}`;
      if (seenComboKeys.current.has(key)) return;
      seenComboKeys.current.add(key);
      newItems.push({
        kind: 'combo',
        key,
        emoji: g.emoji,
        count: g.count,
        x: Math.random() * width,
        bornAt: now,
      });
    });

    bucket.singles.forEach(r => {
      const key = `s:${r.playerId}:${r.timestamp}:${r.emoji}`;
      if (seenSingleKeys.current.has(key)) return;
      seenSingleKeys.current.add(key);
      newItems.push({
        kind: 'single',
        key,
        emoji: r.emoji,
        isText: isText(r.emoji),
        x: Math.random() * width,
        bornAt: now,
      });
    });

    if (newItems.length > 0) {
      setVisible(prev => {
        const merged = [...prev, ...newItems];
        // Deterministic drop-oldest overflow handling.
        if (merged.length > MAX_CONCURRENT_NODES) {
          merged.sort((a, b) => a.bornAt - b.bornAt);
          return merged.slice(merged.length - MAX_CONCURRENT_NODES);
        }
        return merged;
      });
      newItems.forEach(item => {
        const ttl = reduced ? 1200 : item.kind === 'combo' ? 3200 : 2500;
        setTimeout(() => {
          setVisible(prev => prev.filter(i => i.key !== item.key));
        }, ttl);
      });
    }

    if (bucket.hype) {
      const hypeKey = `${bucket.hype.emoji}:${bucket.hype.count}`;
      if (hypeKey !== lastHypeKeyRef.current) {
        lastHypeKeyRef.current = hypeKey;
        const chip = { emoji: bucket.hype.emoji, count: bucket.hype.count, key: Date.now() };
        setHypeChip(chip);
        setTimeout(() => {
          setHypeChip(prev => (prev?.key === chip.key ? null : prev));
        }, reduced ? 1200 : 2200);
      }
    }
  }, [bucket, reduced]);

  // Animation tuning by capability — webgl-hybrid path adds a glow layer
  // and stronger spring; CSS3D fallback uses gentler transforms.
  const animPreset = reduced
    ? { duration: 0.4, ease: 'linear' as const, scale: 1, y: -40 }
    : useWebGLHybrid
      ? { duration: 2.4, ease: 'easeOut' as const, scale: 1.15, y: -180 }
      : { duration: 2.0, ease: 'easeOut' as const, scale: 1, y: -150 };

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      data-renderer={useWebGLHybrid ? 'webgl-hybrid' : 'css3d'}
      data-reduced-motion={reduced ? 'true' : 'false'}
    >
      <AnimatePresence>
        {hypeChip && (
          <motion.div
            key={hypeChip.key}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 220, damping: 18 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-card border-2 border-primary text-base font-display font-bold flex items-center gap-2 shadow-lg neon-box"
          >
            <span className="text-primary">🔥 HYPE</span>
            <span className="text-2xl">{hypeChip.emoji}</span>
            <span className="text-foreground tabular-nums">×{hypeChip.count}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible.map(item => {
          if (item.kind === 'combo') {
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, scale: 0.4, y: 100, x: item.x }}
                animate={{ opacity: 1, scale: animPreset.scale + 0.05, y: animPreset.y }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: animPreset.duration + 0.2, ease: animPreset.ease }}
                className={`absolute bottom-20 flex items-center gap-2 px-4 py-2 rounded-full bg-card border-2 border-primary/70 shadow-lg neon-box ${
                  useWebGLHybrid && !reduced ? 'mix-blend-screen' : ''
                }`}
              >
                <span className="text-5xl">{item.emoji}</span>
                <span className="font-display font-bold text-2xl text-primary tabular-nums">
                  ×{item.count}
                </span>
              </motion.div>
            );
          }
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, scale: 0.3, y: 100, x: item.x }}
              animate={{ opacity: 1, scale: animPreset.scale, y: animPreset.y }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: animPreset.duration, ease: animPreset.ease }}
              className={
                item.isText
                  ? 'absolute bottom-20 px-5 py-3 rounded-2xl bg-card border-2 border-primary/60 text-xl font-display font-bold neon-box whitespace-nowrap'
                  : 'absolute bottom-20 text-6xl'
              }
              style={item.isText ? { color: 'hsl(var(--foreground))' } : undefined}
            >
              {item.emoji}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Controller-side ReactionBar — server-policy driven.
// Replaces local hardcoded constants with values from the live ReactionPolicy
// broadcast by the server. Uses onReactionAck to surface accepted/rejected
// feedback and a "recent used" strip for fast repeats.
// ──────────────────────────────────────────────────────────────────────────

const REACTIONS = ['🔥', '😂', '😱', '👏', '💀', '🎉'];
const TAUNTS = ['Easy!', 'Got you!', 'Nice try', 'Watch this', 'GG', 'Oof'];

const REJECT_LABEL: Record<ReactionRejectReason, string> = {
  cooldown: 'Cooling down',
  rate_limited: 'Slow down — others want a turn',
  disabled: 'Reactions are off',
  duplicate: 'Already sent that one',
};

export interface ReactionAckEvent {
  ok: boolean;
  emoji: string;
  reason?: ReactionRejectReason;
  retryAfterMs?: number;
  clientNonce?: string;
}

interface ReactionBarProps {
  onReact: (emoji: string, clientNonce?: string) => void;
  /** Live server-enforced reaction policy. Falls back to defaults. */
  reactionPolicy?: ReactionPolicy;
  /** Live taunt policy — used to dim taunt button when off. */
  tauntPolicy?: TauntPolicy;
  /** Subscribe to per-attempt server acks. */
  onReactionAck?: (fn: (ack: ReactionAckEvent) => void) => () => void;
}

export function ReactionBar({
  onReact,
  reactionPolicy = DEFAULT_REACTION_POLICY,
  tauntPolicy = DEFAULT_TAUNT_POLICY,
  onReactionAck,
}: ReactionBarProps) {
  const [tauntsOpen, setTauntsOpen] = useState(false);
  const [lastSentMap, setLastSentMap] = useState<Record<string, number>>({});
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [, setTick] = useState(0);
  const pendingNoncesRef = useRef<Map<string, string>>(new Map());
  const burstIntervalRef = useRef<number | null>(null);
  const pointerBurstSentRef = useRef(false);

  // Cooldown ring re-render tick.
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 100);
    return () => window.clearInterval(id);
  }, []);

  // Subscribe to server acks.
  useEffect(() => {
    if (!onReactionAck) return;
    return onReactionAck((ack) => {
      const nonceEmoji = ack.clientNonce ? pendingNoncesRef.current.get(ack.clientNonce) : undefined;
      const targetEmoji = nonceEmoji ?? ack.emoji;
      if (ack.clientNonce) pendingNoncesRef.current.delete(ack.clientNonce);

      if (ack.ok) {
        setPulseKey(`${targetEmoji}:${Date.now()}`);
        setRecent(prev => {
          const next = [targetEmoji, ...prev.filter(e => e !== targetEmoji)];
          return next.slice(0, 4);
        });
      } else {
        const reason = ack.reason ?? 'cooldown';
        const base = REJECT_LABEL[reason];
        const hint =
          ack.retryAfterMs && ack.retryAfterMs > 250
            ? ` · retry in ${(ack.retryAfterMs / 1000).toFixed(1)}s`
            : '';
        toast.error(`${base}${hint}`, { id: `reaction-${reason}`, duration: 1800 });
        // Roll back optimistic cooldown so the user isn't double-penalized.
        setLastSentMap(prev => {
          if (!prev[targetEmoji]) return prev;
          const { [targetEmoji]: _gone, ...rest } = prev;
          return rest;
        });
      }
    });
  }, [onReactionAck]);

  const tryReact = useCallback((emoji: string) => {
    if (!reactionPolicy.enabled) {
      toast.error(REJECT_LABEL.disabled, { id: 'reaction-disabled' });
      return;
    }
    const now = Date.now();
    // Optimistic local cooldown (mirrors server policy). Server is the truth.
    const last = lastSentMap[emoji];
    if (last && now - last < reactionPolicy.cooldownMs) return;
    setLastSentMap(prev => ({ ...prev, [emoji]: now }));
    const nonce = `${emoji}-${now}-${Math.random().toString(36).slice(2, 7)}`;
    pendingNoncesRef.current.set(nonce, emoji);
    onReact(emoji, nonce);
  }, [reactionPolicy, lastSentMap, onReact]);

  const stopBurst = useCallback(() => {
    if (burstIntervalRef.current != null) {
      window.clearInterval(burstIntervalRef.current);
      burstIntervalRef.current = null;
    }
  }, []);

  const startBurst = useCallback((emoji: string) => {
    stopBurst();
    pointerBurstSentRef.current = true;
    tryReact(emoji);
    const cadence = Math.max(140, Math.min(650, reactionPolicy.cooldownMs || 250));
    burstIntervalRef.current = window.setInterval(() => tryReact(emoji), cadence);
  }, [reactionPolicy.cooldownMs, stopBurst, tryReact]);

  useEffect(() => stopBurst, [stopBurst]);

  const cooldownProgress = (emoji: string): number => {
    const sent = lastSentMap[emoji];
    if (!sent) return 0;
    const elapsed = Date.now() - sent;
    if (elapsed >= reactionPolicy.cooldownMs) return 0;
    return 1 - elapsed / reactionPolicy.cooldownMs;
  };

  const reactionsDisabled = !reactionPolicy.enabled;
  const tauntsDisabled = !tauntPolicy.enabled || reactionsDisabled;

  return (
    <div className="space-y-2">
      {/* Recent-used strip — appears once you've actually used something */}
      {recent.length > 0 && (
        <div className="flex items-center gap-1.5 justify-center">
          <Sparkles className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">
            Recent
          </span>
          {recent.map((emoji) => (
            <button
              key={`recent-${emoji}`}
              onClick={() => tryReact(emoji)}
              disabled={reactionsDisabled}
              className="text-lg px-2 py-1 rounded-md bg-muted/60 hover:bg-muted transition-colors disabled:opacity-40"
              aria-label={`Repeat ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 justify-center flex-wrap">
        {REACTIONS.map(emoji => {
          const progress = cooldownProgress(emoji);
          const onCd = progress > 0;
          const justAccepted = pulseKey?.startsWith(`${emoji}:`);
          return (
            <motion.button
              key={emoji}
              whileTap={onCd || reactionsDisabled ? undefined : { scale: 1.4 }}
              animate={justAccepted ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={justAccepted ? { duration: 0.35 } : undefined}
              onClick={() => {
                if (pointerBurstSentRef.current) {
                  pointerBurstSentRef.current = false;
                  return;
                }
                tryReact(emoji);
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                startBurst(emoji);
              }}
              onPointerUp={stopBurst}
              onPointerCancel={stopBurst}
              onPointerLeave={stopBurst}
              disabled={reactionsDisabled}
              className={`relative text-2xl p-3 rounded-xl transition-colors min-w-[48px] min-h-[48px] overflow-hidden ${
                reactionsDisabled
                  ? 'bg-muted/30 opacity-40 cursor-not-allowed'
                  : onCd
                    ? 'bg-muted/40 opacity-60'
                    : 'bg-muted active:bg-muted/60'
              }`}
              aria-label={`React with ${emoji}`}
            >
              <span className="relative z-10">{emoji}</span>
              {onCd && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    background: `conic-gradient(hsl(var(--primary) / 0.35) ${progress * 360}deg, transparent 0deg)`,
                  }}
                />
              )}
            </motion.button>
          );
        })}
        <motion.button
          whileTap={tauntsDisabled ? undefined : { scale: 0.95 }}
          onClick={() => !tauntsDisabled && setTauntsOpen(o => !o)}
          disabled={tauntsDisabled}
          className={`p-3 rounded-xl transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center ${
            tauntsDisabled
              ? 'bg-muted/30 opacity-40 cursor-not-allowed'
              : tauntsOpen
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
          }`}
          aria-label="Toggle taunts"
        >
          <MessageSquare className="w-5 h-5" />
        </motion.button>
      </div>

      <AnimatePresence>
        {tauntsOpen && !tauntsDisabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 pt-1">
              {TAUNTS.map(t => {
                const progress = cooldownProgress(t);
                const onCd = progress > 0;
                const justAccepted = pulseKey?.startsWith(`${t}:`);
                return (
                  <motion.button
                    key={t}
                    whileTap={onCd ? undefined : { scale: 0.95 }}
                    animate={justAccepted ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={justAccepted ? { duration: 0.3 } : undefined}
                    onClick={() => tryReact(t)}
                    className={`relative px-3 py-2 rounded-lg text-sm font-display font-bold transition-colors overflow-hidden ${
                      onCd ? 'bg-muted/40 opacity-60' : 'bg-muted active:bg-muted/60'
                    }`}
                  >
                    <span className="relative z-10">{t}</span>
                    {onCd && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        style={{
                          background: `conic-gradient(hsl(var(--primary) / 0.35) ${progress * 360}deg, transparent 0deg)`,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
