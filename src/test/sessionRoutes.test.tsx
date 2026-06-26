import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  isSessionScreen,
  sessionPath,
  screenIsPublic,
  screenSeesPrivateState,
  SESSION_SCREENS,
} from '@/lib/sessionRoutes';
import SessionScreen from '@/pages/SessionScreen';

vi.mock('@/hooks/useHouseSession', () => ({
  useHouseSession: ({ code }: { code: string }) => ({
    snapshot: {
      session: {
        id: 'hs_test',
        code,
        status: 'waiting_for_players',
        settings: { allowBots: true, hintsEnabled: true, allowCrowdVotes: false, maxControllers: 12 },
      },
      members: [],
      activeRun: null,
    },
    status: 'ready',
    gamePublicState: null,
    gamePrivateState: null,
    aiResult: null,
    setReady: vi.fn(),
    sendGameIntent: vi.fn(),
    requestHint: vi.fn(),
    selectGame: vi.fn(),
    startGame: vi.fn(),
    switchGame: vi.fn(),
    endGame: vi.fn(),
  }),
}));

// AC-4.1: each session screen renders its shell. AC-4.2: public display is no-scroll.
// AC-P.1/P.2: state-boundary helpers classify public vs private surfaces.
describe('session routing', () => {
  it('validates screen names', () => {
    expect(isSessionScreen('display')).toBe(true);
    expect(isSessionScreen('controller')).toBe(true);
    expect(isSessionScreen('jumbotron')).toBe(false);
    expect(isSessionScreen(undefined)).toBe(false);
  });

  it('builds session paths', () => {
    expect(sessionPath('ABCD', 'companion')).toBe('/session/ABCD/companion');
  });

  it('classifies public vs private surfaces', () => {
    expect(screenIsPublic('display')).toBe(true);
    expect(screenIsPublic('crowd')).toBe(true);
    expect(screenIsPublic('controller')).toBe(false);
    expect(screenSeesPrivateState('controller')).toBe(true);
    expect(screenSeesPrivateState('display')).toBe(false);
  });

  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/session/:code/:screen" element={<SessionScreen />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('keeps the four unified session screens in the route contract', () => {
    expect(SESSION_SCREENS).toEqual(['display', 'controller', 'crowd', 'companion']);
  });

  it('renders the public display with the one session code', () => {
    renderAt('/session/ABCD/display');
    expect(screen.getByRole('heading', { name: /house abcd/i })).toBeInTheDocument();
  });

  it('public display renders the unified game picker', () => {
    renderAt('/session/ABCD/display');
    expect(screen.getByRole('button', { name: 'Games & controls' })).toBeInTheDocument();
  });

  it('controller waits in the same session for automatic game switching', () => {
    // Players reach the controller after creating a profile (via the join flow).
    localStorage.setItem('boredroom_player_profile', JSON.stringify({ displayName: 'Ada', avatarType: 'emoji', avatarValue: '🦁', accentColor: '#45f36b' }));
    renderAt('/session/ABCD/controller');
    expect(screen.getByText(/controls will switch automatically/i)).toBeInTheDocument();
  });
});
