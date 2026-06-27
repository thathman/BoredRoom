import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InstalledGameSurface } from '@/components/session/InstalledGameSurface';

const board = Array.from({ length: 15 }, () => Array(15).fill(null));
const state = {
  gameType: 'word-wahala', name: 'Word Wahala', emoji: '🔡', mode: 'word-board', phase: 'playing',
  board, players: [{ id: 'p1', name: 'Ada', score: 0 }, { id: 'p2', name: 'Tobi', score: 0 }],
  currentPlayerId: 'p1', turn: 1, bagCount: 86, winnerPlayerIds: [], lastAction: 'Place through the centre.',
};

describe('Word Wahala board surface', () => {
  it('renders a complete board and private rack', () => {
    render(<InstalledGameSurface publicState={state} privateState={{ seated: true, isTurn: true, rack: [{ id: 'a-1', letter: 'A', value: 1 }], legalIntents: [{ type: 'place_tiles' }, { type: 'pass' }] }} role="controller" sendIntent={() => {}} />);
    expect(screen.getByLabelText('Word Wahala board').querySelectorAll('button')).toHaveLength(225);
    expect(screen.getByRole('button', { name: 'Tile A, 1 points' })).toBeInTheDocument();
  });

  it('builds a coordinate placement intent from rack and board interaction', () => {
    const sendIntent = vi.fn();
    render(<InstalledGameSurface publicState={state} privateState={{ seated: true, isTurn: true, rack: [{ id: 'a-1', letter: 'A', value: 1 }], legalIntents: [{ type: 'place_tiles' }, { type: 'pass' }] }} role="controller" sendIntent={sendIntent} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tile A, 1 points' }));
    fireEvent.click(screen.getByRole('button', { name: /Row 8, column 8/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Play word' }));
    expect(sendIntent).toHaveBeenCalledWith({ type: 'place_tiles', placements: [{ tileId: 'a-1', row: 7, col: 7 }] });
  });
});
