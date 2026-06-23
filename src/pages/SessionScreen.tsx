import { useParams, Navigate } from 'react-router-dom';
import {
  isSessionScreen,
  screenIsPublic,
  type SessionScreen as Screen,
} from '@/lib/sessionRoutes';

// Phase 4 multi-screen shell. One route, four roles. These are structural shells; game rendering
// arrives via the GameAdapter (Phase 6) and theming via design tokens (Phase 7). Public surfaces
// (display/crowd) must never render private state (constitution Art. II).

const SCREEN_LABEL: Record<Screen, string> = {
  display: 'Public Display',
  operator: 'Operator Console',
  controller: 'Controller',
  crowd: 'Crowd',
};

export default function SessionScreen() {
  const { code, screen } = useParams<{ code: string; screen: string }>();

  if (!isSessionScreen(screen)) {
    return <Navigate to={`/session/${code ?? ''}/display`} replace />;
  }

  // The public display fills the viewport with no scroll (constitution Art. IV.2).
  const noScroll = screenIsPublic(screen);

  return (
    <main
      data-screen={screen}
      data-public={screenIsPublic(screen) ? 'true' : 'false'}
      className={
        noScroll
          ? 'h-screen w-screen overflow-hidden flex flex-col items-center justify-center'
          : 'min-h-screen w-full flex flex-col items-center justify-center p-4'
      }
    >
      <p className="text-sm uppercase tracking-widest opacity-60">Session {code}</p>
      <h1 className="text-2xl font-semibold">{SCREEN_LABEL[screen]}</h1>
    </main>
  );
}
