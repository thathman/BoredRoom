import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AtmosphereTrail = {
  id: number;
  x: number;
  y: number;
  hue: 'green' | 'purple' | 'blue';
  size: number;
  angle: number;
};

type CursorGlow = {
  x: number;
  y: number;
  hue: AtmosphereTrail['hue'];
};

const twinkleStars = [
  { left: '4%', top: '8%', size: 3, delay: '0s', duration: '2.6s', color: '255 255 255' },
  { left: '7%', top: '25%', size: 3, delay: '.18s', duration: '2.8s', color: '101 198 255' },
  { left: '12%', top: '44%', size: 4, delay: '.35s', duration: '3.1s', color: '101 198 255' },
  { left: '16%', top: '12%', size: 2, delay: '.72s', duration: '2.3s', color: '255 255 255' },
  { left: '19%', top: '9%', size: 2, delay: '.9s', duration: '2.2s', color: '255 255 255' },
  { left: '23%', top: '33%', size: 4, delay: '1.34s', duration: '3.4s', color: '93 255 151' },
  { left: '27%', top: '25%', size: 2, delay: '.2s', duration: '3.5s', color: '190 112 255' },
  { left: '31%', top: '7%', size: 3, delay: '1.7s', duration: '2.7s', color: '101 198 255' },
  { left: '34%', top: '12%', size: 3, delay: '1.1s', duration: '2.8s', color: '255 255 255' },
  { left: '40%', top: '28%', size: 4, delay: '.48s', duration: '2.9s', color: '255 255 255' },
  { left: '44%', top: '39%', size: 2, delay: '.65s', duration: '3.2s', color: '93 255 151' },
  { left: '48%', top: '17%', size: 2, delay: '1.9s', duration: '2.4s', color: '190 112 255' },
  { left: '52%', top: '8%', size: 2, delay: '1.4s', duration: '2.5s', color: '101 198 255' },
  { left: '56%', top: '35%', size: 3, delay: '.96s', duration: '3.6s', color: '255 255 255' },
  { left: '61%', top: '22%', size: 4, delay: '.15s', duration: '3.7s', color: '255 255 255' },
  { left: '66%', top: '13%', size: 2, delay: '1.42s', duration: '2.6s', color: '101 198 255' },
  { left: '70%', top: '11%', size: 2, delay: '.8s', duration: '2.4s', color: '93 255 151' },
  { left: '75%', top: '31%', size: 4, delay: '1.02s', duration: '3.1s', color: '255 255 255' },
  { left: '82%', top: '20%', size: 3, delay: '1.25s', duration: '3s', color: '255 255 255' },
  { left: '86%', top: '8%', size: 2, delay: '.11s', duration: '2.1s', color: '93 255 151' },
  { left: '91%', top: '10%', size: 2, delay: '.45s', duration: '2.9s', color: '190 112 255' },
  { left: '95%', top: '39%', size: 2, delay: '1.65s', duration: '3.4s', color: '101 198 255' },
  { left: '97%', top: '18%', size: 4, delay: '.32s', duration: '2.5s', color: '255 255 255' },
  { left: '14%', top: '18%', size: 3, delay: '1.92s', duration: '2.9s', color: '190 112 255' },
  { left: '38%', top: '6%', size: 3, delay: '.08s', duration: '3.2s', color: '255 255 255' },
  { left: '58%', top: '10%', size: 3, delay: '2.1s', duration: '2.4s', color: '93 255 151' },
  { left: '79%', top: '7%', size: 3, delay: '1.18s', duration: '3s', color: '101 198 255' },
];

const shootingStars = [
  { left: '-8%', top: '22%', width: 280, delay: '-1.4s', duration: '4.8s', rotate: '-23deg', color: '190 112 255' },
  { left: '17%', top: '15%', width: 260, delay: '-3.2s', duration: '5.6s', rotate: '-25deg', color: '93 255 151' },
  { left: '41%', top: '29%', width: 230, delay: '-2.1s', duration: '5.2s', rotate: '-18deg', color: '101 198 255' },
  { left: '62%', top: '11%', width: 210, delay: '-4.6s', duration: '6.4s', rotate: '-21deg', color: '255 255 255' },
  { left: '74%', top: '34%', width: 220, delay: '-.7s', duration: '5.8s', rotate: '-16deg', color: '93 255 151' },
];

