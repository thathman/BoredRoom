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
}));

vi.mock('@/lib/serverApi', () => serverApi);

describe('catalog and pack pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverApi.getPackAdminAuth.mockResolvedValue(false);
    serverApi.listPacks.mockResolvedValue([]);
  });

  it('renders all games as browse-only content', () => {
    render(<MemoryRouter><Games /></MemoryRouter>);
    expect(screen.getByText('All games')).toBeInTheDocument();
    expect(screen.getByText(/return home and host a game night/i)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(15);
    expect(screen.queryByRole('button', { name: /play /i })).not.toBeInTheDocument();
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
