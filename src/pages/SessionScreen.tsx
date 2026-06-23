import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Monitor, Sliders, Smartphone, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ThemeProvider } from '@/components/system/ThemeProvider';
import {
  isSessionScreen,
  screenIsPublic,
  type SessionScreen as Screen,
} from '@/lib/sessionRoutes';
import { getPack, getGamesForPack } from '@/lib/packs';
import { OperatorConsole } from '@/components/session/OperatorConsole';

// Phase 4 multi-screen shells, themed by the active pack (Phase 7). One route, four roles. These are
// designed structural shells; live game rendering arrives via the GameAdapter Display/Controller/
// Setup/Recap components. Public surfaces (display/crowd) never render private state (Art. II).

const SCREEN_META: Record<Screen, { label: string; icon: typeof Monitor; blurb: string }> = {
  display: { label: 'Public Display', icon: Monitor, blurb: 'Everyone watches here. Scan to join.' },
  operator: { label: 'Operator Console', icon: Sliders, blurb: 'Run the night. Settings stay off the big screen.' },
  controller: { label: 'Controller', icon: Smartphone, blurb: 'Your private hand and controls.' },
  crowd: { label: 'Crowd', icon: Users, blurb: 'Cheer, react, and vote with the room.' },
};

export default function SessionScreen() {
  const { code, screen } = useParams<{ code: string; screen: string }>();
  const [params] = useSearchParams();
  const packId = params.get('pack') ?? undefined;

  if (!isSessionScreen(screen)) {
    return <Navigate to={`/session/${code ?? ''}/display`} replace />;
  }

  const meta = SCREEN_META[screen];
  const Icon = meta.icon;
  const pack = getPack(packId);
  const games = packId ? getGamesForPack(packId) : [];
  const isPublic = screenIsPublic(screen);

  return (
    <ThemeProvider packId={packId}>
      <main
        data-screen={screen}
        data-public={isPublic ? 'true' : 'false'}
        className={
          isPublic
            ? 'h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col'
            : 'min-h-screen w-full bg-background text-foreground flex flex-col'
        }
      >
        <header className="px-6 py-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-primary/15 text-primary grid place-items-center">
              <Icon className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground leading-none">
                {pack?.name ?? 'House Session'}
              </p>
              <h1 className="text-lg font-bold leading-tight">{meta.label}</h1>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-base tracking-[0.3em] px-3 py-1">
            {code}
          </Badge>
        </header>

        <div className="flex-1 grid place-items-center p-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md"
          >
            <p className="text-muted-foreground">{meta.blurb}</p>

            {screen === 'display' && games.length > 0 && (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Tonight's lineup</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {games.map((g) => (
                    <Badge key={g.slug} variant="outline" className="text-sm py-1">
                      {g.emoji} {g.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {screen === 'operator' && (
              <div className="mt-6 flex justify-center">
                <OperatorConsole code={code ?? ''} packId={packId} />
              </div>
            )}

            {screen === 'controller' && (
              <p className="mt-6 text-sm text-muted-foreground">
                Waiting for the host to start a game. Your private view appears here.
              </p>
            )}
          </motion.div>
        </div>
      </main>
    </ThemeProvider>
  );
}
