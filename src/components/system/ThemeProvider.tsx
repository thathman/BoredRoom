import { useEffect } from 'react';
import { resolvePackTheme } from '@/lib/packs';
import { applyTheme, isTokenSet } from '@/lib/theme/tokens';

// Applies a pack's design-token theme to the document (Phase 7). Theming is data-driven: the pack's
// PackTheme.tokenSet selects a token map which becomes CSS variables. Defaults to the Naija theme
// when no/unknown pack is active.
export function ThemeProvider({
  packId,
  children,
}: {
  packId?: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const theme = packId ? resolvePackTheme(packId) : null;
    const tokenSet = theme && isTokenSet(theme.tokenSet) ? theme.tokenSet : 'naija';
    applyTheme(tokenSet);
  }, [packId]);

  return <>{children}</>;
}
