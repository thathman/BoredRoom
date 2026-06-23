import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { HeroSky } from '@/components/game/HeroSky';
import { GameGlyph } from '@/components/game/GameGlyph';
import { GAME_REGISTRY, classifyDeviceForGame } from '@/lib/games';
import { ContinueSessionCard } from '@/components/system/ContinueSessionCard';
import { resetPwaCacheAndReload } from '@/lib/pwa';
import { toast } from 'sonner';

export default function Index() {
  const navigate = useNavigate();
  const defaultRole = classifyDeviceForGame();
  const buildHash = (import.meta.env.VITE_BUILD_HASH as string | undefined) ?? 'dev';
  const appVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

  const onPickGame = (slug: string) => {
    const role = classifyDeviceForGame();
    navigate(`/${slug}/${role}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pb-10 relative overflow-hidden">
      {/* Hero band: night sky + skyline + header */}
      <div className="relative w-full -mx-6 px-6 pt-16 pb-24" style={{ minHeight: '620px' }}>
        <HeroSky />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center max-w-5xl w-full mx-auto"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h1 className="display-text neon-text mb-3">
              Bored<span className="text-secondary">Room</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Pick a game. Share the screen. Play together in the same room.
            </p>
            <div className="mt-6">
              <Button size="lg" onClick={() => navigate('/start')} className="rounded-2xl">
                <Gamepad2 className="w-5 h-5 mr-2" /> Host a game night
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">Pick a pack. Gather the room. Let the house play.</p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-10 text-center max-w-6xl w-full"
      >
        {/* Flat catalog — no categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-left"
        >
          {GAME_REGISTRY.filter((game) => game.enabled !== false).map((game) => (
            <button
              key={game.slug}
              onClick={() => onPickGame(game.slug)}
              disabled={game.enabled === false}
              className="group glass rounded-3xl p-6 text-left transition-all hover:-translate-y-1 hover:scale-[1.01] hover:border-primary/50 border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100"
              aria-label={`Play ${game.name}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-primary group-hover:text-secondary transition-colors">
                  <GameGlyph slug={game.slug} className="w-14 h-14" />
                </div>
                {game.enabled === false && (
                  <span className="text-[10px] uppercase tracking-wider font-display px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                    Gated
                  </span>
                )}
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

        <div className="mb-6 max-w-2xl mx-auto">
          <ContinueSessionCard />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mb-10"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(defaultRole === 'host' ? '/display/stats' : '/profile')}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <User className="w-4 h-4" />
            {defaultRole === 'host' ? 'Display stats' : 'View profile & stats'}
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-8 justify-center text-sm text-muted-foreground flex-wrap"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-neon" />
            No app install
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse-neon" />
            2–8 players
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse-neon" />
            One screen, one room
          </div>
        </motion.div>

        <BuiltByFooter />
      </motion.div>

      <button
        type="button"
        className="fixed bottom-3 right-3 z-30 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[10px] font-mono text-muted-foreground backdrop-blur hover:text-foreground"
        onClick={() =>
          toast('Having stale-version issues?', {
            description: 'Reset cached app assets and reload this page.',
            action: {
              label: 'Reset cache',
              onClick: () => { void resetPwaCacheAndReload(); },
            },
          })
        }
      >
        v{appVersion} · build {buildHash}
      </button>
    </div>
  );
}
