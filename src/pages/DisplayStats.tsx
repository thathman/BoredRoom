import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Gamepad2, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ensureDisplayPartyId,
  ensureHostDisplayId,
  getDisplayPartyName,
  setDisplayPartyName,
} from '@/lib/roomUtils';
import { fetchDisplayMatchesMerged, upsertDisplayParty } from '@/lib/profile';
import { toast } from 'sonner';

interface DisplayMatchRow {
  id: string;
  room_code: string;
  game_type: string;
  winner_device_id: string | null;
  player_names: Record<string, string>;
  finished_at: string;
}

export default function DisplayStatsPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<DisplayMatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const hostDisplayId = useMemo(() => ensureHostDisplayId(), []);
  const partyId = useMemo(() => ensureDisplayPartyId(), []);
  const [partyName, setPartyName] = useState(() => getDisplayPartyName());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await upsertDisplayParty({ id: partyId, hostDisplayId, name: getDisplayPartyName() });
      const rows = await fetchDisplayMatchesMerged({ hostDisplayId, partyId, limit: 30 });
      setMatches(rows as DisplayMatchRow[]);
      setLoading(false);
    };
    void load();
  }, [hostDisplayId, partyId]);

  const savePartyName = async () => {
    setSavingName(true);
    const clean = partyName.trim().slice(0, 40) || 'Home table';
    setDisplayPartyName(clean);
    const saved = await upsertDisplayParty({ id: partyId, hostDisplayId, name: clean });
    setSavingName(false);
    if (!saved) {
      toast.error('Could not save display name');
      return;
    }
    setPartyName(clean);
    toast.success('Display name updated');
  };

  const totalGames = matches.length;
  const winnersByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) {
      const winner = m.winner_device_id ? (m.player_names?.[m.winner_device_id] ?? 'Winner') : 'Ended';
      map.set(winner, (map.get(winner) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [matches]);
  const gamesByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) map.set(m.game_type, (map.get(m.game_type) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [matches]);

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Home
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-8 mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <Monitor className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-display font-bold neon-text">{partyName}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Display history and stats for this host screen.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            maxLength={40}
            placeholder="Display name"
            className="sm:max-w-xs"
          />
          <Button size="sm" onClick={savePartyName} disabled={savingName}>
            {savingName ? 'Saving…' : 'Save name'}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard icon={<Gamepad2 className="w-5 h-5" />} label="Games hosted" value={totalGames} />
        <StatCard icon={<Trophy className="w-5 h-5" />} label="Top winner" value={winnersByName[0]?.[0] ?? '—'} />
        <StatCard icon={<Monitor className="w-5 h-5" />} label="Display ID" value={hostDisplayId.slice(0, 8)} mono />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-display font-bold mb-4">Top winners</h2>
          {winnersByName.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finished matches yet.</p>
          ) : (
            <div className="space-y-2">
              {winnersByName.slice(0, 8).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <span>{name}</span>
                  <span className="font-display font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-display font-bold mb-4">Games by type</h2>
          {gamesByType.length === 0 ? (
            <p className="text-sm text-muted-foreground">No game history yet.</p>
          ) : (
            <div className="space-y-2">
              {gamesByType.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <span className="uppercase tracking-wider">{type}</span>
                  <span className="font-display font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 mt-4">
        <h2 className="text-lg font-display font-bold mb-4">Recent display matches</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches recorded for this display yet.</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => {
              const winnerName = m.winner_device_id
                ? m.player_names[m.winner_device_id] || 'Winner'
                : 'Ended';
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-display font-bold px-2 py-0.5 rounded-full bg-secondary/40 text-secondary-foreground uppercase">
                      {m.game_type}
                    </span>
                    <span className="text-sm">Room {m.room_code}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Won by {winnerName}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>
      <div className={`text-2xl font-display font-bold ${mono ? 'font-mono text-lg' : ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
