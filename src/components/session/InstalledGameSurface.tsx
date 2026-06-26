import { useEffect, useMemo, useState } from 'react';
import { Check, FastForward, Trophy, Users } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sounds, vibrate } from '@/lib/sounds';

type PlayerScore = { id: string; name: string; score: number };
type Challenge = { kind: 'choice' | 'number' | 'text' | 'order'; prompt: string; options?: string[] };
type WhotCard = { id?: string; label: string; shape?: string; number?: number; isWhot?: boolean };
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
  topCard?: WhotCard;
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
  hand?: Array<WhotCard & { id: string }>;
  legalIntents?: Array<Record<string, unknown> & { label?: string }>;
};

const whotShapeGlyph: Record<string, string> = {
  Circle: '●',
  Triangle: '▲',
  Cross: '✚',
  Square: '■',
  Star: '★',
  Whot: 'W',
};

function whotCardTone(card?: WhotCard): string {
  if (!card) return 'from-white/10 to-white/5 border-white/20';
  if (card.isWhot || card.shape === 'Whot') return 'from-purple-500/30 to-fuchsia-500/10 border-secondary/70 text-secondary';
  if (card.shape === 'Circle') return 'from-emerald-400/25 to-emerald-400/5 border-primary/70 text-primary';
  if (card.shape === 'Triangle') return 'from-amber-300/25 to-amber-300/5 border-amber-200/70 text-amber-200';
  if (card.shape === 'Cross') return 'from-sky-300/25 to-sky-400/5 border-sky-200/70 text-sky-200';
  if (card.shape === 'Square') return 'from-rose-300/25 to-rose-400/5 border-rose-200/70 text-rose-200';
  if (card.shape === 'Star') return 'from-violet-300/25 to-violet-400/5 border-violet-200/70 text-violet-200';
  return 'from-white/10 to-white/5 border-white/20';
}

function WhotCardFace({
  card,
  disabled,
  playable,
  compact = false,
}: {
  card?: WhotCard;
  disabled?: boolean;
  playable?: boolean;
  compact?: boolean;
}) {
  const shape = card?.shape ?? (card?.isWhot ? 'Whot' : '');
  const glyph = whotShapeGlyph[shape] ?? (shape.slice(0, 1) || 'W');
  const number = card?.number ?? card?.label.match(/\d+/)?.[0] ?? (card?.isWhot ? '20' : '');
  return (
    <div
      className={`whot-card-face relative grid ${compact ? 'h-28 w-20' : 'h-40 w-28'} place-items-center overflow-hidden rounded-2xl border bg-gradient-to-br p-3 shadow-[0_18px_36px_rgba(0,0,0,.32)] transition ${
        whotCardTone(card)
      } ${playable ? 'scale-105 ring-2 ring-primary/70' : ''} ${disabled ? 'opacity-45 grayscale' : ''}`}
    >
      <span className="absolute left-2 top-2 text-lg font-black">{number}</span>
      <span className={`${compact ? 'text-4xl' : 'text-6xl'} drop-shadow-[0_0_14px_currentColor]`}>{glyph}</span>
      <span className="absolute bottom-2 right-2 rotate-180 text-lg font-black">{number}</span>
    </div>
  );
}

