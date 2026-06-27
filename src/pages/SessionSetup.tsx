import { useEffect, useReducer, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LagosScene } from '@/components/brand/LagosScene';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { createSession, fetchGamesCatalog } from '@/lib/serverApi';
import { detectDeviceClass } from '@/lib/deviceExperience';
import { rememberHouseSession } from '@/lib/houseSessionResume';
import { getPlayerId } from '@/lib/roomUtils';
import { initialSetupState, setupReducer, toCreateSessionInput } from '@/lib/setupFlow';

export default function SessionSetup() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(setupReducer, undefined, initialSetupState);
  const [creating, setCreating] = useState(false);
  const [gameCount, setGameCount] = useState(0);

  useEffect(() => {
    void fetchGamesCatalog()
      .then(({ games }) => setGameCount(games.filter((game) => game.installed).length))
      .catch(() => setGameCount(0));
  }, []);

  if (detectDeviceClass() !== 'desktop_host') {
    return <Navigate to="/" replace />;
  }

  async function start() {
    setCreating(true);
    try {
      const { session } = await createSession(toCreateSessionInput(state, getPlayerId()));
      rememberHouseSession({ code: session.code });
      navigate(`/session/${session.code}/display`);
    } catch {
      toast.error('Could not open the room. Try again.');
      setCreating(false);
    }
  }

  return (
    <LagosScene>
      <div className="mx-auto min-h-screen max-w-6xl px-6 pb-24 pt-7">
        <header className="flex items-center justify-between">
          <BrandLogo />
          <Button variant="outline" className="rounded-xl bg-black/25" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" /> Back home
          </Button>
        </header>
        <section className="mx-auto mt-6 max-w-xl text-center">
          <h1 className="brush-display text-5xl text-white sm:text-6xl">Start a <span className="text-primary">game night</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Set up your game session.</p>

          <div className="neon-panel mt-7 overflow-hidden rounded-2xl text-left">
            <button type="button" className="flex w-full items-center gap-4 border-b border-white/10 px-5 py-4 text-left hover:bg-white/5" onClick={() => navigate('/games')}>
              <span className="text-2xl">🎮</span>
              <div className="flex-1"><strong className="text-sm">Games</strong><p className="text-xs text-muted-foreground">{gameCount} installed</p></div>
              <ArrowRight className="h-4 w-4" />
            </button>
            <label className="flex items-center gap-4 border-b border-white/10 px-5 py-4">
              <span className="text-xl">🤖</span>
              <div className="flex-1"><strong className="text-sm">Allow bots</strong><p className="text-xs text-muted-foreground">Fill available seats when supported</p></div>
              <Switch checked={state.settings.allowBots} onCheckedChange={(value) => dispatch({ type: 'set_setting', key: 'allowBots', value })} />
            </label>
            <label className="flex items-center gap-4 border-b border-white/10 px-5 py-4">
              <span className="text-xl">💡</span>
              <div className="flex-1"><strong className="text-sm">Player hints</strong><p className="text-xs text-muted-foreground">Private, limited assistance</p></div>
              <Switch checked={state.settings.hintsEnabled} onCheckedChange={(value) => dispatch({ type: 'set_setting', key: 'hintsEnabled', value })} />
            </label>
            <label className="flex items-center gap-4 px-5 py-4">
              <span className="text-xl">👥</span>
              <div className="flex-1"><strong className="text-sm">Allow crowd votes</strong><p className="text-xs text-muted-foreground">Audience can vote where supported</p></div>
              <Switch checked={state.settings.allowCrowdVotes} onCheckedChange={(value) => dispatch({ type: 'set_setting', key: 'allowCrowdVotes', value })} />
            </label>
          </div>

          {gameCount === 0 ? (
            <div className="neon-panel mt-5 rounded-2xl p-5">
              <p className="text-sm">You need at least one installed game before opening a room.</p>
              <Button variant="outline" className="mt-4 border-primary text-primary" onClick={() => navigate('/games')}>Go to Games Library</Button>
            </div>
          ) : (
            <Button className="neon-primary mt-5 h-14 w-full rounded-xl text-base font-bold" disabled={creating} onClick={() => void start()}>
              {creating ? <Loader2 className="animate-spin" /> : <>Open the room <ArrowRight className="ml-auto" /></>}
            </Button>
          )}
        </section>
        <BuiltByFooter />
      </div>
    </LagosScene>
  );
}
