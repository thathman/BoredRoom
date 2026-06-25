import { cn } from '@/lib/utils';

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('brand-script inline-flex items-baseline text-3xl leading-none text-white', className)}>
      Bored<span className="text-primary">Room</span>
    </span>
  );
}
