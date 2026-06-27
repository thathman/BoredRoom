import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LagosScene } from '@/components/brand/LagosScene';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { Button } from '@/components/ui/button';
import { redeemCompanionPairing, getCompanionCredential } from '@/lib/serverApi';

// One-step companion pairing target. The host's "Pair companion" QR encodes /pair/:code?t=<token>.
// Scanning it lands here, auto-redeems the one-time token, and drops the tablet straight into the
// companion control booth — no manual code entry. Still host-approved (the token is the approval).
export default function CompanionPair() {
  const { code } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const normalized = (code ?? '').trim().toUpperCase();
  const token = params.get('t') ?? '';
  const [status, setStatus] = useState<'pairing' | 'error'>('pairing');

  useEffect(() => {
    let cancelled = false;
    async function pair() {
      // Already paired on this device? Go straight in.
      if (getCompanionCredential(normalized)) {
        navigate(`/session/${normalized}/companion`, { replace: true });
        return;
      }
      if (!normalized || !token) { setStatus('error'); return; }
      try {
        await redeemCompanionPairing(normalized, token);
        if (!cancelled) navigate(`/session/${normalized}/companion`, { replace: true });
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    void pair();
    return () => { cancelled = true; };
  }, [normalized, token, navigate]);

  if (status === 'error') {
    return (
      <LagosScene>
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8 text-center">
          <BrandLogo className="mx-auto text-2xl" />
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="brush-display text-4xl">Pairing <span className="text-primary">expired</span></h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This pairing link is invalid or has expired. Ask the host to show a fresh "Pair companion" QR, or enter the code manually.
            </p>
            <Button className="neon-primary mt-6 h-12 rounded-xl" onClick={() => navigate(`/join?mode=companion`)}>Pair manually</Button>
          </div>
          <BuiltByFooter />
        </div>
      </LagosScene>
    );
  }

  return (
    <LagosScene>
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Pairing this device as host companion…</p>
      </div>
    </LagosScene>
  );
}
