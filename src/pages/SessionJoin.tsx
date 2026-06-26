import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, QrCode } from 'lucide-react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LagosScene } from '@/components/brand/LagosScene';
import { QrScanner } from '@/components/join/QrScanner';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchSession } from '@/lib/serverApi';
import { detectDeviceClass } from '@/lib/deviceExperience';
import { getPlayerName, setPlayerName } from '@/lib/roomUtils';
import { getPlayerSessionResume, rememberPlayerSession } from '@/lib/playerSessionResume';

export default function SessionJoin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessionCode } = useParams<{ sessionCode?: string }>();
  const companionMode = searchParams.get('mode') === 'companion';
  const [code, setCode] = useState(sessionCode ?? '');
  const [name, setName] = useState(() => getPlayerName());
  const [joining, setJoining] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(searchParams.get('scan') === '1');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [resume] = useState(() => getPlayerSessionResume());
  const normalized = code.trim().toUpperCase();
  const canJoin = normalized.length === 4 && (companionMode || name.trim().length >= 2);

  async function join() {
    if (!canJoin) return;
    setJoining(true);
    try {
      const session = await fetchSession(normalized);
      if (!session) {
        toast.error('That room code could not be found.');
        return;
      }
      if (!companionMode) setPlayerName(name.trim());
      rememberPlayerSession({
        code: normalized,
        role: companionMode ? 'companion' : 'controller',
        displayName: companionMode ? 'Host companion' : name.trim(),
      });
      navigate(`/session/${normalized}/${companionMode ? 'companion' : 'controller'}`);
    } catch {
      toast.error('Could not reach the game-night server.');
    } finally {
      setJoining(false);
    }
  }

  async function openScanner() {
    setCameraError(null);
    setScannerOpen(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not available in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setCameraStream(stream);
    } catch (error) {
      setCameraStream(null);
      setCameraError(error instanceof Error ? error.message : 'Could not start camera.');
    }
  }

  function useScannedCode(nextCode: string) {
    setCode(nextCode);
    setScannerOpen(false);
    if (name.trim().length >= 2 || companionMode) {
      window.setTimeout(() => {
        void fetchSession(nextCode).then((session) => {
          if (!session) {
            toast.error('That room code could not be found.');
            return;
          }
          if (!companionMode) setPlayerName(name.trim());
          rememberPlayerSession({
            code: nextCode,
            role: companionMode ? 'companion' : 'controller',
            displayName: companionMode ? 'Host companion' : name.trim(),
          });
          navigate(`/session/${nextCode}/${companionMode ? 'companion' : 'controller'}`);
        }).catch(() => toast.error('Could not reach the game-night server.'));
      }, 0);
    }
  }

  useEffect(() => {
    if (sessionCode && name.trim().length >= 2) void join();
    // One deep-link attempt; failure leaves the form usable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const device = detectDeviceClass();
  if (device === 'desktop_host') return <Navigate to="/" replace />;
  if (companionMode && device !== 'tablet') return <Navigate to="/join" replace />;

  return (
    <LagosScene>
      <div className="mx-auto flex min-h-screen max-w-sm flex-col px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] text-center">
        <BrandLogo className="mx-auto text-2xl" />
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto grid grid-cols-2 gap-2 text-2xl font-bold">
            {[1, 2, 3, 4].map((number) => (
              <span key={number} className="grid h-12 w-12 place-items-center rounded-xl border-2 border-primary bg-[#06150f]/90 shadow-[0_0_14px_rgba(69,243,107,.55)]">{number}</span>
            ))}
          </div>
          <h1 className="mt-7 text-3xl font-bold">{companionMode ? 'Pair with your host' : 'Ready to play?'}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {companionMode
              ? 'Enter the room code, then use the one-time approval code from the host.'
              : 'Join a game in your room with a code from the host.'}
          </p>
          {!companionMode && resume && (
            <button
              type="button"
              className="neon-panel mt-5 rounded-2xl px-4 py-3 text-left"
              onClick={() => navigate(`/session/${resume.code}/${resume.role}`)}
            >
              <span className="block text-xs text-muted-foreground">Resume current game</span>
              <strong className="block text-lg">House {resume.code}</strong>
              <span className="mt-1 block text-xs text-primary">Reconnect as {resume.displayName || 'player'} →</span>
            </button>
          )}
          {!companionMode && (
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              maxLength={40}
              aria-label="Display name"
              className="mt-7 h-13 rounded-xl bg-black/40 text-center"
            />
          )}
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
            onKeyDown={(event) => event.key === 'Enter' && void join()}
            placeholder="CODE"
            maxLength={4}
            aria-label="Session code"
            className="mt-3 h-14 rounded-xl bg-black/40 text-center font-mono text-2xl tracking-[0.45em]"
          />
          <Button className="neon-primary mt-4 h-14 w-full rounded-xl text-base font-bold" onClick={() => void join()} disabled={!canJoin || joining}>
            {joining ? <Loader2 className="animate-spin" /> : <><span className="flex-1">{companionMode ? 'Continue to pairing' : 'Join with a code'}</span><ArrowRight /></>}
          </Button>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <Button variant="outline" className="h-14 rounded-xl bg-black/30" onClick={() => void openScanner()}>
            <QrCode /> Scan QR code
          </Button>
          <p className="mt-4 text-[10px] text-muted-foreground">{companionMode ? 'Pairing requires explicit host approval.' : 'You can only join games on this device.'}</p>
        </div>
        <BuiltByFooter />
      </div>
      <QrScanner
        open={scannerOpen}
        onOpenChange={(open) => {
          setScannerOpen(open);
          if (!open) {
            setCameraStream(null);
            setCameraError(null);
          }
        }}
        onCode={useScannedCode}
        stream={cameraStream}
        acquireError={cameraError}
        onRetryAcquire={() => void openScanner()}
      />
    </LagosScene>
  );
}
