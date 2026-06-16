import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { RoomState } from '@/lib/realtimeRoom';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Trophy, Home, RotateCcw, Sparkles, FileDown, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { RecapPayload } from '@/lib/ai';
import { deriveGameResult } from '@/lib/gameResult';
import { ShareCardExport } from '@/components/room/ShareCardExport';
import { saveReplay } from '@/lib/replay';
import { getActiveReplayHandle } from '@/lib/useReplayRecorder';

interface GameOverProps {
  roomState: RoomState;
  playerId: string;
  isHost: boolean;
  onPlayAgain?: () => void;
  recap?: RecapPayload | null;
}

export function GameOver({ roomState, playerId, isHost, onPlayAgain, recap }: GameOverProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [savingReplay, setSavingReplay] = useState(false);
  const [savedShareUrl, setSavedShareUrl] = useState<string | null>(null);
  const { gameType, winnerId, winnerName, winnerColor, standings } = deriveGameResult(
    roomState as unknown as RoomState & Record<string, unknown>,
  );

  const isWinner = winnerId === playerId;
  const gameLabel = gameType.toUpperCase();

  /** Replay export: dump the public room state, standings, and recap as JSON
   *  so players can re-share or post-mortem the match. Lightweight v1. */
  const handleDownloadReplay = () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        room: {
          code: roomState.code,
          gameType,
          finishedAt: (roomState as unknown as { finishedAt?: number }).finishedAt ?? null,
        },
        result: { winnerId, winnerName, winnerColor },
        standings,
        recap: recap ?? null,
        finalState: roomState,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boredroom-${gameType}-${roomState.code}-replay.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Replay download failed', err);
    }
  };

  const handleSaveAndShare = async () => {
    if (savingReplay) return;
    setSavingReplay(true);
    try {
      // Prefer the live recorder URL if the host display already initialized
      // a replay during the match — that one already has per-turn snapshots.
      const live = getActiveReplayHandle();
      if (live.shareUrl) {
        try { await navigator.clipboard.writeText(live.shareUrl); } catch { /* ignore */ }
        setSavedShareUrl(live.shareUrl);
        toast.success(t('gameOver.replaySavedToast'));
        return;
      }
      const playerNames: Record<string, string> = {};
      for (const s of standings) playerNames[s.id] = s.displayName;
      const result = await saveReplay({
        roomCode: roomState.code,
        gameType,
        winnerDeviceId: winnerId ?? null,
        winnerName: winnerName ?? null,
        playerNames,
        standings: standings.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          label: p.label,
          color: p.color,
        })),
        recap: recap ?? null,
        finalState: roomState as unknown as Record<string, unknown>,
      });
      if (!result) {
        toast.error(t('gameOver.replaySaveFailed'));
        return;
      }
      try { await navigator.clipboard.writeText(result.url); } catch { /* ignore */ }
      setSavedShareUrl(result.url);
      toast.success(t('gameOver.replaySavedToast'));
    } finally {
      setSavingReplay(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="text-center space-y-8 max-w-lg"
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Trophy className="w-24 h-24 mx-auto text-accent" />
        </motion.div>

        <div className="space-y-2">
          <span className="inline-block text-[10px] font-display font-bold tracking-[0.2em] px-2 py-0.5 rounded-full border border-primary/40 text-primary uppercase">
            {gameLabel}
          </span>
          <h1 className="text-5xl md:text-7xl font-display font-bold neon-text">
            {isWinner ? t('gameOver.youWin') : t('gameOver.gameOver')}
          </h1>
          {winnerName && (
            <p
              className="text-2xl font-display"
              style={{ color: winnerColor ? getColorHsl(winnerColor) : 'hsl(var(--accent))' }}
            >
              <Trophy className="inline w-5 h-5 mr-2 -mt-1" aria-hidden />
              {t('gameOver.takesCrown', { name: winnerName, defaultValue: '{{name}} takes the crown!' })}
            </p>
          )}
        </div>

        {/* AI Recap */}
        {recap && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass neon-border rounded-2xl p-5 space-y-3 text-left"
          >
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4 animate-pulse-neon" />
              <span className="text-xs uppercase tracking-wider font-display">{t('gameOver.aiRecap')}</span>
            </div>
            <h3 className="text-2xl font-display font-bold neon-text leading-tight">
              {recap.headline}
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed">
              {recap.paragraph}
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="text-sm font-display"><span className="text-accent">{t('gameOver.mvp')}:</span> {recap.mvp}</span>
            </div>
          </motion.div>
        )}

        {/* Final standings */}
        {standings.length > 0 && (
          <div className="glass rounded-2xl p-6 space-y-3">
            <h3 className="text-sm text-muted-foreground uppercase tracking-wider">{t('gameOver.finalStandings')}</h3>
            {standings.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-display font-bold text-muted-foreground">#{i + 1}</span>
                  {p.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: getColorHsl(p.color) }}
                    />
                  )}
                  <span className="font-display font-bold">{p.displayName}</span>
                </div>
                <span className="text-sm text-muted-foreground">{p.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          {isHost && onPlayAgain && (
            <Button
              onClick={onPlayAgain}
              size="lg"
              className="controller-button bg-primary text-primary-foreground gap-2 px-8"
            >
              <RotateCcw className="w-5 h-5" />
              {t('gameOver.playAgain')}
            </Button>
          )}
          <Button
            onClick={() => navigate('/')}
            size="lg"
            variant="outline"
            className="controller-button gap-2 px-8"
          >
            <Home className="w-5 h-5" />
            {t('gameOver.home')}
          </Button>
          <ShareCardExport
            gameLabel={gameLabel}
            winnerName={winnerName}
            standings={standings.map((p) => ({ displayName: p.displayName, label: p.label }))}
            roomCode={roomState.code}
            recapHeadline={recap?.headline}
          />
          <Button
            onClick={handleDownloadReplay}
            size="lg"
            variant="outline"
            className="controller-button gap-2 px-6"
            title={t('gameOver.downloadReplay', { defaultValue: 'Download replay (.json)' }) as string}
          >
            <FileDown className="w-5 h-5" />
            {t('gameOver.replay', { defaultValue: 'Replay' })}
          </Button>
          <Button
            onClick={handleSaveAndShare}
            size="lg"
            variant="outline"
            className="controller-button gap-2 px-6"
            disabled={savingReplay}
          >
            {savingReplay ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
            {savingReplay ? t('gameOver.savingReplay') : t('gameOver.saveAndShare')}
          </Button>
        </div>
        {savedShareUrl && (
          <div className="glass rounded-xl p-3 text-xs text-muted-foreground break-all max-w-md mx-auto">
            <a href={savedShareUrl} target="_blank" rel="noreferrer" className="text-primary underline">
              {savedShareUrl}
            </a>
          </div>
        )}
      </motion.div>
    </div>
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