function WhotCardBack({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative grid ${compact ? 'h-24 w-16' : 'h-32 w-24'} place-items-center overflow-hidden rounded-2xl border border-primary/50 bg-[#031209] shadow-[0_0_22px_rgba(69,243,107,.22)]`}>
      <div className="absolute inset-2 rounded-xl border border-primary/70" />
      <span className="brush-display text-3xl text-primary">B</span>
    </div>
  );
}

const ludoPalette = [
  { name: 'Emerald', token: 'bg-primary text-[#031008]', glow: 'shadow-[0_0_18px_rgba(69,243,107,.65)]', border: 'border-primary/80', area: 'bg-primary/10' },
  { name: 'Violet', token: 'bg-secondary text-white', glow: 'shadow-[0_0_18px_rgba(179,76,255,.65)]', border: 'border-secondary/80', area: 'bg-secondary/10' },
  { name: 'Amber', token: 'bg-amber-300 text-black', glow: 'shadow-[0_0_18px_rgba(252,211,77,.55)]', border: 'border-amber-300/80', area: 'bg-amber-300/10' },
  { name: 'Sky', token: 'bg-sky-300 text-black', glow: 'shadow-[0_0_18px_rgba(125,211,252,.55)]', border: 'border-sky-300/80', area: 'bg-sky-300/10' },
];

const ludoPath = (() => {
  const cells: Array<{ row: number; col: number }> = [];
  for (let col = 1; col <= 13; col += 1) cells.push({ row: 1, col });
  for (let row = 2; row <= 13; row += 1) cells.push({ row, col: 13 });
  for (let col = 13; col >= 1; col -= 1) cells.push({ row: 13, col });
  for (let row = 12; row >= 2; row -= 1) cells.push({ row, col: 1 });
  return cells;
})();

const ludoHomeCells = [
  { row: 5, col: 7 },
  { row: 6, col: 7 },
  { row: 7, col: 7 },
  { row: 8, col: 7 },
  { row: 9, col: 7 },
  { row: 7, col: 6 },
];

const ludoYards = [
  { row: 2, col: 2, className: 'items-start justify-start' },
  { row: 2, col: 10, className: 'items-start justify-end' },
  { row: 10, col: 10, className: 'items-end justify-end' },
  { row: 10, col: 2, className: 'items-end justify-start' },
];

function ludoTokenLabel(index: number) {
  return ['A', 'B', 'C', 'D'][index] ?? String(index + 1);
}

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
                  <div className="mx-auto w-full max-w-5xl">
                    <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                      <div className="ludo-board relative mx-auto aspect-square w-full max-w-[720px] overflow-hidden rounded-[2rem] border border-primary/25 bg-[#071018] p-3 shadow-[inset_0_0_70px_rgba(0,0,0,.55),0_0_34px_rgba(69,243,107,.12)]">
                        <div className="grid h-full w-full grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] gap-1">
                          {ludoPath.map((cell, index) => {
                            const safe = [0, 8, 13, 21, 26, 34, 39, 47].includes(index);
                            return (
                              <div
                                key={`path-${index}`}
                                className={`ludo-cell rounded-md border text-[9px] ${safe ? 'border-primary/55 bg-primary/18 text-primary' : 'border-white/10 bg-white/[0.045] text-white/28'}`}
                                style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
                              >
                                {safe ? '★' : ''}
                              </div>
                            );
                          })}
                          {ludoHomeCells.map((cell, index) => (
                            <div
                              key={`home-${index}`}
                              className="ludo-cell rounded-md border border-primary/50 bg-primary/15 text-[9px] text-primary"
                              style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
                            >
                              HOME
                            </div>
                          ))}
                        </div>

                        <div className="absolute inset-[34%] grid place-items-center rounded-3xl border border-primary/40 bg-[radial-gradient(circle,rgba(69,243,107,.22),rgba(2,8,23,.9))] text-center shadow-[0_0_28px_rgba(69,243,107,.18)]">
                          <p className="brush-display text-4xl text-primary">Ludo</p>
                          <p className="text-xs text-white/60">Race home</p>
                        </div>

                        {(state.players ?? []).map((player, playerIndex) => {
                          const palette = ludoPalette[playerIndex % ludoPalette.length];
                          const yard = ludoYards[playerIndex % ludoYards.length];
                          const tokens = state.tokens?.[player.id] ?? [];
                          return (
                            <div
                              key={`yard-${player.id}`}
                              className={`absolute grid h-[25%] w-[25%] ${yard.className} rounded-[1.5rem] border ${palette.border} ${palette.area} p-3`}
                              style={{
                                top: `${(yard.row / 15) * 100}%`,
                                left: `${(yard.col / 15) * 100}%`,
                              }}
                            >
                              <p className="mb-2 truncate text-xs font-bold">{player.name}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {tokens.map((position, tokenIndex) => {
                                  if (position >= 0) return null;
                                  const legal = legalIntents.find((intent) => intent.type === 'move_token' && intent.tokenIndex === tokenIndex);
                                  return (
                                    <button
                                      key={`yard-token-${player.id}-${tokenIndex}`}
                                      type="button"
                                      disabled={isHost || role === 'crowd' || !legal || state.phase !== 'playing'}
                                      onClick={() => {
                                        if (!legal) return;
                                        sounds.tokenMove();
                                        vibrate(45);
                                        sendIntent(legal);
                                      }}
                                      className={`ludo-token ${palette.token} ${palette.glow} ${legal ? 'ring-2 ring-white/80' : ''}`}
                                      aria-label={`${player.name} token ${tokenIndex + 1} in yard`}
                                    >
                                      {ludoTokenLabel(tokenIndex)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {(state.players ?? []).flatMap((player, playerIndex) => {
                          const palette = ludoPalette[playerIndex % ludoPalette.length];
                          const tokens = state.tokens?.[player.id] ?? [];
                          return tokens.map((position, tokenIndex) => {
                            if (position < 0) return null;
                            const cell = position >= 52
                              ? ludoHomeCells[Math.min(position - 52, ludoHomeCells.length - 1)]
                              : ludoPath[(position + playerIndex * 13) % ludoPath.length];
                            const legal = player.id === state.currentPlayerId
                              ? legalIntents.find((intent) => intent.type === 'move_token' && intent.tokenIndex === tokenIndex)
                              : null;
                            return (
                              <button
                                key={`track-token-${player.id}-${tokenIndex}`}
                                type="button"
                                disabled={isHost || role === 'crowd' || !legal || state.phase !== 'playing'}
                                onClick={() => {
                                  if (!legal) return;
                                  sounds.tokenMove();
                                  vibrate(45);
                                  sendIntent(legal);
                                }}
                                className={`ludo-token absolute ${palette.token} ${palette.glow} ${legal ? 'ring-2 ring-white/80' : ''}`}
                                style={{
                                  top: `calc(${(cell.row / 15) * 100}% + 2px + ${(tokenIndex % 2) * 12}px)`,
                                  left: `calc(${(cell.col / 15) * 100}% + 2px + ${Math.floor(tokenIndex / 2) * 12}px)`,
                                }}
                                aria-label={`${player.name} token ${tokenIndex + 1} at ${position >= 57 ? 'home' : `position ${position}`}`}
                              >
                                {ludoTokenLabel(tokenIndex)}
                              </button>
                            );
                          });
                        })}
                      </div>

                      <aside className="space-y-4">
                        <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4 text-center">
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Dice</p>
                          <div className="ludo-die mx-auto mt-3 grid h-24 w-24 place-items-center rounded-3xl border border-primary/60 bg-primary/10 text-5xl font-black text-primary shadow-[0_0_28px_rgba(69,243,107,.22)]">
                            {state.pendingRoll ?? '•'}
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">
                            {mine.isTurn ? 'Your turn.' : `Waiting for ${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? 'the next player'}.`}
                          </p>
                        </div>

                        <div className="space-y-2">
                          {(state.players ?? []).map((player, playerIndex) => {
                            const palette = ludoPalette[playerIndex % ludoPalette.length];
                            const active = player.id === state.currentPlayerId;
                            return (
                              <div key={`rail-${player.id}`} className={`rounded-2xl border p-3 ${active ? `${palette.border} ${palette.area}` : 'border-white/10 bg-white/[0.035]'}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`h-4 w-4 rounded-full ${palette.token}`} />
                                  <strong className="min-w-0 flex-1 truncate text-sm">{player.name}</strong>
                                  <span className="text-xs text-muted-foreground">{player.score}</span>
                                </div>
                                <div className="mt-2 flex gap-1">
                                  {(state.tokens?.[player.id] ?? []).map((position, index) => (
                                    <span key={index} className="rounded-full bg-black/35 px-2 py-1 text-[10px] text-white/65">
                                      {position < 0 ? 'Yard' : position >= 57 ? 'Home' : position}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {!isHost && role !== 'crowd' && (
                          <div className="grid gap-2">
                            {legalIntents.map((intent, index) => (
                              <Button
                                key={index}
                                className="neon-primary h-13 rounded-xl"
                                disabled={state.phase !== 'playing'}
                                onClick={() => {
                                  if (intent.type === 'roll') sounds.ludoDiceGlassRoll();
                                  else sounds.tokenMove();
                                  vibrate(intent.type === 'roll' ? [30, 20, 30] : 45);
                                  sendIntent(intent);
                                }}
                              >
                                {intent.label ?? (intent.type === 'roll' ? 'Roll dice' : 'Move token')}
                              </Button>
                            ))}
                          </div>
                        )}
                      </aside>
                    </div>
                  </div>
                )}

                {state.mode === 'whot' && (
                  <div className="mx-auto w-full max-w-5xl">
                    <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-primary/25 bg-[radial-gradient(circle_at_50%_48%,rgba(20,92,52,.92),rgba(4,24,18,.96)_42%,rgba(2,8,23,.98)_72%)] p-5 shadow-[inset_0_0_90px_rgba(0,0,0,.45),0_0_42px_rgba(69,243,107,.12)]">
                      <div className="pointer-events-none absolute inset-8 rounded-full border border-primary/15" />
                      <div className="pointer-events-none absolute inset-[18%] rounded-full border border-white/10 bg-black/10" />
                      <div className="absolute inset-x-4 top-4 flex flex-wrap justify-center gap-3">
                        {(state.players ?? []).map((player, index) => {
                          const active = player.id === state.currentPlayerId;
                          return (
                            <div
                              key={player.id}
                              className={`whot-seat flex min-w-28 items-center gap-2 rounded-2xl border px-3 py-2 ${
                                active ? 'border-primary bg-primary/15 shadow-[0_0_20px_rgba(69,243,107,.28)]' : 'border-white/10 bg-black/28'
                              }`}
                              style={{ animationDelay: `${index * 80}ms` }}
                            >
                              <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/50 bg-primary/10 text-xs font-black">
                                {player.name.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-bold">{player.name}</span>
                                <span className="block text-[10px] text-muted-foreground">{player.handCount ?? 0} cards</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 grid-cols-2 items-center gap-7">
                        <div className="text-center">
                          <button
                            type="button"
                            disabled={isHost || role === 'crowd' || !legalIntents.some((intent) => intent.type === 'draw') || state.phase !== 'playing'}
                            onClick={() => {
                              sounds.hustleCard();
                              vibrate(35);
                              sendIntent({ type: 'draw' });
                            }}
                            className="group relative disabled:cursor-default"
                          >
                            <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-xl transition group-enabled:group-hover:bg-primary/25" />
                            <WhotCardBack />
                          </button>
                          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/60">Market · {state.drawPileCount ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <div className="whot-played-card">
                            <WhotCardFace card={state.topCard} />
                          </div>
                          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/60">
                            {state.requestedShape ? `Requested ${state.requestedShape}` : 'Discard'}
                          </p>
                        </div>
                      </div>

                      <div className="absolute inset-x-4 bottom-4 text-center">
                        <div className="mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm backdrop-blur">
                          <span className={mine.isTurn ? 'text-primary' : 'text-muted-foreground'}>
                            {mine.isTurn ? 'Your turn — play a card or go market.' : `Waiting for ${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? 'the next player'}.`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isHost && role !== 'crowd' && (
                      <div className="mt-5 rounded-3xl border border-white/10 bg-black/35 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Your hand</h2>
                          <span className="text-xs text-primary">{(mine.hand ?? []).length} cards</span>
                        </div>
                        <div className="flex min-h-44 gap-3 overflow-x-auto pb-3">
                          {(mine.hand ?? []).map((card, index) => {
                            const legal = legalIntents.find((intent) => intent.type === 'play_card' && intent.cardId === card.id);
                            return (
                              <button
                                key={card.id}
                                type="button"
                                disabled={!legal || state.phase !== 'playing'}
                                onClick={() => {
                                  if (!legal) return;
                                  sounds.hustleCard();
                                  vibrate(45);
                                  sendIntent(legal);
                                }}
                                className="whot-hand-card shrink-0 disabled:cursor-not-allowed"
                                style={{ animationDelay: `${index * 45}ms` }}
                                aria-label={legal ? `Play ${card.label}` : `${card.label} cannot be played now`}
                              >
                                <WhotCardFace card={card} disabled={!legal} playable={Boolean(legal)} />
                              </button>
                            );
                          })}
                        </div>
                        {legalIntents.some((intent) => intent.type === 'draw') && (
                          <Button
                            className="neon-primary h-14 w-full rounded-xl"
                            onClick={() => {
                              sounds.hustleCard();
                              vibrate(35);
                              sendIntent({ type: 'draw' });
                            }}
                          >
                            Go to market
                          </Button>
                        )}
                      </div>
                    )}
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
