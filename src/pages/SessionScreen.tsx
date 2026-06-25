import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Loader2, Menu, RotateCcw, Smartphone, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ThemeProvider } from '@/components/system/ThemeProvider';
import { HostGameDrawer } from '@/components/session/HostGameDrawer';
import { NativeGameSurface } from '@/components/session/NativeGameSurface';
import RoomPage from '@/pages/Room';
import { useHouseSession, type HouseSessionRole } from '@/hooks/useHouseSession';
import { ensureHostDisplayId, getPlayerId, getPlayerName } from '@/lib/roomUtils';
import {
  activateGameRun,
  clearCurrentGame,
  createCompanionPairing,
  fetchRuntimeAccess,
  finishGameRun,
  getCompanionCredential,
  getControlCredential,
  redeemCompanionPairing,
  startGameRun,
  type StartedRun,
} from '@/lib/serverApi';
import { getAllGames, type CatalogGame } from '@/lib/catalog';
import { toast } from 'sonner';

const SESSION_ROLES = new Set<HouseSessionRole>(['display', 'controller', 'crowd', 'companion']);
const NATIVE_GAMES = new Set(['market-price', 'pidgin-translator', 'faith-feud', 'bible-timeline']);

function SessionMissing({ code }: { code: string }) {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen grid place-items-center bg-background p-6 text-foreground">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/15 text-destructive">
          <RotateCcw className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-display font-bold">Session not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          “{code}” is invalid, expired, or belongs to another server.
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate('/join', { replace: true })}>
          Enter another code
        </Button>
      </div>
    </main>
  );
}

