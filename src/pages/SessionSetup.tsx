import { useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { ThemeProvider } from '@/components/system/ThemeProvider';
import { PACK_REGISTRY } from '@/lib/packs';
import { getGamesForPacks } from '@/lib/packs';
import {
  initialSetupState,
  setupReducer,
  canAdvance,
  toCreateSessionInput,
  selectedPacks,
  SETUP_STEPS,
  type SetupSettings,
} from '@/lib/setupFlow';
import { getPlayerId } from '@/lib/roomUtils';
import { createSession } from '@/lib/serverApi';
import { rememberHouseSession } from '@/lib/houseSessionResume';
import { toast } from 'sonner';

const STEP_TITLE = ['Pick your packs', 'Set the house rules', 'Review & start'];

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
  const activePackId = state.selectedPackIds[0];

  async function start() {
    setCreating(true);
    try {
      const session = await createSession(toCreateSessionInput(state, getPlayerId()));
      const pack = session.activePackId ?? activePackId ?? '';
      rememberHouseSession({ code: session.code, packId: pack || undefined });
      toast.success(`House session ${session.code} ready`);
      navigate(`/session/${session.code}/display?pack=${encodeURIComponent(pack)}`);
    } catch {
      toast.error('Could not start the session. Try again.');
      setCreating(false);
    }
  }

  return (
    <ThemeProvider packId={activePackId}>
      <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
        <header className="px-5 pt-6 pb-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold leading-none">Host a game night</h1>
            <p className="text-xs text-muted-foreground mt-1">Pick a pack. Gather the room. Let the house play.</p>
          </div>
        </header>

        {/* Step rail */}
        <div className="px-5 flex items-center gap-2">
          {STEP_TITLE.map((t, i) => (
            <div key={t} className="flex items-center gap-2">
              <span
                className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold transition-colors ${
                  i <= stepIdx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < stepIdx ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              {i < STEP_TITLE.length - 1 && <span className="w-6 h-px bg-border" />}
            </div>
          ))}
          <span className="ml-2 text-sm font-medium">{STEP_TITLE[stepIdx]}</span>
        </div>

        <main className="flex-1 px-5 py-5 overflow-y-auto">
          {state.step === 'select_packs' && (
            <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
              {PACK_REGISTRY.map((pack) => {
                const selected = state.selectedPackIds.includes(pack.id);
                return (
                  <motion.button
                    key={pack.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => dispatch({ type: 'toggle_pack', packId: pack.id })}
                    className={`text-left rounded-2xl border p-4 transition-colors ${
                      selected ? 'border-primary bg-card ring-2 ring-primary/40' : 'border-border bg-card/60 hover:bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold">{pack.name}</h3>
                      {selected && <Check className="w-5 h-5 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{pack.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{pack.games.length} games</Badge>
                      <Badge variant="outline">{pack.ageRating}</Badge>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {state.step === 'settings' && (
            <div className="max-w-md space-y-2">
              {SETTING_LABELS.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <Switch
                    checked={state.settings[key] as boolean}
                    onCheckedChange={(value) => dispatch({ type: 'set_setting', key, value })}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4">
                <div>
                  <p className="font-medium">Language</p>
                  <p className="text-xs text-muted-foreground">Host & prompts language.</p>
                </div>
                <div className="flex gap-1">
                  {(['en', 'pcm'] as const).map((lang) => (
                    <Button
                      key={lang}
                      size="sm"
                      variant={state.settings.language === lang ? 'default' : 'outline'}
                      onClick={() => dispatch({ type: 'set_setting', key: 'language', value: lang })}
                    >
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
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Packs</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedPacks(state).map((p) => (
                    <Badge key={p.id}>{p.name}</Badge>
                  ))}
                </div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-4">Games in play</p>
                <p className="text-sm mt-1">
                  {getGamesForPacks(state.selectedPackIds).map((g) => g.name).join(' · ')}
                </p>
              </div>
              <Button className="w-full" size="lg" onClick={start} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start the house'}
              </Button>
            </div>
          )}
        </main>

        <footer className="px-5 py-4 flex items-center justify-between border-t border-border">
          <Button
            variant="ghost"
            onClick={() => (stepIdx === 0 ? navigate('/') : dispatch({ type: 'back' }))}
            disabled={creating}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> {stepIdx === 0 ? 'Home' : 'Back'}
          </Button>
          {state.step !== 'review' && (
            <Button onClick={() => dispatch({ type: 'next' })} disabled={!canAdvance(state)}>
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </footer>
        <BuiltByFooter />
      </div>
    </ThemeProvider>
  );
}
