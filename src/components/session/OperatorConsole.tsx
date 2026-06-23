import { useEffect, useState } from 'react';
import { Loader2, Play, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getGamesForPacks, type PackGame } from '@/lib/packs';
import { getPlayerId } from '@/lib/roomUtils';
import { fetchSession, startGameRun, type StartedRun } from '@/lib/serverApi';

// Operator console (Phase 9 surface): the host runs the night here. Lists the session's lineup and
// starts a GameRun via POST /sessions/:code/runs. Legacy games return a Colyseus room code players
// connect to; adapter games (Phase 8) launch roomless. Settings stay off the public display (Art. IV.2).
export function OperatorConsole({ code, packId }: { code: string; packId?: string }) {
  const [packIds, setPackIds] = useState<string[]>(packId ? [packId] : []);
  const [sessionId, setSessionId] = useState<string>(`local_${code}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [started, setStarted] = useState<{ game: PackGame; run: StartedRun | null } | null>(null);

  useEffect(() => {
    let live = true;
    fetchSession(code)
      .then((s) => {
        if (!live || !s) return;
        setSessionId(s.id);
        if (s.selectedPackIds?.length) setPackIds(s.selectedPackIds);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code]);

  const games = getGamesForPacks(packIds);

  async function start(game: PackGame) {
    setBusy(game.slug);
    try {
      const run = await startGameRun({
        code,
        houseSessionId: sessionId,
        hostDeviceId: getPlayerId(),
        gameType: game.slug,
        packId: packId ?? packIds[0],
      });
      setStarted({ game, run });
    } catch {
      setStarted({ game, run: null });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-md text-left">
      {started ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <Radio className="mx-auto mb-2 h-6 w-6 text-primary" />
          <p className="font-semibold">{started.game.name} is live</p>
          {started.run?.room ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Players join with this room code:</p>
              <p className="mt-2 font-mono text-3xl tracking-[0.3em]">{started.run.room.code}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {started.game.kind === 'adapter' ? 'Adapter game launched.' : 'Started.'}
            </p>
          )}
          <Button variant="outline" className="mt-4" onClick={() => setStarted(null)}>
            Back to lineup
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Start a game</p>
          <div className="space-y-2">
            {games.length === 0 && (
              <p className="text-sm text-muted-foreground">No games in this session yet.</p>
            )}
            {games.map((g) => (
              <div key={g.slug} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{g.emoji}</span>
                  <div>
                    <p className="font-medium leading-none">{g.name}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {g.kind === 'legacy' ? 'live room' : 'adapter'}
                    </Badge>
                  </div>
                </div>
                <Button size="sm" onClick={() => start(g)} disabled={busy !== null}>
                  {busy === g.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" /> Start</>}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
