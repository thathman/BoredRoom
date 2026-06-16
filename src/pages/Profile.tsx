import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Gamepad2, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Profile, fetchProfile, fetchRecentMatches } from '@/lib/profile';
import { getPlayerId } from '@/lib/roomUtils';
import { ProfileSetup } from '@/components/profile/ProfileSetup';
import { LanguageSwitcher } from '@/components/system/LanguageSwitcher';
import { Loader2 } from 'lucide-react';

interface MatchRow {
  id: string;
  room_code: string;
  game_type: string;
  winner_device_id: string | null;
  player_names: Record<string, string>;
  finished_at: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const deviceId = getPlayerId();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [p, m] = await Promise.all([
      fetchProfile(deviceId),
      fetchRecentMatches(deviceId, 10),
    ]);
    setProfile(p);
    setMatches(m as MatchRow[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile || editing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <ProfileSetup
          title={profile ? 'Edit your profile' : 'Create your profile'}
          subtitle="Stored on this device. Stats follow you across games."
          ctaLabel="Save"
          onComplete={() => { setEditing(false); reload(); }}
        />
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/')}>
          Back
        </Button>
      </div>
    );
  }

  const winRate = profile.games_played > 0
    ? Math.round((profile.wins / profile.games_played) * 100)
    : 0;

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Home
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit profile
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-8 text-center mb-6"
      >
        <div className="text-7xl mb-3">{profile.avatar}</div>
        <h1 className="text-3xl font-display font-bold neon-text">{profile.username}</h1>
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon={<Gamepad2 className="w-5 h-5" />} label="Games" value={profile.games_played} />
        <StatCard icon={<Trophy className="w-5 h-5" />} label="Wins" value={profile.wins} accent />
        <StatCard icon={<Percent className="w-5 h-5" />} label="Win rate" value={`${winRate}%`} />
      </div>

      <div className="glass rounded-2xl p-4 mb-6 flex justify-center">
        <LanguageSwitcher />
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-display font-bold mb-4">Recent matches</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No matches yet — host or join a room to play your first game.
          </p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => {
              const isWin = m.winner_device_id === deviceId;
              const winnerName = m.winner_device_id
                ? m.player_names[m.winner_device_id] || 'Someone'
                : '—';
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-display font-bold px-2 py-0.5 rounded-full ${
                      isWin ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isWin ? 'WIN' : 'LOSS'}
                    </span>
                    <GameBadge gameType={m.game_type} />
                    <span className="text-sm">Room {m.room_code}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Won by {winnerName}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div className={`flex justify-center mb-1 ${accent ? 'text-accent' : 'text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="text-2xl font-display font-bold">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function GameBadge({ gameType }: { gameType: string }) {
  const isWhot = gameType === 'whot';
  const label = isWhot ? 'WHOT' : 'LUDO';
  return (
    <span
      className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
        isWhot
          ? 'bg-accent/20 text-accent'
          : 'bg-secondary/40 text-secondary-foreground'
      }`}
      aria-label={`Game: ${label}`}
    >
      {label}
    </span>
  );
}
