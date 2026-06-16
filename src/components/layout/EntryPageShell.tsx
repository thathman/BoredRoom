import type { ReactNode } from 'react';
import { Gamepad2 } from 'lucide-react';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';

interface EntryPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function EntryPageShell({ title, subtitle, children }: EntryPageShellProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(var(--neon-glow)), transparent)', filter: 'blur(80px)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(var(--neon-purple)), transparent)', filter: 'blur(80px)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-xl space-y-7">
        <div className="text-center space-y-3">
          <Gamepad2 className="w-14 h-14 mx-auto text-primary" />
          <h1 className="text-6xl sm:text-7xl font-display font-black neon-text tracking-tight">
            Bored<span className="text-secondary">Room</span>
          </h1>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">{title}</h2>
          <p className="text-base text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        <BuiltByFooter />
      </div>
    </div>
  );
}
