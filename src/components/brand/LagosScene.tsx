import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AtmosphereTrail = {
  id: number;
  x: number;
  y: number;
  hue: 'green' | 'purple' | 'blue';
};

const twinkleStars = [
  { left: '7%', top: '14%', size: 2, delay: '0s', duration: '2.6s', color: '255 255 255' },
  { left: '12%', top: '44%', size: 3, delay: '.35s', duration: '3.1s', color: '101 198 255' },
  { left: '19%', top: '9%', size: 2, delay: '.9s', duration: '2.2s', color: '255 255 255' },
  { left: '27%', top: '25%', size: 2, delay: '.2s', duration: '3.5s', color: '190 112 255' },
  { left: '34%', top: '12%', size: 3, delay: '1.1s', duration: '2.8s', color: '255 255 255' },
  { left: '44%', top: '39%', size: 2, delay: '.65s', duration: '3.2s', color: '93 255 151' },
  { left: '52%', top: '8%', size: 2, delay: '1.4s', duration: '2.5s', color: '101 198 255' },
  { left: '61%', top: '22%', size: 3, delay: '.15s', duration: '3.7s', color: '255 255 255' },
  { left: '70%', top: '11%', size: 2, delay: '.8s', duration: '2.4s', color: '93 255 151' },
  { left: '82%', top: '20%', size: 3, delay: '1.25s', duration: '3s', color: '255 255 255' },
  { left: '91%', top: '10%', size: 2, delay: '.45s', duration: '2.9s', color: '190 112 255' },
  { left: '95%', top: '39%', size: 2, delay: '1.65s', duration: '3.4s', color: '101 198 255' },
];

const shootingStars = [
  { left: '9%', top: '23%', width: 180, delay: '-1.4s', duration: '6.8s', rotate: '-24deg', color: '190 112 255' },
  { left: '39%', top: '16%', width: 155, delay: '-4.2s', duration: '7.6s', rotate: '-28deg', color: '93 255 151' },
  { left: '66%', top: '29%', width: 135, delay: '-2.8s', duration: '8.2s', rotate: '-18deg', color: '101 198 255' },
  { left: '74%', top: '12%', width: 110, delay: '-6.1s', duration: '9.4s', rotate: '-22deg', color: '255 255 255' },
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
      };
      setTrails((current) => [...current.slice(-14), trail]);
      window.setTimeout(() => {
        setTrails((current) => current.filter((item) => item.id !== trail.id));
      }, 1150);
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
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,23,.02)_0%,rgba(2,8,23,.03)_50%,rgba(2,8,23,.2)_78%,rgba(2,8,23,.62)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_19%,transparent_0,rgba(2,8,23,.04)_48%,rgba(2,8,23,.22)_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {twinkleStars.map((star, index) => (
          <span
            key={`twinkle-${index}`}
            className="absolute rounded-full"
            style={
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                background: `rgb(${star.color})`,
                boxShadow: `0 0 ${star.size * 4}px rgb(${star.color} / .95), 0 0 ${star.size * 9}px rgb(${star.color} / .35)`,
                animation: `star-twinkle ${star.duration} ease-in-out ${star.delay} infinite`,
              } as CSSProperties
            }
          />
        ))}
        {shootingStars.map((star, index) => (
          <span
            key={`shooting-${index}`}
            className="absolute h-px origin-left rounded-full"
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
        {trails.map((trail) => (
          <span
            key={trail.id}
            className={cn(
              'animate-atmosphere-trail absolute h-5 w-5 rounded-full blur-[1px]',
              trail.hue === 'green' && 'bg-primary shadow-[0_0_18px_rgba(69,243,107,.95)]',
              trail.hue === 'purple' && 'bg-secondary shadow-[0_0_18px_rgba(179,76,255,.95)]',
              trail.hue === 'blue' && 'bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,.95)]',
            )}
            style={{ left: trail.x - 5, top: trail.y - 5 }}
          />
        ))}
      </div>
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
