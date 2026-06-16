import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { sounds } from '@/lib/sounds';

export function SoundControls({ compact = false }: { compact?: boolean }) {
  const [muted, setMuted] = useState(() => sounds.isMuted());
  const [volume, setVolume] = useState(() => sounds.getVolume());

  const toggle = () => {
    sounds.unlock();
    const next = !muted;
    sounds.setMuted(next);
    setMuted(next);
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? 'justify-center' : ''}`}>
      <button
        type="button"
        onClick={toggle}
        className="rounded-full border border-border bg-card/70 p-2 text-muted-foreground hover:text-foreground"
        aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      {!compact && (
        <div className="flex items-center gap-2">
          <input
            aria-label="Sound effect volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              const next = Number(e.target.value);
              sounds.setVolume(next);
              setVolume(next);
            }}
            className="w-24 accent-primary"
          />
          <span className="text-[11px] text-muted-foreground tabular-nums">{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  );
}
