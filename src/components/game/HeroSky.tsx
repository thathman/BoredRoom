import { useEffect, useMemo, useRef, useState } from 'react';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

interface ShootingStar {
  id: number;
  top: number;
  left: number;
  angle: number;
  duration: number;
}

/**
 * Hero-only night sky: twinkling stars, periodic shooting stars,
 * and the neon skyline anchored to the bottom of the hero band.
 * Designed to be placed inside a positioned hero container.
 */
export function HeroSky() {
  const reduced = useReducedMotion();
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);
  const nextShootId = useRef(0);

  const stars = useMemo<Star[]>(() => {
    const count = reduced ? 80 : 220;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      // Stars cover the upper ~70% of the hero (above skyline)
      y: Math.random() * 70,
      size: Math.random() * 2.2 + 0.5,
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 4,
    }));
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    let timer: number;
    const spawn = () => {
      const id = nextShootId.current++;
      const star: ShootingStar = {
        id,
        top: Math.random() * 35,
        left: Math.random() * 70,
        angle: 15 + Math.random() * 20,
        duration: 1.2 + Math.random() * 0.8,
      };
      setShootingStars((prev) => [...prev, star]);
      window.setTimeout(() => {
        setShootingStars((prev) => prev.filter((s) => s.id !== id));
      }, (star.duration + 0.2) * 1000);
      timer = window.setTimeout(spawn, 1200 + Math.random() * 2000);
    };
    timer = window.setTimeout(spawn, 600);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Soft sky glow behind everything */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, hsl(160 60% 8% / 0.7) 0%, transparent 60%)',
        }}
      />

      {/* Twinkling stars */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: 0.85,
            boxShadow: '0 0 4px hsl(0 0% 100% / 0.85)',
            animation: reduced
              ? 'none'
              : `star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Shooting stars */}
      {shootingStars.map((s) => (
        <span
          key={s.id}
          className="absolute"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: '120px',
            height: '2px',
            background:
              'linear-gradient(to right, transparent, hsl(var(--primary) / 0.95), white)',
            boxShadow: '0 0 12px hsl(var(--primary) / 0.8)',
            transform: `rotate(${s.angle}deg)`,
            transformOrigin: 'left center',
            animation: `shooting-star ${s.duration}s ease-out forwards`,
            borderRadius: '999px',
          }}
        />
      ))}

      {/* Skyline image anchored to hero bottom. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '62%',
          opacity: 0.9,
          backgroundImage: "url('/images/nigerian-skyline-header.png')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center bottom',
          backgroundSize: 'cover',
          filter: 'drop-shadow(0 0 20px hsl(var(--primary) / 0.25))',
          maskImage: 'linear-gradient(to top, black 45%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 45%, transparent 100%)',
        }}
      />

      {/* Soft ground haze under skyline (no procedural block buildings). */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '48%',
          opacity: 0.8,
          background: 'linear-gradient(to top, hsl(220 35% 10% / 0.9), transparent 70%)',
        }}
      />

      {/* Fade hero into page below */}
      <div
        className="absolute inset-x-0 bottom-0 h-24"
        style={{
          background:
            'linear-gradient(to bottom, transparent, hsl(var(--background)) 95%)',
        }}
      />
    </div>
  );
}
