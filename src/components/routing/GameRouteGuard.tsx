import { Navigate, useParams } from 'react-router-dom';
import { getGameMeta, isGameEnabled, isSupportedGame } from '@/lib/games';
import InvalidGame from '@/pages/InvalidGame';
import type { ReactNode } from 'react';

/**
 * Validates that the :game URL param is a supported slug.
 * Renders the InvalidGame screen if not.
 */
export function GameRouteGuard({ children }: { children: ReactNode }) {
  const { game } = useParams<{ game: string }>();
  if (!isSupportedGame(game)) {
    return <InvalidGame reason="unknown_game" detail={game ? `slug: ${game}` : undefined} />;
  }
  if (!isGameEnabled(game)) {
    const meta = getGameMeta(game);
    return (
      <InvalidGame
        reason="game_disabled"
        detail={meta ? `${meta.name} is temporarily gated until full smoke pass` : undefined}
      />
    );
  }
  return <>{children}</>;
}

/** Convenience: redirect bare /:game → /:game/<role> using device heuristic. */
export function GameIndexRedirect() {
  const { game } = useParams<{ game: string }>();
  if (!isSupportedGame(game) || !isGameEnabled(game)) {
    return <Navigate to="/" replace />;
  }
  // Defer to Index-style heuristic at navigation time.
  // Done synchronously for SSR-safety: we use a client-only check.
  if (typeof window === 'undefined') {
    return <Navigate to={`/${game}/join`} replace />;
  }
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const role = !isCoarse && window.innerWidth >= 1200 ? 'host' : 'join';
  return <Navigate to={`/${game}/${role}`} replace />;
}
