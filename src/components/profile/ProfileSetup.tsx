import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AVATAR_OPTIONS, upsertProfile, getLocalProfile, fetchProfile } from '@/lib/profile';
import { getPlayerId } from '@/lib/roomUtils';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileSetupProps {
  title?: string;
  subtitle?: string;
  onComplete: (username: string, avatar: string) => void | Promise<void>;
  ctaLabel?: string;
  ctaClass?: string;
}

export function ProfileSetup({
  title = 'Pick your player',
  subtitle = "We'll remember this on this device — no signup needed.",
  onComplete,
  ctaLabel = 'Continue',
  ctaClass = 'bg-primary text-primary-foreground hover:bg-primary/90',
}: ProfileSetupProps) {
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATAR_OPTIONS[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = getLocalProfile();
      if (local) {
        if (!cancelled) {
          setUsername(local.username);
          setAvatar(local.avatar);
        }
      }
      const remote = await fetchProfile(getPlayerId());
      if (remote && !cancelled) {
        setUsername(remote.username);
        setAvatar(remote.avatar);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setSaving(true);
    const profile = await upsertProfile(trimmed, avatar);
    setSaving(false);
    if (!profile) {
      toast.error("Couldn't save profile — try again");
      return;
    }
    onComplete(profile.username, profile.avatar);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-display font-bold neon-text mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Avatar</label>
          <div className="grid grid-cols-8 gap-2">
            {AVATAR_OPTIONS.map((emoji) => {
              const selected = emoji === avatar;
              return (
                <motion.button
                  key={emoji}
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={() => setAvatar(emoji)}
                  className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all ${
                    selected
                      ? 'bg-primary/20 ring-2 ring-primary'
                      : 'bg-muted hover:bg-muted/70'
                  }`}
                  aria-label={`Avatar ${emoji}`}
                  aria-pressed={selected}
                >
                  {emoji}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Pick a name"
            maxLength={20}
            className="h-12 text-lg bg-muted border-border focus:border-primary"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={!username.trim() || saving}
          size="lg"
          className={`w-full controller-button gap-2 ${ctaClass}`}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-xl">{avatar}</span>}
          {ctaLabel}
        </Button>
      </div>
    </motion.div>
  );
}
