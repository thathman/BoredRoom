import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperatorConsole } from '@/components/session/OperatorConsole';
import { getAllGames } from '@/lib/catalog';

// The operator lists installed games; only legacy games are startable today (adapter games show
// "Coming soon" instead of dead-ending).
describe('OperatorConsole', () => {
  it('lists games; legacy startable, adapter coming soon', () => {
    render(
      <MemoryRouter>
        <OperatorConsole code="ABCDE" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Start a game')).toBeInTheDocument();
    expect(screen.getByText('Whot')).toBeInTheDocument(); // legacy
    expect(screen.getByText('Market Price')).toBeInTheDocument(); // adapter
    const legacyCount = getAllGames().filter((g) => g.kind === 'legacy').length;
    expect(screen.getAllByRole('button', { name: /^Start$/i }).length).toBe(legacyCount);
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
  });
});
