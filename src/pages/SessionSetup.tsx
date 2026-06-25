import { useEffect, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Smartphone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import {
  initialSetupState,
  setupReducer,
  toCreateSessionInput,
  SETUP_STEPS,
  type SetupSettings,
} from '@/lib/setupFlow';
import { getPlayerId } from '@/lib/roomUtils';
import { createSession, fetchGamesCatalog } from '@/lib/serverApi';
import { detectDeviceClass } from '@/lib/deviceExperience';
import { rememberHouseSession } from '@/lib/houseSessionResume';
import { toast } from 'sonner';

const STEP_TITLE = ['Set the house rules', 'Review & start'];

const SETTING_LABELS: { key: keyof SetupSettings; label: string; hint: string }[] = [
  { key: 'allowBots', label: 'Allow bots', hint: 'Fill empty seats with AI players.' },
  { key: 'hintsEnabled', label: 'Hints', hint: 'Let players earn limited hints.' },
  { key: 'allowCrowdVotes', label: 'Crowd can vote', hint: 'Spectators help decide what to play.' },
];

export default function SessionSetup() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(setupReducer, undefined, initialSetupState);
  const [creating, setCreating] = useState(false);
  const stepIdx = SETUP_STEPS.indexOf(state.step);
  const [gameCount, setGameCount] = useState(0);
  useEffect(() => {
    void fetchGamesCatalog().then(({ games }) => setGameCount(games.filter((game) => game.installed).length)).catch(() => {});
  }, []);

  if (detectDeviceClass() !== 'desktop_host') {
    return (
      <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Smartphone className="w-7 h-7" />
        </span>
        <h1 className="text-xl font-bold">Hosting belongs on the big screen</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Start the public display on a TV, desktop, or laptop. Tablets can join as a controller or
          pair as a private host companion.
        </p>
        <Button className="mt-6 rounded-2xl" onClick={() => navigate('/join')}>Join as controller</Button>
        <Button variant="ghost" className="mt-2" onClick={() => navigate('/')}>Back home</Button>
      </div>
    );
  }

  async function start() {
    setCreating(true);
    try {
      const { session } = await createSession(toCreateSessionInput(state, getPlayerId()));
      rememberHouseSession({ code: session.code });
      toast.success(`Room ${session.code} ready`);
      navigate(`/session/${session.code}/display`);
    } catch {
      toast.error('Could not start the room. Try again.');
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      <header className="px-5 pt-6 pb-3 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold leading-none">Start a game night</h1>
          <p className="text-xs text-muted-foreground mt-1">Create the room — pick games once everyone’s in.</p>
        </div>
      </header>

      <div className="px-5 flex items-center gap-2">
        {STEP_TITLE.map((t, i) => (
          <div key={t} className="flex items-center gap-2">
            <span className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${i <= stepIdx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {i < stepIdx ? <Check className="w-4 h-4" /> : i + 1}
            </span>
            {i < STEP_TITLE.length - 1 && <span className="w-6 h-px bg-border" />}
          </div>
        ))}
        <span className="ml-2 text-sm font-medium">{STEP_TITLE[stepIdx]}</span>
      </div>

      <main className="flex-1 px-5 py-5 overflow-y-auto">
        {state.step === 'settings' && (
          <div className="max-w-md space-y-2">
            {SETTING_LABELS.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <Switch checked={state.settings[key] as boolean} onCheckedChange={(value) => dispatch({ type: 'set_setting', key, value })} />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4">
              <div>
                <p className="font-medium">Language</p>
                <p className="text-xs text-muted-foreground">Host & prompts language.</p>
              </div>
              <div className="flex gap-1">
                {(['en', 'pcm'] as const).map((lang) => (
                  <Button key={lang} size="sm" variant={state.settings.language === lang ? 'default' : 'outline'} onClick={() => dispatch({ type: 'set_setting', key: 'language', value: lang })}>
                    {lang === 'en' ? 'English' : 'Pidgin'}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {state.step === 'review' && (
          <div className="max-w-md space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm">
                A room will open with <span className="font-bold">{gameCount} installed games</span> ready to play.
              </p>
            </div>
            {gameCount === 0 && (
              <Button variant="outline" className="w-full" onClick={() => navigate('/games')}>
                Install games first
              </Button>
            )}
            <Button className="w-full" size="lg" onClick={start} disabled={creating || gameCount === 0}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open the room'}
            </Button>
          </div>
        )}
      </main>

      <footer className="px-5 py-4 flex items-center justify-between border-t border-border">
        <Button variant="ghost" onClick={() => (stepIdx === 0 ? navigate('/') : dispatch({ type: 'back' }))} disabled={creating}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {stepIdx === 0 ? 'Home' : 'Back'}
        </Button>
        {state.step !== 'review' && (
          <Button onClick={() => dispatch({ type: 'next' })}>
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </footer>
      <BuiltByFooter />
    </div>
  );
}
