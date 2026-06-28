import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControllerMenu } from '@/components/session/ControllerMenu';
import { achievementsFor, type PlayerProfile } from '@/lib/playerProfile';

const profile: PlayerProfile = {
  id: 'd1', displayName: 'Ada', avatarType: 'emoji', avatarValue: '🦁', accentColor: '#45f36b',
  preferences: { sound: true, haptics: true, language: 'en' },
  stats: { gamesPlayed: 3, wins: 1, currentStreak: 1, bestStreak: 1 },
  updatedAt: '',
};

describe('ControllerMenu', () => {
  it('shows the player name chip and opens a flyout with achievements + pause', () => {
    const onPause = vi.fn();
    render(<ControllerMenu profile={profile} onSaveProfile={() => {}} onPause={onPause} canPause />);
    expect(screen.getByRole('button', { name: 'Request game pause' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Request game pause' }));
    expect(onPause).toHaveBeenCalledTimes(1);
    // chip shows the name
    expect(screen.getAllByText('Ada').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByLabelText('Player menu'));
    expect(screen.getByText(/Achievements/)).toBeInTheDocument();
    expect(screen.getByText('1 wins · 3 games')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Request pause'));
    expect(onPause).toHaveBeenCalledTimes(2);
  });

  it('derives achievements from stats (first win earned, champion not)', () => {
    const a = achievementsFor(profile.stats);
    expect(a.find((x) => x.id === 'first_win')?.earned).toBe(true);
    expect(a.find((x) => x.id === 'champion')?.earned).toBe(false);
  });
});
