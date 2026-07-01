import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LibraryGame } from '@/lib/serverApi';

// Pre-game configuration shown for EVERY game before it starts. Universal knobs (rounds, pace,
// bots, hints) map to the runtime settings; the pace setting drives a fast-paced reveal/turn
// timer so a round never drags. Game-specific extras can be layered on later per game.
export type GamePace = 'relaxed' | 'normal' | 'fast' | 'blitz';

const PACE_MS: Record<GamePace, number> = { relaxed: 0, normal: 45000, fast: 30000, blitz: 15000 };
const PACE_LABEL: Record<GamePace, string> = { relaxed: 'Relaxed', normal: 'Normal', fast: 'Fast', blitz: 'Blitz ⚡' };

export interface GameConfig {
  rounds: number;
  pace: GamePace;
  timerMs: number; // 0 = no timer
  revealCountdownMs: number;
  botCount: number;
  hintsEnabled: boolean;
}

export function defaultConfig(): GameConfig {
  return { rounds: 5, pace: 'normal', timerMs: PACE_MS.normal, revealCountdownMs: 5000, botCount: 0, hintsEnabled: true };
}

// Game-specific knobs — ONLY keys the deployed runtimes actually read (no placeholder UI).
// `toggle` carries a boolean; `select` carries the chosen option value verbatim into run settings.
type ExtraField =
  | { key: string; label: string; type: 'toggle'; default: boolean }
  | { key: string; label: string; type: 'select'; default: string | number; options: Array<{ value: string | number; label: string }> };

