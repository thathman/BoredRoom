import { useEffect, useState } from 'react';
import { ArrowRight, Download, Gamepad2, QrCode, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LagosScene } from '@/components/brand/LagosScene';
import { Button } from '@/components/ui/button';
import { getLastHouseSession } from '@/lib/houseSessionResume';
import {
  allowedCorrections,
  detectDeviceClass,
  setDeviceClassCorrection,
  type DeviceClass,
} from '@/lib/deviceExperience';
import { fetchGamesCatalog, type LibraryGame } from '@/lib/serverApi';

function DeviceCorrection({ device }: { device: DeviceClass }) {
  const alternative = allowedCorrections().find((item) => item !== device);
  if (!alternative) return null;
  return (
    <button
      type="button"
      className="mt-5 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-white"
      onClick={() => setDeviceClassCorrection(alternative)}
    >
      Wrong device mode?
    </button>
  );
}

function TabletEntry() {
  const navigate = useNavigate();
  return (
    <LagosScene className="bg-[linear-gradient(180deg,#020817,#06101e)]">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 pb-7 pt-8 text-center">
        <BrandLogo className="mx-auto" />
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="mx-auto max-w-sm text-4xl font-bold leading-[1.05]">How do you want<br />to play today?</h1>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            This tablet can be your controller<br />or your host’s companion.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              className="min-h-60 rounded-3xl border border-primary bg-[#06150f]/80 p-5 text-left shadow-[0_0_28px_rgba(69,243,107,.08)]"
              onClick={() => navigate('/join')}
            >
              <Gamepad2 className="mx-auto h-12 w-12 text-primary" strokeWidth={1.8} />
              <h2 className="mt-7 text-center text-xl font-bold">Use as<br />controller</h2>
              <p className="mt-3 text-center text-xs text-muted-foreground">Join a game as<br />a player.</p>
              <ArrowRight className="mx-auto mt-7 text-primary" />
            </button>
            <button
              className="min-h-60 rounded-3xl border border-secondary bg-[#14091d]/75 p-5 text-left shadow-[0_0_28px_rgba(179,76,255,.08)]"
              onClick={() => navigate('/join?mode=companion')}
            >
              <Users className="mx-auto h-12 w-12 text-secondary" strokeWidth={1.8} />
              <h2 className="mt-7 text-center text-xl font-bold">Pair as host<br />companion</h2>
              <p className="mt-3 text-center text-xs text-muted-foreground">Help the host run<br />the game.</p>
              <ArrowRight className="mx-auto mt-7 text-secondary" />
            </button>
          </div>
          <DeviceCorrection device="tablet" />
        </div>
      </div>
    </LagosScene>
  );
}

