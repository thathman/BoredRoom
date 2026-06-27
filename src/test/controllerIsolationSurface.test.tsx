import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstalledGameSurface } from '@/components/session/InstalledGameSurface';

describe('controller projection surfaces', () => {
  it('keeps the public Ludo board off the controller', () => {
    render(<InstalledGameSurface
      publicState={{ gameType: 'ludo', name: 'Ludo', emoji: '🎲', mode: 'ludo', phase: 'playing', round: 1, totalRounds: 1, players: [{ id: 'p1', name: 'Ada', score: 0 }], tokens: { p1: [-1, -1, -1, -1] }, pendingRoll: null, currentPlayerId: 'p1', winnerPlayerIds: [], lastAction: 'Ada can roll.' }}
      privateState={{ seated: true, isTurn: true, tokens: [-1, -1, -1, -1], legalIntents: [{ type: 'roll', label: 'Roll dice' }] }}
      role="controller"
      sendIntent={() => {}}
    />);
    expect(screen.getByText(/Ludo controller/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeInTheDocument();
    expect(screen.queryByText('Race home')).not.toBeInTheDocument();
  });

  it('keeps the public Whot table off the controller while showing only their hand', () => {
    render(<InstalledGameSurface
      publicState={{ gameType: 'whot', name: 'Whot', emoji: '🃏', mode: 'whot', phase: 'playing', round: 1, totalRounds: 5, roundsToWin: 3, players: [{ id: 'p1', name: 'Ada', score: 0, handCount: 1 }, { id: 'p2', name: 'Tobi', score: 0, handCount: 4 }], topCard: { id: 'top', label: 'Circle 10', shape: 'Circle', number: 10 }, drawPileCount: 40, currentPlayerId: 'p1', winnerPlayerIds: [], lastAction: 'Ada to play.' }}
      privateState={{ seated: true, isTurn: true, hand: [{ id: 'mine', label: 'Circle 3', shape: 'Circle', number: 3 }], legalIntents: [{ type: 'play_card', cardId: 'mine', label: 'Play Circle 3' }, { type: 'draw', label: 'Go to market' }] }}
      role="controller"
      sendIntent={() => {}}
    />);
    expect(screen.getByText(/Whot controller/)).toBeInTheDocument();
    expect(screen.getByText('Your hand')).toBeInTheDocument();
    expect(screen.queryByText(/Market ·/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tobi', { exact: true })).not.toBeInTheDocument();
  });
});
