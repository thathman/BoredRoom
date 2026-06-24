import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllGames, type CatalogGame } from '@/lib/catalog';
import { getPlayerId } from '@/lib/roomUtils';
import { fetchSession, startGameRun, listPacks, type StartedRun } from '@/lib/serverApi';

// Operator console (Phase 9 surface): the host runs the night here. Lists the session's lineup and
// starts a GameRun via POST /sessions/:code/runs. Legacy games return a Colyseus room code players
// connect to; adapter games (Phase 8) launch roomless. Settings stay off the public display (Art. IV.2).
export function OperatorConsole({ code }: { code: string; packId?: string }) {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string>(`local_${code}`);
  const [games, setGames] = useState<CatalogGame[]>(getAllGames());
  const [busy, setBusy] = useState<string | null>(null);
  const [started, setStarted] = useState<{ game: CatalogGame; run: StartedRun | null } | null>(null);

  useEffect(() => {
    let live = true;
    fetchSession(code)
      .then((s) => {
        if (live && s) setSessionId(s.id);
      })
      .catch(() => {});
    // All installed games are available in any room (built-in + pack-installed).
    listPacks()
      .then((packs) => {
        if (!live) return;
        const packGames: CatalogGame[] = packs.flatMap((p) =>
          p.manifest.games.map((g) => ({
            slug: g.slug,
            name: g.name,
            emoji: g.emoji,
            tagline: g.tagline,
            minPlayers: g.minPlayers,
            maxPlayers: g.maxPlayers,
            kind: 'adapter' as const,
          })),
        );
        const seen = new Set(getAllGames().map((g) => g.slug));
        setGames([...getAllGames(), ...packGames.filter((g) => !seen.has(g.slug))]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code]);

  async function start(game: CatalogGame) {
    setBusy(game.slug);
    try {
      const run = await startGameRun({
        code,
        houseSessionId: sessionId,
        hostDeviceId: getPlayerId(),
        gameType: game.slug,
      });
      setStarted({ game, run });
    } catch {
      setStarted({ game, run: null });
    } finally {
      setBusy(null);
    }
  }

  // Enter the live Colyseus room for a started legacy game, reusing the existing host-token flow.
  function openGameRoom(game: CatalogGame, run: StartedRun) {
    if (!run.room) return;
    sessionStorage.setItem('boredroom_is_host', 'true');
    sessionStorage.setItem('boredroom_game_type', game.slug);
    sessionStorage.setItem('boredroom_host_token', run.room.hostToken);
    sessionStorage.setItem('boredroom_room_code', run.room.code);
    navigate(`/${game.slug}/room/${run.room.code}`);
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
              <Button className="mt-4 w-full" onClick={() => openGameRoom(started.game, started.run!)}>
                Open game room
              </Button>
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
            {games.map((g) => {
              // Only legacy games have a live play surface today. Adapter/pack games have engines
              // but no room/UI yet — show them as coming soon instead of dead-ending on Start.
              const playable = g.kind === 'legacy';
              return (
                <div key={g.slug} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{g.emoji}</span>
                    <div>
                      <p className={`font-medium leading-none ${playable ? '' : 'text-muted-foreground'}`}>{g.name}</p>
                      {!playable && (
                        <Badge variant="outline" className="mt-1 text-[10px]">Coming soon</Badge>
                      )}
                    </div>
                  </div>
                  {playable ? (
                    <Button size="sm" onClick={() => start(g)} disabled={busy !== null}>
                      {busy === g.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" /> Start</>}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled>Soon</Button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
