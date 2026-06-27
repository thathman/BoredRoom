import { useEffect, useRef, useState } from 'react';
import { Check, Mic, MicOff, Square } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type RecognitionEvent = { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type RecognitionError = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;

type PidginState = {
  challenge?: { prompt?: string } | null;
  phase?: string;
  round?: number;
  totalRounds?: number;
  translationMode?: string;
  players?: Array<{ id: string; name: string; score: number }>;
  lastResults?: Array<{ playerId: string; points: number; answer?: string }>;
  lastAction?: string;
};

export function PidginVoiceSurface({
  state,
  mine,
  role,
  sendIntent,
}: {
  state: PidginState;
  mine: { seated?: boolean; submitted?: boolean; legalIntents?: Array<Record<string, unknown> & { type?: string }> };
  role: 'display' | 'controller' | 'crowd' | 'companion';
  sendIntent: (intent: Record<string, unknown>) => void;
}) {
  const isController = role === 'controller';
  const voiceAllowed = mine.legalIntents?.some((intent) => intent.type === 'voice_submission') ?? false;
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('');
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setTranscript('');
    setStatus('');
    recognitionRef.current?.abort();
    setRecording(false);
  }, [state.round]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  async function startListening() {
    const speechWindow = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const RecognitionApi = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionApi) {
      setStatus('Live transcription is not supported in this browser. Use the text box below.');
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('microphone_unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const recognition = new RecognitionApi();
      recognition.lang = 'en-NG';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const text = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim();
        setTranscript(text);
        setStatus(text ? 'Transcript ready. Check it before submitting.' : 'Listening…');
      };
      recognition.onerror = (event) => {
        setRecording(false);
        setStatus(event.error === 'not-allowed' ? 'Microphone permission was denied. Type your answer instead.' : 'Transcription stopped. You can retry or type your answer.');
      };
      recognition.onend = () => setRecording(false);
      recognitionRef.current = recognition;
      recognition.start();
      setRecording(true);
      setStatus('Listening… Your browser handles speech recognition; BoredRoom submits only the transcript.');
    } catch {
      setRecording(false);
      setStatus('Microphone access failed. Check browser permission or type your answer instead.');
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  function submitVoice() {
    if (!transcript.trim()) return;
    sendIntent({ type: 'voice_submission', transcript: transcript.trim() });
  }

  function submitText() {
    if (!transcript.trim()) return;
    sendIntent({ type: 'answer_text', text: transcript.trim() });
  }

  return (
    <main className="star-field min-h-screen bg-[#020817] px-4 pb-6 pt-4 text-white sm:px-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3"><BrandLogo className="text-2xl" /><span className="text-sm font-semibold">🗣️ Pidgin Translator</span></div>
        <span className="text-xs text-muted-foreground">Round {state.round ?? 1} / {state.totalRounds ?? 1}</span>
      </header>
      <div className="mx-auto grid max-w-5xl gap-5 py-6 lg:grid-cols-[1fr_240px]">
        <section className="neon-panel rounded-3xl p-5 text-center sm:p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-secondary">{state.phase === 'reveal' ? 'Translation reveal' : 'Say it your way'}</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-2xl font-black sm:text-4xl">{state.challenge?.prompt ?? state.lastAction}</h1>

          {isController && mine.seated !== false && state.phase === 'playing' ? (
            mine.submitted ? (
              <div className="mx-auto mt-8 max-w-md rounded-2xl border border-primary/40 bg-primary/10 p-5 text-primary"><Check className="mx-auto mb-2" /> Translation submitted.</div>
            ) : (
              <div className="mx-auto mt-8 max-w-lg">
                {voiceAllowed ? (
                  <div className="mb-4">
                    <button type="button" onClick={recording ? stopListening : startListening}
                      className={`mx-auto grid h-24 w-24 place-items-center rounded-full border-2 transition ${recording ? 'border-red-300 bg-red-500/20 text-red-200 shadow-[0_0_32px_rgba(248,113,113,.45)]' : 'border-primary bg-primary/10 text-primary shadow-[0_0_28px_rgba(69,243,107,.3)]'}`}
                      aria-label={recording ? 'Stop microphone' : 'Start microphone'}>
                      {recording ? <Square className="h-9 w-9" /> : <Mic className="h-10 w-10" />}
                    </button>
                    <p className="mt-3 text-xs text-muted-foreground">Tap, speak, check the transcript, then submit.</p>
                  </div>
                ) : (
                  <div className="mb-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><MicOff className="h-4 w-4" /> Voice mode is off for this game.</div>
                )}
                <Input value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Your transcript or typed translation" className="h-14 rounded-xl bg-black/30 text-center text-lg" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {voiceAllowed ? <Button className="neon-primary h-12 rounded-xl" disabled={!transcript.trim()} onClick={submitVoice}><Mic className="h-4 w-4" /> Submit transcript</Button> : null}
                  <Button variant={voiceAllowed ? 'outline' : 'default'} className="h-12 rounded-xl" disabled={!transcript.trim()} onClick={submitText}>Submit typed answer</Button>
                </div>
                <p className="mt-3 min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite">{status}</p>
              </div>
            )
          ) : null}

          {state.phase === 'reveal' ? <p className="mt-8 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-lg text-primary">{state.lastAction}</p> : null}
        </section>
        <aside className="neon-panel rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Scoreboard</p>
          <div className="mt-3 space-y-2">{(state.players ?? []).map((player) => (
            <div key={player.id} className="flex items-center justify-between rounded-xl bg-white/[0.035] px-3 py-2"><span className="truncate text-sm">{player.name}</span><strong className="text-primary">{player.score}</strong></div>
          ))}</div>
        </aside>
      </div>
    </main>
  );
}
