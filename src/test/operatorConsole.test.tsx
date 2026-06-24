import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperatorConsole } from '@/components/session/OperatorConsole';
import { getAllGames } from '@/lib/catalog';

// The operator can launch any installed game in the room (not pack-scoped).
describe('OperatorConsole', () => {
  it('lists installed games with Start controls', () => {
    render(
      <MemoryRouter>
        <OperatorConsole code="ABCDE" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Start a game')).toBeInTheDocument();
    // a built-in game and a new adapter game both appear
    expect(screen.getByText('Whot')).toBeInTheDocument();
    expect(screen.getByText('Market Price')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Start/i }).length).toBe(getAllGames().length);
  });
});
