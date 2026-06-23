import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionSetup from '@/pages/SessionSetup';
import { PACK_REGISTRY } from '@/lib/packs';

// UI pass: the pack-first wizard renders packs and gates "Next" until a pack is chosen.
describe('SessionSetup page', () => {
  it('lists packs from the registry and gates Next', () => {
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
