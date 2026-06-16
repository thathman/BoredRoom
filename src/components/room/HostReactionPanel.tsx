// Host moderation panel for reactions/taunts.
// Used in two layouts:
//   - Lobby: full inline panel (variant="full")
//   - In-game: compact sheet/drawer trigger + body (variant="drawer")

import { useMemo, useState } from 'react';
import {
  DEFAULT_REACTION_POLICY,
  ReactionPolicy,
  ReactionStats,
  RoomMember,
  TauntPolicy,
} from '@/lib/transport/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Settings2, Trash2, Smile, Zap } from 'lucide-react';
import { toast } from 'sonner';

// Three named presets — saves the host from sliding 5 controls individually.
const PRESETS: Record<'strict' | 'balanced' | 'loose', Partial<ReactionPolicy>> = {
  strict: { cooldownMs: 800, burstMax: 4, burstWindowMs: 3000, duplicateWindowMs: 600 },
  balanced: { cooldownMs: 600, burstMax: 6, burstWindowMs: 3000, duplicateWindowMs: 500 },
  loose: { cooldownMs: 300, burstMax: 10, burstWindowMs: 3000, duplicateWindowMs: 0 },
};

interface Props {
  reactionPolicy?: ReactionPolicy;
  tauntPolicy?: TauntPolicy;
  reactionStats?: ReactionStats;
  /** Resolved display renderer ('webgl-hybrid' | 'css3d'). Diagnostics only. */
  rendererMode?: string;
  /** Member list, used for "top senders" attribution. */
  members?: RoomMember[];
  onSetReactionPolicy: (policy: Partial<ReactionPolicy>) => void;
  onSetTauntPolicy: (policy: Partial<TauntPolicy>) => void;
  onClearReactions: () => void;
  variant?: 'full' | 'drawer';
}

function ReactionPanelBody({
  reactionPolicy,
  tauntPolicy,
  reactionStats,
  rendererMode,
  members,
  onSetReactionPolicy,
  onSetTauntPolicy,
  onClearReactions,
}: Omit<Props, 'variant'>) {
  const policy = reactionPolicy ?? DEFAULT_REACTION_POLICY;
  const taunt = tauntPolicy ?? { enabled: true };
  const stats = reactionStats;

  const handleClear = () => {
    onClearReactions();
    toast.success('Reactions cleared');
  };

  const applyPreset = (name: 'strict' | 'balanced' | 'loose') => {
    onSetReactionPolicy(PRESETS[name]);
    toast.success(`Preset: ${name}`);
  };

  // Top 3 senders by accepted count — labels resolved against the member list.
  const topSenders = useMemo(() => {
    if (!stats?.perUserAccepted) return [];
    const memberMap = new Map((members ?? []).map((m) => [m.id, m.displayName]));
    return Object.entries(stats.perUserAccepted)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({
        id,
        count,
        name: memberMap.get(id) ?? id.slice(0, 6),
      }));
  }, [stats, members]);

  const totalRejected = stats
    ? stats.rejected.cooldown +
      stats.rejected.rate_limited +
      stats.rejected.disabled +
      stats.rejected.duplicate
    : 0;

  return (
    <div className="space-y-5">
      {/* Master toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="reactions-on" className="font-display">
            Reactions enabled
          </Label>
          <Switch
            id="reactions-on"
            checked={policy.enabled}
            onCheckedChange={(v) => onSetReactionPolicy({ enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="taunts-on" className="font-display">
            Taunts enabled
          </Label>
          <Switch
            id="taunts-on"
            checked={taunt.enabled}
            onCheckedChange={(v) => onSetTauntPolicy({ enabled: v })}
          />
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-display flex items-center gap-1">
          <Zap className="w-3 h-3" /> Presets
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={() => applyPreset('strict')}>
            Strict
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => applyPreset('balanced')}>
            Balanced
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => applyPreset('loose')}>
            Loose
          </Button>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <span>Cooldown</span>
            <span className="tabular-nums">{policy.cooldownMs}ms</span>
          </div>
          <Slider
            value={[policy.cooldownMs]}
            min={0}
            max={3000}
            step={50}
            onValueChange={([v]) => onSetReactionPolicy({ cooldownMs: v })}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <span>Burst max</span>
            <span className="tabular-nums">{policy.burstMax} / {policy.burstWindowMs}ms</span>
          </div>
          <Slider
            value={[policy.burstMax]}
            min={1}
            max={20}
            step={1}
            onValueChange={([v]) => onSetReactionPolicy({ burstMax: v })}
          />
          <Slider
            className="mt-2"
            value={[policy.burstWindowMs]}
            min={500}
            max={10000}
            step={250}
            onValueChange={([v]) => onSetReactionPolicy({ burstWindowMs: v })}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <span>Duplicate suppression</span>
            <span className="tabular-nums">{policy.duplicateWindowMs}ms</span>
          </div>
          <Slider
            value={[policy.duplicateWindowMs]}
            min={0}
            max={3000}
            step={50}
            onValueChange={([v]) => onSetReactionPolicy({ duplicateWindowMs: v })}
          />
        </div>
      </div>

      {/* Diagnostics */}
      {stats && (
        <div className="text-xs space-y-2 p-3 rounded-lg bg-muted/40 font-display">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-muted-foreground">Accepted</div>
              <div className="text-foreground tabular-nums text-base">{stats.totalAccepted}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Rejected</div>
              <div className="text-foreground tabular-nums text-base">{totalRejected}</div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            cd:{stats.rejected.cooldown} · rl:{stats.rejected.rate_limited} · dup:{stats.rejected.duplicate} · off:{stats.rejected.disabled}
          </div>
          {topSenders.length > 0 && (
            <div className="pt-1 border-t border-border/60 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Top senders
              </div>
              {topSenders.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="truncate max-w-[60%]">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{s.count}</span>
                </div>
              ))}
            </div>
          )}
          {rendererMode && (
            <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60">
              renderer: <span className="font-mono">{rendererMode}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2"
          onClick={handleClear}
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear reactions
        </Button>
      </div>
    </div>
  );
}

export function HostReactionPanel(props: Props) {
  const variant = props.variant ?? 'full';
  const policy = props.reactionPolicy ?? DEFAULT_REACTION_POLICY;
  const taunt = props.tauntPolicy ?? { enabled: true };

  if (variant === 'drawer') {
    return (
      <DrawerVariant {...props} policy={policy} taunt={taunt} />
    );
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-4 max-w-md mx-auto w-full">
      <div className="flex items-center gap-2">
        <Smile className="w-4 h-4 text-primary" />
        <h3 className="font-display font-bold text-sm uppercase tracking-wider">
          Reactions policy
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {policy.enabled ? 'ON' : 'OFF'} · {taunt.enabled ? 'taunts on' : 'taunts off'}
        </span>
      </div>
      <ReactionPanelBody {...props} />
    </div>
  );
}

function DrawerVariant({
  policy,
  taunt,
  ...props
}: Props & { policy: ReactionPolicy; taunt: TauntPolicy }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 fixed bottom-3 left-3 z-30 bg-card/90 backdrop-blur"
          aria-label="Reactions moderation"
        >
          <Settings2 className="w-4 h-4" />
          Reactions
          <span className="text-[10px] text-muted-foreground font-mono">
            {policy.enabled ? 'on' : 'off'}/{taunt.enabled ? 't:on' : 't:off'}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        overlayClassName="pointer-events-none bg-transparent"
        className="w-[70vw] max-w-sm overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Reactions moderation</SheetTitle>
          <SheetDescription>
            Tune live. Changes apply immediately for everyone.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <ReactionPanelBody {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
