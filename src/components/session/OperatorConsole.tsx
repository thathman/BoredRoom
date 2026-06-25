import { useNavigate } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** @deprecated Host controls now live in the unified session display drawer. */
export function OperatorConsole({ code }: { code: string; packId?: string }) {
  const navigate = useNavigate();
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
      <Gamepad2 className="mx-auto h-8 w-8 text-primary" />
      <h2 className="mt-3 text-xl font-display font-bold">Controls moved to the house display</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose games, manage players, and change settings without leaving the session.
      </p>
      <Button className="mt-5" onClick={() => navigate(`/session/${code}/display`)}>
        Open house display
      </Button>
    </div>
  );
}
