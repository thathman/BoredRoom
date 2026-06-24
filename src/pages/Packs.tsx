import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Package, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { listPacks, installPack, uninstallPack, type InstalledPack } from '@/lib/serverApi';
import { toast } from 'sonner';

// Manage packs: install a content pack from a GitHub repo URL. Installed packs add their games to
// the unified catalog server-wide; you then create a room and pick any installed game.
const ERROR_COPY: Record<string, string> = {
  not_a_github_repo_url: 'That doesn’t look like a GitHub repo URL.',
  fetch_failed: 'Could not reach the repo. Check the URL.',
  manifest_http_404: 'No boredroom-pack.json found in that repo.',
  manifest_not_json: 'The pack manifest is not valid JSON.',
  manifest_invalid: 'The pack manifest is invalid (bad games/engine).',
  no_server: 'Pack installs need the live server.',
};

export default function Packs() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<InstalledPack[]>([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => listPacks().then(setPacks).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  async function install() {
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      const pack = await installPack(url.trim());
      toast.success(`Installed ${pack.name} (${pack.manifest.games.length} games)`);
      setUrl('');
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : 'install_failed';
      toast.error(ERROR_COPY[code] ?? `Install failed (${code})`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(packId: string) {
    await uninstallPack(packId);
    toast(`Uninstalled ${packId}`);
    await refresh();
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col px-6 py-8">
      <header className="max-w-3xl w-full mx-auto flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold">Game packs</h1>
            <p className="text-sm text-muted-foreground">Install game packs from a GitHub repo. They add games for everyone on this server.</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl w-full mx-auto">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && install()}
            placeholder="https://github.com/owner/boredroom-pack-faith"
            aria-label="Pack repo URL"
          />
          <Button onClick={install} disabled={busy || !url.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" /> Install</>}
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Installed packs ({packs.length})</p>
          {packs.length === 0 && (
            <p className="text-sm text-muted-foreground">No packs installed yet. Paste a repo URL above to add games.</p>
          )}
          {packs.map((pack) => (
            <div key={pack.packId} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{pack.name} <span className="text-xs text-muted-foreground">v{pack.version}</span></p>
                  <p className="text-xs text-muted-foreground break-all">{pack.sourceUrl}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(pack.packId)} aria-label={`Uninstall ${pack.name}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pack.manifest.games.map((g) => (
                  <Badge key={g.slug} variant="secondary" className="text-xs">{g.emoji} {g.name}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <BuiltByFooter />
    </div>
  );
}
