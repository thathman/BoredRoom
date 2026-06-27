import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LibraryGame } from '@/lib/serverApi';

// Pre-game configuration shown for EVERY game before it starts. Universal knobs (rounds, pace,
// bots, hints) map to the runtime settings; the pace setting drives a fast-paced reveal/turn
// timer so a round never drags. Game-specific extras can be layered on later per game.
export type GamePace = 'relaxed' | 'normal' | 'fast' | 'blitz';

const PACE_MS: Record<GamePace, number> = { relaxed: 0, normal: 20000, fast: 12000, blitz: 7000 };
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

  function start() {
    const timerMs = PACE_MS[pace];
    onStart({
      rounds,
      questionCount: rounds, // content games key off questionCount
      pace,
      timerMs,
      revealCountdownMs: pace === 'blitz' ? 3000 : pace === 'fast' ? 4000 : 5000,
      botCount,
      bots: botCount, // legacy alias
      hintsEnabled,
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
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Rounds</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[3, 5, 7, 10].map((n) => (
                <Button key={n} variant={rounds === n ? 'default' : 'outline'} className={rounds === n ? 'neon-primary h-11 rounded-xl' : 'h-11 rounded-xl'} onClick={() => setRounds(n)}>{n}</Button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Pace (round timer)</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {(Object.keys(PACE_MS) as GamePace[]).map((p) => (
                <Button key={p} variant={pace === p ? 'default' : 'outline'} className={pace === p ? 'neon-primary h-11 rounded-xl text-xs' : 'h-11 rounded-xl text-xs'} onClick={() => setPace(p)}>{PACE_LABEL[p]}</Button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-white/45">{PACE_MS[pace] === 0 ? 'No timer — take your time.' : `${PACE_MS[pace] / 1000}s per round, then auto-advance.`}</p>
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
        </div>

        <Button className="neon-primary mt-7 h-14 w-full rounded-xl text-base font-bold" onClick={start}>Start {game.name}</Button>
      </div>
    </div>
  );
}