export function LagosScene({
  children,
  className,
  style,
  skyline = true,
  skylineClassName,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  skyline?: boolean;
  skylineClassName?: string;
}) {
  const [trails, setTrails] = useState<AtmosphereTrail[]>([]);
  const [cursorGlow, setCursorGlow] = useState<CursorGlow | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    let id = 0;
    let last = 0;
    const hues: AtmosphereTrail['hue'][] = ['green', 'purple', 'blue'];
    const onPointerMove = (event: PointerEvent | MouseEvent) => {
      const now = performance.now();
      if (now - last < 42) return;
      last = now;
      id += 1;
      const trail: AtmosphereTrail = {
        id,
        x: event.clientX,
        y: event.clientY,
        hue: hues[id % hues.length],
        size: 18 + (id % 5) * 4,
        angle: -18 + (id % 5) * 9,
      };
      setCursorGlow({ x: event.clientX, y: event.clientY, hue: trail.hue });
      setTrails((current) => [...current.slice(-36), trail]);
      window.setTimeout(() => {
        setTrails((current) => current.filter((item) => item.id !== trail.id));
      }, 1300);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onPointerMove);
    };
  }, []);

  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-background text-foreground star-field', className)} style={style}>
      {skyline ? (
        <img
          aria-hidden="true"
          src="/assets/lagos-night-skyline.png"
          className={cn(
            'lagos-skyline-image pointer-events-none absolute inset-x-0 object-contain object-bottom',
            skylineClassName,
          )}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,23,.01)_0%,rgba(2,8,23,.02)_48%,rgba(2,8,23,.1)_78%,rgba(2,8,23,.42)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_19%,transparent_0,rgba(2,8,23,.02)_48%,rgba(2,8,23,.14)_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {twinkleStars.map((star, index) => (
          <span
            key={`twinkle-${index}`}
            className="atmosphere-star absolute rounded-full"
            style={
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                color: `rgb(${star.color})`,
                background: `rgb(${star.color})`,
                boxShadow: `0 0 ${star.size * 4}px rgb(${star.color} / .95), 0 0 ${star.size * 9}px rgb(${star.color} / .35)`,
                '--star-flare': `${star.size * 6}px`,
                animation: `star-twinkle ${star.duration} ease-in-out ${star.delay} infinite`,
              } as CSSProperties
            }
          />
        ))}
        {shootingStars.map((star, index) => (
          <span
            key={`shooting-${index}`}
            className="atmosphere-shooting-star absolute origin-left rounded-full"
            style={
              {
                left: star.left,
                top: star.top,
                width: star.width,
                background: `linear-gradient(90deg, rgb(${star.color} / 0), rgb(${star.color} / .95), rgb(255 255 255 / .9))`,
                boxShadow: `0 0 18px rgb(${star.color} / .75)`,
                '--tw-rotate': star.rotate,
                animation: `shooting-star ${star.duration} ease-in-out ${star.delay} infinite`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40">
        {cursorGlow ? (
          <span
            className={cn(
              'atmosphere-cursor-glow absolute rounded-full',
              cursorGlow.hue === 'green' && 'bg-primary text-primary',
              cursorGlow.hue === 'purple' && 'bg-secondary text-secondary',
              cursorGlow.hue === 'blue' && 'bg-sky-300 text-sky-300',
            )}
            style={{
              left: cursorGlow.x,
              top: cursorGlow.y,
            }}
          />
        ) : null}
        {trails.map((trail) => (
          <span
            key={trail.id}
            className={cn(
              'animate-atmosphere-trail absolute rounded-full',
              trail.hue === 'green' && 'bg-primary shadow-[0_0_18px_rgba(69,243,107,.95)]',
              trail.hue === 'purple' && 'bg-secondary shadow-[0_0_18px_rgba(179,76,255,.95)]',
              trail.hue === 'blue' && 'bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,.95)]',
            )}
            style={
              {
                left: trail.x - trail.size / 2,
                top: trail.y - trail.size / 2,
                width: trail.size,
                height: trail.size,
                '--trail-angle': `${trail.angle}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
