import { cn } from '@/lib/utils';

export function WhotRulesSummary({
  settings,
  className,
}: {
  settings: Record<string, unknown>;
  className?: string;
}) {
  const turnSeconds = Number(settings.turnSeconds ?? 45);
  const value = (key: string, fallback: string) => String(settings[key] ?? fallback).replaceAll('_', ' ');

  return (
    <div className={cn('rounded-xl border border-white/10 bg-black/25 p-3', className)}>
      <p className="font-medium text-foreground">Current Whot house rules</p>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
        <dt>Format</dt><dd>Best of 5 · first to 3</dd>
        <dt>Starting hand</dt><dd>{Number(settings.initialHandSize ?? 6)} cards</dd>
        <dt>Turn time</dt><dd>{turnSeconds === 0 ? 'Off' : `${turnSeconds}s`}</dd>
        <dt>Special effects</dt><dd>{settings.specialCards === false ? 'Off' : 'On'}</dd>
        <dt>Pick defence</dt><dd className="capitalize">{value('pickDefence', 'stack_same')}</dd>
        <dt>Special-card finish</dt><dd>{settings.allowSpecialFinish === false ? 'Blocked' : 'Allowed'}</dd>
        <dt>Star 8</dt><dd>{settings.starSuspension === 'skip_one' ? 'Skip 1' : 'Skip 2'}</dd>
        <dt>General Market</dt><dd>{settings.generalMarketTurn === 'pass' ? 'Pass turn' : 'Play again'}</dd>
        <dt>Round starter</dt><dd>{settings.rotateStarter === false ? 'Same player' : 'Rotates'}</dd>
        <dt>Timeout</dt><dd className="capitalize">{value('timeoutPenalty', 'draw_and_pass')}</dd>
        <dt>Card 11 reverse</dt><dd>{settings.enableDirection === true ? 'On' : 'Off'}</dd>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">Locked during this match so everyone plays the rules accepted at setup.</p>
    </div>
  );
}
