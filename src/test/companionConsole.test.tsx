import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompanionConsole } from '@/components/session/CompanionConsole';
import type { SessionMember } from '@/lib/serverApi';

const members: SessionMember[] = [
  { deviceId: 'a', displayName: 'Ada', role: 'controller', ready: true, connected: true, joinedAt: '', lastSeenAt: '' },
  { deviceId: 'p', displayName: 'Pending Pat', role: 'controller', pending: true, ready: false, connected: true, joinedAt: '', lastSeenAt: '' },
];

function noop() {}
const baseProps = {
  code: 'ABCD', joinUrl: 'https://x/join/ABCD', members, remoteOn: true,
  activeGame: null, votePoll: null, voteHistory: [], pairingCode: null,
  onOpenGames: noop, admitPlayer: noop, rejectPlayer: noop, kickPlayer: noop,
  setRemoteMode: noop, pauseGame: noop, resumeGame: noop, endGame: noop,
  callVote: noop, closeVote: noop, cancelVote: noop, applyVoteResult: noop,
  overrideVote: noop, endParty: noop, deleteParty: noop, createPairing: noop,
};

describe('CompanionConsole', () => {
  it('shows the party code/QR on the Party tab and tabbed navigation', () => {
    render(<CompanionConsole {...baseProps} />);
    expect(screen.getByText('Control booth')).toBeInTheDocument();
    expect(screen.getByText('ABCD')).toBeInTheDocument();
    // tabs present
    ['Party', 'Players', 'Games', 'Current', 'Votes', 'Settings'].forEach((t) =>
      expect(screen.getByText(t)).toBeInTheDocument());
  });

  it('lists pending players with admit/reject on the Players tab', () => {
    const admit = vi.fn();
    render(<CompanionConsole {...baseProps} admitPlayer={admit} />);
    fireEvent.click(screen.getByText('Players'));
    expect(screen.getByText('Pending Pat')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Admit'));
    expect(admit).toHaveBeenCalledWith('p');
  });

  it('exposes End/Delete party only behind the Settings danger zone', () => {
    render(<CompanionConsole {...baseProps} />);
    // not visible on the default Party tab
    expect(screen.queryByText('End party')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('End party')).toBeInTheDocument();
    expect(screen.getByText('Delete party')).toBeInTheDocument();
  });
});
