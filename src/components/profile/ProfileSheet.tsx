import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerAvatar } from './PlayerAvatar';
import {
  AVATAR_EMOJIS,
  ACCENT_COLORS,
  getPlayerProfile,
  savePlayerProfile,
  type PlayerProfile,
} from '@/lib/playerProfile';

interface ProfileSheetProps {
  title?: string;
  cta?: string;
  onSave: (profile: PlayerProfile) => void;
  onCancel?: () => void;
}

// Create-or-edit profile surface. Used on first join (before the controller) and from the
// controller flyout / lobby for edits.
export function ProfileSheet({ title = 'Your profile', cta = 'Save profile', onSave, onCancel }: ProfileSheetProps) {
  const existing = getPlayerProfile();
  const [name, setName] = useState(existing.displayName);
  const [avatar, setAvatar] = useState(existing.avatarType === 'emoji' ? existing.avatarValue : '');
  const [color, setColor] = useState(existing.accentColor);
  const [sound, setSound] = useState(existing.preferences.sound);
  const [haptics, setHaptics] = useState(existing.preferences.haptics);

  function commit() {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return;
    const profile = savePlayerProfile({
      displayName: trimmed,
      avatarType: avatar ? 'emoji' : 'default',
      avatarValue: avatar,
      accentColor: color,
      preferences: { sound, haptics, language: existing.preferences.language },
    });
    onSave(profile);
  }

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-center gap-4">
        <PlayerAvatar displayName={name || '?'} avatar={avatar} accentColor={color} size={64} />
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.22em] text-secondary">{title}</p>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            placeholder="Your name"
            className="mt-2 h-12 bg-black/35 text-lg"
            aria-label="Display name"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Avatar</p>
        <div className="mt-2 grid grid-cols-8 gap-2">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setAvatar(avatar === emoji ? '' : emoji)}
              className={`grid h-10 place-items-center rounded-lg border text-lg ${avatar === emoji ? 'border-primary bg-primary/15' : 'border-white/10 bg-black/30'}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Accent colour</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full border-2 ${color === c ? 'scale-110' : 'border-transparent opacity-70'}`}
              style={{ background: c, borderColor: color === c ? '#fff' : 'transparent' }}
              aria-label={`Accent ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> Sound</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={haptics} onChange={(e) => setHaptics(e.target.checked)} /> Haptics</label>
      </div>

      <div className="flex gap-2">
        <Button className="neon-primary h-12 flex-1 rounded-xl" disabled={!name.trim()} onClick={commit}>{cta}</Button>
        {onCancel && <Button variant="outline" className="h-12 rounded-xl" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}
