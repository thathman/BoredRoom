import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionSetup from '@/pages/SessionSetup';
import { PACK_REGISTRY } from '@/lib/packs';

// Setup is host-only; simulate a big screen so the wizard (not the phone gate) renders.
vi.mock('@/lib/games', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/games')>();
  return { ...actual, classifyDeviceForGame: () => 'host' as const };
});

// UI pass: the pack-first wizard renders packs and gates "Next" until a pack is chosen.
describe('SessionSetup page', () => {
  it('shows the wizard on a host device and gates Next', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <SessionSetup />
      </MemoryRouter>,
    );
    expect(screen.getByText('Host a game night')).toBeInTheDocument();
    for (const pack of PACK_REGISTRY) {
      expect(screen.getByText(pack.name)).toBeInTheDocument();
    }
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeDisabled();

    fireEvent.click(screen.getByText(PACK_REGISTRY[0].name));
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });
});
