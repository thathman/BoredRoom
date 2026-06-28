import { useEffect, useState } from 'react';
import { Bot, CircleStop, Gamepad2, Pause, Play, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import { fetchAiHealth, type AiHealth, type SessionMember } from '@/lib/serverApi';

interface DrawerGame {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  available: boolean;
  capabilities?: {
    bots: boolean;
    audience: boolean;
    hints: boolean;
    restore: boolean;
  };
}

interface HostGameDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeGameType?: string;
  activeRunStatus?: string;
  activeRunSettings?: Record<string, unknown>;
  members: SessionMember[];
  busyGame?: string | null;
  onSelectGame: (game: DrawerGame) => void;
  pairingCode?: string | null;
  onCreatePairing: () => void;
  pairingBusy?: boolean;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onEndGame: () => void;
  games: DrawerGame[];
  sessionCode: string;
}

export function HostGameDrawer({
  open,
  onOpenChange,
  activeGameType,
  activeRunStatus,
  activeRunSettings,
  members,
  busyGame,
  onSelectGame,
  pairingCode,
  onCreatePairing,
  pairingBusy = false,
  onPauseGame,
  onResumeGame,
  onEndGame,
  games,
  sessionCode,
}: HostGameDrawerProps) {
  const [aiHealth, setAiHealth] = useState<AiHealth | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetchAiHealth(sessionCode).then(setAiHealth).catch(() => setAiHealth(null));
  }, [open, sessionCode]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(94vw,430px)] overflow-y-auto border-l border-primary/35 bg-[#080b13]/98 p-5 backdrop-blur-xl sm:max-w-[430px]"
        overlayClassName="bg-black/55"
      >
        <SheetHeader>
          <SheetTitle className="brush-display text-3xl">{activeGameType ? 'Game controls' : 'Choose a game'}</SheetTitle>
          <SheetDescription>{activeGameType ? 'Control the current run without exposing the game library.' : 'Everyone stays in this house session.'}</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="games" className="mt-5">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="games"><Gamepad2 className="mr-1 h-4 w-4" /> {activeGameType ? 'Current' : 'Games'}</TabsTrigger>
            <TabsTrigger value="players"><Users className="mr-1 h-4 w-4" /> Players</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="mr-1 h-4 w-4" /> Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="games" className="mt-4 space-y-2">
            {activeGameType ? (
              <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-primary">Now playing</p>
                  <p className="mt-1 text-lg font-bold">{games.find((game) => game.slug === activeGameType)?.name ?? activeGameType}</p>
                  <p className="text-xs capitalize text-muted-foreground">{activeRunStatus ?? 'active'}</p>
                </div>
                {activeRunStatus === 'paused' ? (
                  <Button className="neon-primary w-full" onClick={onResumeGame}><Play className="h-4 w-4" /> Resume game</Button>
                ) : (
                  <Button className="w-full" variant="outline" onClick={onPauseGame}><Pause className="h-4 w-4" /> Pause game</Button>
                )}
                <Button className="w-full border-destructive/50 text-destructive hover:bg-destructive/10" variant="outline" onClick={onEndGame}>
                  <CircleStop className="h-4 w-4" /> End current game
                </Button>
                <p className="text-xs text-muted-foreground">End the current game to return to recap and choose the next one.</p>
              </div>
            ) : null}
            {!activeGameType && games.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <p className="font-medium">No games installed</p>
                <p className="mt-1 text-sm text-muted-foreground">Open the Games Library to install what this house can play.</p>
                <Button className="mt-4" variant="outline" onClick={() => { window.location.href = '/games'; }}>
                  Open Games Library
                </Button>
              </div>
            )}
            {!activeGameType && games.map((game) => (
              <div
                key={game.slug}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  activeGameType === game.slug ? 'border-primary bg-primary/10' : 'border-border bg-card/70'
                }`}
              >
                <span className="text-2xl">{game.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{game.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {game.minPlayers}–{game.maxPlayers} players · {game.tagline}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!game.available || busyGame != null || activeGameType === game.slug}
                  onClick={() => onSelectGame(game)}
                >
                  {busyGame === game.slug ? 'Starting…' : activeGameType === game.slug ? 'Live' : 'Start'}
                </Button>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="players" className="mt-4 space-y-2">
            {members.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Waiting for players to join.</p>
            ) : members.map((member) => (
              <div key={member.deviceId} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className={`h-2.5 w-2.5 rounded-full ${member.connected ? 'bg-primary' : 'bg-muted'}`} />
                <div className="flex-1">
                  <p className="font-medium">{member.displayName}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {member.role.replace('_', ' ')}{member.isBot ? ' · bot' : ''}
                  </p>
                </div>
                <span className={`text-xs ${member.isBot ? 'text-secondary' : 'text-muted-foreground'}`}>
                  {member.isBot ? 'Bot' : member.ready ? 'Ready' : 'Waiting'}
                </span>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <div className="space-y-3 rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
              <p>Game-specific settings appear in the selected game before play. House-wide settings remain attached to this session.</p>
              <div className="border-t border-border pt-3">
                {activeGameType === 'whot' && activeRunSettings && (
                  <div className="mb-3 rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="font-medium text-foreground">Current Whot house rules</p>
                    <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                      <dt>Turn time</dt><dd>{Number(activeRunSettings.turnSeconds ?? 45) === 0 ? 'Off' : `${Number(activeRunSettings.turnSeconds ?? 45)}s`}</dd>
                      <dt>Pick defence</dt><dd>{String(activeRunSettings.pickDefence ?? 'stack_same').replaceAll('_', ' ')}</dd>
                      <dt>Special-card finish</dt><dd>{activeRunSettings.allowSpecialFinish === false ? 'Blocked' : 'Allowed'}</dd>
                      <dt>Timeout</dt><dd>{String(activeRunSettings.timeoutPenalty ?? 'draw_and_pass').replaceAll('_', ' ')}</dd>
                      <dt>Card 11 reverse</dt><dd>{activeRunSettings.enableDirection === true ? 'On' : 'Off'}</dd>
                    </dl>
                    <p className="mt-2 text-[11px] text-muted-foreground">Locked during this match so every player keeps the rules they accepted in setup.</p>
                  </div>
                )}
                <p className="font-medium text-foreground">Pair a host companion</p>
                <p className="mt-1 text-xs">Scan this QR on the companion device — it pairs in one step. Or enter the code manually.</p>
                {pairingCode ? (
                  <div className="mt-3 rounded-xl bg-primary/10 p-3 text-center">
                    {/* One-scan pairing: QR embeds the room code + one-time approval token. */}
                    <div className="mx-auto w-fit rounded-lg bg-white p-2">
                      <QRCodeSVG value={`${window.location.origin}/pair/${sessionCode}?t=${pairingCode}`} size={132} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Scan to pair · or enter code</p>
                    <p className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">{pairingCode}</p>
                    <p className="mt-1 text-xs">Expires in 5 minutes</p>
                  </div>
                ) : (
                  <Button className="mt-3 w-full" variant="outline" disabled={pairingBusy} onClick={onCreatePairing}>
                    {pairingBusy ? 'Creating code…' : 'Show pairing QR'}
                  </Button>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <p className="flex items-center gap-2 font-medium text-foreground"><Bot className="h-4 w-4 text-primary" /> AI assistance</p>
                {aiHealth ? (
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt>Status</dt><dd className={aiHealth.status === 'active' ? 'text-primary' : 'text-amber-300'}>{aiHealth.status}</dd>
                    <dt>Model</dt><dd className="truncate text-foreground">{aiHealth.model}</dd>
                    <dt>Latency</dt><dd>{aiHealth.lastLatencyMs == null ? 'Not measured' : `${aiHealth.lastLatencyMs} ms`}</dd>
                    <dt>Rate limit</dt><dd>{aiHealth.rateLimitRemaining ?? 'Unknown'}</dd>
                    <dt>Credits</dt><dd className="capitalize">{aiHealth.creditStatus}</dd>
                    <dt>Fallback</dt><dd>{aiHealth.fallbackActive ? 'Deterministic fallback active' : 'Not active'}</dd>
                  </dl>
                ) : <p className="mt-2 text-xs">AI health is unavailable. Gameplay remains fully operational.</p>}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
