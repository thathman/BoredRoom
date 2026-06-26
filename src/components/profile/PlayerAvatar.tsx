import { avatarGlyph } from '@/lib/playerProfile';

interface PlayerAvatarProps {
  displayName: string;
  avatar?: string;
  accentColor?: string;
  isBot?: boolean;
  size?: number;
  className?: string;
}

// One avatar surface used everywhere (lobby, display, companion, scoreboards, votes, recap).
// Emoji avatars render the glyph; otherwise an accent-tinted initial. Never a broken image.
export function PlayerAvatar({ displayName, avatar, accentColor, isBot, size = 48, className = '' }: PlayerAvatarProps) {
  const color = accentColor || '#45f36b';
  const glyph = isBot ? '🤖' : (avatar || avatarGlyph({ avatarType: avatar ? 'emoji' : 'default', avatarValue: avatar ?? '', displayName }));
  return (
    <div
      className={`grid place-items-center rounded-full border-2 font-bold ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: color,
        background: `${color}1f`,
        fontSize: size * 0.42,
      }}
      aria-label={`${displayName} avatar`}
    >
      {glyph}
    </div>
  );
}
