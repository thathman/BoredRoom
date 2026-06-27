import { useState } from 'react';
import { Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/profile/PlayerAvatar';
import { ProfileSheet } from '@/components/profile/ProfileSheet';
import { achievementsFor, type PlayerProfile } from '@/lib/playerProfile';

// Persistent controller chip (avatar + name) shown on every game's controller. Tapping opens a
// flyout with Edit profile, Achievements, and a Pause request — consolidating controls so they
// never overlap the in-game round/turn header. Lives top-left, away from the top-right round info.
export function ControllerMenu({
  profile,
  onSaveProfile,
  onPause,
  canPause,
  extraSlot,
}: {
  profile: PlayerProfile;
  onSaveProfile: (p: PlayerProfile) => void;
  onPause?: () => void;
  canPause?: boolean;
  extraSlot?: React.ReactNode; // e.g. the rules-assistant button
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'menu' | 'edit'>('menu');
  const achievements = achievementsFor(profile.stats);
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <>
      <button
        type="button"
        onClick={() => { setTab('menu'); setOpen(true); }}
        className="fixed left-3 top-3 z-[72] flex items-center gap-2 rounded-full border border-white/15 bg-black/70 py-1 pl-1 pr-3 backdrop-blur-md"
        aria-label="Player menu"
      >
        <PlayerAvatar displayName={profile.displayName || 'You'} avatar={profile.avatarType === 'emoji' ? profile.avatarValue : undefined} accentColor={profile.accentColor} size={28} />
        <span className="max-w-24 truncate text-xs font-semibold">{profile.displayName || 'You'}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-start bg-black/60 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="mt-12 w-72 rounded-2xl border border-white/12 bg-[#080b16]/97 p-4" onClick={(e) => e.stopPropagation()}>
            {tab === 'menu' ? (
              <>
                <div className="flex items-center gap-3">
                  <PlayerAvatar displayName={profile.displayName || 'You'} avatar={profile.avatarType === 'emoji' ? profile.avatarValue : undefined} accentColor={profile.accentColor} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{profile.displayName || 'You'}</p>
                    <p className="text-[11px] text-muted-foreground">{profile.stats.wins} wins · {profile.stats.gamesPlayed} games</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Achievements ({earned}/{achievements.length})</p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {achievements.map((a) => (
                      <div key={a.id} title={a.earned ? a.label : a.hint} className={`grid h-10 place-items-center rounded-lg border text-lg ${a.earned ? 'border-primary/60 bg-primary/10' : 'border-white/8 bg-black/30 opacity-40 grayscale'}`}>
                        {a.emoji}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {extraSlot}
                  <Button variant="outline" className="h-10 rounded-xl text-xs" onClick={() => setTab('edit')}>Edit profile</Button>
                  {onPause && (
                    <Button variant="outline" className="h-10 rounded-xl text-xs" disabled={!canPause} onClick={() => { onPause(); setOpen(false); }}>
                      <Pause className="h-4 w-4" /> Request pause
                    </Button>
                  )}
                  <Button variant="ghost" className="h-9 rounded-xl text-xs" onClick={() => setOpen(false)}>Close</Button>
                </div>
              </>
            ) : (
              <ProfileSheet
                title="Edit profile"
                cta="Save"
                onSave={(p) => { onSaveProfile(p); setTab('menu'); }}
                onCancel={() => setTab('menu')}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
