import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { GameGlyph } from '@/components/game/GameGlyph';
import { GAME_REGISTRY, classifyDeviceForGame } from '@/lib/games';

// Legacy single-game catalog. The pack-first landing (/) is primary; this page keeps the original
// one-game-one-room flow reachable (spec routing: /games).
export default function Games() {
  const navigate = useNavigate();
  const onPickGame = (slug: string) => navigate(`/${slug}/${classifyDeviceForGame()}`);

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col px-6 py-8">
      <header className="max-w-6xl w-full mx-auto flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold">All games</h1>
          <p className="text-sm text-muted-foreground">Jump straight into a single game room.</p>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl w-full mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {GAME_REGISTRY.filter((game) => game.enabled !== false).map((game) => (
          <button
            key={game.slug}
            onClick={() => onPickGame(game.slug)}
            className="group glass rounded-3xl p-6 text-left transition-all hover:-translate-y-1 hover:border-primary/50 border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Play ${game.name}`}
          >
            <div className="text-primary group-hover:text-secondary transition-colors">
              <GameGlyph slug={game.slug} className="w-14 h-14" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <h3 className="text-2xl font-display font-bold">{game.name}</h3>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{game.tagline}</p>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground/80">
              {game.minPlayers === game.maxPlayers ? `${game.maxPlayers}` : `${game.minPlayers}-${game.maxPlayers}`} players
            </p>
          </button>
        ))}
      </motion.div>
      <BuiltByFooter />
    </div>
  );
}
