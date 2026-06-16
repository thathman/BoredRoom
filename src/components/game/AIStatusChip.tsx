import { Sparkles, Zap, AlertTriangle, WifiOff } from 'lucide-react';
import type { AIStatus } from '@/lib/realtimeRoom';

interface AIStatusChipProps {
  status: AIStatus;
  className?: string;
}

const META: Record<AIStatus, { label: string; icon: typeof Sparkles; color: string; bg: string; glow?: string }> = {
  active: {
    label: 'AI live',
    icon: Sparkles,
    color: 'hsl(var(--primary))',
    bg: 'hsl(var(--primary) / 0.12)',
    glow: '0 0 8px hsl(var(--primary) / 0.5)',
  },
  fallback: {
    label: 'AI fallback',
    icon: Zap,
    color: 'hsl(45, 100%, 60%)',
    bg: 'hsl(45, 100%, 60% / 0.12)',
  },
  degraded: {
    label: 'AI slow',
    icon: AlertTriangle,
    color: 'hsl(30, 100%, 60%)',
    bg: 'hsl(30, 100%, 60% / 0.12)',
  },
  offline: {
    label: 'AI offline',
    icon: WifiOff,
    color: 'hsl(var(--muted-foreground))',
    bg: 'hsl(var(--muted-foreground) / 0.12)',
  },
};

export function AIStatusChip({ status, className = '' }: AIStatusChipProps) {
  const meta = META[status];
  const Icon = meta.icon;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-display border border-border backdrop-blur ${className}`}
      style={{ background: meta.bg, color: meta.color, boxShadow: meta.glow }}
      title={`AI commentary: ${meta.label}`}
      aria-label={`AI commentary status: ${meta.label}`}
    >
      <Icon className="w-3 h-3" />
      <span className="uppercase tracking-wider">{meta.label}</span>
    </div>
  );
}
