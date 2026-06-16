import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvalidGame from '@/pages/InvalidGame';

describe('InvalidGame (game_mismatch)', () => {
  it('renders mismatch title and detail string', () => {
    render(
      <MemoryRouter>
        <InvalidGame reason="game_mismatch" detail="URL: ludo · Room: whot · Code: ABCD" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Wrong game for this room/i)).toBeInTheDocument();
    expect(screen.getByText(/URL: ludo · Room: whot · Code: ABCD/)).toBeInTheDocument();
  });

  it('falls back to unknown_game title when reason omitted', () => {
    render(
      <MemoryRouter>
        <InvalidGame />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Game not found/i)).toBeInTheDocument();
  });
});
