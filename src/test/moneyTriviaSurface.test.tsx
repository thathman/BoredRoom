import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyTriviaSurface } from '@/components/session/MoneyTriviaSurface';

const LADDER = [100, 200, 300, 400, 500, 700, 900, 1200, 1600, 2000, 2500, 3100, 3600, 4300, 5000];

describe('MoneyTriviaSurface', () => {
  it('renders the fastest-finger prompt and lets an eligible controller order options', () => {
    render(
      <MoneyTriviaSurface
        role="controller"
        mine={{ role: 'fastest_finger', fastestFingerSubmitted: false }}
        sendIntent={vi.fn()}
        state={{
          name: 'Money Trivia', emoji: '💰', phase: 'fastest_finger', currency: 'NGN',
          ladder: LADDER, safetyNets: [5, 10], players: [], contestant: null, lastAction: 'Go!',
          fastestFinger: { prompt: 'Order these', options: ['A1', 'B1', 'C1', 'D1'], deadline: null, submittedCount: 0, eligibleCount: 3, tieBreak: false },
        }}
      />,
    );
    expect(screen.getByText('Order these')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lock in order/i })).toBeDisabled();
  });

  it('shows the ladder and a Final answer button for the contestant in hot seat', () => {
    render(
      <MoneyTriviaSurface
        role="controller"
        mine={{ isContestant: true, role: 'contestant' }}
        sendIntent={vi.fn()}
        state={{
          name: 'Money Trivia', emoji: '💰', phase: 'hot_seat', currency: 'NGN',
          ladder: LADDER, safetyNets: [5, 10],
          players: [{ id: 'p1', name: 'Ada', score: 0 }],
          contestant: { id: 'p1', name: 'Ada' }, lastAction: '',
          level: 0, currentPrize: 0, nextPrize: 100,
          question: { prompt: 'Capital of Nigeria?', options: [
            { label: 'Abuja', index: 0, removed: false }, { label: 'Lagos', index: 1, removed: false },
            { label: 'Kano', index: 2, removed: false }, { label: 'Jos', index: 3, removed: false },
          ] },
          selectedOption: 1, lockedOption: null,
          lifelines: { fifty_fifty: { enabled: true, used: false }, ask_room: { enabled: true, used: false }, ask_player: { enabled: true, used: false }, ask_host: { enabled: true, used: false } },
          lifeline: null, reveal: null,
        }}
      />,
    );
    expect(screen.getByText('Capital of Nigeria?')).toBeInTheDocument();
    expect(screen.getByText('Money ladder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Final answer/i })).toBeEnabled();
  });

  it('renders the result and host payout controls when finished', () => {
    const onMarkPayout = vi.fn();
    render(
      <MoneyTriviaSurface
        role="display"
        mine={{}}
        sendIntent={vi.fn()}
        onMarkPayout={onMarkPayout}
        state={{
          name: 'Money Trivia', emoji: '💰', phase: 'finished', currency: 'NGN',
          ladder: LADDER, safetyNets: [5, 10], players: [], contestant: { id: 'p1', name: 'Ada' },
          lastAction: 'Done',
          result: { contestantName: 'Ada', earnedAmount: 2000, pledgedPrize: 5000, outcome: 'walked_away', currency: 'NGN', settlementStatus: 'unsettled' },
        }}
      />,
    );
    expect(screen.getByText('₦2,000')).toBeInTheDocument();
    expect(screen.getByText(/Host-funded prize/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark paid/i })).toBeInTheDocument();
  });
});
