import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionSetup from '@/pages/SessionSetup';

// Setup is host-only; simulate a big screen so the wizard (not the phone gate) renders.
vi.mock('@/lib/games', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/games')>();
  return { ...actual, classifyDeviceForGame: () => 'host' as const };
});

// New model: no pack-picking step — the wizard opens a room with all installed games available.
describe('SessionSetup page', () => {
  it('renders the room setup wizard at the settings step (no pack chooser)', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <SessionSetup />
      </MemoryRouter>,
    );
    expect(screen.getByText('Start a game night')).toBeInTheDocument();
    expect(screen.getByText('Set the house rules')).toBeInTheDocument();
    expect(screen.getByText('Allow bots')).toBeInTheDocument();
    // No "Pick your packs" step exists anymore.
    expect(screen.queryByText(/Pick your packs/i)).toBeNull();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });
});
