import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Smartphone, ArrowRight, Grid3x3, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { HeroSky } from '@/components/game/HeroSky';
import { classifyDeviceForGame } from '@/lib/games';
import { getAllGames } from '@/lib/catalog';
import { ContinueSessionCard } from '@/components/system/ContinueSessionCard';
import { getLastHouseSession } from '@/lib/houseSessionResume';
import { resetPwaCacheAndReload } from '@/lib/pwa';
import { toast } from 'sonner';

// Pack-first landing (spec: pack-first landing page). Phones join as controllers; bigger screens
// host the night. The legacy single-game catalog lives at /games.
export default function Index() {
  const navigate = useNavigate();
  const isPhone = classifyDeviceForGame() === 'join';
  const buildHash = (import.meta.env.VITE_BUILD_HASH as string | undefined) ?? 'dev';
  const appVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';
  const lastHouse = getLastHouseSession();
  const gameCount = getAllGames().length;

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pb-10 relative overflow-hidden">
      {/* Hero */}
      <div className="relative w-full -mx-6 px-6 pt-16 pb-24" style={{ minHeight: '620px' }}>
        <HeroSky />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center max-w-5xl w-full mx-auto"
        >
          <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="display-text neon-text mb-3">
            Bored<span className="text-secondary">Room</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Gather the room. Pick any game. Play together on one screen.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            {isPhone ? (
              <>
                <Button size="lg" onClick={() => navigate('/join')} className="rounded-2xl">
                  <Smartphone className="w-5 h-5 mr-2" /> Join a game night
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  Phones are controllers. Host a night from a TV, laptop, or tablet.
                </p>
              </>
            ) : (
              <>
                <Button size="lg" onClick={() => navigate('/start')} className="rounded-2xl">
                  <Gamepad2 className="w-5 h-5 mr-2" /> Host a game night
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/join')}>
                  Joining from this device? Enter a code
                </Button>
              </>
            )}
            {lastHouse && (
              <Button
                variant="outline"
                onClick={() =>
                  navigate(`/session/${lastHouse.code}/display?pack=${encodeURIComponent(lastHouse.packId ?? '')}`)
                }
                className="rounded-2xl"
              >
                Continue your house ({lastHouse.code})
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-10 w-full max-w-6xl"
      >
        {/* Your server's games + pack management (packs install games, you don't pick a pack to play) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-left mb-10">
          <button
            onClick={() => navigate('/games')}
            className="group glass rounded-3xl p-6 text-left transition-all hover:-translate-y-1 hover:border-primary/50 border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Grid3x3 className="w-10 h-10 text-primary" />
            <div className="mt-4 flex items-center gap-2">
              <h3 className="text-2xl font-display font-bold">{gameCount} games installed</h3>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Browse everything you can play in a room.</p>
          </button>
          <button
            onClick={() => navigate('/packs')}
            className="group glass rounded-3xl p-6 text-left transition-all hover:-translate-y-1 hover:border-primary/50 border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Package className="w-10 h-10 text-secondary" />
            <div className="mt-4 flex items-center gap-2">
              <h3 className="text-2xl font-display font-bold">Game packs</h3>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Install more games from a GitHub repo.</p>
          </button>
        </div>

        <div className="mb-8 max-w-2xl mx-auto">
          <ContinueSessionCard />
        </div>

        <div className="flex gap-8 justify-center text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-neon" /> No app install
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse-neon" /> One screen, one room
          </div>
        </div>

        <BuiltByFooter />
      </motion.div>

      <button
        type="button"
        className="fixed bottom-3 right-3 z-30 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[10px] font-mono text-muted-foreground backdrop-blur hover:text-foreground"
        onClick={() =>
          toast('Having stale-version issues?', {
            description: 'Reset cached app assets and reload this page.',
            action: { label: 'Reset cache', onClick: () => { void resetPwaCacheAndReload(); } },
          })
        }
      >
        v{appVersion} · build {buildHash}
      </button>
    </div>
  );
}
