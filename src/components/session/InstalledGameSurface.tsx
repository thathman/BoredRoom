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
  mode?: string;
  phase: 'playing' | 'reveal' | 'finished';
  round?: number;
  totalRounds?: number;
  challenge?: Challenge | null;
  board?: Array<Array<string | null>>;
  tokens?: Record<string, number[]>;
  topCard?: { label: string; shape?: string; number?: number };
  requestedShape?: string | null;
  drawPileCount?: number;
  pendingRoll?: number | null;
  currentPlayerId?: string;
  players: Array<PlayerScore & { disc?: string; mark?: string; handCount?: number }>;
  submittedCount?: number;
  lastResults?: Array<{ playerId: string; points: number }>;
  winnerPlayerIds: string[];
  lastAction: string;
};
type PrivateState = {
  seated?: boolean;
  submitted?: boolean;
  submission?: unknown;
  isTurn?: boolean;
  tokens?: number[];
  hand?: Array<{ id: string; label: string }>;
  legalIntents?: Array<Record<string, unknown> & { label?: string }>;
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
  const legalIntents = mine.legalIntents ?? [];
  const isBoardGame = !challenge && ['connect4', 'ettt', 'ludo', 'whot'].includes(state.mode ?? '');

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
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">{state.phase === 'reveal' ? 'Round result' : state.mode ?? 'Your challenge'}</p>
              <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">
                {challenge?.prompt ?? (state.phase === 'finished' ? 'Game complete' : state.lastAction)}
              </h1>
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

            {isBoardGame && (
              <div className="p-4">
                {(state.mode === 'connect4' || state.mode === 'ettt') && (
                  <div className="mx-auto max-w-xl">
                    <div
                      className={`grid gap-2 ${state.mode === 'connect4' ? 'grid-cols-7' : 'grid-cols-3'}`}
                      aria-label={state.mode === 'connect4' ? 'Connect 4 board' : 'Endless Tic Tac Toe board'}
                    >
                      {(state.board ?? []).flatMap((row, rowIndex) =>
                        row.map((cell, columnIndex) => {
                          const cellIndex = state.mode === 'connect4' ? columnIndex : rowIndex * 3 + columnIndex;
                          const legal = legalIntents.find((intent) =>
                            state.mode === 'connect4'
                              ? intent.type === 'drop' && intent.column === columnIndex
                              : intent.type === 'place' && intent.cell === cellIndex,
                          );
                          return (
                            <button
                              key={`${rowIndex}-${columnIndex}`}
                              type="button"
                              disabled={isHost || role === 'crowd' || !legal || state.phase !== 'playing'}
                              onClick={() => legal && sendIntent(legal)}
                              className={`grid aspect-square place-items-center rounded-xl border text-lg font-black transition ${
                                cell
                                  ? 'border-primary/50 bg-primary/15 text-primary'
                                  : legal
                                    ? 'border-secondary/70 bg-secondary/10 text-secondary hover:bg-secondary/20'
                                    : 'border-white/10 bg-white/[0.035] text-white/30'
                              }`}
                            >
                              {cell ?? (state.mode === 'connect4' ? columnIndex + 1 : cellIndex + 1)}
                            </button>
                          );
                        }),
                      )}
                    </div>
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                      {mine.isTurn ? 'Your turn.' : `Waiting for ${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? 'the next player'}.`}
                    </p>
                  </div>
                )}

                {state.mode === 'ludo' && (
                  <div className="mx-auto max-w-2xl space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(state.players ?? []).map((player) => (
                        <div key={player.id} className={`rounded-2xl border p-4 ${player.id === state.currentPlayerId ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.035]'}`}>
                          <p className="font-semibold">{player.name}</p>
                          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                            {(state.tokens?.[player.id] ?? []).map((position, index) => (
                              <div key={index} className="rounded-xl border border-white/10 bg-black/30 p-2">
                                T{index + 1}<br /><span className="text-primary">{position < 0 ? 'Yard' : position >= 57 ? 'Home' : position}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
                      <p className="text-sm text-muted-foreground">Dice</p>
                      <p className="mt-1 text-4xl font-black text-primary">{state.pendingRoll ?? '—'}</p>
                    </div>
                    {!isHost && role !== 'crowd' && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {legalIntents.map((intent, index) => (
                          <Button key={index} className="neon-primary rounded-xl" disabled={state.phase !== 'playing'} onClick={() => sendIntent(intent)}>
                            {intent.label ?? (intent.type === 'roll' ? 'Roll dice' : 'Move token')}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {state.mode === 'whot' && (
                  <div className="mx-auto max-w-2xl space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-primary/50 bg-primary/10 p-4 text-center sm:col-span-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Top card</p>
                        <p className="mt-2 text-3xl font-black text-primary">{state.topCard?.label}</p>
                        {state.requestedShape && <p className="mt-1 text-sm">Requested shape: {state.requestedShape}</p>}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Market</p>
                        <p className="mt-2 text-3xl font-black">{state.drawPileCount ?? 0}</p>
                      </div>
                    </div>
                    {!isHost && role !== 'crowd' && (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(mine.hand ?? []).map((card) => {
                            const legal = legalIntents.find((intent) => intent.type === 'play_card' && intent.cardId === card.id);
                            return (
                              <Button key={card.id} variant={legal ? 'default' : 'outline'} disabled={!legal || state.phase !== 'playing'} onClick={() => legal && sendIntent(legal)}>
                                {card.label}
                              </Button>
                            );
                          })}
                        </div>
                        {legalIntents.some((intent) => intent.type === 'draw') && (
                          <Button className="neon-primary w-full rounded-xl" onClick={() => sendIntent({ type: 'draw' })}>Go to market</Button>
                        )}
                      </>
                    )}
                    <p className="text-center text-sm text-muted-foreground">
                      {mine.isTurn ? 'Your turn.' : `Waiting for ${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? 'the next player'}.`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {(role === 'crowd' || (!isHost && mine.seated === false)) && (
              <p className="p-5 text-center text-sm text-muted-foreground">
                You joined after this game started. You’re watching from the crowd and will be seated in the next game.
              </p>
            )}
            {isHost && state.phase !== 'finished' && (
              <div className="border-t border-white/10 p-4 text-center">
                {challenge ? (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">{state.submittedCount ?? 0} of {state.players.length} players locked in</p>
                    <Button className="neon-primary min-w-52 rounded-xl" onClick={() => sendIntent({ type: 'advance' })}>
                      <FastForward className="h-4 w-4" /> {state.phase === 'playing' ? 'Reveal answers' : 'Next round'}
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Board actions are controlled by the active player’s controller.</p>
                )}
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
