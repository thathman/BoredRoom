import { useEffect, useState } from 'react';
import { Bot, Gamepad2, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  members: SessionMember[];
  busyGame?: string | null;
  onSelectGame: (game: DrawerGame) => void;
  pairingCode?: string | null;
  onCreatePairing: () => void;
  games: DrawerGame[];
  sessionCode: string;
}

export function HostGameDrawer({
  open,
  onOpenChange,
  activeGameType,
  members,
  busyGame,
  onSelectGame,
  pairingCode,
  onCreatePairing,
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
          <SheetTitle className="brush-display text-3xl">Choose a game</SheetTitle>
          <SheetDescription>Everyone stays in this house session.</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="games" className="mt-5">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="games"><Gamepad2 className="mr-1 h-4 w-4" /> Games</TabsTrigger>
            <TabsTrigger value="players"><Users className="mr-1 h-4 w-4" /> Players</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="mr-1 h-4 w-4" /> Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="games" className="mt-4 space-y-2">
            {games.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <p className="font-medium">No games installed</p>
                <p className="mt-1 text-sm text-muted-foreground">Open the Games Library to install what this house can play.</p>
                <Button className="mt-4" variant="outline" onClick={() => { window.location.href = '/games'; }}>
                  Open Games Library
                </Button>
              </div>
            )}
            {games.map((game) => (
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
                <p className="font-medium text-foreground">Pair a host companion</p>
                <p className="mt-1 text-xs">Open this session’s companion URL on another device, then enter a one-time code.</p>
                {pairingCode ? (
                  <div className="mt-3 rounded-xl bg-primary/10 p-3 text-center">
                    <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">{pairingCode}</p>
                    <p className="mt-1 text-xs">Expires in 5 minutes</p>
                  </div>
                ) : (
                  <Button className="mt-3 w-full" variant="outline" onClick={onCreatePairing}>
                    Create pairing code
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
