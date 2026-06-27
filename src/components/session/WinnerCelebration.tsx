import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '@/lib/sounds';
import { recordGameResult } from '@/lib/playerProfile';

// Fires once per finished game: a confetti burst + win chime, records the result on this device's
// profile (for achievements), and shows a winner-name banner. Keyed so it never double-fires.
export function WinnerCelebration({
  fireKey,
  winnerNames,
  iWon,
  isController,
}: {
  fireKey: string; // unique per game run (e.g. gameType + endedAt)
  winnerNames: string[];
  iWon: boolean;
  isController: boolean;
}) {
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (firedRef.current === fireKey) return;
    firedRef.current = fireKey;

    // Record this game on the player's profile (controllers/crowd only — hosts aren't players).
    if (isController) recordGameResult(iWon);

    sounds.win();
    const end = Date.now() + 1200;
    const colors = ['#45f36b', '#a855f7', '#f59e0b', '#38bdf8'];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.4 }, colors });
  }, [fireKey, iWon, isController]);

  return (
    <div className="pointer-events-none mt-2 text-center">
      <p className="brush-display text-3xl text-primary drop-shadow-[0_0_16px_rgba(69,243,107,.6)] sm:text-4xl">
        🎉 {winnerNames.length ? `${winnerNames.join(', ')} wins!` : 'Game over!'}
      </p>
      {iWon && isController && <p className="mt-1 text-sm text-secondary">That's you — nice one! 🏆</p>}
    </div>
  );
}
