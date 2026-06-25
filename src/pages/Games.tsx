import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, Gamepad2, Loader2, LockKeyhole, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import {
  fetchGamesCatalog,
  getPackAdminAuth,
  installGame,
  loginPackAdmin,
  logoutPackAdmin,
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
    void Promise.all([refresh(), getPackAdminAuth().then(setAuthenticated)]);
  }, [refresh]);

  async function unlock() {
    if (!passphrase) return;
    setBusy('auth');
    try {
      await loginPackAdmin(passphrase);
      setPassphrase('');
      setAuthenticated(true);
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'pack_admin_rate_limited'
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
        ? `${game.name} is running in a session. End it before changing the installation.`
        : `Could not ${action} ${game.name} (${code}).`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6 text-foreground sm:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" /> Home
        </Button>
        <div className="text-right">
          <h1 className="text-2xl font-display font-bold sm:text-4xl">Games Library</h1>
          <p className="text-sm text-muted-foreground">Choose what is installed on this BoredRoom server.</p>
        </div>
      </header>

      <section className="mx-auto mt-8 w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border/60 py-4">
          <p className="text-sm text-muted-foreground">
            {games.filter((game) => game.installed).length} installed · {games.length} available
          </p>
          {!authenticated ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                className="w-full sm:w-56"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void unlock()}
                placeholder="Owner passphrase"
                aria-label="Owner passphrase"
              />
              <Button onClick={() => void unlock()} disabled={!passphrase || busy === 'auth'}>
                {busy === 'auth' ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
                Manage
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={policy.automatic}
                  onCheckedChange={(automatic) => {
                    void updateGamesPolicy({ automatic }).then(setPolicy);
                  }}
                />
                Auto-update games
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void logoutPackAdmin().then(() => setAuthenticated(false))}
              >
                <LogOut /> Lock
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid min-h-72 place-items-center"><Loader2 className="h-9 w-9 animate-spin text-primary" /></div>
        ) : (
          <div className="divide-y divide-border/60">
            {games.map((game) => (
              <article key={game.id} className="group grid gap-4 py-6 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-primary/20 bg-card text-4xl shadow-[0_0_30px_hsl(var(--primary)/0.08)]">
                  {game.emoji}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-display font-bold">{game.name}</h2>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${game.installed ? 'text-primary' : 'text-muted-foreground'}`}>
                      {game.installed ? `Installed ${game.installedVersion}` : `Available ${game.version}`}
                    </span>
                    {game.updateAvailable && <span className="text-xs font-semibold text-accent">Update available</span>}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{game.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {game.minPlayers}–{game.maxPlayers} players
                    {game.capabilities.bots ? ' · bots' : ''}
                    {game.capabilities.audience ? ' · crowd mode' : ''}
                    {game.capabilities.restore ? ' · reconnect recovery' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {authenticated && game.installed && (
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      aria-label={`${game.name} automatic update preference`}
                      value={game.updateOverride}
                      onChange={(event) => {
                        const override = event.target.value as LibraryGame['updateOverride'];
                        void updateGamesPolicy({ gameId: game.id, override }).then(() => refresh());
                      }}
                    >
                      <option value="inherit">Use global</option>
                      <option value="enabled">Auto-update</option>
                      <option value="disabled">Manual update</option>
                    </select>
                  )}
                  {authenticated && !game.installed && (
                    <Button onClick={() => void mutate(game, 'install')} disabled={busy === game.id}>
                      {busy === game.id ? <Loader2 className="animate-spin" /> : <Download />} Install
                    </Button>
                  )}
                  {authenticated && game.updateAvailable && (
                    <Button onClick={() => void mutate(game, 'update')} disabled={busy === game.id}>
                      <RefreshCw /> Update
                    </Button>
                  )}
                  {authenticated && game.installed && (
                    <Button variant="ghost" size="icon" aria-label={`Uninstall ${game.name}`} onClick={() => void mutate(game, 'uninstall')} disabled={busy === game.id}>
                      <Trash2 />
                    </Button>
                  )}
                  {!authenticated && game.installed && <Gamepad2 className="h-5 w-5 text-primary" aria-label="Installed" />}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <BuiltByFooter />
    </main>
  );
}
