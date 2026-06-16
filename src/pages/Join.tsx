import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { generatePlayerId, setPlayerName } from '@/lib/roomUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Camera, ArrowLeft } from 'lucide-react';
import { ProfileSetup } from '@/components/profile/ProfileSetup';
import { getLocalProfile, setLocalProfile } from '@/lib/profile';
import { EntryPageShell } from '@/components/layout/EntryPageShell';
import { getGameMeta } from '@/lib/games';
import { isValidRoomCode, normalizeRoomCode } from '@/lib/roomCode';
import { toast } from 'sonner';
import { ContinueSessionCard } from '@/components/system/ContinueSessionCard';
import { DeferredPromptEvent, isMobileLikeDevice, isStandalonePWA } from '@/lib/pwa';
import { getActiveSession } from '@/lib/sessionResume';

const QrScanner = lazy(async () => {
  const mod = await import('@/components/join/QrScanner');
  return { default: mod.QrScanner };
});

export default function JoinPage() {
  const navigate = useNavigate();
  const { game, code: urlCode } = useParams<{ game: string; code: string }>();
  const meta = getGameMeta(game);
  const [code, setCode] = useState(normalizeRoomCode(urlCode ?? ''));
  const [step, setStep] = useState<'code' | 'profile'>('code');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStream, setScanStream] = useState<MediaStream | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPromptEvent | null>(null);
  const [showInstallGate, setShowInstallGate] = useState(false);
  const [sessionConflictDismissed, setSessionConflictDismissed] = useState(false);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const activeSession = useMemo(() => getActiveSession(), []);
  const hasSessionConflict = !!activeSession && !sessionConflictDismissed;

  useEffect(() => {
    const local = getLocalProfile();
    if (local && !urlCode) setStep('code');
  }, [urlCode]);

  const hasLocalProfile = Boolean(getLocalProfile()?.username);

  useEffect(() => {
    const shouldGate = isMobileLikeDevice() && !isStandalonePWA();
    setShowInstallGate(shouldGate);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const requestCameraAndOpen = async () => {
    setScanError(null);
    if (!window.isSecureContext) {
      setScanError('Camera requires a secure (HTTPS) connection.');
      setScannerOpen(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Camera not supported on this device.');
      setScannerOpen(true);
      return;
    }
    try {
      // Must be in the click handler to preserve the user gesture.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      setScanStream(stream);
      setScannerOpen(true);
    } catch (err: unknown) {
      const name = err instanceof DOMException || err instanceof Error ? err.name : '';
      let msg: string;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        msg = inIframe
          ? 'Camera blocked in this preview frame. Open the app in a full browser tab to scan.'
          : 'Camera permission denied. Enable it in browser settings, or type the code manually.';
      } else if (name === 'NotFoundError') {
        msg = 'No camera found on this device.';
      } else if (name === 'NotReadableError') {
        msg = 'Camera is in use by another app.';
      } else {
        msg = err instanceof Error ? err.message : 'Could not start the camera.';
      }
      setScanError(msg);
      setScannerOpen(true);
    }
  };

  const handleScannerOpenChange = (next: boolean) => {
    setScannerOpen(next);
    if (!next) {
      // Stop tracks; QrScanner also stops them defensively.
      scanStream?.getTracks().forEach((t) => t.stop());
      setScanStream(null);
      setScanError(null);
    }
  };

  const [validating, setValidating] = useState(false);
  const colyseusHttpUrl = useMemo(() => {
    const raw = import.meta.env.VITE_COLYSEUS_URL as string | undefined;
    if (!raw) return null;
    try {
      const url = new URL(raw);
      url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch {
      return null;
    }
  }, []);

  const handleScanned = (scanned: string) => {
    setCode(normalizeRoomCode(scanned));
    setStep('profile');
  };

  const validateRoomForJoin = async (rawCode: string): Promise<string | null> => {
    const normalized = normalizeRoomCode(rawCode);
    setCode(normalized);
    if (!isValidRoomCode(normalized)) {
      toast.error('Enter a valid 4-character room code');
      setStep('code');
      return null;
    }
    if (colyseusHttpUrl && meta) {
      setValidating(true);
      try {
        const res = await fetch(`${colyseusHttpUrl}/rooms/${normalized}`);
        if (!res.ok) {
          toast.error(res.status === 404 ? 'Room not found' : 'Could not validate room');
          setStep('code');
          return null;
        }
        const info = await res.json() as { gameType?: string; joinable?: boolean; status?: string };
        if (info.gameType && info.gameType !== meta.slug) {
          toast.error(`That room is for ${info.gameType.toUpperCase()}, not ${meta.name}`);
          setStep('code');
          return null;
        }
        if (info.joinable === false) {
          toast.error(info.status === 'finished' ? 'That game has ended' : 'Room is full or locked');
          setStep('code');
          return null;
        }
      } catch {
        toast.error('Server validation failed. Check the room code and connection.');
        setStep('code');
        return null;
      } finally {
        setValidating(false);
      }
    }
    return normalized;
  };

  const goToProfile = async () => {
    if (hasSessionConflict) {
      toast.message('Resolve current session first', {
        description: 'Continue or dismiss the active game card before joining another room.',
      });
      return;
    }
    const normalized = await validateRoomForJoin(code);
    if (!normalized) return;
    setStep('profile');
  };

  const handleComplete = async (username: string, avatar: string) => {
    if (!meta) return;
    if (hasSessionConflict) {
      toast.message('Resolve current session first', {
        description: 'Continue or dismiss the active game card before joining another room.',
      });
      return;
    }
    const normalized = await validateRoomForJoin(code);
    if (!normalized) return;
    generatePlayerId();
    setPlayerName(username);
    setLocalProfile(username, avatar);
    sessionStorage.setItem('boredroom_is_host', 'false');
    sessionStorage.removeItem('boredroom_host_token');
    sessionStorage.setItem('boredroom_game_type', meta.slug);
    sessionStorage.setItem('boredroom_room_code', normalized);
    navigate(`/${meta.slug}/room/${normalized}`);
  };

  const joinWithExistingProfile = async () => {
    if (hasSessionConflict) {
      toast.message('Resolve current session first', {
        description: 'Continue or dismiss the active game card before joining another room.',
      });
      return;
    }
    const local = getLocalProfile();
    if (!local) {
      setStep('profile');
      return;
    }
    const normalized = await validateRoomForJoin(code);
    if (!normalized || !meta) return;
    generatePlayerId();
    setPlayerName(local.username);
    setLocalProfile(local.username, local.avatar);
    sessionStorage.setItem('boredroom_is_host', 'false');
    sessionStorage.removeItem('boredroom_host_token');
    sessionStorage.setItem('boredroom_game_type', meta.slug);
    sessionStorage.setItem('boredroom_room_code', normalized);
    navigate(`/${meta.slug}/room/${normalized}`);
  };

  if (!meta) return null;

  return (
    <EntryPageShell
      title={`Join ${meta.name}`}
      subtitle={step === 'code' ? 'Enter the room code from the shared screen' : `Joining room ${code}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {step === 'code' ? (
          <div className="glass rounded-2xl p-8 space-y-6">
            <ContinueSessionCard reloadOnDismiss={false} onDismiss={() => setSessionConflictDismissed(true)} />
            {showInstallGate && (
              <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 space-y-2">
                <p className="font-display font-bold">Best experience: install the controller app</p>
                <p className="text-xs text-muted-foreground">
                  Install once, then scan room QR codes faster and resume games reliably.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!deferredPrompt) {
                        toast.message('Use browser menu: Add to Home Screen');
                        return;
                      }
                      await deferredPrompt.prompt();
                      await deferredPrompt.userChoice.catch(() => null);
                      setDeferredPrompt(null);
                    }}
                  >
                    Install app
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowInstallGate(false)}>
                    Continue in browser
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Room Code</label>
              <Input
                value={code}
                onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                placeholder="ABCD"
                maxLength={4}
                className="h-16 text-3xl text-center font-display tracking-[0.3em] bg-muted border-border focus:border-secondary"
                onKeyDown={(e) => e.key === 'Enter' && goToProfile()}
              />
            </div>

            <Button
              onClick={hasLocalProfile ? joinWithExistingProfile : goToProfile}
              disabled={code.length < 4 || validating || hasSessionConflict}
              className="w-full controller-button bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2"
            >
              {validating ? 'Checking…' : hasLocalProfile ? 'Join game' : 'Next'}
              <ArrowRight className="w-5 h-5" />
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={requestCameraAndOpen}
              className="w-full gap-2"
            >
              <Camera className="w-5 h-5" />
              Scan QR code
            </Button>
          </div>
        ) : (
          <ProfileSetup
            title="Pick your player"
            onComplete={handleComplete}
            ctaLabel="Join Game"
            ctaClass="bg-secondary text-secondary-foreground hover:bg-secondary/90"
          />
        )}

        <div className="flex items-center justify-start text-sm">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Catalog
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="gap-2">
            Profile & Stats
          </Button>
        </div>
      </motion.div>

      <Suspense fallback={null}>
        {scannerOpen && (
          <QrScanner
            open={scannerOpen}
            onOpenChange={handleScannerOpenChange}
            onCode={handleScanned}
            stream={scanStream}
            acquireError={scanError}
            onRetryAcquire={requestCameraAndOpen}
          />
        )}
      </Suspense>
    </EntryPageShell>
  );
}
