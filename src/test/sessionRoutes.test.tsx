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
    expect(sessionPath('ABCD', 'operator')).toBe('/session/ABCD/operator');
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

  it('renders each screen shell with the right label', () => {
    for (const s of SESSION_SCREENS) {
      const { unmount } = renderAt(`/session/ABCD/${s}`);
      expect(screen.getByText('Session ABCD')).toBeInTheDocument();
      unmount();
    }
  });

  it('public display shell is marked no-scroll', () => {
    renderAt('/session/ABCD/display');
    const main = document.querySelector('main[data-screen="display"]') as HTMLElement;
    expect(main).toBeTruthy();
    expect(main.getAttribute('data-public')).toBe('true');
    expect(main.className).toContain('overflow-hidden');
  });

  it('controller shell is not public and scrollable', () => {
    renderAt('/session/ABCD/controller');
    const main = document.querySelector('main[data-screen="controller"]') as HTMLElement;
    expect(main.getAttribute('data-public')).toBe('false');
    expect(main.className).not.toContain('overflow-hidden');
  });
});
