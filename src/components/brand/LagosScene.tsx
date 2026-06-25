import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function LagosScene({
  children,
  className,
  skyline = true,
}: {
  children: ReactNode;
  className?: string;
  skyline?: boolean;
}) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-background text-foreground star-field', className)}>
      {skyline ? (
        <img
          aria-hidden="true"
          src="/assets/lagos-night-skyline.png"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full object-cover object-bottom"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,23,.02)_0%,rgba(2,8,23,.04)_50%,rgba(2,8,23,.4)_78%,rgba(2,8,23,.86)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_19%,transparent_0,rgba(2,8,23,.08)_48%,rgba(2,8,23,.42)_100%)]" />
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
