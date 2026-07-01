import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2, LockKeyhole, LogOut, MoreVertical, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LagosScene } from '@/components/brand/LagosScene';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { MoneyTriviaReview } from '@/components/games/MoneyTriviaReview';
import {
  fetchGamesCatalog,
  getGameAdminAuth,
  installGame,
  loginGameAdmin,
  logoutGameAdmin,
  uninstallGame,
  updateGame,
  updateGamesPolicy,
  type GameUpdatePolicy,
  type LibraryGame,
} from '@/lib/serverApi';

export default function Games() {
  const navigate = useNavigate();
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [policy, setPolicy] = useState<GameUpdatePolicy>({ automatic: false, overrides: {} });
  const [authenticated, setAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchGamesCatalog();
      setGames(result.games);
      setPolicy(result.updatePolicy);
    } catch {
      toast.error('The official games catalog is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([refresh(), getGameAdminAuth().then(setAuthenticated)]);
  }, [refresh]);

  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? games.filter((game) => `${game.name} ${game.description}`.toLowerCase().includes(normalized))
      : games;
  }, [games, query]);

  async function unlock() {
    if (!passphrase) return;
    setBusy('auth');
    try {
      await loginGameAdmin(passphrase);
      setPassphrase('');
      setAuthenticated(true);
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'game_admin_rate_limited'
        ? 'Too many attempts. Try again later.'
        : 'Incorrect owner passphrase.');
    } finally {
      setBusy(null);
    }
  }

  async function mutate(game: LibraryGame, action: 'install' | 'update' | 'uninstall') {
    setBusy(game.id);
    try {
      if (action === 'install') await installGame(game.id);
      if (action === 'update') await updateGame(game.id);
      if (action === 'uninstall') await uninstallGame(game.id);
      toast.success(`${game.name} ${action === 'uninstall' ? 'uninstalled' : 'installed'}`);
      await refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'failed';
      toast.error(code === 'game_active'
        ? `${game.name} is running. End the game before changing it.`
        : `Could not ${action} ${game.name} (${code}).`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <LagosScene>
      <div className="mx-auto min-h-screen max-w-6xl px-5 pb-36 pt-6 sm:px-8">
        <header className="flex items-center justify-between">
          <BrandLogo />
          <Button variant="outline" className="rounded-xl bg-black/25" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" /> Back home
          </Button>
        </header>

        <section className="mx-auto mt-5 max-w-5xl">
          <div className="text-center">
            <h1 className="brush-display text-5xl text-white sm:text-6xl">Games <span className="text-primary">Library</span></h1>
            <p className="mt-2 text-sm text-muted-foreground">Find and manage your games.</p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="neon-panel flex h-12 flex-1 items-center gap-3 rounded-xl px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search games…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {!authenticated ? (
              <div className="flex gap-2">
                <Input
                  type="password"
                  className="h-12 w-full bg-black/35 sm:w-52"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void unlock()}
                  placeholder="Owner passphrase"
                  aria-label="Owner passphrase"
                />
                <Button className="h-12 rounded-xl" onClick={() => void unlock()} disabled={!passphrase || busy === 'auth'}>
                  {busy === 'auth' ? <Loader2 className="animate-spin" /> : <LockKeyhole />} Manage
                </Button>
              </div>
            ) : (
              <div className="neon-panel flex h-12 items-center gap-3 rounded-xl px-4">
                <Switch checked={policy.automatic} onCheckedChange={(automatic) => void updateGamesPolicy({ automatic }).then(setPolicy)} />
                <span className="text-xs">Auto-update</span>
                <Button variant="ghost" size="icon" onClick={() => void logoutGameAdmin().then(() => setAuthenticated(false))} aria-label="Lock owner controls">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="neon-panel mt-4 overflow-hidden rounded-2xl">
            {loading ? (
              <div className="grid min-h-72 place-items-center"><Loader2 className="h-9 w-9 animate-spin text-primary" /></div>
            ) : visibleGames.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">No games match that search.</div>
            ) : visibleGames.map((game) => (
              <article key={game.id} className="grid gap-4 border-b border-white/10 px-4 py-3 last:border-0 sm:grid-cols-[52px_1fr_150px_auto] sm:items-center">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/8 text-3xl">{game.emoji}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold">{game.name}</h2>
                  <p className="truncate text-[11px] text-muted-foreground">{game.description}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  <strong className="block font-medium text-white">{game.minPlayers}–{game.maxPlayers} players</strong>
                  <span>{game.capabilities.audience ? 'Crowd compatible' : 'Players only'} · v{game.version}</span>
                </div>
                <div className="flex min-w-40 items-center justify-end gap-2">
                  <span className={`mr-1 text-xs ${game.installed ? 'text-primary' : 'text-muted-foreground'}`}>
                    {game.installed ? '● Installed' : '○ Not installed'}
                  </span>
                  {authenticated && !game.installed && (
                    <Button size="sm" variant="outline" className="border-primary text-primary" onClick={() => void mutate(game, 'install')} disabled={busy === game.id}>
                      <Download className="h-4 w-4" /> Install
                    </Button>
                  )}
                  {authenticated && game.updateAvailable && (
                    <Button size="sm" variant="outline" className="border-primary text-primary" onClick={() => void mutate(game, 'update')} disabled={busy === game.id}>
                      <RefreshCw className="h-4 w-4" /> Update
                    </Button>
                  )}
                  {authenticated && game.installed && !game.updateAvailable && (
                    <Button size="sm" variant="outline" onClick={() => void mutate(game, 'uninstall')} disabled={busy === game.id}>
                      <Trash2 className="h-4 w-4" /> Uninstall
                    </Button>
                  )}
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              </article>
            ))}
          </div>
        </section>
        {authenticated && (
          <section className="mt-8">
            <MoneyTriviaReview />
          </section>
        )}
        <BuiltByFooter />
      </div>
    </LagosScene>
  );
}
