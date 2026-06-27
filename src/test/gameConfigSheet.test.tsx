import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameConfigSheet } from '@/components/session/GameConfigSheet';
import type { LibraryGame } from '@/lib/serverApi';

const game: LibraryGame = {
  id: 'whot', name: 'Whot', emoji: '🃏', description: '', version: '1.0.0.0',
  minPlayers: 2, maxPlayers: 6,
  capabilities: { bots: true, audience: true, hints: true, restore: true },
  installed: true, updateAvailable: false, updateOverride: 'inherit',
};

describe('GameConfigSheet', () => {
  it('starts with the chosen pace timer baked into settings', () => {
    const onStart = vi.fn();
    render(<GameConfigSheet game={game} readyPlayers={2} onStart={onStart} onCancel={() => {}} />);
    // Pick blitz pace, then start.
    fireEvent.click(screen.getByRole('button', { name: /Blitz/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start Whot/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
    const cfg = onStart.mock.calls[0][0];
    expect(cfg.pace).toBe('blitz');
    expect(cfg.timerMs).toBe(7000);
    expect(cfg.questionCount).toBe(cfg.rounds);
  });

  it('carries runtime-honored game-specific settings (Whot special cards default on)', () => {
    const onStart = vi.fn();
    render(<GameConfigSheet game={game} readyPlayers={2} onStart={onStart} onCancel={() => {}} />);
    expect(screen.getByText(/Special cards/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start Whot/i }));
    const cfg = onStart.mock.calls[0][0];
    expect(cfg.specialCards).toBe(true);
    expect(cfg.enableDirection).toBe(false);
  });
});
