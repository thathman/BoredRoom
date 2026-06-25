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

      {/* Neon skyline (inline SVG — themeable, crisp, no binary asset). */}
      <SkylineSvg />

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

function SkylineSvg() {
  return (
    <svg
      className="absolute inset-x-0 bottom-0 w-full"
      style={{
        height: '49%',
        opacity: 0.9,
        filter: 'drop-shadow(0 0 16px hsl(var(--primary) / 0.22))',
      }}
      viewBox="0 0 1600 330"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lagosNeon" x1="0" x2="1">
          <stop offset="0" stopColor="hsl(var(--primary))" />
          <stop offset=".52" stopColor="hsl(var(--primary))" />
          <stop offset="1" stopColor="hsl(var(--secondary))" />
        </linearGradient>
        <linearGradient id="lagosWater" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="hsl(var(--primary) / .22)" />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d="M0 287H1600V330H0Z" fill="hsl(232 40% 5%)" />
      <g fill="hsl(232 38% 7%)" stroke="url(#lagosNeon)" strokeWidth="2">
        {/* Third Mainland Bridge */}
        <path d="M0 267 C110 216 225 211 356 264 L356 286 H0Z" />
        <path d="M18 263 L90 232 L166 220 L244 231 L332 263" fill="none" />
        <path d="M52 248V286M113 226V286M176 220V286M240 230V286M302 252V286" opacity=".65" />
        {/* National Theatre */}
        <path d="M384 286 V237 Q449 190 517 237 V286Z" />
        <path d="M402 240 Q450 215 499 240M412 253H489M423 266H478" fill="none" />
        {/* Marina towers and NECOM */}
        <path d="M548 286V143H603V286M616 286V91H670V286M685 286V126H756V286M771 286V64H827V286" />
        <path d="M799 64V28M790 28H808" fill="none" />
        <path d="M842 286V115H904V286M918 286V165H978V286M993 286V102H1058V286" />
        {/* Civic clock / cathedral silhouette */}
        <path d="M1080 286V175H1122V286M1088 175V145H1114V175M1095 145V128H1107V145" />
        <circle cx="1101" cy="157" r="7" fill="none" />
        {/* Lekki-Ikoyi Link Bridge */}
        <path d="M1152 286H1600V269H1152Z" />
        <path d="M1190 269 Q1354 154 1564 269M1358 269V129M1358 129L1268 269M1358 129L1454 269" fill="none" />
        <path d="M1217 253H1541M1244 234H1513M1275 213H1484" fill="none" opacity=".55" />
      </g>
      <g fill="hsl(var(--accent))">
        {[571, 637, 704, 795, 866, 940, 1015].map((x, index) => (
          <circle key={x} cx={x} cy={180 + (index % 3) * 24} r="2.5" opacity=".8" />
        ))}
      </g>
      <path d="M0 293 Q180 307 356 292 T720 296 T1100 294 T1600 298V330H0Z" fill="url(#lagosWater)" />
    </svg>
  );
}
