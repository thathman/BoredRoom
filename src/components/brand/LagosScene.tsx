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
  { left: '4%', top: '8%', size: 1.5, delay: '-1.7s', duration: '5.8s', color: '255 255 255' },
  { left: '7%', top: '25%', size: 1.25, delay: '-4.2s', duration: '7.1s', color: '101 198 255' },
  { left: '12%', top: '44%', size: 2, delay: '-2.8s', duration: '6.3s', color: '101 198 255', flare: true },
  { left: '16%', top: '12%', size: 1, delay: '-3.6s', duration: '5.2s', color: '255 255 255' },
  { left: '19%', top: '9%', size: 1.1, delay: '-.9s', duration: '6.9s', color: '255 255 255' },
  { left: '23%', top: '33%', size: 1.6, delay: '-5.1s', duration: '7.4s', color: '93 255 151' },
  { left: '27%', top: '25%', size: 1, delay: '-2.2s', duration: '6.6s', color: '190 112 255' },
  { left: '31%', top: '7%', size: 1.4, delay: '-4.7s', duration: '5.9s', color: '101 198 255' },
  { left: '34%', top: '12%', size: 1.25, delay: '-1.1s', duration: '7.2s', color: '255 255 255' },
  { left: '40%', top: '28%', size: 2.15, delay: '-3.9s', duration: '6.7s', color: '255 255 255', flare: true },
  { left: '44%', top: '39%', size: 1.1, delay: '-.7s', duration: '5.5s', color: '93 255 151' },
  { left: '48%', top: '17%', size: 1, delay: '-4.4s', duration: '7.6s', color: '190 112 255' },
  { left: '52%', top: '8%', size: 1.2, delay: '-2.5s', duration: '6.1s', color: '101 198 255' },
  { left: '56%', top: '35%', size: 1.5, delay: '-5.3s', duration: '7.3s', color: '255 255 255' },
  { left: '61%', top: '22%', size: 2.25, delay: '-1.3s', duration: '6.8s', color: '255 255 255', flare: true },
  { left: '66%', top: '13%', size: 1, delay: '-3.1s', duration: '5.7s', color: '101 198 255' },
  { left: '70%', top: '11%', size: 1.1, delay: '-4.9s', duration: '7.5s', color: '93 255 151' },
  { left: '75%', top: '31%', size: 1.75, delay: '-2.1s', duration: '6.4s', color: '255 255 255' },
  { left: '82%', top: '20%', size: 1.4, delay: '-5.7s', duration: '7.8s', color: '255 255 255' },
  { left: '86%', top: '8%', size: 1, delay: '-.4s', duration: '5.4s', color: '93 255 151' },
  { left: '91%', top: '10%', size: 1.2, delay: '-3.4s', duration: '7s', color: '190 112 255' },
  { left: '95%', top: '39%', size: 1, delay: '-1.8s', duration: '6.5s', color: '101 198 255' },
  { left: '97%', top: '18%', size: 2, delay: '-4.1s', duration: '7.7s', color: '255 255 255', flare: true },
  { left: '14%', top: '18%', size: 1.3, delay: '-2.6s', duration: '5.6s', color: '190 112 255' },
  { left: '38%', top: '6%', size: 1.45, delay: '-5.2s', duration: '7.2s', color: '255 255 255' },
  { left: '58%', top: '10%', size: 1.3, delay: '-1.4s', duration: '6.2s', color: '93 255 151' },
  { left: '79%', top: '7%', size: 1.35, delay: '-3.7s', duration: '7.4s', color: '101 198 255' },
];

const shootingStars = [
  { left: '-12%', top: '18%', width: 150, delay: '-7s', duration: '19s', rotate: '-21deg', color: '190 112 255' },
  { left: '24%', top: '11%', width: 130, delay: '-18s', duration: '27s', rotate: '-18deg', color: '93 255 151' },
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
        <>
          <img
            aria-hidden="true"
            src="/assets/lagos-night-skyline.png"
            className={cn(
              'lagos-skyline-image pointer-events-none absolute inset-x-0 object-contain object-bottom',
              skylineClassName,
            )}
          />
          <div aria-hidden="true" className="lagos-water-extension pointer-events-none absolute inset-x-0 bottom-0" />
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,23,.01)_0%,rgba(2,8,23,.02)_48%,rgba(2,8,23,.1)_78%,rgba(2,8,23,.42)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_19%,transparent_0,rgba(2,8,23,.02)_48%,rgba(2,8,23,.14)_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {twinkleStars.map((star, index) => (
          <span
            key={`twinkle-${index}`}
            className={cn('atmosphere-star absolute rounded-full', star.flare && 'atmosphere-star-flare')}
            style={
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                color: `rgb(${star.color})`,
                background: `rgb(${star.color})`,
                boxShadow: `0 0 ${star.size * 3}px rgb(${star.color} / .72), 0 0 ${star.size * 7}px rgb(${star.color} / .2)`,
                '--star-flare': `${Math.max(7, star.size * 4.5)}px`,
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
