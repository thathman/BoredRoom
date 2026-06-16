import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, AlertTriangle } from 'lucide-react';
import { GAME_REGISTRY } from '@/lib/games';
import { GameGlyph } from '@/components/game/GameGlyph';

interface InvalidGameProps {
  reason?: 'unknown_game' | 'game_mismatch' | 'game_disabled';
  detail?: string;
}

export default function InvalidGame({ reason = 'unknown_game', detail }: InvalidGameProps) {
  const navigate = useNavigate();
  const title =
    reason === 'game_mismatch'
      ? 'Wrong game for this room'
      : reason === 'game_disabled'
        ? 'Game temporarily gated'
        : 'Game not found';
  const body =
    reason === 'game_mismatch'
      ? 'This room is running a different game than the URL says. Open the correct link, or go back to the catalog.'
      : reason === 'game_disabled'
        ? 'This game is temporarily unavailable. Please try again shortly.'
        : 'That game does not exist on BoredRoom yet.';

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full glass rounded-2xl p-6 space-y-5 text-center">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <div>
          <h1 className="text-2xl font-display font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-2">{body}</p>
          {detail && <p className="text-xs font-mono mt-2 text-muted-foreground">{detail}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate('/')} className="gap-2 w-full">
            <Home className="w-4 h-4" /> Back to catalog
          </Button>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {GAME_REGISTRY.map((g) => (
              <Button
                key={g.slug}
                size="sm"
                variant="outline"
                onClick={() => navigate(`/${g.slug}/host`)}
                className="gap-2"
              >
                <span className="w-4 h-4 text-primary" aria-hidden="true">
                  <GameGlyph slug={g.slug} className="w-4 h-4" />
                </span>
                {g.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