function MobileEntry() {
  const navigate = useNavigate();
  return (
    <LagosScene className="bg-[linear-gradient(180deg,#020817,#06101e)]">
      <div className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(26px,env(safe-area-inset-top))] text-center">
        <BrandLogo className="mx-auto text-2xl" />
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto grid grid-cols-2 gap-2 text-2xl font-bold">
            {[1, 2, 3, 4].map((number) => (
              <span key={number} className="grid h-12 w-12 place-items-center rounded-xl border-2 border-primary bg-[#06150f]/90 shadow-[0_0_14px_rgba(69,243,107,.55)]">
                {number}
              </span>
            ))}
          </div>
          <h1 className="mt-7 text-3xl font-bold">Ready to play?</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Join a game in your room<br />with a code from the host.
          </p>
          <Button className="neon-primary mt-7 h-14 w-full rounded-xl text-base font-bold" onClick={() => navigate('/join')}>
            <span className="flex flex-1 items-center justify-center gap-3"><span className="font-mono text-lg">⌨</span> Join with a code</span>
            <ArrowRight />
          </Button>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="h-14 w-full rounded-xl bg-black/25" onClick={() => navigate('/join?scan=1')}>
            <QrCode /> Scan QR code
          </Button>
          <p className="mt-4 text-[10px] text-muted-foreground">You can only join games on this device.</p>
          <DeviceCorrection device="mobile_controller" />
        </div>
      </div>
    </LagosScene>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const device = detectDeviceClass();
  const lastHouse = getLastHouseSession();
  const resumableHouse = lastHouse?.code?.length === 4 ? lastHouse : null;
  const [games, setGames] = useState<LibraryGame[]>([]);

  useEffect(() => {
    void fetchGamesCatalog()
      .then((result) => setGames(result.games.filter((game) => game.installed).slice(0, 6)))
      .catch(() => setGames([]));
  }, []);

  if (device === 'tablet') return <TabletEntry />;
  if (device === 'mobile_controller') return <MobileEntry />;

  return (
    <LagosScene>
      <div className="mx-auto flex min-h-screen max-w-[1536px] flex-col px-8 pb-6 pt-7 lg:px-14">
        <header className="flex items-center justify-between">
          <BrandLogo className="text-4xl" />
          <Button variant="outline" className="rounded-xl bg-black/25 text-xs" onClick={() => window.dispatchEvent(new Event('beforeinstallprompt'))}>
            <Download className="h-4 w-4" /> Add to Home screen
          </Button>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center pb-48 pt-5 text-center">
          <h1 className="brush-display text-5xl uppercase leading-[1.04] text-white sm:text-6xl lg:text-[68px]">
            One room.<br />
            <span className="text-primary">Every phone is<br />a controller.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Multiplayer party games for Nigerians.<br />Same room. Big energy.
          </p>
          <Button className="neon-primary mt-5 h-14 min-w-80 rounded-xl px-8 text-base font-bold" onClick={() => navigate('/start')}>
            <Gamepad2 className="h-5 w-5" /> Host a game night <ArrowRight className="ml-auto" />
          </Button>
          <button className="mt-4 text-sm font-semibold text-secondary hover:text-white" onClick={() => navigate('/games')}>
            Browse games <ArrowRight className="ml-1 inline h-4 w-4" />
          </button>
          {resumableHouse && (
            <button
              className="neon-panel mt-5 flex w-full max-w-2xl items-center gap-4 rounded-2xl px-5 py-3 text-left"
              onClick={() => navigate(`/session/${resumableHouse.code}/display`)}
            >
              <span className="text-3xl">🎨</span>
              <span className="flex-1">
                <span className="block text-xs text-muted-foreground">Resume your last session</span>
                <strong className="block">House {resumableHouse.code}</strong>
              </span>
              <span className="rounded-xl border border-border px-8 py-3 text-sm">Resume <span className="ml-3 text-primary">▶</span></span>
            </button>
          )}
        </section>

        <section className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#020713]/94 px-8 pb-5 pt-3 backdrop-blur-xl lg:px-14">
          <div className="mx-auto max-w-[1424px]">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold">Your games</h2>
                <p className="mt-1 text-xs text-muted-foreground">Jump back in or discover something new.</p>
              </div>
              {games.length === 0 && (
                <button className="text-sm text-primary" onClick={() => navigate('/games')}>Install games <ArrowRight className="inline h-4 w-4" /></button>
              )}
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {games.map((game) => (
                <button
                  key={game.id}
                  className="neon-panel min-w-52 rounded-xl px-4 py-4 text-left hover:border-primary/70"
                  onClick={() => navigate('/games')}
                >
                  <span className="text-4xl">{game.emoji}</span>
                  <strong className="mt-4 block text-sm">{game.name}</strong>
                  <span className="mt-2 block text-xs text-primary">● Installed</span>
                </button>
              ))}
              {games.length === 0 && (
                <button className="neon-panel min-w-64 rounded-xl p-5 text-left" onClick={() => navigate('/games')}>
                  <strong>No games installed</strong>
                  <span className="mt-2 block text-xs text-muted-foreground">Open the Games Library to install your first game.</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </LagosScene>
  );
}
