import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CompanionPair from '@/pages/CompanionPair';

vi.mock('@/lib/serverApi', () => ({
  redeemCompanionPairing: vi.fn(async (_c: string, t: string) => { if (t === 'bad') throw new Error('expired'); }),
  getCompanionCredential: vi.fn(() => ''),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/pair/:code" element={<CompanionPair />} />
        <Route path="/session/:code/:screen" element={<div>COMPANION CONSOLE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CompanionPair (one-step QR pairing)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('auto-redeems a valid token and lands on the companion console', async () => {
    renderAt('/pair/AB12?t=goodtoken');
    await waitFor(() => expect(screen.getByText('COMPANION CONSOLE')).toBeInTheDocument());
  });

  it('shows an expired message + manual fallback when the token is missing', async () => {
    renderAt('/pair/AB12');
    await waitFor(() => expect(screen.getByRole('button', { name: /Pair manually/i })).toBeInTheDocument());
  });
});
