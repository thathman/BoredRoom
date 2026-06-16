import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GameRouteGuard } from '@/components/routing/GameRouteGuard';

function Wrap({ initialPath }: { initialPath: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/:game/host"
          element={
            <GameRouteGuard>
              <div data-testid="child">child-rendered</div>
            </GameRouteGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('GameRouteGuard', () => {
  it('renders children for a supported game slug (ludo)', () => {
    render(<Wrap initialPath="/ludo/host" />);
    expect(screen.getByTestId('child')).toHaveTextContent('child-rendered');
  });

  it('renders children for a supported game slug (whot)', () => {
    render(<Wrap initialPath="/whot/host" />);
    expect(screen.getByTestId('child')).toHaveTextContent('child-rendered');
  });

  it('renders InvalidGame screen for an unknown game slug', () => {
    render(<Wrap initialPath="/chess/host" />);
    expect(screen.queryByTestId('child')).toBeNull();
    expect(screen.getByText(/Game not found/i)).toBeInTheDocument();
    expect(screen.getByText(/slug: chess/i)).toBeInTheDocument();
  });
});
