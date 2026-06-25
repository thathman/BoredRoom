import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gamepad2, Grid3x3, Monitor, Smartphone, Tablet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { HeroSky } from '@/components/game/HeroSky';
import { getLastHouseSession } from '@/lib/houseSessionResume';
import {
  allowedCorrections,
  detectDeviceClass,
  setDeviceClassCorrection,
  type DeviceClass,
} from '@/lib/deviceExperience';
import { fetchGamesCatalog, type LibraryGame } from '@/lib/serverApi';

function DeviceCorrection({ device }: { device: DeviceClass }) {
  const alternatives = allowedCorrections().filter((item) => item !== device);
  if (alternatives.length === 0) return null;
  return (
    <button
      type="button"
      className="mt-5 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
      onClick={() => setDeviceClassCorrection(alternatives[0])}
    >
      Wrong device mode? Use {alternatives[0] === 'tablet' ? 'tablet controls' : 'desktop hosting'}
    </button>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const device = detectDeviceClass();
  const lastHouse = getLastHouseSession();
  const resumableHouse = lastHouse?.code?.length === 4 ? lastHouse : null;
  const [games, setGames] = useState<LibraryGame[]>([]);

  useEffect(() => {
    void fetchGamesCatalog().then((result) => setGames(result.games.filter((game) => game.installed).slice(0, 6))).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative min-h-[760px] px-5 pb-20 pt-8 sm:px-8 lg:min-h-[820px]">
        <HeroSky />
        <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between">
          <button className="flex items-center gap-2 text-left" onClick={() => navigate('/')}>
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/35 bg-primary/10">
              <Gamepad2 className="h-5 w-5 text-primary" />
            </span>
            <span className="font-display text-xl font-bold">Bored<span className="text-primary">Room</span></span>
          </button>
          <Button variant="ghost" onClick={() => navigate('/games')}>
            <Grid3x3 /> Games Library
          </Button>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[610px] max-w-7xl items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className={`max-w-3xl pt-12 ${device === 'desktop_host' ? 'text-center' : ''}`}
          >
            {device === 'desktop_host' && (
              <>
                <h1 className="mx-auto max-w-3xl font-display text-5xl font-bold uppercase leading-[0.92] tracking-[-0.055em] sm:text-7xl lg:text-[92px]">
                  One room.<br /><span className="text-primary">Every phone</span><br />is a controller.
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Put BoredRoom on the big screen, invite everyone with one code, and move between games without making anybody join again.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button size="lg" className="h-14 rounded-xl px-7 text-base font-bold" onClick={() => navigate('/start')}>
                    <Monitor /> Host a game night <ArrowRight />
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 rounded-xl px-7" onClick={() => navigate('/games')}>
                    Browse games
                  </Button>
                </div>
                {resumableHouse && (
                  <button
                    className="mx-auto mt-5 flex items-center gap-3 rounded-xl border border-border/70 bg-card/55 px-4 py-3 text-left backdrop-blur hover:border-primary/50"
                    onClick={() => navigate(`/session/${resumableHouse.code}/display`)}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary))]" />
                    <span><strong>Continue house {resumableHouse.code}</strong><br /><span className="text-xs text-muted-foreground">Resume on this host display</span></span>
                  </button>
                )}
              </>
            )}

            {device === 'tablet' && (
              <>
                <Tablet className="h-12 w-12 text-primary" />
                <h1 className="mt-5 max-w-2xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-[-0.045em] sm:text-7xl">
                  How is this tablet joining?
                </h1>
                <p className="mt-5 max-w-xl text-muted-foreground">Use it as a player controller or pair it privately with the host display.</p>
                <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
                  <Button size="lg" className="h-20 justify-start rounded-2xl px-5" onClick={() => navigate('/join')}>
                    <Smartphone className="h-6 w-6" />
                    <span className="text-left"><strong className="block">Player controller</strong><span className="text-xs font-normal opacity-75">Join with the room code</span></span>
                  </Button>
                  <Button size="lg" variant="outline" className="h-20 justify-start rounded-2xl px-5" onClick={() => navigate('/join?mode=companion')}>
                    <Users className="h-6 w-6" />
                    <span className="text-left"><strong className="block">Host companion</strong><span className="text-xs font-normal opacity-75">Pair with owner approval</span></span>
                  </Button>
                </div>
              </>
            )}

            {device === 'mobile_controller' && (
              <>
                <Smartphone className="h-12 w-12 text-primary" />
                <h1 className="mt-5 font-display text-6xl font-bold uppercase leading-[0.92] tracking-[-0.05em]">
                  Your phone<br />is the controller.
                </h1>
                <p className="mt-5 max-w-md text-muted-foreground">Enter the four-character code on the host screen. Your controls change automatically with every game.</p>
                <Button size="lg" className="mt-8 h-14 rounded-xl px-8 text-base font-bold" onClick={() => navigate('/join')}>
                  Join game night <ArrowRight />
                </Button>
              </>
            )}
            <DeviceCorrection device={device} />
          </motion.div>
        </div>
      </section>

      <section className="relative z-20 -mt-14 border-t border-primary/15 bg-background/90 px-5 py-10 backdrop-blur-xl sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold">Ready on this server</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {games.length ? 'Installed games appear inside every host session.' : 'The library is empty. Install the games you want.'}
              </p>
            </div>
            <Button variant="ghost" onClick={() => navigate('/games')}>Games Library <ArrowRight /></Button>
          </div>
          {games.length > 0 && (
            <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
              {games.map((game) => (
                <div key={game.id} className="min-w-56 rounded-2xl border border-border/70 bg-card/70 p-4">
                  <span className="text-3xl">{game.emoji}</span>
                  <h3 className="mt-3 font-display text-lg font-bold">{game.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{game.description}</p>
                </div>
              ))}
            </div>
          )}
          <BuiltByFooter />
        </div>
      </section>
    </main>
  );
}
