import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
