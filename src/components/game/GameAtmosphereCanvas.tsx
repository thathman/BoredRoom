import { useEffect, useRef, useState } from 'react';

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

interface TrailPoint {
  id: number;
  x: number;
  y: number;
}

/**
 * Global atmosphere: only the mouse trail (stars/shooting-stars/skyline now
 * live inside the hero header on the landing page).
 */
export function GameAtmosphereCanvas() {
  const reduced = useReducedMotion();
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const nextTrailId = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const addPoint = (x: number, y: number) => {
      const id = nextTrailId.current++;
      setTrail((prev) => [...prev.slice(-10), { id, x, y }]);
      window.setTimeout(() => {
        setTrail((prev) => prev.filter((p) => p.id !== id));
      }, 700);
    };
    const pointer = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') addPoint(e.clientX, e.clientY);
    };
    const touch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) addPoint(t.clientX, t.clientY);
    };
    window.addEventListener('pointermove', pointer, { passive: true });
    window.addEventListener('touchmove', touch, { passive: true });
    return () => {
      window.removeEventListener('pointermove', pointer);
      window.removeEventListener('touchmove', touch);
    };
  }, [reduced]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {trail.map((p, i) => (
        <span
          key={p.id}
          className="absolute h-2 w-2 rounded-full bg-primary/80 blur-[1px] animate-atmosphere-trail"
          style={{
            left: p.x,
            top: p.y,
            boxShadow: '0 0 20px hsl(var(--primary) / 0.8)',
            opacity: Math.max(0.15, 1 - i * 0.08),
          }}
        />
      ))}
    </div>
  );
}