const GAME_EXTRAS: Record<string, ExtraField[]> = {
  whot: [
    { key: 'initialHandSize', label: 'Starting cards per player', type: 'select', default: 6, options: [
      { value: 4, label: '4 · Quick' },
      { value: 5, label: '5' },
      { value: 6, label: '6 · Classic' },
    ] },
    { key: 'specialCards', label: 'Special cards (pick-2, hold-on, general market, WHOT)', type: 'toggle', default: true },
    { key: 'enableDirection', label: 'Card 11 reverses play direction', type: 'toggle', default: false },
    { key: 'allowSpecialFinish', label: 'Allow an action card or Whot 20 to win a round', type: 'toggle', default: true },
    { key: 'pickDefence', label: 'Defending pick cards', type: 'select', default: 'stack_same', options: [
      { value: 'stack_same', label: 'Stack same' },
      { value: 'stack_any', label: 'Stack 2 or 5' },
      { value: 'no_stack', label: 'No blocking' },
    ] },
    { key: 'starSuspension', label: 'Star 8 suspension', type: 'select', default: 'skip_two', options: [
      { value: 'skip_two', label: 'Skip next 2' },
      { value: 'skip_one', label: 'Skip next 1' },
    ] },
    { key: 'generalMarketTurn', label: 'After General Market', type: 'select', default: 'keep', options: [
      { value: 'keep', label: 'Play again' },
      { value: 'pass', label: 'Pass turn' },
    ] },
    { key: 'rotateStarter', label: 'Rotate the starting player each round', type: 'toggle', default: true },
    { key: 'timeoutPenalty', label: 'When time runs out', type: 'select', default: 'draw_and_pass', options: [
      { value: 'draw_and_pass', label: 'Pick 1 + lose turn' },
      { value: 'pass', label: 'Lose turn' },
      { value: 'draw_one', label: 'Pick 1 + continue' },
    ] },
  ],
  ettt: [
    { key: 'teamMode', label: 'Team mode', type: 'toggle', default: false },
    { key: 'activeMarkLimit', label: 'Marks before rolling', type: 'select', default: 3, options: [{ value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }] },
    { key: 'targetScore', label: 'Wins to take the round', type: 'select', default: 3, options: [{ value: 1, label: '1' }, { value: 3, label: '3' }, { value: 5, label: '5' }] },
  ],
  'connect-4': [
    { key: 'teamMode', label: 'Team mode', type: 'toggle', default: false },
    { key: 'bestOf', label: 'Best of', type: 'select', default: 1, options: [{ value: 1, label: '1' }, { value: 3, label: '3' }, { value: 5, label: '5' }] },
  ],
  'faith-feud': [
    { key: 'steals', label: 'Allow steals', type: 'toggle', default: true },
    { key: 'aiSurveys', label: 'AI-generated surveys', type: 'toggle', default: true },
  ],
  hustle: [
    { key: 'quickMode', label: 'Quick mode (shorter board)', type: 'toggle', default: false },
    { key: 'diceMode', label: 'Dice', type: 'select', default: 'single', options: [{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }] },
    { key: 'eventDensity', label: 'Wahala/opportunity density', type: 'select', default: 0.15, options: [{ value: 0.1, label: 'Low' }, { value: 0.15, label: 'Medium' }, { value: 0.25, label: 'High' }] },
  ],
  landlord: [
    { key: 'quickMode', label: 'Quick mode', type: 'toggle', default: false },
    { key: 'startingCash', label: 'Starting cash', type: 'select', default: 50000, options: [{ value: 30000, label: '₦30k' }, { value: 50000, label: '₦50k' }, { value: 80000, label: '₦80k' }] },
  ],
  logo: [
    { key: 'revealStages', label: 'Reveal stages', type: 'select', default: 5, options: [{ value: 3, label: '3' }, { value: 5, label: '5' }, { value: 7, label: '7' }] },
  ],
  'market-price': [
    { key: 'tolerance', label: 'Accepted tolerance', type: 'select', default: 15, options: [{ value: 10, label: '±10%' }, { value: 15, label: '±15%' }, { value: 20, label: '±20%' }] },
  ],
  'pidgin-translator': [
    { key: 'mode', label: 'Input mode', type: 'select', default: 'speed_voice', options: [{ value: 'speed_voice', label: 'Voice' }, { value: 'text', label: 'Text' }] },
    { key: 'direction', label: 'Direction', type: 'select', default: 'pidgin_to_english', options: [{ value: 'pidgin_to_english', label: 'Pidgin → English' }, { value: 'english_to_pidgin', label: 'English → Pidgin' }] },
  ],
  'color-wahala': [
    { key: 'difficulty', label: 'Difficulty', type: 'select', default: 'medium', options: [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }] },
  ],
  'word-wahala': [
    { key: 'rackSize', label: 'Rack size', type: 'select', default: 7, options: [{ value: 5, label: '5' }, { value: 6, label: '6' }, { value: 7, label: '7' }] },
  ],
  'half-half': [
    { key: 'mode', label: 'Mode', type: 'select', default: 'split_vote', options: [{ value: 'split_vote', label: 'Split vote' }, { value: 'midpoint', label: 'Midpoint' }] },
  ],
  'bible-timeline': [
    { key: 'aiEvents', label: 'AI-generated events', type: 'toggle', default: true },
  ],
  // Money Trivia — cash hot-seat. ageBand picks the approved bank; prizes/timers/lifelines tune
  // the run. Lifeline toggles are flattened here and re-nested into a `lifelines` object on start.
  trivia: [
    { key: 'ageBand', label: 'Age band', type: 'select', default: 'adult', options: [{ value: 'pre_teen', label: 'Pre-teen' }, { value: 'teen', label: 'Teen' }, { value: 'adult', label: 'Adult' }] },
    { key: 'startingPrize', label: 'Starting prize', type: 'select', default: 100, options: [{ value: 100, label: '₦100' }, { value: 500, label: '₦500' }] },
    { key: 'topPrize', label: 'Top prize', type: 'select', default: 5000, options: [{ value: 5000, label: '₦5k' }, { value: 10000, label: '₦10k' }, { value: 50000, label: '₦50k' }] },
    { key: 'fastestFingerSeconds', label: 'Fastest finger timer', type: 'select', default: 10, options: [{ value: 8, label: '8s' }, { value: 10, label: '10s' }, { value: 15, label: '15s' }] },
    { key: 'questionSeconds', label: 'Question timer', type: 'select', default: 0, options: [{ value: 0, label: 'None' }, { value: 30, label: '30s' }, { value: 45, label: '45s' }, { value: 60, label: '60s' }, { value: 90, label: '90s' }] },
    { key: 'timeoutOutcome', label: 'When time runs out', type: 'select', default: 'walk_away', options: [{ value: 'walk_away', label: 'Walk away' }, { value: 'wrong_answer', label: 'Wrong answer' }] },
    { key: 'll_fifty_fifty', label: 'Lifeline: 50:50', type: 'toggle', default: true },
    { key: 'll_ask_room', label: 'Lifeline: Ask the Room', type: 'toggle', default: true },
    { key: 'll_ask_player', label: 'Lifeline: Ask a Player', type: 'toggle', default: true },
    { key: 'll_ask_host', label: 'Lifeline: Ask the Host', type: 'toggle', default: true },
  ],
};

