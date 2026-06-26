import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, LockKeyhole, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LagosScene } from '@/components/brand/LagosScene';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchAdminOverview,
  getGameAdminAuth,
  loginGameAdmin,
  logoutGameAdmin,
  type AdminOverview,
} from '@/lib/serverApi';

const REFRESH_MS = 5000;

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await fetchAdminOverview();
    if (data) setOverview(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void getGameAdminAuth().then((ok) => {
      setAuthenticated(ok);
      if (ok) void refresh();
      else setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    if (!authenticated) return;
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [authenticated, refresh]);

  async function unlock() {
    if (!passphrase) return;
    setBusy(true);
    try {
      await loginGameAdmin(passphrase);
      setPassphrase('');
      setAuthenticated(true);
      setLoading(true);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'game_admin_rate_limited'
        ? 'Too many attempts. Try again later.'
        : 'Incorrect owner passphrase.');
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) {
    return (
      <LagosScene>
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8 text-center">
          <BrandLogo className="mx-auto text-2xl" />
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="brush-display text-5xl">Admin <span className="text-primary">back office</span></h1>
            <p className="mt-2 text-sm text-muted-foreground">Server administration. Owner passphrase required.</p>
            <Input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void unlock()}
              placeholder="Owner passphrase"
              aria-label="Owner passphrase"
              className="mt-7 h-14 bg-black/35 text-center"
            />
            <Button className="neon-primary mt-4 h-14 rounded-xl" disabled={!passphrase || busy} onClick={() => void unlock()}>
              {busy ? <Loader2 className="animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Unlock dashboard
            </Button>
            <Button variant="ghost" className="mt-3" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" /> Back home
            </Button>
          </div>
          <BuiltByFooter />
        </div>
      </LagosScene>
    );
  }

  return (
    <LagosScene className="bg-[linear-gradient(180deg,rgba(2,8,23,.5),rgba(2,8,23,.85))]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <div>
            <BrandLogo className="text-3xl" />
            <h1 className="brush-display mt-3 text-4xl">Server <span className="text-primary">back office</span></h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl bg-black/40" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></Button>
            <Button variant="outline" className="rounded-xl bg-black/40" onClick={() => void logoutGameAdmin().then(() => setAuthenticated(false))}><LogOut className="h-4 w-4" /> Lock</Button>
          </div>
        </header>

        {loading || !overview ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Active parties" value={overview.parties.total} tone="text-primary" />
              <Stat label="In game" value={overview.parties.inGame} />
              <Stat label="Installed games" value={`${overview.games.installed} / ${overview.games.available}`} />
              <Stat
                label="AI status"
                value={overview.ai.status}
                tone={overview.ai.status === 'active' ? 'text-primary' : overview.ai.status === 'degraded' ? 'text-amber-300' : 'text-red-300'}
              />
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="AI model" value={overview.ai.model || '—'} />
              <Stat label="Protocol" value={`v${overview.server.protocolVersion}`} />
              <Stat label="Uptime" value={`${Math.floor(overview.server.uptimeSeconds / 60)}m`} />
              <Stat label="Env" value={overview.server.nodeEnv} />
            </section>

            <section className="neon-panel rounded-2xl p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Active parties</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <tr>
                      <th className="pb-2">Code</th><th className="pb-2">Status</th><th className="pb-2">Players</th>
                      <th className="pb-2">Game</th><th className="pb-2">Vote</th><th className="pb-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.parties.list.map((party) => (
                      <tr key={party.code} className="border-t border-white/5">
                        <td className="py-2 font-mono font-bold text-primary">{party.code}</td>
                        <td className="py-2">{party.status}</td>
                        <td className="py-2">{party.connected}/{party.members}{party.bots ? ` (+${party.bots}🤖)` : ''}</td>
                        <td className="py-2">{party.activeGame ? `${party.activeGame} · ${party.gameStatus}` : '—'}</td>
                        <td className="py-2">{party.activeVote ?? '—'}</td>
                        <td className="py-2 text-white/50">{new Date(party.updatedAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                    {overview.parties.list.length === 0 && (
                      <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No active parties.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="neon-panel rounded-2xl p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Recent votes</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {overview.recentVotes.map((vote) => (
                  <li key={`${vote.sessionCode}-${vote.voteId}`} className="flex items-center justify-between gap-2 border-t border-white/5 py-1.5">
                    <span><span className="font-mono text-primary">{vote.sessionCode}</span> · {vote.voteType}</span>
                    <span className="text-white/60">
                      {vote.winnerOption ?? (vote.tied ? 'tie' : vote.status)} · {vote.castCount}/{vote.eligibleVoterCount}
                      {vote.hostOverride ? ' · override' : vote.autoApplied ? ' · auto' : ''}
                    </span>
                  </li>
                ))}
                {overview.recentVotes.length === 0 && <li className="py-3 text-center text-muted-foreground">No votes yet.</li>}
              </ul>
            </section>
          </div>
        )}
        <div className="mt-8"><BuiltByFooter /></div>
      </div>
    </LagosScene>
  );
}
