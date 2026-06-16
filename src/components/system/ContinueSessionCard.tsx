import { Button } from '@/components/ui/button';
import { getActiveSession, clearActiveSession } from '@/lib/sessionResume';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, X } from 'lucide-react';

interface ContinueSessionCardProps {
  reloadOnDismiss?: boolean;
  onDismiss?: () => void;
}

export function ContinueSessionCard({ reloadOnDismiss = true, onDismiss }: ContinueSessionCardProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const session = useMemo(() => getActiveSession(), []);
  if (dismissed) return null;
  if (!session) return null;

  return (
    <div className="glass rounded-2xl p-4 border border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Active game detected</p>
          <p className="font-display font-bold text-lg">
            {session.gameType.toUpperCase()} · Room {session.roomCode}
          </p>
          <p className="text-xs text-muted-foreground">
            {session.isHost ? 'Host session' : 'Controller session'} is still open on this device.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="gap-2"
          onClick={() => navigate(`/${session.gameType}/room/${session.roomCode}`)}
        >
          <RotateCcw className="w-4 h-4" /> Continue game
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            clearActiveSession();
            setDismissed(true);
            onDismiss?.();
            if (reloadOnDismiss) window.location.reload();
          }}
        >
          <X className="w-4 h-4" /> Dismiss
        </Button>
      </div>
    </div>
  );
}
