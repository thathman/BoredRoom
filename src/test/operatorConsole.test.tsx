import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperatorConsole } from '@/components/session/OperatorConsole';
import { getGamesForPack } from '@/lib/packs';

// Operator can launch any game in the session's pack (Phase 9 surface; flow toward 10).
describe('OperatorConsole', () => {
  it('lists the pack lineup with Start controls', () => {
    render(
      <MemoryRouter>
        <OperatorConsole code="ABCDE" packId="pack.market" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Start a game')).toBeInTheDocument();
    for (const g of getGamesForPack('pack.market')) {
      expect(screen.getByText(g.name)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: /Start/i }).length).toBeGreaterThan(0);
  });

  it('shows an empty state when the session has no games', () => {
    render(
      <MemoryRouter>
        <OperatorConsole code="ZZZZZ" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No games in this session/i)).toBeInTheDocument();
  });
});
