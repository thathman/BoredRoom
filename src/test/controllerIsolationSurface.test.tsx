import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InstalledGameSurface } from '@/components/session/InstalledGameSurface';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

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

  it('shows the requested Whot shape and uses a private assistant bubble without raw intents', () => {
    render(<InstalledGameSurface
      publicState={{ gameType: 'whot', name: 'Whot', emoji: '🃏', mode: 'whot', phase: 'playing', round: 1, totalRounds: 5, roundsToWin: 3, players: [{ id: 'p1', name: 'Ada', score: 0, handCount: 2 }, { id: 'p2', name: 'Obi', score: 0, handCount: 4 }], topCard: { id: 'top', label: 'Whot 20', shape: 'Whot', number: 20, isWhot: true }, requestedShape: 'Star', drawPileCount: 40, currentPlayerId: 'p1', winnerPlayerIds: [], lastAction: 'Obi played Whot 20 and requested Star.' }}
      privateState={{ seated: true, isTurn: true, hand: [{ id: 'mine', label: 'Star 3', shape: 'Star', number: 3 }], legalIntents: [{ type: 'play_card', cardId: 'mine', label: 'Play Star 3' }] }}
      role="controller"
      sendIntent={() => {}}
      requestHint={() => {}}
      aiHint="Play the highlighted Star 3 to match the requested shape."
      hintBudget={1}
    />);
    expect(screen.getByText(/Requested shape:.*Star/)).toBeInTheDocument();
    expect(screen.queryByText(/Hint \(1\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open personal game assistant' }));
    expect(screen.getByText('Your private assistant')).toBeInTheDocument();
    expect(screen.getByText(/Play the highlighted Star 3/)).toBeInTheDocument();
    expect(screen.queryByText(/"type"|cardId|\{/)).not.toBeInTheDocument();
  });

  it('shows Whot match wins and MC callouts without exposing display controls when a companion is active', () => {
    render(<InstalledGameSurface
      publicState={{
        gameType: 'whot', name: 'Whot', emoji: '🃏', mode: 'whot', phase: 'round_end', round: 2, totalRounds: 5, roundsToWin: 3,
        players: [{ id: 'p1', name: 'Ada', score: 2, roundWins: 2, handCount: 0 }, { id: 'p2', name: 'Tobi', score: 0, roundWins: 0, handCount: 4 }],
        topCard: { id: 'top', label: 'Circle 3', shape: 'Circle', number: 3 }, drawPileCount: 28,
        currentPlayerId: 'p1', winnerPlayerIds: ['p1'], lastAction: 'Ada calls check up and wins round 2.',
        callout: { kind: 'check_up', playerName: 'Ada', text: 'Ada: check up!', sequence: 4 },
      }}
      privateState={{ seated: false, legalIntents: [] }}
      role="display"
      sendIntent={() => {}}
      aiCommentary="Ada has cleared the table — two rounds on the board!"
      hostControlsEnabled={false}
    />);
    expect(screen.getByText(/Round 2 of 5 · First to 3/)).toBeInTheDocument();
    expect(screen.getByText(/2 wins/)).toBeInTheDocument();
    expect(screen.getByText('Ada: check up!')).toBeInTheDocument();
    expect(screen.getByText(/MC/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next round/i })).not.toBeInTheDocument();
  });
});
