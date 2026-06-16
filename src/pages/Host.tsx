import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ensureDisplayPartyId,
  ensureHostDisplayId,
  generateRoomCode,
  getDisplayPartyName,
} from '@/lib/roomUtils';
import { Button } from '@/components/ui/button';
import { MonitorPlay, ArrowLeft } from 'lucide-react';
import { EntryPageShell } from '@/components/layout/EntryPageShell';
import { toast } from 'sonner';
import { getGameMeta } from '@/lib/games';
import { fetchDisplayMatchesMerged, upsertDisplayParty } from '@/lib/profile';
import { ContinueSessionCard } from '@/components/system/ContinueSessionCard';
import { getActiveSession } from '@/lib/sessionResume';
import { GameGlyph } from '@/components/game/GameGlyph';

interface DisplayMatchRow {
  id: string;
  room_code: string;
  game_type: string;
  winner_device_id: string | null;
  player_names: Record<string, string>;
}

export default function HostPage() {
  const navigate = useNavigate();
  const { game } = useParams<{ game: string }>();
  const meta = getGameMeta(game);
  const [creating, setCreating] = useState(false);
  const [recentMatches, setRecentMatches] = useState<DisplayMatchRow[]>([]);
  const [sessionConflictDismissed, setSessionConflictDismissed] = useState(false);
  const hostDisplayId = useMemo(() => ensureHostDisplayId(), []);
  const partyId = useMemo(() => ensureDisplayPartyId(), []);
  const activeSession = useMemo(() => getActiveSession(), []);
  const hasSessionConflict = !!activeSession && !sessionConflictDismissed;
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

  useEffect(() => {
    void upsertDisplayParty({
      id: partyId,
      hostDisplayId,
      name: getDisplayPartyName(),
    });
    void fetchDisplayMatchesMerged({ hostDisplayId, partyId, limit: 4 }).then((rows) => {
      setRecentMatches(rows as DisplayMatchRow[]);
    });
  }, [hostDisplayId, partyId]);

  const handleCreateRoom = async () => {
    if (creating || !meta) return;
    if (hasSessionConflict) {
      toast.message('Resolve current session first', {
        description: 'Continue or dismiss the active game card before hosting a new room.',
      });
      return;
    }
    sessionStorage.setItem('boredroom_is_host', 'true');
    sessionStorage.setItem('boredroom_game_type', meta.slug);
    sessionStorage.removeItem('boredroom_transport_fallback');
    if (!colyseusHttpUrl) {
      const code = generateRoomCode();
      sessionStorage.removeItem('boredroom_host_token');
      sessionStorage.setItem('boredroom_room_code', code);
      navigate(`/${meta.slug}/room/${code}`);
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${colyseusHttpUrl}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostDeviceId: hostDisplayId, partyId, gameType: meta.slug }),
      });

      if (!response.ok) {
        throw new Error(`room_create_failed_${response.status}`);
      }

      const data = (await response.json()) as { code?: string; hostToken?: string };
      if (!data.code || !data.hostToken) {
        throw new Error('room_create_invalid_response');
      }

      sessionStorage.setItem('boredroom_host_token', data.hostToken);
      sessionStorage.setItem('boredroom_room_code', data.code);
      navigate(`/${meta.slug}/room/${data.code}`);
    } catch (error) {
      toast.error('Could not create the live room right now');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  if (!meta) return null;

  return (
    <EntryPageShell
      title={`Host ${meta.name}`}
      subtitle="Shared display only. Players join from their phones."
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="glass rounded-2xl p-8 space-y-6">
          <ContinueSessionCard reloadOnDismiss={false} onDismiss={() => setSessionConflictDismissed(true)} />
          <div className="text-center flex flex-col items-center gap-2">
            <div className="w-16 h-16 text-primary" aria-hidden="true">
              <GameGlyph slug={meta.slug} className="w-16 h-16" />
            </div>
            <p className="text-sm text-muted-foreground">
              This screen controls the game and shows the public board.
            </p>
          </div>
          <Button
            onClick={handleCreateRoom}
            disabled={creating || hasSessionConflict}
            className="w-full controller-button bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            <MonitorPlay className="w-5 h-5" />
            {creating ? 'Creating Room…' : `Host ${meta.name}`}
          </Button>
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="font-display font-bold text-lg">This display&apos;s table history</h2>
            <p className="text-xs text-muted-foreground">
              Stored against this host screen, so refreshing the room code does not lose history.
            </p>
          </div>
          {recentMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No finished matches on this display yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recentMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-sm"
                >
                  <span className="font-display font-bold uppercase tracking-wide">
                    {m.game_type}
                  </span>
                  <span className="text-muted-foreground">Room {m.room_code}</span>
                  <span>
                    {m.winner_device_id ? (m.player_names?.[m.winner_device_id] ?? 'Winner') : 'Ended'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-start text-sm">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Catalog
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/display/stats')} className="gap-2">
            Display stats
          </Button>
        </div>
      </motion.div>
    </EntryPageShell>
  );
}
