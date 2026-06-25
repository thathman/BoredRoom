import { Button } from '@/components/ui/button';
import { clearLastHouseSession, getLastHouseSession } from '@/lib/houseSessionResume';
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
  const session = useMemo(() => getLastHouseSession(), []);
  if (dismissed) return null;
  if (!session) return null;

  return (
    <div className="glass rounded-2xl p-4 border border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">House session</p>
          <p className="font-display font-bold text-lg">
            House {session.code}
          </p>
          <p className="text-xs text-muted-foreground">
            Resume the same lobby, players, and current game.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="gap-2"
          onClick={() => navigate(`/session/${session.code}/display`)}
        >
          <RotateCcw className="w-4 h-4" /> Continue game
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            clearLastHouseSession();
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
