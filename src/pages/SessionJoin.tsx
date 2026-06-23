import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Smartphone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';

// Flow 3: join a house session as a controller. Phones land here (they don't host). Enter the code
// shown on the display -> become a controller. Supports /join and /join/:sessionCode.
export default function SessionJoin() {
  const navigate = useNavigate();
  const { sessionCode } = useParams<{ sessionCode?: string }>();
  const [code, setCode] = useState(sessionCode ?? '');

  const normalized = code.trim().toUpperCase();
  const canJoin = normalized.length >= 4;

  function join() {
    if (!canJoin) return;
    navigate(`/session/${encodeURIComponent(normalized)}/controller`);
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Smartphone className="w-7 h-7" />
        </span>
        <h1 className="text-2xl font-display font-bold">Join the game night</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the code on the big screen to become a controller.
        </p>

        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && join()}
          placeholder="CODE"
          maxLength={8}
          aria-label="Session code"
          className="mt-6 text-center text-2xl tracking-[0.4em] font-mono h-14"
        />

        <Button className="mt-4 w-full rounded-2xl" size="lg" onClick={join} disabled={!canJoin}>
          Join as controller <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

        <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate('/')}>
          Back home
        </Button>
      </div>
      <BuiltByFooter />
    </div>
  );
}
