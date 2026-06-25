import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Games from '@/pages/Games';
import Packs from '@/pages/Packs';

const serverApi = vi.hoisted(() => ({
  getPackAdminAuth: vi.fn(),
  loginPackAdmin: vi.fn(),
  logoutPackAdmin: vi.fn(),
  listPacks: vi.fn(),
  installPack: vi.fn(),
  uninstallPack: vi.fn(),
  fetchGamesCatalog: vi.fn(),
  installGame: vi.fn(),
  updateGame: vi.fn(),
  uninstallGame: vi.fn(),
  updateGamesPolicy: vi.fn(),
}));

vi.mock('@/lib/serverApi', () => serverApi);

describe('catalog and pack pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverApi.getPackAdminAuth.mockResolvedValue(false);
    serverApi.listPacks.mockResolvedValue([]);
    serverApi.fetchGamesCatalog.mockResolvedValue({ games: [], updatePolicy: { automatic: false, overrides: {} } });
  });

  it('renders the unified games library', () => {
    render(<MemoryRouter><Games /></MemoryRouter>);
    expect(screen.getByText('Games Library')).toBeInTheDocument();
    expect(screen.getByText(/choose what is installed/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Owner passphrase')).toBeInTheDocument();
  });

  it('requires owner login before exposing pack management', async () => {
    render(<MemoryRouter><Packs /></MemoryRouter>);
    expect(await screen.findByText('Owner access')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pack repo URL')).not.toBeInTheDocument();
  });

  it('unlocks pack management after a valid login', async () => {
    serverApi.loginPackAdmin.mockResolvedValue(undefined);
    render(<MemoryRouter><Packs /></MemoryRouter>);
    const input = await screen.findByLabelText('Owner passphrase');
    fireEvent.change(input, { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock pack manager' }));
    await waitFor(() => expect(serverApi.loginPackAdmin).toHaveBeenCalledWith('secret'));
    expect(await screen.findByLabelText('Pack repo URL')).toBeInTheDocument();
  });
});
