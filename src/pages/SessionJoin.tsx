import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Smartphone, ArrowRight, Loader2, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { fetchSession } from '@/lib/serverApi';
import { getPlayerName, setPlayerName } from '@/lib/roomUtils';
import { toast } from 'sonner';
import { detectDeviceClass } from '@/lib/deviceExperience';

// Flow 3: join a house session as a controller. Phones land here (they don't host). Enter the code
// shown on the display -> become a controller. Supports /join and /join/:sessionCode.
export default function SessionJoin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessionCode } = useParams<{ sessionCode?: string }>();
  const companionMode = searchParams.get('mode') === 'companion';
  const [code, setCode] = useState(sessionCode ?? '');
  const [name, setName] = useState(() => getPlayerName());
  const [joining, setJoining] = useState(false);

  const normalized = code.trim().toUpperCase();
  const canJoin = normalized.length === 4 && (companionMode || name.trim().length >= 2);

  async function join() {
    if (!canJoin) return;
    setJoining(true);
    try {
      const session = await fetchSession(normalized);
      if (!session) {
        toast.error('That session does not exist.');
        return;
      }
      if (!companionMode) setPlayerName(name.trim());
      navigate(`/session/${encodeURIComponent(normalized)}/${companionMode ? 'companion' : 'controller'}`);
    } catch {
      toast.error('Could not reach the session server.');
    } finally {
      setJoining(false);
    }
  }

  useEffect(() => {
    if (sessionCode && name.trim().length >= 2) void join();
    // Deep links attempt once; failures leave the form visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (detectDeviceClass() === 'desktop_host') return <Navigate to="/" replace />;
  if (companionMode && detectDeviceClass() !== 'tablet') return <Navigate to="/join" replace />;

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          {companionMode ? <Tablet className="w-7 h-7" /> : <Smartphone className="w-7 h-7" />}
        </span>
        <h1 className="text-2xl font-display font-bold">{companionMode ? 'Pair host companion' : 'Join the game night'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {companionMode ? 'Enter the house code first. The owner will approve this tablet with a one-time pairing code.' : 'Enter the code on the big screen to become a controller.'}
        </p>

        {!companionMode && <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          aria-label="Display name"
          className="mt-6 h-12 text-center"
        />}

        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && join()}
          placeholder="CODE"
          maxLength={4}
          aria-label="Session code"
          className="mt-3 text-center text-2xl tracking-[0.4em] font-mono h-14"
        />

        <Button className="mt-4 w-full rounded-2xl" size="lg" onClick={() => void join()} disabled={!canJoin || joining}>
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{companionMode ? 'Continue to pairing' : 'Join as controller'} <ArrowRight className="w-4 h-4 ml-2" /></>}
        </Button>

        <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate('/')}>
          Back home
        </Button>
      </div>
      <BuiltByFooter />
    </div>
  );
}
