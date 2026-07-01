import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';
import { sounds, vibrate } from '@/lib/sounds';

// Money Trivia — original BoredRoom hot-seat cash-ladder surface. Emerald/purple neon with gold
// prize accents on the Lagos-night shell. Handles every role and phase; the correct answer is
// only present after reveal (the runtime withholds it), so nothing here can leak it early.

type Option = { label: string; index: number; removed: boolean };
interface MTState {
  name: string;
  emoji: string;
  phase: 'fastest_finger' | 'hot_seat' | 'finished';
  currency: string;
  ladder: number[];
  safetyNets: number[];
  players: Array<{ id: string; name: string; score: number }>;
  contestant: { id: string; name: string } | null;
  lastAction: string;
  fastestFinger?: { prompt: string; options: string[]; deadline: number | null; submittedCount: number; eligibleCount: number; tieBreak: boolean };
  level?: number;
  currentPrize?: number;
  nextPrize?: number;
  guaranteedPrize?: number;
  question?: { prompt: string; options: Option[] } | null;
  selectedOption?: number | null;
  lockedOption?: number | null;
  questionDeadline?: number | null;
  lifelines?: Record<string, { enabled: boolean; used: boolean }>;
  lifeline?: {
    type: string; deadline: number;
    percentages?: number[]; votesCast?: number;
    helperName?: string; recommendation?: { optionIndex: number; confidence: number } | null;
  } | null;
  lastLifelineHint?: {
    type: string;
    percentages?: number[];
    votesCast?: number;
    helperName?: string;
    recommendation?: { optionIndex: number; confidence: number } | null;
  } | null;
  reveal?: { pending?: boolean; correctIndex?: number; chosenIndex?: number; correct?: boolean; explanation?: string } | null;
  result?: { contestantName?: string; earnedAmount: number; pledgedPrize: number; outcome: string; currency: string; settlementStatus: string };
}
interface MTPrivate {
  isContestant?: boolean;
  role?: 'contestant' | 'audience' | 'fastest_finger';
  fastestFingerSubmitted?: boolean;
  isHelper?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D'];
const money = (n: number, ccy: string) => `${ccy === 'NGN' ? '₦' : ''}${(n ?? 0).toLocaleString()}`;

function Countdown({ deadline }: { deadline: number | null | undefined }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <span className={`tabular-nums font-black ${secs <= 5 ? 'text-red-400' : 'text-amber-300'}`}>{secs}s</span>;
}

export function MoneyTriviaSurface({
  state, mine, role, sendIntent, onMarkPayout,
}: {
  state: MTState;
  mine: MTPrivate;
  role: 'display' | 'controller' | 'crowd' | 'companion';
  sendIntent: (intent: Record<string, unknown>) => void;
  onMarkPayout?: (settlementStatus: 'paid' | 'waived' | 'unsettled') => void;
}) {
  const isHost = role === 'display' || role === 'companion';
  const isContestant = Boolean(mine.isContestant);
  const [ffOrder, setFfOrder] = useState<number[]>([]);

  // Sound cues on phase/reveal transitions.
  const prevReveal = useRef<string>('');
  useEffect(() => {
    const key = `${state.level}:${state.reveal?.correct}`;
    if (state.reveal && !state.reveal.pending && key !== prevReveal.current) {
      prevReveal.current = key;
      if (state.phase === 'finished' && state.result && state.result.earnedAmount > 0) sounds.mtWin?.();
      else if (state.reveal.correct) sounds.mtCorrect?.();
      else sounds.mtWrong?.();
    }
  }, [state.reveal, state.level, state.phase, state.result]);

  useEffect(() => { setFfOrder([]); }, [state.fastestFinger?.prompt]);

  return (
    <main className="star-field min-h-screen bg-[#040316] px-4 pb-6 pt-4 text-white sm:px-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <BrandLogo className="text-2xl" />
          <span className="text-sm font-bold">{state.emoji} {state.name}</span>
        </div>
        <div className="text-xs text-amber-300/90">
          Top prize {money(state.ladder[state.ladder.length - 1], state.currency)}
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-6xl">
        {state.phase === 'fastest_finger' && (
          <FastestFinger state={state} mine={mine} role={role} sendIntent={sendIntent} ffOrder={ffOrder} setFfOrder={setFfOrder} />
        )}
        {state.phase === 'hot_seat' && (
          <HotSeat state={state} mine={mine} role={role} isHost={isHost} isContestant={isContestant} sendIntent={sendIntent} />
        )}
        {state.phase === 'finished' && (
          <Finished state={state} role={role} onMarkPayout={onMarkPayout} />
        )}
      </div>
    </main>
  );
}

function FastestFinger({
  state, mine, role, sendIntent, ffOrder, setFfOrder,
}: {
  state: MTState; mine: MTPrivate; role: string;
  sendIntent: (i: Record<string, unknown>) => void;
  ffOrder: number[]; setFfOrder: (f: (o: number[]) => number[]) => void;
}) {
  const ff = state.fastestFinger;
  const canPlay = role === 'controller' && mine.role === 'fastest_finger' && !mine.fastestFingerSubmitted;
  if (!ff) return null;
  const toggle = (i: number) => {
    setFfOrder((o) => (o.includes(i) ? o.filter((x) => x !== i) : o.length < 4 ? [...o, i] : o));
    vibrate(15);
  };
  return (
    <section className="rounded-3xl border border-secondary/40 bg-black/40 p-5 text-center shadow-[0_0_40px_rgba(124,58,237,.18)]">
      <p className="text-[11px] uppercase tracking-[0.3em] text-secondary">{ff.tieBreak ? 'Tie-breaker' : 'Fastest Finger First'}</p>
      <h1 className="brush-display mt-2 text-2xl sm:text-4xl">{ff.prompt}</h1>
      <p className="mt-2 text-sm text-white/60">{ff.submittedCount}/{ff.eligibleCount} locked in · <Countdown deadline={ff.deadline} /></p>

      <div className="mx-auto mt-5 grid max-w-2xl gap-2 sm:grid-cols-2">
        {ff.options.map((opt, i) => {
          const pos = ffOrder.indexOf(i);
          return (
            <button
              key={i}
              type="button"
              disabled={!canPlay}
              onClick={() => toggle(i)}
              aria-label={`Option ${LETTERS[i]}: ${opt}${pos >= 0 ? `, position ${pos + 1}` : ''}`}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-70 ${
                pos >= 0 ? 'border-primary bg-primary/15 shadow-[0_0_18px_rgba(69,243,107,.25)]' : 'border-white/12 bg-white/[.03]'
              }`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-secondary/50 text-sm font-black text-secondary">
                {pos >= 0 ? pos + 1 : LETTERS[i]}
              </span>
              <span className="flex-1 text-sm font-semibold">{opt}</span>
            </button>
          );
        })}
      </div>

      {canPlay && (
        <div className="mx-auto mt-4 flex max-w-2xl gap-2">
          <Button variant="outline" className="h-12 flex-1 rounded-xl" disabled={ffOrder.length === 0} onClick={() => setFfOrder(() => [])}>Reset</Button>
          <Button
            className="neon-primary h-12 flex-[2] rounded-xl font-bold"
            disabled={ffOrder.length !== 4}
            onClick={() => { sounds.mtLockIn?.(); sendIntent({ type: 'fastest_finger_submit', order: ffOrder }); }}
          >
            Lock in order
          </Button>
        </div>
      )}
      {role === 'controller' && mine.fastestFingerSubmitted && <p className="mt-4 text-sm text-primary">Locked in — waiting for the others…</p>}
      {role === 'controller' && mine.role === 'audience' && <p className="mt-4 text-sm text-white/60">You’re in the audience for this run.</p>}
      <p className="mt-4 text-xs text-white/45">{state.lastAction}</p>
    </section>
  );
}

function MoneyLadder({ state }: { state: MTState }) {
  const level = state.level ?? 0;
  return (
    <div className="rounded-2xl border border-amber-300/25 bg-black/40 p-3">
      <p className="mb-2 text-center text-[10px] uppercase tracking-[0.24em] text-amber-300/80">Money ladder</p>
      <ol className="flex flex-col-reverse gap-1">
        {state.ladder.map((amount, i) => {
          const isCurrent = i === level;
          const isWon = i < level;
          const isNet = state.safetyNets.includes(i + 1);
          return (
            <li
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-1 text-sm ${
                isCurrent ? 'bg-amber-300/20 font-black text-amber-200 shadow-[0_0_14px_rgba(252,211,77,.35)]'
                  : isWon ? 'text-primary/80' : 'text-white/55'
              }`}
            >
              <span className="tabular-nums">{i + 1}{isNet ? ' 🛟' : ''}</span>
              <span className="tabular-nums">{money(amount, state.currency)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function HotSeat({
  state, mine, role, isHost, isContestant, sendIntent,
}: {
  state: MTState; mine: MTPrivate; role: string; isHost: boolean; isContestant: boolean;
  sendIntent: (i: Record<string, unknown>) => void;
}) {
  const q = state.question;
  const reveal = state.reveal;
  const lifeline = state.lifeline;
  const lastHint = state.lastLifelineHint;
  const locked = state.lockedOption != null;
  const lifelinesLeft = useMemo(() => Object.entries(state.lifelines ?? {})
    .filter(([, v]) => v.enabled && !v.used).map(([k]) => k), [state.lifelines]);
  const [pickingHelper, setPickingHelper] = useState(false);
  const [confidence, setConfidence] = useState(65); // helper/host chosen confidence
  const otherPlayers = state.players.filter((p) => p.id !== state.contestant?.id);

  const optionTone = (opt: Option) => {
    if (reveal && !reveal.pending && reveal.correctIndex != null) {
      if (opt.index === reveal.correctIndex) return 'border-primary bg-primary/25 text-primary';
      if (opt.index === reveal.chosenIndex) return 'border-red-500 bg-red-500/15 text-red-300';
      return 'border-white/10 bg-white/[.02] opacity-60';
    }
    if (opt.removed) return 'border-white/5 bg-black/30 opacity-30';
    if (opt.index === state.lockedOption) return 'border-amber-300 bg-amber-300/20 text-amber-100';
    if (opt.index === state.selectedOption) return 'border-secondary bg-secondary/20';
    return 'border-white/12 bg-white/[.03]';
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <MoneyLadder state={state} />

      <section className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-2 text-sm">
          <span>🎤 <span className="font-bold text-secondary">{state.contestant?.name ?? '—'}</span> in the hot seat</span>
          <span className="text-amber-300">Playing for {money(state.nextPrize ?? 0, state.currency)}</span>
        </div>

        {/* Lifeline status row */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(state.lifelines ?? {}).map(([key, v]) => (
            <span key={key} className={`rounded-full border px-3 py-1 text-xs ${v.used || !v.enabled ? 'border-white/10 text-white/35 line-through' : 'border-secondary/50 text-secondary'}`}>
              {LIFELINE_LABEL[key] ?? key}
            </span>
          ))}
        </div>

        {q && (
          <div className="rounded-3xl border border-secondary/30 bg-black/45 p-5">
            <h1 className="text-center text-xl font-bold leading-tight sm:text-3xl">{q.prompt}</h1>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {q.options.map((opt) => (
                <button
                  key={opt.index}
                  type="button"
                  disabled={!isContestant || locked || opt.removed || Boolean(reveal && !reveal.pending) || role !== 'controller'}
                  onClick={() => { sounds.click?.(); sendIntent({ type: 'select_answer', optionIndex: opt.index }); }}
                  aria-label={`Answer ${LETTERS[opt.index]}: ${opt.removed ? 'removed' : opt.label}`}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:cursor-default ${optionTone(opt)}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current text-sm font-black">{LETTERS[opt.index]}</span>
                  <span className="flex-1 text-sm font-semibold">{opt.removed ? '—' : opt.label}</span>
                </button>
              ))}
            </div>

            {reveal && !reveal.pending && reveal.explanation && (
              <p className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3 text-center text-sm text-white/80">{reveal.explanation}</p>
            )}

            {/* Ask-the-Room live tally (anonymous). */}
            {lifeline?.type === 'ask_room' && lifeline.percentages && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {lifeline.percentages.map((pct, i) => (
                  <div key={i} className="text-center">
                    <div className="flex h-20 items-end rounded bg-white/5"><div className="w-full rounded bg-secondary/70" style={{ height: `${pct}%` }} /></div>
                    <span className="text-xs text-white/70">{LETTERS[i]} · {pct}%</span>
                  </div>
                ))}
              </div>
            )}
            {lifeline?.type === 'ask_player' && lifeline.recommendation && (
              <p className="mt-3 text-center text-sm text-secondary">{lifeline.helperName} suggests {LETTERS[lifeline.recommendation.optionIndex]} ({lifeline.recommendation.confidence}% sure)</p>
            )}
            {lifeline?.type === 'ask_host' && lifeline.recommendation && (
              <p className="mt-3 text-center text-sm text-amber-300">Host leans {LETTERS[lifeline.recommendation.optionIndex]} ({lifeline.recommendation.confidence}% sure)</p>
            )}
            {!lifeline && lastHint?.type === 'ask_player' && lastHint.recommendation && (
              <p className="mt-3 rounded-xl border border-secondary/35 bg-secondary/10 p-3 text-center text-sm text-secondary" role="status">
                {lastHint.helperName ?? 'Your player'} suggests {LETTERS[lastHint.recommendation.optionIndex]} ({lastHint.recommendation.confidence}% sure)
              </p>
            )}
            {!lifeline && lastHint?.type === 'ask_host' && lastHint.recommendation && (
              <p className="mt-3 rounded-xl border border-amber-300/35 bg-amber-300/10 p-3 text-center text-sm text-amber-200" role="status">
                Host suggests {LETTERS[lastHint.recommendation.optionIndex]} ({lastHint.recommendation.confidence}% sure)
              </p>
            )}
            {!lifeline && lastHint?.type === 'ask_room' && lastHint.percentages && (
              <p className="mt-3 rounded-xl border border-secondary/35 bg-secondary/10 p-3 text-center text-sm text-secondary" role="status">
                Room vote: {lastHint.percentages.map((pct, index) => `${LETTERS[index]} ${pct}%`).join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Contestant controls */}
        {role === 'controller' && isContestant && (!reveal || reveal.pending) && (
          <div className="space-y-2">
            {!locked && (
              <Button
                className="neon-primary h-14 w-full rounded-xl text-base font-bold"
                disabled={state.selectedOption == null}
                onClick={() => { sounds.mtLockIn?.(); sendIntent({ type: 'lock_answer' }); }}
              >
                Final answer{state.selectedOption != null ? `: ${LETTERS[state.selectedOption]}` : ''}
              </Button>
            )}
            {!locked && lifelinesLeft.length > 0 && !lifeline && !pickingHelper && (
              <div className="grid grid-cols-2 gap-2">
                {lifelinesLeft.map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    className="h-11 rounded-xl text-xs"
                    onClick={() => {
                      // Ask a Player prompts an explicit contestant choice instead of auto-picking.
                      if (key === 'ask_player') setPickingHelper(true);
                      else sendIntent({ type: 'use_lifeline', lifeline: key });
                    }}
                  >
                    {LIFELINE_LABEL[key] ?? key}
                  </Button>
                ))}
              </div>
            )}
            {pickingHelper && (
              <div className="rounded-xl border border-secondary/40 bg-black/40 p-3">
                <p className="mb-2 text-xs text-white/70">Ask which player?</p>
                <div className="grid grid-cols-2 gap-2">
                  {otherPlayers.map((p) => (
                    <Button key={p.id} variant="outline" className="h-11 rounded-xl text-xs"
                      onClick={() => { sendIntent({ type: 'use_lifeline', lifeline: 'ask_player', targetPlayerId: p.id }); setPickingHelper(false); }}>
                      {p.name}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" className="mt-2 h-9 w-full text-xs" onClick={() => setPickingHelper(false)}>Cancel</Button>
              </div>
            )}
            {!locked && (
              <Button variant="outline" className="h-11 w-full rounded-xl text-amber-300" onClick={() => sendIntent({ type: 'walk_away' })}>
                Walk away with {money(state.currentPrize ?? 0, state.currency)}
              </Button>
            )}
          </div>
        )}

        {/* Audience: vote during Ask the Room. */}
        {role === 'controller' && !isContestant && lifeline?.type === 'ask_room' && (
          <div className="grid grid-cols-2 gap-2">
            {(q?.options ?? []).map((opt) => (
              <Button key={opt.index} variant="outline" disabled={opt.removed} className="h-12 rounded-xl" onClick={() => sendIntent({ type: 'audience_vote', optionIndex: opt.index })}>
                {LETTERS[opt.index]}
              </Button>
            ))}
          </div>
        )}
        {/* Helper: pick a confidence, then recommend, during Ask One Player. */}
        {role === 'controller' && mine.isHelper && lifeline?.type === 'ask_player' && (
          <div className="space-y-2">
            <ConfidencePicker value={confidence} onChange={setConfidence} />
            <div className="grid grid-cols-2 gap-2">
              {(q?.options ?? []).map((opt) => (
                <Button key={opt.index} variant="outline" disabled={opt.removed} className="h-12 rounded-xl" onClick={() => sendIntent({ type: 'friend_answer', optionIndex: opt.index, confidence })}>
                  Suggest {LETTERS[opt.index]}
                </Button>
              ))}
            </div>
          </div>
        )}
        {role === 'controller' && !isContestant && !mine.isHelper && lifeline?.type !== 'ask_room' && (
          <p className="text-center text-sm text-white/55">Cheer on {state.contestant?.name ?? 'the contestant'} 👀</p>
        )}

        {/* Host/companion controls. */}
        {isHost && (
          <div className="flex flex-wrap gap-2">
            {locked && reveal?.pending && (
              <Button className="neon-primary h-12 flex-1 rounded-xl" onClick={() => sendIntent({ type: 'reveal_answer' })}>Reveal answer</Button>
            )}
            {reveal && !reveal.pending && reveal.correct && (
              <Button className="neon-primary h-12 flex-1 rounded-xl" onClick={() => sendIntent({ type: 'advance' })}>Next question</Button>
            )}
            {lifeline?.type === 'ask_host' && !lifeline.recommendation && (
              <div className="w-full space-y-2">
                <ConfidencePicker value={confidence} onChange={setConfidence} />
                <div className="grid grid-cols-2 gap-2">
                  {(q?.options ?? []).map((opt) => (
                    <Button key={opt.index} variant="outline" disabled={opt.removed} className="h-12 rounded-xl" onClick={() => sendIntent({ type: 'host_answer', optionIndex: opt.index, confidence })}>
                      Advise {LETTERS[opt.index]}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {state.questionDeadline && <Button variant="outline" className="h-12 rounded-xl" onClick={() => sendIntent({ type: 'resolve_timeout' })}>Time up</Button>}
          </div>
        )}

        <p className="text-center text-xs text-white/45">{state.lastAction}</p>
      </section>
    </div>
  );
}

function Finished({ state, role, onMarkPayout }: { state: MTState; role: string; onMarkPayout?: (s: 'paid' | 'waived' | 'unsettled') => void }) {
  const r = state.result;
  const isHost = role === 'display' || role === 'companion';
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-amber-300/40 bg-black/45 p-6 text-center shadow-[0_0_50px_rgba(252,211,77,.18)]">
      <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300">Final answer</p>
      <h1 className="brush-display mt-2 text-4xl">{r?.contestantName ?? 'Contestant'}</h1>
      <p className="mt-2 text-5xl font-black tabular-nums text-amber-200">{money(r?.earnedAmount ?? 0, r?.currency ?? state.currency)}</p>
      <p className="mt-2 text-sm text-white/70">{OUTCOME_LABEL[r?.outcome ?? ''] ?? state.lastAction}</p>
      <p className="mt-1 text-xs text-white/45">Host-funded prize · BoredRoom never collects or transfers money.</p>

      {isHost && r && (
        <div className="mt-5">
          <p className="text-xs text-white/55">Settlement: <span className="font-bold text-white/80">{r.settlementStatus}</span></p>
          <div className="mt-2 flex gap-2">
            <Button className="neon-primary h-11 flex-1 rounded-xl" onClick={() => onMarkPayout?.('paid')}>Mark paid</Button>
            <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => onMarkPayout?.('waived')}>Waive</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ConfidencePicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const levels: Array<[string, number]> = [['Not sure', 40], ['Fairly sure', 65], ['Very sure', 90]];
  return (
    <div className="flex gap-2" role="group" aria-label="Confidence">
      {levels.map(([label, n]) => (
        <Button key={n} variant={value === n ? 'default' : 'outline'} className={`h-9 flex-1 rounded-lg text-xs ${value === n ? 'neon-primary' : ''}`} onClick={() => onChange(n)}>{label}</Button>
      ))}
    </div>
  );
}

const LIFELINE_LABEL: Record<string, string> = {
  fifty_fifty: '50:50', ask_room: 'Ask the Room', ask_player: 'Ask a Player', ask_host: 'Ask the Host',
};
const OUTCOME_LABEL: Record<string, string> = {
  top_prize: 'Top prize! 🏆', walked_away: 'Walked away', wrong_answer: 'Wrong answer',
  timeout_walk: 'Time up — walked away', timeout_wrong: 'Time up — counted wrong',
};
