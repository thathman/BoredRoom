import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, Menu, QrCode, RotateCcw, Trophy, Users } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LagosScene } from '@/components/brand/LagosScene';
import { HostGameDrawer } from '@/components/session/HostGameDrawer';
import { InstalledGameSurface } from '@/components/session/InstalledGameSurface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHouseSession, type HouseSessionRole } from '@/hooks/useHouseSession';
import { canUseSessionScreen, detectDeviceClass } from '@/lib/deviceExperience';
import { ensureHostDisplayId, getPlayerId, getPlayerName } from '@/lib/roomUtils';
import {
  createCompanionPairing,
  fetchGamesCatalog,
  getCompanionCredential,
  getControlCredential,
  redeemCompanionPairing,
  type LibraryGame,
} from '@/lib/serverApi';

const SESSION_ROLES = new Set<HouseSessionRole>(['display', 'controller', 'crowd', 'companion']);

function StatusScreen({
  icon,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <LagosScene>
      <div className="mx-auto flex min-h-screen max-w-sm flex-col px-6 py-8 text-center">
        <BrandLogo className="mx-auto text-2xl" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-primary text-primary shadow-[0_0_24px_rgba(69,243,107,.45)]">{icon}</div>
          <h1 className="brush-display mt-6 text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{detail}</p>
          {action ? <div className="mt-7 w-full">{action}</div> : null}
        </div>
      </div>
    </LagosScene>
  );
}

