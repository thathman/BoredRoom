import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, Menu, Play, QrCode, RotateCcw, Trophy, X } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LagosScene } from '@/components/brand/LagosScene';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { HostGameDrawer } from '@/components/session/HostGameDrawer';
import { CompanionConsole } from '@/components/session/CompanionConsole';
import { InstalledGameSurface } from '@/components/session/InstalledGameSurface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useHouseSession, type HouseSessionRole } from '@/hooks/useHouseSession';
import { canUseSessionScreen, detectDeviceClass } from '@/lib/deviceExperience';
import { rememberPlayerSession } from '@/lib/playerSessionResume';
import { ensureHostDisplayId, getPlayerId } from '@/lib/roomUtils';
import { getPlayerProfile, hasPlayerProfile, type PlayerProfile } from '@/lib/playerProfile';
import { PlayerAvatar } from '@/components/profile/PlayerAvatar';
import { ProfileSheet } from '@/components/profile/ProfileSheet';
import { ControllerMenu } from '@/components/session/ControllerMenu';
import { WinnerCelebration } from '@/components/session/WinnerCelebration';
import { GameConfigSheet } from '@/components/session/GameConfigSheet';
import { sounds } from '@/lib/sounds';
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
        <BuiltByFooter />
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
  const [profile, setProfile] = useState<PlayerProfile>(() => getPlayerProfile());
  const [profileNeeded, setProfileNeeded] = useState(() => !isHost && (role === 'controller' || role === 'crowd') && !hasPlayerProfile());
  const [editingProfile, setEditingProfile] = useState(false);
  const displayName = isHost ? (role === 'companion' ? 'Host companion' : 'Host display') : profile.displayName || 'Player';
  const [companionCredential, setCompanionCredential] = useState(role === 'companion' ? getCompanionCredential(normalizedCode) : '');
  const {
    snapshot,
    status,
    gamePublicState,
    gamePrivateState,
    aiResult,
    votePoll,
    voteHistory,
    setReady,
    sendGameIntent,
    requestHint,
    requestRules,
    castVote,
    callVote,
    requestVote,
    closeVote,
    cancelVote,
    applyVoteResult,
    overrideVote,
    startGame,
    switchGame,
    endGame,
    pauseGame,
    resumeGame,
    kickPlayer,
    admitPlayer,
    rejectPlayer,
    addBot,
    removeBot,
    setRemoteMode,
    endParty,
    deleteParty,
    kicked,
  } = useHouseSession({
    code: normalizedCode,
    deviceId,
    displayName,
    role: role ?? 'controller',
    avatar: isHost ? undefined : (profile.avatarType === 'emoji' ? profile.avatarValue : undefined),
    accentColor: isHost ? undefined : profile.accentColor,
    enabled: compatibleRole && (role !== 'companion' || Boolean(companionCredential)) && !profileNeeded,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busyGame, setBusyGame] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingInput, setPairingInput] = useState('');
  const [pairingBusy, setPairingBusy] = useState(false);
  const [hostPairingBusy, setHostPairingBusy] = useState(false);
  const [dismissedVoteId, setDismissedVoteId] = useState<string | null>(null);
  const [installedGames, setInstalledGames] = useState<LibraryGame[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configGame, setConfigGame] = useState<LibraryGame | null>(null);
  const wakeLockStatus = useWakeLock(role === 'controller' || role === 'crowd' || role === 'companion');
  const whotCallout = gamePublicState?.gameType === 'whot'
    ? (gamePublicState.state as { callout?: { kind?: string; sequence?: number; playerName?: string } }).callout
    : undefined;

  useEffect(() => {
    if (role !== 'display' || !whotCallout?.sequence) return;
    const key = `boredroom_whot_callout:${normalizedCode}:${whotCallout.sequence}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    if (whotCallout.kind === 'semi_last_card' || whotCallout.kind === 'last_card' || whotCallout.kind === 'check_up') {
      // Dynamic Naija TTS line ("<player> calls semi/last card / check up") with the player's
      // name; falls back to the pre-recorded clip if the TTS service is unavailable.
      const phrase = whotCallout.kind === 'semi_last_card' ? 'calls semi last card'
        : whotCallout.kind === 'last_card' ? 'calls last card' : 'calls check up';
      const line = `${whotCallout.playerName ?? 'Player'} ${phrase}`;
      void sounds.whotCalloutLine(line, whotCallout.kind);
    }
  }, [normalizedCode, role, whotCallout?.kind, whotCallout?.sequence, whotCallout?.playerName]);

  useEffect(() => {
    void fetchGamesCatalog()
      .then(({ games }) => setInstalledGames(games.filter((game) => game.installed)))
      .catch(() => setInstalledGames([]));
  }, []);

  useEffect(() => {
    if (role === 'controller' || role === 'crowd' || role === 'companion') {
      rememberPlayerSession({
        code: normalizedCode,
        role,
        displayName,
      });
    }
  }, [displayName, normalizedCode, role]);

  const activeRun = snapshot?.activeRun ?? null;
  const members = snapshot?.members ?? [];
  const activeGame = useMemo(
    () => installedGames.find((game) => game.id === activeRun?.gameType) ?? null,
    [activeRun?.gameType, installedGames],
  );

  // Picking a game opens its configuration screen first (every game gets one); the actual
  // start/switch happens from the config sheet with the chosen settings.
  const chooseGame = useCallback((game: { slug: string }) => {
    if (!snapshot || !isHost || busyGame) return;
    const lib = installedGames.find((g) => g.id === game.slug);
    if (lib) { setConfigGame(lib); setDrawerOpen(false); setPickerOpen(false); }
  }, [busyGame, installedGames, isHost, snapshot]);

  const startConfigured = useCallback((settings: Record<string, unknown>) => {
    if (!configGame || !isHost) return;
    const slug = configGame.id;
    setBusyGame(slug);
    if (activeRun && !['finished', 'abandoned'].includes(activeRun.status)) {
      switchGame(slug, settings);
    } else {
      startGame(slug, settings);
    }
    setConfigGame(null);
    window.setTimeout(() => setBusyGame(null), 800);
  }, [activeRun, configGame, isHost, startGame, switchGame]);

  if (!role) return <Navigate to={deviceClass === 'desktop_host' ? `/session/${normalizedCode}/display` : `/session/${normalizedCode}/controller`} replace />;
  if (!compatibleRole) return <Navigate to={deviceClass === 'desktop_host' ? '/' : `/join/${normalizedCode}`} replace />;

  if (profileNeeded) {
    return (
      <LagosScene>
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
          <BrandLogo className="mx-auto text-2xl" />
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="brush-display mb-6 text-center text-4xl">Set up your <span className="text-primary">profile</span></h1>
            <div className="neon-panel rounded-2xl p-5">
              <ProfileSheet
                cta="Join the house"
                onSave={(next) => { setProfile(next); setProfileNeeded(false); }}
              />
            </div>
          </div>
          <BuiltByFooter />
        </div>
      </LagosScene>
    );
  }

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
            <p className="mt-2 text-sm text-muted-foreground">Enter the six-digit approval code shown on the host’s screen.</p>
            <Input
              value={pairingInput}
              onChange={(event) => setPairingInput(event.target.value.replace(/\D/g, ''))}
              maxLength={6}
              minLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Six-digit companion pairing code"
              className="mt-7 h-16 bg-black/35 text-center font-mono text-3xl tracking-[0.18em]"
              placeholder="000 000"
            />
            <Button className="neon-primary mt-4 h-14 rounded-xl" disabled={pairingInput.length !== 6 || pairingBusy} onClick={() => void pair()}>
              {pairingBusy ? <Loader2 className="animate-spin" /> : 'Request host approval'}
            </Button>
          </div>
          <BuiltByFooter />
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

  if (kicked) {
    return (
      <StatusScreen
        icon={<span className="text-4xl">🚪</span>}
        title="Removed from the house"
        detail={kicked.reason}
        action={<Button className="neon-primary w-full" onClick={() => navigate('/join')}>Join another house <ArrowRight className="ml-auto" /></Button>}
      />
    );
  }

  if (snapshot?.session.status === 'ended' || snapshot?.session.status === 'deleted') {
    const deleted = snapshot.session.status === 'deleted';
    return (
      <StatusScreen
        icon={<span className="text-4xl">{deleted ? '🗑️' : '👋'}</span>}
        title={deleted ? 'Party deleted' : 'Party ended'}
        detail={deleted
          ? 'The host deleted this house. Thanks for playing!'
          : 'The host ended this game night. Thanks for playing!'}
        action={(
          <Button className="neon-primary w-full" onClick={() => navigate(isHost ? '/' : '/join')}>
            {isHost ? 'Host a new party' : 'Join another house'} <ArrowRight className="ml-auto" />
          </Button>
        )}
      />
    );
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

  const callGameVote = () => {
    const options = drawerGames.slice(0, 6).map((game) => game.name);
    if (options.length >= 2) {
      callVote(options);
      toast.success('Vote opened on player controllers.');
    }
  };

  async function createPairing() {
    if (hostPairingBusy) return;
    setHostPairingBusy(true);
    try {
      const pairing = await createCompanionPairing(normalizedCode);
      setPairingCode(pairing.pairingCode);
      toast.success('Six-digit companion code created.');
    } catch (error) {
      toast.error(error instanceof Error && error.message.includes('403')
        ? 'This display no longer has the owner credential. Resume the house from its original host device.'
        : 'Could not create a companion code. Try again.');
    } finally {
      setHostPairingBusy(false);
    }
  }

  function endCurrentGame() {
    if (!activeRun || !window.confirm('End the current game and move everyone to the recap?')) return;
    endGame();
    setDrawerOpen(false);
  }

  const hostControls = isHost ? (
    <>
      {/* Pre-game configuration — every game gets a config screen before it starts. */}
      {configGame && (
        <GameConfigSheet
          game={configGame}
          readyPlayers={readyCount}
          onStart={startConfigured}
          onCancel={() => setConfigGame(null)}
        />
      )}
      {/* Public display keeps the lightweight Games & controls drawer (emergency surface).
          The companion gets the full tabbed control booth instead. */}
      {role === 'display' && (
        <>
          <Button className="fixed right-4 top-4 z-[70] rounded-xl bg-black/70" variant="outline" onClick={() => setDrawerOpen(true)}>
            <Menu className="h-4 w-4" /> Games & controls
          </Button>
          <HostGameDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            activeGameType={activeRun && ['active', 'paused', 'setup', 'recoverable'].includes(activeRun.status) ? activeRun.gameType : undefined}
            activeRunStatus={activeRun?.status}
            members={members}
            busyGame={busyGame}
            onSelectGame={(game) => void chooseGame(game)}
            pairingCode={pairingCode}
            onCreatePairing={() => void createPairing()}
            pairingBusy={hostPairingBusy}
            onPauseGame={() => pauseGame('host_pause')}
            onResumeGame={resumeGame}
            onEndGame={endCurrentGame}
            games={drawerGames}
            sessionCode={normalizedCode}
          />
        </>
      )}
      {role === 'companion' && (
        <CompanionConsole
          code={normalizedCode}
          joinUrl={joinUrl}
          members={members}
          remoteOn={snapshot?.session.settings.allowRemote ?? true}
          activeGame={activeRun ? { gameType: activeRun.gameType, status: activeRun.status } : null}
          votePoll={votePoll}
          voteHistory={voteHistory}
          pairingCode={pairingCode}
          onOpenGames={() => setPickerOpen(true)}
          admitPlayer={admitPlayer}
          rejectPlayer={rejectPlayer}
          kickPlayer={kickPlayer}
          setRemoteMode={setRemoteMode}
          pauseGame={() => pauseGame('host_pause')}
          resumeGame={resumeGame}
          endGame={endGame}
          callVote={(options, opts) => callVote(options, opts)}
          closeVote={closeVote}
          cancelVote={cancelVote}
          applyVoteResult={applyVoteResult}
          overrideVote={overrideVote}
          endParty={endParty}
          deleteParty={deleteParty}
          createPairing={() => void createPairing()}
        />
      )}
    </>
  ) : null;

  const hostJoinStrip = isHost ? (
    <div className="fixed bottom-4 left-4 z-[65] flex items-center gap-3 rounded-2xl border border-primary/40 bg-[#050914]/92 p-3 shadow-[0_0_24px_rgba(69,243,107,.18)] backdrop-blur-xl">
      <div className="rounded-lg bg-white p-1"><QRCodeSVG value={joinUrl} size={58} /></div>
      <div className="text-left">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Join house</p>
        <p className="font-mono text-2xl font-black tracking-[0.16em] text-primary">{normalizedCode}</p>
        <p className="text-[10px] text-white/60">{joinUrl.replace(/^https?:\/\//, '')}</p>
      </div>
    </div>
  ) : null;

  // Cinematic vote overlay for the public display (the stage). Read-only: live tally + result.
  const displayVoteOverlay = role === 'display' && votePoll && dismissedVoteId !== votePoll.id ? (
    <div className="fixed inset-x-0 top-6 z-[75] flex justify-center px-6">
      <div className="relative w-full max-w-2xl rounded-3xl border border-secondary/50 bg-[#0b0716]/95 p-6 text-center shadow-[0_0_40px_rgba(168,85,247,.25)] backdrop-blur-xl">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-3 top-3 rounded-full"
          aria-label="Dismiss vote from host screen"
          onClick={() => setDismissedVoteId(votePoll.id)}
        >
          <X className="h-4 w-4" />
        </Button>
        <p className="text-xs uppercase tracking-[0.3em] text-secondary">
          {votePoll.status === 'open' ? '● House vote live' : votePoll.status === 'expired' ? 'Vote expired' : 'Vote result'}
        </p>
        <div className="mt-4 space-y-2">
          {votePoll.options.map((option) => {
            const count = votePoll.tally[option] ?? 0;
            const total = Math.max(1, votePoll.options.reduce((sum, opt) => sum + (votePoll.tally[opt] ?? 0), 0));
            const pct = Math.round((count / total) * 100);
            const isWinner = votePoll.result?.winnerOption === option;
            return (
              <div key={option} className={`relative overflow-hidden rounded-xl border px-4 py-3 text-left ${isWinner ? 'border-primary' : 'border-white/10'}`}>
                <div className="absolute inset-y-0 left-0 bg-secondary/25" style={{ width: `${pct}%` }} />
                <div className="relative flex items-center justify-between text-lg font-bold">
                  <span>{option}</span>
                  <span className="text-primary">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
        {votePoll.result && (
          <p className="mt-4 text-sm text-white/80">
            {votePoll.result.winnerOption
              ? `Winner: ${votePoll.result.winnerOption}${votePoll.result.applied ? ' — applied' : ''}${votePoll.result.hostOverride ? ' (host override)' : ''}`
              : votePoll.result.tied
                ? `Tie: ${votePoll.result.tiedOptions.join(', ')}`
                : 'No majority reached.'}
          </p>
        )}
      </div>
    </div>
  ) : null;

  const disconnectedControllers = members.filter((member) =>
    member.role === 'controller' && !member.connected && activeRun && ['active', 'paused'].includes(activeRun.status),
  );

  const pauseOverlay = activeRun?.status === 'paused' ? (
    <div className="fixed inset-x-4 top-20 z-[75] mx-auto max-w-xl rounded-2xl border border-amber-300/50 bg-[#171006]/95 p-4 text-center shadow-[0_0_28px_rgba(251,191,36,.18)] backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.22em] text-amber-200">Game paused</p>
      <h2 className="mt-1 text-xl font-black">Waiting for players to reconnect</h2>
      {disconnectedControllers.length > 0 ? (
        <p className="mt-2 text-sm text-amber-100/80">
          Missing: {disconnectedControllers.map((member) => member.displayName).join(', ')}
        </p>
      ) : (
        <p className="mt-2 text-sm text-amber-100/80">Everyone appears connected. Host can resume.</p>
      )}
      {isHost && (
        <Button className="neon-primary mt-3 rounded-xl" onClick={resumeGame}>
          <Play className="h-4 w-4" /> Resume game
        </Button>
      )}
    </div>
  ) : null;

  // Controller chip + flyout (player name/avatar, edit, achievements, pause) — replaces the old
  // floating top-right pause button so it never covers the in-game round/turn header.
  const rulesText = aiResult?.kind === 'rules' ? aiResult.text : null;
  const controllerMenu = (role === 'controller' || role === 'crowd') ? (
    <ControllerMenu
      profile={profile}
      onSaveProfile={setProfile}
      onPause={() => pauseGame('player_pause')}
      canPause={activeRun?.status === 'active'}
      extraSlot={activeRun ? (
        <div className="space-y-2">
          <Button variant="outline" className="h-10 w-full rounded-xl text-xs" onClick={() => requestRules()}>🤖 How to play</Button>
          {rulesText && <p className="rounded-xl border border-secondary/30 bg-secondary/10 p-2 text-[11px] leading-relaxed text-white/85">{rulesText}</p>}
        </div>
      ) : undefined}
    />
  ) : null;

  const controllerPersistenceStrip = !isHost && wakeLockStatus === 'unsupported' ? (
    <div className="fixed inset-x-3 bottom-3 z-[70] rounded-xl border border-amber-300/30 bg-[#171006]/92 px-4 py-2 text-center text-[11px] text-amber-100 shadow-[0_0_18px_rgba(251,191,36,.12)]">
      If your phone locks, reopen BoredRoom and tap Resume House {normalizedCode}.
    </div>
  ) : null;

  if (snapshot?.session.status === 'game_recap' && snapshot.lastRecap) {
    const winners = controllerMembers.filter((member) => snapshot.lastRecap?.winnerPlayerIds.includes(member.deviceId));
    return (
      <LagosScene>
        {hostControls}
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 pb-24 pt-7">
          <BrandLogo />
          <section className="mx-auto mt-10 w-full text-center">
            <h1 className="brush-display text-5xl">Game night <span className="text-primary">recap</span></h1>
            <p className="mt-2 text-lg">{activeGame?.emoji} {activeGame?.name ?? snapshot.lastRecap.gameType}</p>
            {snapshot.lastRecap.status !== 'abandoned' && (
              <WinnerCelebration
                fireKey={`${snapshot.lastRecap.gameType}:${snapshot.lastRecap.endedAt ?? ''}`}
                winnerNames={winners.map((w) => w.displayName)}
                iWon={snapshot.lastRecap.winnerPlayerIds.includes(deviceId)}
                isController={role === 'controller' || role === 'crowd'}
              />
            )}
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
            {(snapshot.session.standings?.length ?? 0) > 0 && (
              <div className="neon-panel mt-4 rounded-2xl p-5 text-left">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">Game-night championship</h2>
                  <span className="text-xs text-muted-foreground">{snapshot.session.completedGameCount} games completed</span>
                </div>
                <div className="mt-3 space-y-2">
                  {snapshot.session.standings.map((standing, index) => (
                    <div key={standing.playerId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <span className="w-6 font-mono text-primary">{index + 1}</span>
                      <span className="flex-1 font-semibold">{standing.displayName}</span>
                      <span className="text-sm">{standing.gameWins} game {standing.gameWins === 1 ? 'win' : 'wins'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isHost ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button className="neon-primary h-14 rounded-xl" onClick={() => setDrawerOpen(true)}>Choose next game <ArrowRight className="ml-auto" /></Button>
                <Button variant="outline" className="h-14 rounded-xl" onClick={endParty}>End game night</Button>
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
        {hostJoinStrip}
        {displayVoteOverlay}
        {controllerPersistenceStrip}
        {pauseOverlay}
        {controllerMenu}
        <InstalledGameSurface
          publicState={gamePublicState.state}
          privateState={gamePrivateState?.gameType === activeRun.gameType ? gamePrivateState.state : null}
          role={role}
          sendIntent={sendGameIntent}
          aiHint={aiResult?.kind === 'hint' ? aiResult.text : null}
          aiCommentary={aiResult?.kind === 'commentary' || aiResult?.kind === 'pacing' ? aiResult.text : null}
          requestHint={role === 'controller' && snapshot?.session.settings.hintsEnabled ? requestHint : undefined}
          hintBudget={gamePrivateState?.gameType === activeRun.gameType ? gamePrivateState.hintBudget : undefined}
          paceDeadline={gamePublicState.paceDeadline}
        />
      </div>
    );
  }

  if (activeRun) {
    return <StatusScreen icon={<Loader2 className="h-9 w-9 animate-spin" />} title="Preparing game…" detail={`Loading ${activeGame?.name ?? activeRun.gameType} for everyone.`} />;
  }

  if (role === 'controller' || role === 'crowd') {
    const me = members.find((member) => member.deviceId === deviceId);
    if (me?.pending) {
      return (
        <StatusScreen
          icon={<Loader2 className="h-9 w-9 animate-spin" />}
          title="Waiting for the host"
          detail="The host needs to admit you to this house. Hang tight — you’ll join automatically once approved."
        />
      );
    }
    if (editingProfile) {
      return (
        <LagosScene>
          <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
            <BrandLogo className="mx-auto text-2xl" />
            <div className="flex flex-1 flex-col justify-center">
              <div className="neon-panel rounded-2xl p-5">
                <ProfileSheet
                  cta="Save"
                  onSave={(next) => { setProfile(next); setEditingProfile(false); }}
                  onCancel={() => setEditingProfile(false)}
                />
              </div>
            </div>
            <BuiltByFooter />
          </div>
        </LagosScene>
      );
    }
    return (
      <StatusScreen
        icon={<PlayerAvatar displayName={displayName} avatar={profile.avatarType === 'emoji' ? profile.avatarValue : undefined} accentColor={profile.accentColor} size={72} />}
        title="Waiting to play"
        detail="Waiting for the host to start the game. Your controls will switch automatically."
        action={role === 'controller' ? (
          <div className="space-y-3">
            <Button className={me?.ready ? 'neon-primary w-full' : 'w-full'} variant={me?.ready ? 'default' : 'outline'} onClick={() => setReady(!me?.ready)}>
              {me?.ready ? 'You’re in as a player' : 'Tap when ready'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setEditingProfile(true)}>Edit profile</Button>
            {role === 'controller' && !votePoll && snapshot?.session.settings.allowPlayerVotes && (
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => {
                  requestVote(['Pause the house', 'Skip to next game'], { question: 'A player called a vote.' });
                  toast.success('Vote requested.');
                }}
              >
                Call a house vote
              </Button>
            )}
            {votePoll && (
              <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-3 text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-secondary">
                  {votePoll.status === 'open' ? 'Vote open' : votePoll.status === 'expired' ? 'Vote expired' : 'Vote result'}
                </p>
                <div className="mt-3 grid gap-2">
                  {votePoll.options.map((option) => (
                    <Button
                      key={option}
                      variant="outline"
                      className="justify-between rounded-xl bg-black/25"
                      disabled={votePoll.status !== 'open'}
                      onClick={() => castVote(option)}
                    >
                      {option}
                      <span className="text-primary">{votePoll.tally[option] ?? 0}</span>
                    </Button>
                  ))}
                </div>
                {votePoll.result && (
                  <p className="mt-3 text-xs text-white/70">
                    {votePoll.result.winnerOption
                      ? `Result: ${votePoll.result.winnerOption}${votePoll.result.applied ? ' applied' : ''}.`
                      : votePoll.result.tied
                        ? `Tie: ${votePoll.result.tiedOptions.join(', ')}. Host decides.`
                        : votePoll.result.quorumMet
                          ? 'No option reached the required majority.'
                          : 'Not enough eligible players voted.'}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : undefined}
      />
    );
  }

  return (
    <LagosScene className="bg-[linear-gradient(180deg,rgba(2,8,23,.4),rgba(2,8,23,.8))]">
      {hostControls}
      {hostJoinStrip}
      {displayVoteOverlay}
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
          {isHost && installedGames.length > 0 && (
            <Button className="neon-primary mt-5 h-14 rounded-xl px-8 text-base font-bold" onClick={() => setPickerOpen(true)}>
              Advance to games <ArrowRight className="ml-auto" />
            </Button>
          )}
        </section>
        <section className="neon-panel rounded-2xl p-5">
          <div className="flex justify-between border-b border-white/10 pb-3 text-sm">
            <strong>JOINED PLAYERS &nbsp; <span className="text-primary">{controllerMembers.length} / {snapshot?.session.settings?.maxControllers ?? 12}</span></strong>
            <span className="text-primary">Ready {readyCount} / {controllerMembers.length}</span>
          </div>
          <div className="mt-4 flex gap-5 overflow-x-auto">
            {controllerMembers.map((member) => (
              <div key={member.deviceId} className="min-w-16 text-center">
                <div className="relative mx-auto w-12">
                  <PlayerAvatar displayName={member.displayName} avatar={member.avatar} accentColor={member.accentColor} isBot={member.isBot} size={48} className="mx-auto" />
                  {member.ready && !member.isBot && <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-black">✓</span>}
                </div>
                <p className="mt-2 text-xs">{member.displayName}</p>
                {member.isBot && <p className="text-[10px] uppercase tracking-[0.2em] text-secondary">🤖 Bot</p>}
                {isHost && member.isBot && (
                  <button type="button" className="mt-1 text-[10px] uppercase tracking-[0.15em] text-red-300/80 hover:text-red-200" onClick={() => removeBot(member.deviceId)}>Remove</button>
                )}
                {role === 'companion' && !member.isBot && (
                  <button
                    type="button"
                    className="mt-1 text-[10px] uppercase tracking-[0.15em] text-red-300/80 hover:text-red-200"
                    onClick={() => { if (window.confirm(`Remove ${member.displayName} from the house?`)) kickPlayer(member.deviceId, 'Removed by host.'); }}
                  >
                    Kick
                  </button>
                )}
              </div>
            ))}
            {controllerMembers.length === 0 && <p className="text-sm text-muted-foreground">Waiting for the first player…</p>}
          </div>
          {/* Host bot roster: add named bots (no name clashes) before starting a game. */}
          {isHost && snapshot?.session.settings.allowBots && (
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-xs text-muted-foreground">
                {controllerMembers.filter((m) => m.isBot).length} bot(s) · {controllerMembers.filter((m) => !m.isBot).length} player(s)
              </span>
              <Button
                variant="outline"
                className="h-9 rounded-xl text-xs"
                disabled={controllerMembers.length >= (snapshot?.session.settings.maxControllers ?? 12)}
                onClick={() => addBot()}
              >
                🤖 Add bot
              </Button>
            </div>
          )}
        </section>
      </div>
      {pickerOpen && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#020817]/95 p-5 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <div>
                <BrandLogo className="text-3xl" />
                <h1 className="brush-display mt-5 text-5xl">Choose the <span className="text-primary">game</span></h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {controllerMembers.length} joined · {readyCount} ready · bots {snapshot?.session.settings.allowBots ? 'allowed' : 'off'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl bg-black/40" onClick={callGameVote}>Call vote</Button>
                <Button variant="outline" className="rounded-xl bg-black/40" onClick={() => setPickerOpen(false)}>Back to lobby</Button>
              </div>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {drawerGames.map((game) => {
                const tooFew = readyCount < game.minPlayers && !snapshot?.session.settings.allowBots;
                return (
                  <button
                    key={game.slug}
                    type="button"
                    disabled={!game.available || tooFew || busyGame != null}
                    onClick={() => void chooseGame(game)}
                    className="neon-panel group min-h-48 rounded-3xl p-5 text-left transition hover:-translate-y-1 hover:border-primary/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-5xl">{game.emoji}</span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground">{game.minPlayers}–{game.maxPlayers} players</span>
                    </div>
                    <h2 className="mt-6 text-2xl font-black">{game.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{game.tagline}</p>
                    <div className="mt-5 flex items-center justify-between text-sm">
                      <span className={game.capabilities?.bots ? 'text-primary' : 'text-white/45'}>
                        {game.capabilities?.bots ? 'Bots available' : 'No bots'}
                      </span>
                      <span className="text-secondary group-hover:text-white">
                        {tooFew ? 'Need more ready players' : busyGame === game.slug ? 'Starting…' : 'Start →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </LagosScene>
  );
}
