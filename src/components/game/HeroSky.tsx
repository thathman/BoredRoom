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

// Stylized Naija night skyline — deterministic vector silhouette with lit windows and neon antenna
// tips. Themeable via CSS vars; anchored to the hero bottom and faded at the top.
function SkylineSvg() {
  // [x, width, height] in viewBox units (viewBox 0..1200 wide, 0..200 tall, ground = 200).
  const buildings: [number, number, number][] = [
    [0, 70, 90], [64, 46, 130], [104, 90, 70], [186, 40, 160], [220, 64, 110],
    [280, 54, 150], [330, 80, 95], [404, 44, 175], [442, 70, 120], [508, 58, 140],
    [560, 96, 80], [650, 48, 165], [692, 66, 115], [752, 84, 100], [830, 44, 150],
    [868, 72, 128], [934, 90, 88], [1018, 46, 158], [1058, 70, 112], [1122, 90, 96],
  ];
  const windowsFor = (bx: number, bw: number, bh: number) => {
    const cells: { x: number; y: number }[] = [];
    const top = 200 - bh;
    for (let y = top + 10; y < 196; y += 12) {
      for (let x = bx + 6; x < bx + bw - 6; x += 12) {
        // deterministic sparse lighting
        if (((x * 7 + y * 13) % 5) < 2) cells.push({ x, y });
      }
    }
    return cells;
  };

  return (
    <svg
      className="absolute inset-x-0 bottom-0 w-full"
      style={{
        height: '60%',
        opacity: 0.92,
        maskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
        filter: 'drop-shadow(0 0 18px hsl(var(--primary) / 0.25))',
      }}
      viewBox="0 0 1200 200"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {buildings.map(([x, w, h], i) => (
        <g key={i}>
          <rect
            x={x}
            y={200 - h}
            width={w}
            height={h}
            fill="hsl(230 40% 8%)"
            stroke="hsl(var(--primary) / 0.35)"
            strokeWidth={1}
          />
          {windowsFor(x, w, h).map((c, j) => (
            <rect
              key={j}
              x={c.x}
              y={c.y}
              width={3}
              height={4}
              fill={j % 7 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'}
              opacity={0.85}
            />
          ))}
          {/* antenna + glow tip on the taller towers */}
          {h > 140 && (
            <>
              <line x1={x + w / 2} y1={200 - h} x2={x + w / 2} y2={200 - h - 14} stroke="hsl(var(--primary) / 0.6)" strokeWidth={1} />
              <circle cx={x + w / 2} cy={200 - h - 14} r={2.2} fill="hsl(var(--accent))" />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