export default function SessionScreen() {
  const { code = '', screen = '' } = useParams<{ code: string; screen: string }>();
  const navigate = useNavigate();
  const normalizedCode = code.toUpperCase();
  const role = SESSION_ROLES.has(screen as HouseSessionRole) ? (screen as HouseSessionRole) : null;
  const deviceClass = detectDeviceClass();
  const compatibleRole = role ? canUseSessionScreen(deviceClass, role) : false;
  const isHost = role === 'display' || role === 'companion';
  const deviceId = isHost ? ensureHostDisplayId() : getPlayerId();
  const displayName = isHost ? (role === 'companion' ? 'Host companion' : 'Host display') : getPlayerName() || 'Player';
  const [companionCredential, setCompanionCredential] = useState(role === 'companion' ? getCompanionCredential(normalizedCode) : '');
  const {
    snapshot,
    status,
    gamePublicState,
    gamePrivateState,
    aiResult,
    setReady,
    sendGameIntent,
    requestHint,
    startGame,
    switchGame,
    endGame,
  } = useHouseSession({
    code: normalizedCode,
    deviceId,
    displayName,
    role: role ?? 'controller',
    enabled: compatibleRole && (role !== 'companion' || Boolean(companionCredential)),
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busyGame, setBusyGame] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingInput, setPairingInput] = useState('');
  const [pairingBusy, setPairingBusy] = useState(false);
  const [installedGames, setInstalledGames] = useState<LibraryGame[]>([]);

  useEffect(() => {
    void fetchGamesCatalog()
      .then(({ games }) => setInstalledGames(games.filter((game) => game.installed)))
      .catch(() => setInstalledGames([]));
  }, []);

  const activeRun = snapshot?.activeRun ?? null;
  const members = snapshot?.members ?? [];
  const activeGame = useMemo(
    () => installedGames.find((game) => game.id === activeRun?.gameType) ?? null,
    [activeRun?.gameType, installedGames],
  );

  const chooseGame = useCallback((game: { slug: string; name: string }) => {
    if (!snapshot || !isHost || busyGame) return;
    setBusyGame(game.slug);
    if (activeRun && !['finished', 'abandoned'].includes(activeRun.status)) {
      if (!window.confirm(`End ${activeGame?.name ?? 'the current game'} and switch to ${game.name}?`)) {
        setBusyGame(null);
        return;
      }
      switchGame(game.slug);
    } else {
      startGame(game.slug);
    }
    setDrawerOpen(false);
    window.setTimeout(() => setBusyGame(null), 800);
  }, [activeGame?.name, activeRun, busyGame, isHost, snapshot, startGame, switchGame]);

  if (!role) return <Navigate to={deviceClass === 'desktop_host' ? `/session/${normalizedCode}/display` : `/session/${normalizedCode}/controller`} replace />;
  if (!compatibleRole) return <Navigate to={deviceClass === 'desktop_host' ? '/' : `/join/${normalizedCode}`} replace />;

  if (role === 'companion' && !companionCredential) {
    async function pair() {
      setPairingBusy(true);
      try {
        await redeemCompanionPairing(normalizedCode, pairingInput);
        setCompanionCredential(getCompanionCredential(normalizedCode));
      } catch {
        toast.error('That approval code is invalid or expired.');
      } finally {
        setPairingBusy(false);
      }
    }
    return (
      <LagosScene>
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-7 text-center">
          <BrandLogo className="mx-auto text-2xl" />
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="brush-display text-5xl">Pair with <span className="text-primary">your host</span></h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter the approval code shown on the host’s screen.</p>
            <Input
              value={pairingInput}
              onChange={(event) => setPairingInput(event.target.value.replace(/\D/g, ''))}
              maxLength={6}
              inputMode="numeric"
              className="mt-7 h-16 bg-black/35 text-center font-mono text-3xl tracking-[0.4em]"
              placeholder="000000"
            />
            <Button className="neon-primary mt-4 h-14 rounded-xl" disabled={pairingInput.length !== 6 || pairingBusy} onClick={() => void pair()}>
              {pairingBusy ? <Loader2 className="animate-spin" /> : 'Request host approval'}
            </Button>
          </div>
        </div>
      </LagosScene>
    );
  }

  if (status === 'missing') {
    return <StatusScreen icon={<span className="text-4xl">!</span>} title="Invalid code" detail="That room code couldn’t be found." action={<Button className="neon-primary w-full" onClick={() => navigate('/join')}>Try again <ArrowRight className="ml-auto" /></Button>} />;
  }
  if (status === 'loading' && !snapshot) {
    return <StatusScreen icon={<Loader2 className="h-9 w-9 animate-spin" />} title="Reconnecting…" detail={`Trying to connect to house ${normalizedCode}…`} />;
  }
  if (status === 'error' && isHost && !getControlCredential(normalizedCode)) {
    return <StatusScreen icon={<RotateCcw />} title="Session unavailable" detail="This device does not have the owner credential for that house." />;
  }

  const controllerMembers = members.filter((member) => member.role === 'controller');
  const readyCount = controllerMembers.filter((member) => member.ready).length;
  const joinUrl = `${window.location.origin}/join/${normalizedCode}`;
  const drawerGames = installedGames.map((game) => ({
    slug: game.id,
    name: game.name,
    emoji: game.emoji,
    tagline: game.description,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    available: game.installed,
    capabilities: game.capabilities,
  }));

  const hostControls = isHost ? (
    <>
      <Button className="fixed right-4 top-4 z-[70] rounded-xl bg-black/70" variant="outline" onClick={() => setDrawerOpen(true)}>
        <Menu className="h-4 w-4" /> Games & controls
      </Button>
      <HostGameDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        activeGameType={activeRun?.gameType}
        members={members}
        busyGame={busyGame}
        onSelectGame={(game) => void chooseGame(game)}
        pairingCode={pairingCode}
        onCreatePairing={() => void createCompanionPairing(normalizedCode).then((pairing) => setPairingCode(pairing.pairingCode))}
        games={drawerGames}
        sessionCode={normalizedCode}
      />
    </>
  ) : null;

  if (snapshot?.session.status === 'recap' && snapshot.lastRecap) {
    const winners = controllerMembers.filter((member) => snapshot.lastRecap?.winnerPlayerIds.includes(member.deviceId));
    return (
      <LagosScene>
        {hostControls}
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 pb-24 pt-7">
          <BrandLogo />
          <section className="mx-auto mt-10 w-full text-center">
            <h1 className="brush-display text-5xl">Game night <span className="text-primary">recap</span></h1>
            <p className="mt-2 text-lg">{activeGame?.emoji} {activeGame?.name ?? snapshot.lastRecap.gameType}</p>
            <div className="mt-7 grid gap-4 md:grid-cols-[280px_1fr]">
              <div className="neon-panel rounded-2xl p-6">
                <p className="text-xs text-muted-foreground">Winner</p>
                <Trophy className="mx-auto mt-4 h-12 w-12 text-primary" />
                <h2 className="mt-3 text-2xl">{winners.map((winner) => winner.displayName).join(', ') || 'The house'}</h2>
              </div>
              <div className="neon-panel rounded-2xl p-6 text-left">
                <h2>{snapshot.lastRecap.headline ?? 'Session recap'}</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {snapshot.lastRecap.paragraph ?? (snapshot.lastRecap.status === 'abandoned'
                    ? 'The host switched games. The run was saved as abandoned and everyone stayed connected.'
                    : 'Game complete. Every player remains connected and ready for the next game.')}
                </p>
              </div>
            </div>
            {isHost ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button className="neon-primary h-14 rounded-xl" onClick={() => setDrawerOpen(true)}>Choose next game <ArrowRight className="ml-auto" /></Button>
                <Button variant="outline" className="h-14 rounded-xl" onClick={endGame}>End game night</Button>
              </div>
            ) : <p className="mt-7 text-sm text-muted-foreground">Waiting for the host to choose the next game.</p>}
          </section>
        </div>
      </LagosScene>
    );
  }

  if (activeRun && gamePublicState?.gameType === activeRun.gameType) {
    return (
      <div className="relative min-h-screen">
        {hostControls}
        <InstalledGameSurface
          publicState={gamePublicState.state}
          privateState={gamePrivateState?.gameType === activeRun.gameType ? gamePrivateState.state : null}
          role={role}
          sendIntent={sendGameIntent}
          aiHint={aiResult?.kind === 'hint' ? aiResult.text : null}
          aiCommentary={aiResult?.kind === 'commentary' || aiResult?.kind === 'pacing' ? aiResult.text : null}
          requestHint={role === 'controller' && snapshot?.session.settings.hintsEnabled ? requestHint : undefined}
        />
      </div>
    );
  }

  if (activeRun) {
    return <StatusScreen icon={<Loader2 className="h-9 w-9 animate-spin" />} title="Preparing game…" detail={`Loading ${activeGame?.name ?? activeRun.gameType} for everyone.`} />;
  }

  if (role === 'controller' || role === 'crowd') {
    const me = members.find((member) => member.deviceId === deviceId);
    return (
      <StatusScreen
        icon={role === 'crowd' ? <Users className="h-9 w-9" /> : <Check className="h-9 w-9" />}
        title="Waiting to play"
        detail="Waiting for the host to start the game. Your controls will switch automatically."
        action={role === 'controller' ? (
          <Button className={me?.ready ? 'neon-primary w-full' : 'w-full'} variant={me?.ready ? 'default' : 'outline'} onClick={() => setReady(!me?.ready)}>
            {me?.ready ? 'You’re in as a player' : 'Tap when ready'}
          </Button>
        ) : undefined}
      />
    );
  }

  return (
    <LagosScene className="bg-[linear-gradient(180deg,rgba(2,8,23,.4),rgba(2,8,23,.8))]">
      {hostControls}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-6 pt-6">
        <BrandLogo className="text-5xl" />
        <section className="flex flex-1 flex-col items-center justify-center pb-32 text-center">
          <h1 className="text-5xl font-bold sm:text-7xl">House <span className="text-primary">{normalizedCode}</span></h1>
          <p className="mt-3 text-2xl">Join once. Play all night.</p>
          <div className="mt-7 flex items-center gap-6">
            <div className="rounded-2xl border border-primary bg-white p-3 shadow-[0_0_28px_rgba(69,243,107,.45)]"><QRCodeSVG value={joinUrl} size={180} /></div>
            <ol className="space-y-4 text-left text-sm">
              <li><QrCode className="mr-3 inline h-5 w-5" />1&nbsp; Scan QR</li>
              <li>🔗&nbsp; 2&nbsp; Open link</li>
              <li>♙&nbsp; 3&nbsp; Enter name</li>
              <li>✓&nbsp; 4&nbsp; You’re in!</li>
            </ol>
          </div>
          <div className="neon-panel mt-6 rounded-full px-7 py-3 text-sm">● &nbsp; Waiting for players</div>
        </section>
        <section className="neon-panel rounded-2xl p-5">
          <div className="flex justify-between border-b border-white/10 pb-3 text-sm">
            <strong>JOINED PLAYERS &nbsp; <span className="text-primary">{controllerMembers.length} / {snapshot?.session.settings?.maxControllers ?? 12}</span></strong>
            <span className="text-primary">Ready {readyCount} / {controllerMembers.length}</span>
          </div>
          <div className="mt-4 flex gap-5 overflow-x-auto">
            {controllerMembers.map((member) => (
              <div key={member.deviceId} className="min-w-16 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border-2 border-primary bg-primary/10">{member.displayName.slice(0, 1).toUpperCase()}</div>
                <p className="mt-2 text-xs">{member.displayName}</p>
              </div>
            ))}
            {controllerMembers.length === 0 && <p className="text-sm text-muted-foreground">Waiting for the first player…</p>}
          </div>
        </section>
      </div>
    </LagosScene>
  );
}