export default function SessionScreen() {
  const { code = '', screen = '' } = useParams<{ code: string; screen: string }>();
  const navigate = useNavigate();
  const normalizedCode = code.toUpperCase();
  const role = SESSION_ROLES.has(screen as HouseSessionRole)
    ? (screen as HouseSessionRole)
    : null;
  const isHost = role === 'display' || role === 'companion';
  const deviceId = isHost ? ensureHostDisplayId() : getPlayerId();
  const displayName = isHost ? (role === 'companion' ? 'Host companion' : 'Host display') : getPlayerName() || 'Player';
  const [companionCredential, setCompanionCredential] = useState(
    role === 'companion' ? getCompanionCredential(normalizedCode) : '',
  );
  const {
    snapshot,
    status,
    gamePublicState,
    gamePrivateState,
    setReady,
    sendGameIntent,
  } = useHouseSession({
    code: normalizedCode,
    deviceId,
    displayName,
    role: role ?? 'controller',
    enabled: role !== 'companion' || Boolean(companionCredential),
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busyGame, setBusyGame] = useState<string | null>(null);
  const [runtimeAccess, setRuntimeAccess] = useState<{
    runId: string;
    runtimeId: string | null;
    hostToken: string | null;
  } | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingInput, setPairingInput] = useState('');
  const [pairingBusy, setPairingBusy] = useState(false);

  const activeRun = snapshot?.activeRun ?? null;
  const members = snapshot?.members ?? [];
  const activeGame = useMemo(
    () => getAllGames().find((game) => game.slug === activeRun?.gameType) ?? null,
    [activeRun?.gameType],
  );

  useEffect(() => {
    if (!isHost || !activeRun || NATIVE_GAMES.has(activeRun.gameType)) {
      setRuntimeAccess(null);
      return;
    }
    let live = true;
    fetchRuntimeAccess(normalizedCode).then((access) => {
      if (live) setRuntimeAccess(access);
    });
    return () => { live = false; };
  }, [isHost, activeRun, normalizedCode]);

  const finishCurrent = useCallback(async (
    runStatus: 'finished' | 'abandoned',
    winnerPlayerIds: string[] = [],
  ) => {
    if (!activeRun || !isHost) return;
    await finishGameRun(normalizedCode, activeRun.id, runStatus, winnerPlayerIds);
  }, [activeRun, isHost, normalizedCode]);

  const chooseGame = useCallback(async (game: CatalogGame) => {
    if (!snapshot || !isHost || busyGame) return;
    setBusyGame(game.slug);
    try {
      if (activeRun && activeRun.status !== 'finished' && activeRun.status !== 'abandoned') {
        const confirmed = window.confirm(
          `End ${activeGame?.name ?? 'the current game'} and switch to ${game.name}? The current run will be saved as abandoned.`,
        );
        if (!confirmed) return;
        await finishGameRun(normalizedCode, activeRun.id, 'abandoned');
        await clearCurrentGame(normalizedCode);
      } else if (activeRun) {
        await clearCurrentGame(normalizedCode);
      }

      const selected = await startGameRun({
        code: normalizedCode,
        houseSessionId: snapshot.session.id,
        hostDeviceId: ensureHostDisplayId(),
        gameType: game.slug,
      });
      const started: StartedRun = await activateGameRun(normalizedCode, selected.run.id);
      setRuntimeAccess({
        runId: started.run.id,
        runtimeId: started.run.runtimeId ?? null,
        hostToken: started.hostToken,
      });
      setDrawerOpen(false);
      toast.success(`${game.name} is ready`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'start_failed';
      toast.error(`Could not start ${game.name} (${message})`);
    } finally {
      setBusyGame(null);
    }
  }, [
    snapshot,
    isHost,
    busyGame,
    activeRun,
    activeGame?.name,
    normalizedCode,
  ]);

  const nextGame = useCallback(async () => {
    if (isHost && activeRun) await clearCurrentGame(normalizedCode);
    setDrawerOpen(isHost);
  }, [isHost, activeRun, normalizedCode]);

  if (!role) return <Navigate to={`/session/${normalizedCode}/display`} replace />;

  if (role === 'companion' && !companionCredential) {
    const pair = async () => {
      setPairingBusy(true);
      try {
        await redeemCompanionPairing(normalizedCode, pairingInput.trim());
        setCompanionCredential(getCompanionCredential(normalizedCode));
      } catch {
        toast.error('That pairing code is invalid or expired.');
      } finally {
        setPairingBusy(false);
      }
    };
    return (
      <ThemeProvider>
        <main className="min-h-screen grid place-items-center bg-background p-6 text-foreground">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
            <Smartphone className="mx-auto h-11 w-11 text-primary" />
            <Badge variant="outline" className="mt-4 font-mono tracking-[0.25em]">{normalizedCode}</Badge>
            <h1 className="mt-4 text-2xl font-display font-bold">Pair host companion</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a one-time code from Games & controls → Settings on the main display.
            </p>
            <Input
              className="mt-6 text-center font-mono text-xl tracking-[0.25em]"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={pairingInput}
              onChange={(event) => setPairingInput(event.target.value.replace(/\D/g, ''))}
            />
            <Button
              className="mt-3 w-full"
              disabled={pairingInput.length !== 6 || pairingBusy}
              onClick={() => void pair()}
            >
              {pairingBusy ? 'Pairing…' : 'Pair companion'}
            </Button>
          </div>
        </main>
      </ThemeProvider>
    );
  }

  if (status === 'missing') return <SessionMissing code={normalizedCode} />;

  if (status === 'loading' && !snapshot) {
    return (
      <main className="min-h-screen grid place-items-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Joining house {normalizedCode}…</p>
        </div>
      </main>
    );
  }

  if (status === 'error' && isHost && !getControlCredential(normalizedCode)) {
    return <SessionMissing code={normalizedCode} />;
  }

  const joinUrl = `${window.location.origin}/join/${normalizedCode}`;
  const controllerCount = members.filter((member) => member.role === 'controller').length;
  const readyCount = members.filter((member) => member.role === 'controller' && member.ready).length;
  const showRecap = snapshot?.session.status === 'recap' && snapshot.lastRecap;

  const hostControls = isHost && (
    <>
      <Button
        className="fixed right-4 top-4 z-[60] gap-2 rounded-full shadow-xl"
        onClick={() => setDrawerOpen(true)}
      >
        <Menu className="h-4 w-4" />
        Games & controls
      </Button>
      <HostGameDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        activeGameType={activeRun?.gameType}
        members={members}
        busyGame={busyGame}
        onSelectGame={chooseGame}
        pairingCode={pairingCode}
        onCreatePairing={() => {
          void createCompanionPairing(normalizedCode)
            .then((pairing) => setPairingCode(pairing.pairingCode))
            .catch(() => toast.error('Could not create a pairing code.'));
        }}
      />
    </>
  );

  if (showRecap) {
    const game = getAllGames().find((item) => item.slug === snapshot.lastRecap?.gameType);
    return (
      <ThemeProvider>
        <main className="min-h-screen grid place-items-center bg-background p-6 text-foreground">
          {hostControls}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg text-center">
            <div className="text-6xl">{game?.emoji ?? '🏆'}</div>
            <p className="mt-4 text-sm uppercase tracking-widest text-primary">Game recap</p>
            <h1 className="mt-2 text-4xl font-display font-bold">{game?.name ?? snapshot.lastRecap.gameType}</h1>
            <p className="mt-3 text-muted-foreground">
              {snapshot.lastRecap.status === 'abandoned'
                ? 'The house switched games. This run was saved.'
                : 'Match complete. Everyone stays connected for the next game.'}
            </p>
            {isHost ? (
              <Button size="lg" className="mt-7" onClick={() => void nextGame()}>
                Choose next game
              </Button>
            ) : (
              <p className="mt-7 text-sm text-muted-foreground">Waiting for the host to choose what’s next…</p>
            )}
          </motion.div>
        </main>
      </ThemeProvider>
    );
  }

  if (activeRun) {
    const isNative = NATIVE_GAMES.has(activeRun.gameType);
    if (isNative && gamePublicState?.gameType === activeRun.gameType) {
      return (
        <ThemeProvider>
          <div className="relative min-h-screen">
            {hostControls}
            <NativeGameSurface
              gameType={activeRun.gameType}
              publicState={gamePublicState.state}
              privateState={gamePrivateState?.gameType === activeRun.gameType ? gamePrivateState.state : null}
              role={role}
              sendIntent={sendGameIntent}
            />
          </div>
        </ThemeProvider>
      );
    }

    const runtimeId = activeRun.runtimeId ?? runtimeAccess?.runtimeId;
    if (runtimeId && (!isHost || runtimeAccess?.hostToken)) {
      return (
        <ThemeProvider>
          <div className="relative min-h-screen">
            {hostControls}
            <RoomPage
              embeddedGame={activeRun.gameType}
              embeddedCode={runtimeId}
              embeddedRole={role === 'companion' ? 'display' : role}
              embeddedHostToken={runtimeAccess?.hostToken ?? undefined}
              publicSessionCode={normalizedCode}
              sessionJoinUrl={joinUrl}
              autoReady={!isHost}
              onGameFinished={(winnerIds) => void finishCurrent('finished', winnerIds)}
              onExitGame={() => void nextGame()}
            />
          </div>
        </ThemeProvider>
      );
    }

    return (
      <main className="min-h-screen grid place-items-center bg-background text-foreground">
        {hostControls}
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Preparing {activeGame?.name ?? 'the game'}…</p>
        </div>
      </main>
    );
  }

  if (role === 'controller' || role === 'crowd') {
    const me = members.find((member) => member.deviceId === deviceId);
    return (
      <ThemeProvider>
        <main className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center text-foreground">
          <Smartphone className="h-12 w-12 text-primary" />
          <Badge variant="outline" className="mt-5 font-mono tracking-[0.25em]">{normalizedCode}</Badge>
          <h1 className="mt-5 text-3xl font-display font-bold">
            {role === 'crowd' ? 'You’re in the crowd' : `Welcome, ${displayName}`}
          </h1>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Stay on this screen. Your controls will switch automatically when the host starts a game.
          </p>
          {role === 'controller' && (
            <Button
              size="lg"
              className="mt-7 min-w-48"
              variant={me?.ready ? 'default' : 'outline'}
              onClick={() => setReady(!me?.ready)}
            >
              {me?.ready ? 'Ready' : 'Tap when ready'}
            </Button>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            {readyCount} ready · {controllerCount} joined
          </p>
        </main>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <main className="relative h-screen overflow-hidden bg-background text-foreground">
        {hostControls}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,hsl(var(--primary)/0.12),transparent_42%),radial-gradient(circle_at_85%_75%,hsl(var(--secondary)/0.12),transparent_38%)]" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-6 pb-28 text-center">
          <Gamepad2 className="h-12 w-12 text-primary" />
          <p className="mt-5 text-sm uppercase tracking-[0.35em] text-muted-foreground">BoredRoom</p>
          <h1 className="mt-3 text-5xl font-display font-bold md:text-7xl">
            House <span className="text-primary">{normalizedCode}</span>
          </h1>
          <p className="mt-3 text-xl text-muted-foreground">Join once. Play all night.</p>
          <div className="mt-8 rounded-3xl border border-primary/35 bg-card/75 p-5 shadow-[0_0_40px_hsl(var(--primary)/0.12)] backdrop-blur">
            <div className="rounded-2xl bg-white p-3">
              <QRCodeSVG value={joinUrl} size={190} level="M" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Scan or visit {window.location.host}/join
          </p>
          <Button size="lg" className="mt-6" onClick={() => setDrawerOpen(true)}>
            Choose a game
          </Button>
        </div>
        <div className="absolute inset-x-6 bottom-5 mx-auto max-w-6xl rounded-2xl border border-border bg-card/85 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Joined players</span>
              <span className="font-mono text-sm text-primary">{controllerCount}</span>
            </div>
            <span className="text-sm text-muted-foreground">{readyCount} ready</span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {members.filter((member) => member.role === 'controller').map((member) => (
              <div key={member.deviceId} className="shrink-0 rounded-full border border-border bg-background/70 px-3 py-1.5 text-sm">
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${member.connected ? 'bg-primary' : 'bg-muted'}`} />
                {member.displayName}
              </div>
            ))}
            {controllerCount === 0 && <span className="text-sm text-muted-foreground">Waiting for players…</span>}
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}
