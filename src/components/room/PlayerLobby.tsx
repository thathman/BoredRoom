import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { RoomState } from '@/lib/realtimeRoom';
import { Button } from '@/components/ui/button';
import { ReactionBar, ReactionAckEvent } from '@/components/game/Reactions';
import { ReactionPolicy, TauntPolicy } from '@/lib/transport/types';
import { Check, Clock } from 'lucide-react';
import { SoundControls } from '@/components/system/SoundControls';
import { getGameMeta } from '@/lib/games';

interface PlayerLobbyProps {
  roomState: RoomState;
  playerId: string;
  onToggleReady: () => void;
  onReact: (emoji: string, clientNonce?: string) => void;
  reactionPolicy?: ReactionPolicy;
  tauntPolicy?: TauntPolicy;
  onReactionAck?: (fn: (ack: ReactionAckEvent) => void) => () => void;
  onRequestLeave?: () => void;
}

export function PlayerLobby({
  roomState,
  playerId,
  onToggleReady,
  onReact,
  reactionPolicy,
  tauntPolicy,
  onReactionAck,
  onRequestLeave,
}: PlayerLobbyProps) {
  const { t } = useTranslation();
  const me = roomState.members.find(m => m.id === playerId);
  const isReady = me?.isReady || false;
  const gameSlug = (roomState.gameType ?? 'ludo');
  const meta = getGameMeta(gameSlug);
  const maxPlayers = roomState.maxPlayers ?? meta?.maxPlayers ?? 4;
  const rules = meta?.rules ?? [
    'Roll and move tokens around the board.',
    'You need a single die showing 6 to leave base.',
    'Get all 4 tokens home before everyone else.',
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        <div>
          <h2 className="text-2xl font-display font-bold mb-1">{t('lobby.room', { code: roomState.code })}</h2>
          <p className="text-muted-foreground">
            {t('lobby.playersJoined', { current: roomState.members.length, max: maxPlayers })}
          </p>
        </div>

        <div className="space-y-3">
          <details className="glass rounded-xl p-4 text-left">
            <summary className="cursor-pointer font-display font-bold">{t('lobby.rulesBeforeReady')}</summary>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              {rules.map((line, idx) => (
                <p key={`${gameSlug}-rule-${idx}`}>{line}</p>
              ))}
            </div>
          </details>

          {roomState.members.map(member => (
            <div
              key={member.id}
              className="glass rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: member.isReady ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  }}
                />
                <span className="font-display font-bold">
                  {member.displayName}
                  {member.id === playerId && ` (${t('common.you')})`}
                </span>
              </div>
              {member.isHost && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{t('lobby.host')}</span>
              )}
            </div>
          ))}
        </div>

        <Button
          onClick={onToggleReady}
          size="lg"
          className={`w-full controller-button gap-3 ${
            isReady
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }`}
        >
          {isReady ? <Check className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
          {isReady ? t('lobby.ready') : t('lobby.tapWhenReady')}
        </Button>

        <div className="pt-4">
          <p className="text-sm text-muted-foreground mb-3">{t('lobby.sendReaction')}</p>
          <ReactionBar
            onReact={onReact}
            reactionPolicy={reactionPolicy}
            tauntPolicy={tauntPolicy}
            onReactionAck={onReactionAck}
          />
        </div>

        <SoundControls compact />

        {onRequestLeave && (
          <Button type="button" variant="ghost" onClick={onRequestLeave} className="w-full">
            {t('lobby.backToLobby')}
          </Button>
        )}
      </motion.div>
    </div>
  );
}
