import { useEffect, useMemo, useState } from 'react';
import { Check, FastForward, Trophy, Users } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PlayerScore = { id: string; name: string; score: number };
type Challenge = { kind: 'choice' | 'number' | 'text' | 'order'; prompt: string; options?: string[] };
type GameState = {
  gameType: string;
  name: string;
  emoji: string;
  phase: 'playing' | 'reveal' | 'finished';
  round: number;
  totalRounds: number;
  challenge: Challenge | null;
  players: PlayerScore[];
  submittedCount: number;
  lastResults: Array<{ playerId: string; points: number }>;
  winnerPlayerIds: string[];
  lastAction: string;
};
type PrivateState = {
  seated?: boolean;
  submitted?: boolean;
  submission?: unknown;
};

export function InstalledGameSurface({
  publicState,
  privateState,
  role,
  sendIntent,
  aiHint,
  requestHint,
  aiCommentary,
}: {
  publicState: unknown;
  privateState: unknown;
  role: 'display' | 'controller' | 'crowd' | 'companion';
  sendIntent: (intent: Record<string, unknown>) => void;
  aiHint?: string | null;
  requestHint?: () => void;
  aiCommentary?: string | null;
}) {
  const state = publicState as GameState;
  const mine = (privateState ?? {}) as PrivateState;
  const isHost = role === 'display' || role === 'companion';
  const [value, setValue] = useState('');
  const [order, setOrder] = useState<number[]>([]);

  useEffect(() => {
    setValue('');
    setOrder([]);
  }, [state.round]);

  const sortedPlayers = useMemo(
    () => [...(state.players ?? [])].sort((a, b) => b.score - a.score),
    [state.players],
  );
  const challenge = state.challenge;

  function submit() {
    if (!challenge || mine.submitted) return;
    if (challenge.kind === 'number') sendIntent({ type: 'guess', amount: Number(value) });
    if (challenge.kind === 'text') sendIntent({ type: 'answer_text', text: value.trim() });
    if (challenge.kind === 'order') {
      const orderedIndexes = order.length === challenge.options?.length
        ? order
        : (challenge.options ?? []).map((_, index) => index);
      sendIntent({ type: 'submit_order', orderedIndexes });
    }
  }

  return (
    <main className="star-field min-h-screen bg-[#020817] px-4 pb-5 pt-4 text-white sm:px-6">
      <header className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-4">
          <BrandLogo className="text-2xl" />
          <span className="text-sm font-semibold">{state.emoji} {state.name}</span>
        </div>
        <div className="text-xs text-muted-foreground">Round {state.round} / {state.totalRounds}</div>
        <div className="flex items-center gap-2 text-xs"><Users className="h-4 w-4" /> {state.players?.length ?? 0}</div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl gap-5 py-5 lg:grid-cols-[1fr_270px]">
        <section className="flex flex-col items-center justify-center">
          <div className="neon-panel w-full max-w-3xl overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 px-5 py-8 text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">{state.phase === 'reveal' ? 'Round result' : 'Your challenge'}</p>
              <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">{challenge?.prompt ?? 'Game complete'}</h1>
            </div>

            {challenge?.kind === 'choice' && (
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {(challenge.options ?? []).map((option, optionIndex) => (
                  <Button
                    key={`${option}-${optionIndex}`}
                    variant={mine.submission === optionIndex ? 'default' : 'outline'}
                    className="min-h-14 justify-start rounded-xl bg-white/[0.035] text-left"
                    disabled={isHost || role === 'crowd' || mine.seated === false || mine.submitted || state.phase !== 'playing'}
                    onClick={() => sendIntent({ type: 'answer', optionIndex })}
                  >
                    <span className="mr-3 text-lg font-bold text-primary">{String.fromCharCode(65 + optionIndex)}</span>{option}
                  </Button>
                ))}
              </div>
            )}

            {!isHost && role !== 'crowd' && mine.seated !== false && challenge && challenge.kind !== 'choice' && (
              <div className="p-4">
                {challenge.kind === 'order' ? (
                  <div className="space-y-2">
                    {(order.length ? order : (challenge.options ?? []).map((_, index) => index)).map((sourceIndex, displayIndex, current) => (
                      <div key={sourceIndex} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                        <span className="w-7 text-center font-mono text-primary">{displayIndex + 1}</span>
                        <span className="flex-1">{challenge.options?.[sourceIndex]}</span>
                        <Button size="sm" variant="ghost" disabled={displayIndex === 0 || mine.submitted} onClick={() => {
                          const next = [...current];
                          [next[displayIndex - 1], next[displayIndex]] = [next[displayIndex], next[displayIndex - 1]];
                          setOrder(next);
                        }}>↑</Button>
                        <Button size="sm" variant="ghost" disabled={displayIndex === current.length - 1 || mine.submitted} onClick={() => {
                          const next = [...current];
                          [next[displayIndex + 1], next[displayIndex]] = [next[displayIndex], next[displayIndex + 1]];
                          setOrder(next);
                        }}>↓</Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Input
                    value={value}
                    inputMode={challenge.kind === 'number' ? 'numeric' : 'text'}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={challenge.kind === 'number' ? 'Enter your estimate' : 'Type your answer'}
                    className="h-14 rounded-xl bg-black/30 text-center text-lg"
                    disabled={mine.submitted}
                  />
                )}
                <Button className="neon-primary mt-3 h-13 w-full rounded-xl" disabled={mine.submitted || (challenge.kind !== 'order' && !value.trim())} onClick={submit}>
                  {mine.submitted ? <><Check /> Locked in</> : 'Submit answer'}
                </Button>
                {requestHint && !mine.submitted && (
                  <Button variant="ghost" className="mt-2 w-full text-secondary" onClick={requestHint}>Ask for a private hint</Button>
                )}
                {aiHint && <p className="mt-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm">{aiHint}</p>}
              </div>
            )}

            {(role === 'crowd' || (!isHost && mine.seated === false)) && (
              <p className="p-5 text-center text-sm text-muted-foreground">
                You joined after this game started. You’re watching from the crowd and will be seated in the next game.
              </p>
            )}
            {isHost && state.phase !== 'finished' && (
              <div className="border-t border-white/10 p-4 text-center">
                <p className="mb-3 text-xs text-muted-foreground">{state.submittedCount} of {state.players.length} players locked in</p>
                <Button className="neon-primary min-w-52 rounded-xl" onClick={() => sendIntent({ type: 'advance' })}>
                  <FastForward className="h-4 w-4" /> {state.phase === 'playing' ? 'Reveal answers' : 'Next round'}
                </Button>
              </div>
            )}
            {state.phase === 'finished' && (
              <div className="flex items-center justify-center gap-3 p-8 text-2xl font-bold text-primary"><Trophy /> Game complete</div>
            )}
          </div>
        </section>

        <aside className="neon-panel rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Players</p>
          <div className="mt-3 space-y-2">
            {sortedPlayers.map((player, index) => {
              const points = state.lastResults?.find((result) => result.playerId === player.id)?.points;
              return (
                <div key={player.id} className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-3 py-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-primary/60 bg-primary/10 text-xs">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{player.name}</span>
                  <span className="text-sm font-bold text-primary">{player.score}{points ? <small className="ml-1">+{points}</small> : null}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">{state.lastAction}</p>
        </aside>
      </div>
      {aiCommentary && (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-xl border border-secondary/50 bg-[#090713]/95 px-5 py-3 text-center text-sm shadow-[0_0_24px_rgba(179,76,255,.25)]">
          {aiCommentary}
        </div>
      )}
    </main>
  );
}