export function GameConfigSheet({
  game,
  readyPlayers,
  onStart,
  onCancel,
}: {
  game: LibraryGame;
  readyPlayers: number;
  onStart: (config: GameConfig & Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const maxBots = Math.max(0, game.maxPlayers - readyPlayers);
  const [rounds, setRounds] = useState(5);
  const [pace, setPace] = useState<GamePace>('normal');
  const [botCount, setBotCount] = useState(Math.max(0, Math.min(maxBots, Math.max(0, game.minPlayers - readyPlayers))));
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [customSeconds, setCustomSeconds] = useState(45);
  const extraFields = GAME_EXTRAS[game.id] ?? [];
  const [extras, setExtras] = useState<Record<string, string | number | boolean>>(
    () => Object.fromEntries(extraFields.map((f) => [f.key, f.default])),
  );
  // Money Trivia is a real-money game: a host-funded confirmation is required before start.
  const isMoney = game.id === 'trivia';
  const [hostFundedConfirmed, setHostFundedConfirmed] = useState(false);

  function start() {
    const turnSeconds = pace === 'relaxed' ? 0 : Math.min(180, Math.max(10, Math.trunc(customSeconds)));
    const timerMs = game.id === 'whot' ? turnSeconds * 1000 : PACE_MS[pace];
    let moneyExtras: Record<string, unknown> = {};
    if (isMoney) {
      // Re-nest the flat lifeline toggles into the object the runtime expects, and pass the gate.
      const { ll_fifty_fifty, ll_ask_room, ll_ask_player, ll_ask_host, ...rest } = extras;
      moneyExtras = {
        ...rest,
        lifelines: {
          fifty_fifty: ll_fifty_fifty !== false,
          ask_room: ll_ask_room !== false,
          ask_player: ll_ask_player !== false,
          ask_host: ll_ask_host !== false,
        },
        hostFundedConfirmed,
      };
    }
    onStart({
      rounds,
      questionCount: rounds, // content games key off questionCount
      pace,
      timerMs,
      turnSeconds,
      revealCountdownMs: pace === 'blitz' ? 3000 : pace === 'fast' ? 4000 : 5000,
      botCount,
      bots: botCount, // legacy alias
      hintsEnabled,
      ...(isMoney ? moneyExtras : extras),
    });
  }

  return (
    <div className="fixed inset-0 z-[85] overflow-y-auto bg-[#020817]/96 p-5 backdrop-blur-xl">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between">
          <h1 className="brush-display text-3xl">{game.emoji} Configure <span className="text-primary">{game.name}</span></h1>
          <Button variant="outline" className="rounded-xl bg-black/40" onClick={onCancel}>Back</Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{readyPlayers} ready player(s) · {game.minPlayers}–{game.maxPlayers} seats</p>

        <div className="mt-6 space-y-5">
          {/* Money Trivia has a fixed 15-question ladder — the generic Rounds/Pace knobs don't apply. */}
          {game.id !== 'whot' && !isMoney && <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Rounds</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[3, 5, 7, 10].map((n) => (
                <Button key={n} variant={rounds === n ? 'default' : 'outline'} className={rounds === n ? 'neon-primary h-11 rounded-xl' : 'h-11 rounded-xl'} onClick={() => setRounds(n)}>{n}</Button>
              ))}
            </div>
          </div>}

          <div className={isMoney ? 'hidden' : ''}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{game.id === 'whot' ? 'Turn time' : 'Pace (round timer)'}</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {(Object.keys(PACE_MS) as GamePace[]).map((p) => (
                <Button key={p} variant={pace === p ? 'default' : 'outline'} className={pace === p ? 'neon-primary h-11 rounded-xl text-xs' : 'h-11 rounded-xl text-xs'} onClick={() => { setPace(p); if (p !== 'relaxed') setCustomSeconds(PACE_MS[p] / 1000); }}>{PACE_LABEL[p]}{p === 'relaxed' ? '' : ` · ${PACE_MS[p] / 1000}s`}</Button>
              ))}
            </div>
            {game.id === 'whot' && pace !== 'relaxed' && (
              <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                Custom seconds
                <Input className="h-10 w-24 bg-black/30 text-center" type="number" inputMode="numeric" min={10} max={180} value={customSeconds} onChange={(event) => setCustomSeconds(Number(event.target.value) || 10)} />
              </label>
            )}
            <p className="mt-1 text-[11px] text-white/45">{pace === 'relaxed' ? 'No timer — take your time.' : game.id === 'whot' ? `${customSeconds}s per turn. The selected timeout penalty is applied automatically.` : `${PACE_MS[pace] / 1000}s per round, then auto-advance.`}</p>
          </div>

          {game.capabilities.bots && (
            <div className="flex items-center justify-between">
              <p className="text-sm">🤖 Bots: <span className="text-primary">{botCount}</span></p>
              <div className="flex gap-2">
                <Button variant="outline" className="h-9 w-9 rounded-xl p-0" disabled={botCount <= 0} onClick={() => setBotCount((b) => Math.max(0, b - 1))}>−</Button>
                <Button variant="outline" className="h-9 w-9 rounded-xl p-0" disabled={botCount >= maxBots} onClick={() => setBotCount((b) => Math.min(maxBots, b + 1))}>+</Button>
              </div>
            </div>
          )}

          {game.capabilities.hints && (
            <label className="flex items-center justify-between text-sm">
              💡 Hints enabled
              <input type="checkbox" checked={hintsEnabled} onChange={(e) => setHintsEnabled(e.target.checked)} />
            </label>
          )}

          {extraFields.length > 0 && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{game.name} rules</p>
              {extraFields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex-1">{f.label}</span>
                  {f.type === 'toggle' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(extras[f.key])}
                      onChange={(e) => setExtras((s) => ({ ...s, [f.key]: e.target.checked }))}
                    />
                  ) : (
                    <div className="flex flex-wrap justify-end gap-1">
                      {f.options.map((o) => (
                        <Button
                          key={String(o.value)}
                          variant={extras[f.key] === o.value ? 'default' : 'outline'}
                          className={`h-9 rounded-lg px-3 text-xs ${extras[f.key] === o.value ? 'neon-primary' : ''}`}
                          onClick={() => setExtras((s) => ({ ...s, [f.key]: o.value }))}
                        >
                          {o.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isMoney && (
          <label className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/5 p-4 text-sm">
            <input type="checkbox" className="mt-1" checked={hostFundedConfirmed} onChange={(e) => setHostFundedConfirmed(e.target.checked)} />
            <span className="text-white/80">
              I confirm this prize is <b>host-funded</b>, no purchase or entry fee is required to play, and
              <b> BoredRoom does not collect, hold, transfer or guarantee any payment.</b>
            </span>
          </label>
        )}

        <Button
          className="neon-primary mt-7 h-14 w-full rounded-xl text-base font-bold"
          disabled={isMoney && !hostFundedConfirmed}
          onClick={start}
        >
          Start {game.name}
        </Button>
      </div>
    </div>
  );
}
