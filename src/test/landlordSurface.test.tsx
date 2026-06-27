import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InstalledGameSurface } from '@/components/session/InstalledGameSurface';

// A minimal Oga Landlord public state mirroring the runtime's publicState shape.
const landlordState = {
  gameType: 'landlord',
  name: 'Oga Landlord',
  emoji: '🏠',
  mode: 'landlord',
  phase: 'playing',
  round: 1,
  totalRounds: 1,
  board: [
    { name: 'Start', type: 'start' },
    { name: 'Mile 12 Market', type: 'property', price: 6000, rent: 400, set: 'market' },
    { name: 'Wahala Card', type: 'chance' },
    { name: 'Alaba Intl', type: 'property', price: 6000, rent: 400, set: 'market' },
  ],
  players: [
    { id: 'p1', name: 'Ada', score: 0, cash: 50000 },
    { id: 'p2', name: 'Tobi', score: 0, cash: 50000 },
  ],
  positions: { p1: 1, p2: 0 },
  properties: { p1: [1], p2: [] },
  houses: {},
  mortgaged: [],
  jail: { p1: 0, p2: 0 },
  diceValue: 5,
  currentPlayerId: 'p1',
  cellProps: null,
  wahalaCard: null,
  lastAction: 'Ada rolled 5 and landed on Mile 12 Market.',
  lastResults: [],
  winnerPlayerIds: [],
};

describe('Landlord board surface', () => {
  it('renders the board, bank leaderboard and dice (display)', () => {
    render(
      <InstalledGameSurface
        publicState={landlordState}
        privateState={{ seated: true }}
        role="display"
        sendIntent={() => {}}
      />,
    );
    expect(screen.getByText('🏠 Oga Landlord')).toBeInTheDocument();
    expect(screen.getByText('Mile 12 Market')).toBeInTheDocument();
    expect(screen.getByText('Bank')).toBeInTheDocument();
    expect(screen.getAllByText('₦50,000').length).toBeGreaterThanOrEqual(2); // both players' cash
    expect(screen.getByText('5')).toBeInTheDocument(); // dice
  });

  it('renders legal-move controls for the controller whose turn it is', () => {
    render(
      <InstalledGameSurface
        publicState={landlordState}
        privateState={{ seated: true, isTurn: true, cash: 50000, position: 1, properties: [1], legalIntents: [{ type: 'roll', label: 'Roll dice' }, { type: 'mortgage', position: 1, label: 'Mortgage Mile 12 Market' }] }}
        role="controller"
        sendIntent={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mortgage Mile 12 Market/ })).toBeInTheDocument();
  });

  it('renders auction bidding for every eligible controller, even off turn', () => {
    render(
      <InstalledGameSurface
        publicState={{ ...landlordState, auction: { propertyPosition: 1, propertyName: 'Mile 12 Market', currentBid: 1000, highestBidderId: 'p1', minimumNextBid: 1500, passedPlayerIds: [] } }}
        privateState={{ seated: true, isTurn: false, cash: 50000, legalIntents: [{ type: 'auction_bid', amount: 1500, label: 'Bid ₦1,500' }, { type: 'auction_pass', label: 'Leave auction' }] }}
        role="controller"
        sendIntent={() => {}}
      />,
    );
    expect(screen.getByText('Bank auction')).toBeInTheDocument();
    expect(screen.getByLabelText('Auction bid amount')).toHaveValue('1500');
    expect(screen.getByRole('button', { name: 'Leave auction' })).toBeEnabled();
  });

  it('builds a validated multi-asset trade proposal from controller choices', () => {
    const sendIntent = vi.fn();
    render(
      <InstalledGameSurface
        publicState={{ ...landlordState, properties: { p1: [1], p2: [3] } }}
        privateState={{ seated: true, isTurn: true, cash: 50000, position: 1, properties: [1], legalIntents: [{ type: 'propose_trade', label: 'Propose a trade', targets: ['p2'] }] }}
        role="controller"
        sendIntent={sendIntent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Propose a trade' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mile 12 Market' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alaba Intl' }));
    fireEvent.change(screen.getByPlaceholderText('Cash offered'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send offer' }));
    expect(sendIntent).toHaveBeenCalledWith({
      type: 'propose_trade', targetPlayerId: 'p2', offeredProperties: [1], requestedProperties: [3], offeredCash: 1000, requestedCash: 0,
    });
  });
});
