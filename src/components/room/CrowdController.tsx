// CrowdController — audience-mode phone UI.
// Crowd members are joiners beyond the player cap (or who arrived mid-game).
// They can: send reactions, and (in Trivia) cast a non-scoring consensus vote
// that aggregates on the host display.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ReactionBar, ReactionAckEvent } from '@/components/game/Reactions';
import { SoundControls } from '@/components/system/SoundControls';
import { vibrate, sounds } from '@/lib/sounds';
import type {
  GameType,
  ReactionPolicy,
  TauntPolicy,
  TriviaPublicState,
} from '@/lib/transport/types';

interface CrowdControllerProps {
  gameType: GameType;
  triviaPublicState?: TriviaPublicState | null;
  onReact: (emoji: string, clientNonce?: string) => void;
  onCrowdVoteTrivia?: (pickedIndex: 0 | 1 | 2 | 3) => void;
  reactionPolicy?: ReactionPolicy;
  tauntPolicy?: TauntPolicy;
  onReactionAck?: (fn: (ack: ReactionAckEvent) => void) => () => void;
  onRequestLeave?: () => void;
  displayName?: string;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function CrowdController({
  gameType,
  triviaPublicState,
  onReact,
  onCrowdVoteTrivia,
  reactionPolicy,
  tauntPolicy,
  onReactionAck,
  onRequestLeave,
  displayName,
}: CrowdControllerProps) {
  const phase = triviaPublicState?.phase;
  const currentQuestion = triviaPublicState?.currentQuestion ?? null;

  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const lastQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = currentQuestion?.id ?? null;
    if (id !== lastQuestionIdRef.current) {
      setPickedIndex(null);
      lastQuestionIdRef.current = id;
    }
  }, [currentQuestion?.id]);

  const isTrivia = gameType === 'trivia';
  const canVote =
    isTrivia &&
    phase === 'options' &&
    !!currentQuestion &&
    !!onCrowdVoteTrivia;

  const handlePick = (idx: number) => {
    if (!canVote) return;
    setPickedIndex(idx);
    sounds.click();
    vibrate([10, 20, 10]);
    onCrowdVoteTrivia?.(idx as 0 | 1 | 2 | 3);
  };

  const consensus = triviaPublicState?.crowdConsensus ?? null;
  const totalVotes = consensus?.total ?? 0;
  const myPctForPicked = useMemo(() => {
    if (pickedIndex == null || !consensus || totalVotes === 0) return null;
    const c = consensus.tally[String(pickedIndex)] ?? 0;
    return Math.round((c / totalVotes) * 100);
  }, [pickedIndex, consensus, totalVotes]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-5 pt-8 gap-5">
      <div className="w-full max-w-md text-center space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary">👀 You're in The Crowd</p>
        <h1 className="font-display font-bold text-2xl">{displayName ?? 'Audience'}</h1>
        <p className="text-xs text-muted-foreground">
          Cheer the players, send reactions, and{' '}
          {isTrivia ? 'vote on questions — your votes don\'t score.' : 'hype the room.'}
        </p>
      </div>

      <div className="w-full max-w-md flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {isTrivia && phase === 'options' && currentQuestion && (
            <motion.div
              key={`vote-${currentQuestion.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3 mt-2"
            >
              <p className="text-sm text-muted-foreground text-center">
                {pickedIndex == null
                  ? 'Tap the answer you think is right'
                  : `You voted ${OPTION_LABELS[pickedIndex]}${
                      myPctForPicked != null ? ` · ${myPctForPicked}% of crowd agrees` : ''
                    }`}
              </p>
              <p className="text-base font-display font-bold text-center px-2">
                {currentQuestion.question}
              </p>
              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((opt, idx) => {
                  const isPicked = pickedIndex === idx;
                  return (
                    <motion.button
                      key={`${currentQuestion.id}-${idx}`}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handlePick(idx)}
                      className={`w-full min-h-[60px] rounded-2xl px-4 py-3 flex items-center gap-3 text-left font-display border transition-colors ${
                        isPicked
                          ? 'bg-secondary text-secondary-foreground border-secondary neon-box'
                          : 'bg-card/80 text-foreground border-border active:bg-muted'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                          isPicked ? 'bg-secondary-foreground text-secondary' : 'bg-muted text-foreground'
                        }`}
                      >
                        {OPTION_LABELS[idx]}
                      </span>
                      <span className="flex-1 text-sm font-bold leading-tight">{opt}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {isTrivia && phase !== 'options' && (
            <motion.div
              key="wait"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mt-12 space-y-3"
            >
              <p className="text-2xl font-display font-bold neon-text">Spectator view</p>
              <p className="text-muted-foreground text-sm">
                {phase === 'reveal'
                  ? 'Answer revealed on the big screen…'
                  : phase === 'leaderboard'
                    ? 'End of round — check the leaderboard.'
                    : phase === 'finished'
                      ? 'Match complete.'
                      : 'Watch the host screen — voting opens with the next question.'}
              </p>
            </motion.div>
          )}

          {!isTrivia && (
            <motion.div
              key="generic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mt-12 space-y-3"
            >
              <p className="text-2xl font-display font-bold neon-text">Hype the room</p>
              <p className="text-muted-foreground text-sm">
                You joined as audience. Use reactions below to cheer (or roast) the players.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3">
        <ReactionBar
          onReact={onReact}
          reactionPolicy={reactionPolicy}
          tauntPolicy={tauntPolicy}
          onReactionAck={onReactionAck}
        />
        <Button variant="ghost" size="sm" onClick={onRequestLeave} disabled={!onRequestLeave}>
          Leave
        </Button>
        <SoundControls compact />
      </div>
    </div>
  );
}
