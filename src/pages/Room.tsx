import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoom } from '@/hooks/useRoom';
import { ensureHostDisplayId, getPlayerId, getPlayerName } from '@/lib/roomUtils';
import { useReplayRecorder } from '@/lib/useReplayRecorder';
import { DisplayLobby } from '@/components/room/DisplayLobby';
import { PlayerLobby } from '@/components/room/PlayerLobby';
import { DisplayGame } from '@/components/room/DisplayGame';
import { PlayerController } from '@/components/room/PlayerController';
import { GameOver } from '@/components/room/GameOver';
import { WhotDisplay } from '@/components/room/WhotDisplay';
import { WhotController } from '@/components/room/WhotController';
import { TriviaDisplay } from '@/components/room/TriviaDisplay';
import { TriviaController } from '@/components/room/TriviaController';
import { TriviaRecap } from '@/components/room/TriviaRecap';
import { CrowdController } from '@/components/room/CrowdController';
import { Connect4Display } from '@/components/room/Connect4Display';
import { Connect4Controller } from '@/components/room/Connect4Controller';
import { EtttDisplay } from '@/components/room/EtttDisplay';
import { EtttController } from '@/components/room/EtttController';
import { LogoDisplay } from '@/components/room/LogoDisplay';
import { LogoController } from '@/components/room/LogoController';
import { LandlordDisplay } from '@/components/room/LandlordDisplay';
import { LandlordController } from '@/components/room/LandlordController';
import { ColorWahalaDisplay } from '@/components/room/ColorWahalaDisplay';
import { ColorWahalaController } from '@/components/room/ColorWahalaController';
import { HustleDisplay } from '@/components/room/HustleDisplay';
import { HustleController } from '@/components/room/HustleController';
import { WordWahalaDisplay } from '@/components/room/WordWahalaDisplay';
import { WordWahalaController } from '@/components/room/WordWahalaController';
import { ReactionsOverlay } from '@/components/game/Reactions';
import { motion } from 'framer-motion';
import { AlertTriangle, BarChart3, Home, Loader2, RotateCcw, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getGameMeta } from '@/lib/games';
import InvalidGame from '@/pages/InvalidGame';
import { BuiltByFooter } from '@/components/layout/BuiltByFooter';
import { resolveRoomSessionRole } from '@/lib/roomSession';

export default function RoomPage() {
  const { game, code } = useParams<{ game: string; code: string }>();
  const navigate = useNavigate();
  // GameRouteGuard validates :game upstream; meta is always defined here.
  const meta = getGameMeta(game)!;
  const requestedHostMode = sessionStorage.getItem('boredroom_is_host') === 'true';
  const storedHostToken = sessionStorage.getItem('boredroom_host_token') ?? '';
  const { isHost, shouldClearHostSession } = resolveRoomSessionRole({
    requestedHostMode,
    storedHostToken,
    storedRoomCode: sessionStorage.getItem('boredroom_room_code'),
    storedGameType: sessionStorage.getItem('boredroom_game_type'),
    routeRoomCode: code,
    routeGameType: meta.slug,
  });
  if (shouldClearHostSession) {
    sessionStorage.setItem('boredroom_is_host', 'false');
    sessionStorage.removeItem('boredroom_host_token');
  }
  const hostDisplayId = isHost ? ensureHostDisplayId() : '';
  const hostToken = isHost ? storedHostToken : undefined;
  const playerId = isHost ? hostDisplayId : getPlayerId();
  const displayName = isHost ? undefined : getPlayerName() || 'Player';

  const {
    transportKind,
    roomState,
    connected,
    syncStatus,
    presenceMap,
    kicked,
    commentaryLine,
    recap,
    aiStatus,
    lastErrorCode,
    retryCount,
    startGame,
    performAction,
    toggleReady,
    sendEmoji,
    playAgain,
    pauseGame,
    resumeGame,
    endGame,
    requestPause,
    requestLeave,
    kickPlayer,
    approveJoin,
    rejectJoin,
    addBot,
    removeBot,
    replaceBotWithHuman,
    autofillBots,
    setRoomPolicy,
    setAiAssistance,
    setGameSettings,
    setReactionPolicy,
    setTauntPolicy,
    clearReactions,
    onReactionAck,
    setGameType,
    whotDrawCard,
    whotPlayCard,
    whotCallSuit,
    whotAnnounceLastCard,
    privateWhotState,
    privateTriviaState,
    triviaLockAnswer,
    crowdVoteTrivia,
    setTriviaSettings,
    connect4Drop,
    etttPlace,
    privateLogoState,
    setLogoSettings,
    logoLockPick,
    logoLockText,
    landlordRoll,
    landlordBuy,
    landlordDecline,
    landlordAckCard,
    landlordPayJailFine,
    landlordUseJailCard,
    landlordEndTurn,
    landlordBuild,
    landlordSellHouse,
    landlordMortgage,
    landlordUnmortgage,
    landlordBid,
    landlordBidPass,
    landlordProposeTrade,
    landlordCancelTrade,
    landlordRespondTrade,
    privateColorWahalaState,
    colorWahalaTap,
    setColorWahalaSettings,
    hustleRoll,
    hustlePlayCard,
    hustleClaimJapa,
    hustleDeclineJapa,
    setHustleSettings,
    privateWordWahalaState,
    wordWahalaPlay,
    wordWahalaPass,
    wordWahalaSwap,
    setWordWahalaSettings,
    setLandlordSettings,
  } = useRoom({
    roomCode: code || '',
    isHost,
    playerId,
    displayName,
    hostToken,
    gameType: meta.slug,
  });

  // Track which renderer the overlay actually picked, so the host panel
  // can show "renderer: webgl-hybrid" / "css3d" for diagnostics.
  const [rendererMode, setRendererMode] = useState<'webgl-hybrid' | 'css3d'>('css3d');
  const showDiagnostics =
    import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';

  useEffect(() => {
    if (kicked) {
      toast.error('You were removed from the room');
    }
  }, [kicked]);

  const { status, gameState } = roomState;
  useEffect(() => {
    if (status !== 'playing') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  const handleRetry = () => {
    window.location.reload();
  };

  // Force-bypass the service-worker cache. Used when the failure is a
  // protocol mismatch — the installed PWA is serving a stale bundle and a
  // normal reload would just re-hand it back. We unregister the SW, clear
  // every Cache Storage entry, then hard-reload with a cache-busting query
  // param so the browser fetches index.html fresh.
  const handleForceRefresh = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // best-effort; fall through to reload regardless
    }
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString(36));
    window.location.replace(url.toString());
  };

  const handleResetSession = () => {
    sessionStorage.removeItem('boredroom_is_host');
    sessionStorage.removeItem('boredroom_host_token');
    sessionStorage.removeItem('boredroom_host_display_id');
    sessionStorage.removeItem('boredroom_room_code');
    sessionStorage.removeItem('boredroom_transport_fallback');
    navigate(meta ? `/${meta.slug}/join` : '/', { replace: true });
  };

  const FATAL_ERROR_CODES = ['host_token_invalid', 'connect_timeout', 'forbidden', 'protocol_mismatch'];
  const isFatalJoinFailure =
    !!lastErrorCode &&
    FATAL_ERROR_CODES.includes(lastErrorCode) &&
    (syncStatus === 'reconnecting' || syncStatus === 'connecting');

  // Hard UI deadline: if we've been stuck in connecting for >15s with no
  // server-side timeout firing, surface a manual recovery card. Prevents the
  // "infinite Connecting…" UX even if a transport hangs without rejecting.
  const [connectDeadlineHit, setConnectDeadlineHit] = useState(false);
  useEffect(() => {
    if (syncStatus === 'ready') {
      setConnectDeadlineHit(false);
      return;
    }
    if (syncStatus !== 'connecting') return;
    const t = window.setTimeout(() => setConnectDeadlineHit(true), 15000);
    return () => window.clearTimeout(t);
  }, [syncStatus]);

  const roomGameType = (roomState as { gameType?: 'ludo' | 'whot' | 'trivia' | 'connect-4' | 'ettt' | 'logo' | 'landlord' | 'half-half' | 'color-wahala' | 'hustle' | 'word-wahala' }).gameType ?? 'ludo';
  const whotPublicState =
    (roomState as { whotState?: import('@/lib/transport/types').WhotPublicState | null }).whotState ?? null;
  const triviaPublicState =
    (roomState as { triviaState?: import('@/lib/transport/types').TriviaPublicState | null }).triviaState ?? null;
  const connect4PublicState =
    (roomState as { connect4State?: import('@/lib/transport/types').Connect4PublicState | null }).connect4State ?? null;
  const etttPublicState =
    (roomState as { etttState?: import('@/lib/transport/types').EtttPublicState | null }).etttState ?? null;
  const logoPublicState =
    (roomState as { logoState?: import('@/lib/transport/types').LogoPublicState | null }).logoState ?? null;
  const landlordPublicState =
    (roomState as { landlordState?: import('@/lib/transport/types').LandlordPublicState | null }).landlordState ?? null;
  const colorWahalaPublicState =
    (roomState as { colorWahalaState?: import('@/lib/transport/types').ColorWahalaPublicState | null }).colorWahalaState ?? null;
  const hustlePublicState =
    (roomState as { hustleState?: import('@/lib/transport/types').HustlePublicState | null }).hustleState ?? null;
  const wordWahalaPublicState =
    (roomState as { wordWahalaState?: import('@/lib/transport/types').WordWahalaPublicState | null }).wordWahalaState ?? null;

  // Replay recording — host display only. Picks the active per-game public
  // state to snapshot (turnNumber + lastAction). Falls back to the room state
  // for games without a public turn struct.
  const activeGameState =
    connect4PublicState
    ?? etttPublicState
    ?? hustlePublicState
    ?? landlordPublicState
    ?? triviaPublicState
    ?? whotPublicState
    ?? logoPublicState
    ?? colorWahalaPublicState
    ?? wordWahalaPublicState
    ?? (roomState as unknown as { turnNumber?: number; lastAction?: string });
  useReplayRecorder({
    enabled: isHost,
    status,
    roomState,
    gameState: activeGameState as unknown as { turnNumber?: number; lastAction?: string } | null,
    recap,
  });

  // Landlord settings aren't published on public state — track host's UI choices locally
  // and forward via setLandlordSettings. Effective values are clamped server-side.
  const [landlordLobbySettings, setLandlordLobbySettings] = useState<
    import('@/lib/transport/types').LandlordSettings
  >({ maxPlayers: 4, startingCash: 1500 });
  const handleSetLandlordSettings = (settings: Partial<import('@/lib/transport/types').LandlordSettings>) => {
    setLandlordLobbySettings((prev) => ({ ...prev, ...settings }));
    setLandlordSettings(settings);
  };

  if (kicked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-sm">
          <h1 className="text-3xl font-display font-bold">Removed from room</h1>
          <p className="text-muted-foreground">The host has removed you from this game.</p>
          <Button onClick={() => navigate('/')} className="gap-2">
            <Home className="w-4 h-4" /> Go home
          </Button>
        </div>
      </div>
    );
  }

  // Full-screen takeover only for the very first connect, and only while we
  // haven't blown the UI deadline or hit a fatal error.
  if (
    !isFatalJoinFailure &&
    !connectDeadlineHit &&
    (syncStatus === 'connecting' || (!connected && syncStatus !== 'reconnecting'))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-display">Connecting to room...</p>
        </motion.div>
      </div>
    );
  }

  if (isFatalJoinFailure || connectDeadlineHit) {
    const code = lastErrorCode ?? (connectDeadlineHit ? 'connect_timeout' : 'unknown');
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full glass rounded-2xl p-6 space-y-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-2xl font-display font-bold">Room Connection Failed</h1>
          <p className="text-sm text-muted-foreground">
            Error: <span className="font-mono">{code}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {code === 'connect_timeout'
              ? 'The server did not respond in time. Check your connection and try again.'
              : code === 'host_token_invalid'
                ? 'Your host session is stale. Reset session and host a new room.'
                : code === 'protocol_mismatch'
                  ? 'This client is out of date. Reload to pick up the latest version.'
                  : 'This room may be unavailable or your session is stale.'}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {code === 'protocol_mismatch' ? (
              <Button onClick={handleForceRefresh} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Update & Reload
              </Button>
            ) : (
              <Button onClick={handleRetry} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Retry
              </Button>
            )}
            <Button onClick={handleResetSession} variant="outline" className="gap-2">
              <Wrench className="w-4 h-4" />
              Reset Session
            </Button>
            <Button onClick={() => navigate('/')} variant="ghost" className="gap-2">
              <Home className="w-4 h-4" />
              Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
  const syncPending = syncStatus !== 'ready';
  const showSeatRestoreOverlay = !isHost && syncStatus === 'syncing';
  const botsAllowed = roomGameType === 'ludo' || roomGameType === 'whot';
  const me = roomState.members.find((m) => m.id === playerId);
  const isCrowd = !isHost && me?.role === 'crowd';

  // Game-mismatch guard
  if (syncStatus === 'ready' && roomGameType !== game) {
    return (
      <InvalidGame
        reason="game_mismatch"
        detail={`URL: ${game} · Room: ${roomGameType} · Code: ${code}`}
      />
    );
  }
  return (
    <div className="min-h-screen">
      <ReactionsOverlay
        reactions={roomState.reactions}
        moments={roomState.reactionMoments}
        onRendererResolved={setRendererMode}
      />

      {/* Reconnecting banner — non-takeover */}
      {syncStatus === 'reconnecting' && (
        <div className="fixed top-0 inset-x-0 z-40 flex justify-center pointer-events-none">
          <div className="mt-2 px-4 py-1.5 rounded-full bg-card/90 border border-border text-xs font-display flex items-center gap-2 shadow-lg backdrop-blur">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span className="text-foreground">Reconnecting…</span>
          </div>
        </div>
      )}

      {showDiagnostics && isHost && (
        <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-card/90 border border-border text-[11px] uppercase tracking-wide font-display">
            Transport: {transportKind}
          </div>
          <div
            className="px-3 py-1 rounded-full bg-card/90 border border-border text-[11px] font-mono"
            title="Build hash — include in bug reports to identify the deployed client bundle"
          >
            build {import.meta.env.VITE_BUILD_HASH ?? 'dev'}
          </div>
        </div>
      )}
      {showDiagnostics && !isHost && (
        <div className="fixed top-3 right-3 z-40">
          <div
            className="px-2 py-0.5 rounded-full bg-card/90 border border-border text-[10px] font-mono opacity-70"
            title="Build hash"
          >
            {import.meta.env.VITE_BUILD_HASH ?? 'dev'}
          </div>
        </div>
      )}

      {showDiagnostics && <div className="fixed bottom-3 right-3 z-40">
        <div className="px-3 py-1 rounded-full bg-card/90 border border-border text-[11px] font-display">
          sync={syncStatus} retry={retryCount} {lastErrorCode ? `err=${lastErrorCode}` : ''}
        </div>
      </div>}

      {roomState.pauseState?.paused && (
        <div className="fixed inset-x-0 top-14 z-40 flex justify-center pointer-events-none">
          <div className="glass rounded-full px-5 py-2 text-sm font-display shadow-xl">
            Paused: {roomState.pauseState.message ?? roomState.pauseState.reason ?? 'Game paused'}
            {isHost && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="ml-3 pointer-events-auto"
                onClick={resumeGame}
              >
                Resume
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Seat restore overlay — non-unmounting, lighter */}
      {showSeatRestoreOverlay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none">
          <div className="text-center space-y-3 px-6">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground font-display">Restoring your seat…</p>
          </div>
        </div>
      )}

      {isCrowd && (
        <CrowdController
          gameType={roomGameType ?? meta.slug}
          triviaPublicState={triviaPublicState}
          onReact={sendEmoji}
          onCrowdVoteTrivia={crowdVoteTrivia}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          onReactionAck={onReactionAck}
          onRequestLeave={requestLeave}
          displayName={me?.displayName}
        />
      )}

      {status === 'lobby' && isHost && (
        <DisplayLobby
          roomState={roomState}
          onStartGame={startGame}
          onKick={kickPlayer}
          presenceMap={presenceMap}
          transportKind={transportKind}
          onAddBot={botsAllowed ? addBot : undefined}
          onRemoveBot={botsAllowed ? removeBot : undefined}
          onAutofillBots={botsAllowed ? autofillBots : undefined}
          onSetRoomPolicy={setRoomPolicy}
          onSetGameType={setGameType}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          reactionStats={roomState.reactionStats}
          rendererMode={showDiagnostics ? rendererMode : undefined}
          members={roomState.members}
          onSetReactionPolicy={setReactionPolicy}
          onSetTauntPolicy={setTauntPolicy}
          onClearReactions={clearReactions}
          onSetAiAssistance={setAiAssistance}
          onSetGameSettings={setGameSettings}
          triviaState={triviaPublicState}
          onSetTriviaSettings={setTriviaSettings}
          logoState={logoPublicState}
          onSetLogoSettings={setLogoSettings}
          colorWahalaState={colorWahalaPublicState}
          onSetColorWahalaSettings={setColorWahalaSettings}
          hustleState={hustlePublicState}
          onSetHustleSettings={setHustleSettings}
          wordWahalaState={wordWahalaPublicState}
          onSetWordWahalaSettings={setWordWahalaSettings}
          landlordSettings={landlordLobbySettings}
          onSetLandlordSettings={handleSetLandlordSettings}
        />
      )}

      {status === 'lobby' && !isHost && !isCrowd && (
        <PlayerLobby
          roomState={roomState}
          playerId={playerId}
          onToggleReady={toggleReady}
          onReact={sendEmoji}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          onReactionAck={onReactionAck}
          onRequestLeave={requestLeave}
        />
      )}

      {/* PLAYING — branch by gameType */}
      {status === 'playing' && roomGameType === 'whot' && whotPublicState && isHost && (
        <WhotDisplay
          state={whotPublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'whot' && whotPublicState && !isHost && !isCrowd && privateWhotState && (
        <WhotController
          publicState={whotPublicState}
          privateState={privateWhotState ?? null}
          playerId={playerId}
          onDraw={whotDrawCard}
          onPlay={whotPlayCard}
          onCallSuit={whotCallSuit}
          onAnnounceLastCard={whotAnnounceLastCard}
          syncPending={syncPending}
        />
      )}
      {status === 'playing' && roomGameType === 'whot' && whotPublicState && !isHost && !isCrowd && !privateWhotState && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass max-w-sm rounded-2xl p-6 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <h2 className="font-display text-2xl font-bold">Restoring your hand</h2>
            <p className="text-sm text-muted-foreground">
              This controller is reconnecting to its private Whot hand. The display view stays on the host screen only.
            </p>
            <Button variant="outline" onClick={handleRetry}>Retry</Button>
          </div>
        </div>
      )}

      {status === 'playing' && roomGameType === 'trivia' && triviaPublicState && isHost && (
        <TriviaDisplay
          state={triviaPublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'trivia' && triviaPublicState && !isHost && !isCrowd && (
        <TriviaController
          publicState={triviaPublicState}
          privateState={privateTriviaState ?? null}
          playerId={playerId}
          onLockAnswer={triviaLockAnswer}
          onReact={sendEmoji}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          onReactionAck={onReactionAck}
          onRequestLeave={requestLeave}
          syncPending={syncPending}
        />
      )}

      {status === 'playing' && roomGameType === 'connect-4' && connect4PublicState && isHost && (
        <Connect4Display
          state={connect4PublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'connect-4' && connect4PublicState && !isHost && !isCrowd && (
        <Connect4Controller
          state={connect4PublicState}
          playerId={playerId}
          onDrop={connect4Drop}
          syncPending={syncPending}
        />
      )}

      {status === 'playing' && roomGameType === 'ettt' && etttPublicState && isHost && (
        <EtttDisplay
          state={etttPublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'ettt' && etttPublicState && !isHost && !isCrowd && (
        <EtttController
          state={etttPublicState}
          playerId={playerId}
          onPlace={etttPlace}
          syncPending={syncPending}
        />
      )}

      {status === 'playing' && roomGameType === 'logo' && logoPublicState && isHost && (
        <LogoDisplay
          state={logoPublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'logo' && logoPublicState && !isHost && !isCrowd && (
        <LogoController
          publicState={logoPublicState}
          privateState={privateLogoState ?? null}
          playerId={playerId}
          onLockPick={logoLockPick}
          onLockText={logoLockText}
          onReact={sendEmoji}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          onReactionAck={onReactionAck}
          onRequestLeave={requestLeave}
          syncPending={syncPending}
        />
      )}
      {status === 'playing' && roomGameType === 'logo' && !logoPublicState && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass max-w-sm rounded-2xl p-6 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <h2 className="font-display text-2xl font-bold">Loading Logo Guesser</h2>
            <p className="text-sm text-muted-foreground">Syncing round state from the server…</p>
            <Button variant="outline" onClick={handleRetry}>Retry</Button>
          </div>
        </div>
      )}

      {status === 'playing' && roomGameType === 'landlord' && landlordPublicState && isHost && (
        <LandlordDisplay
          state={landlordPublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'landlord' && landlordPublicState && !isHost && !isCrowd && (
        <LandlordController
          state={landlordPublicState}
          playerId={playerId}
          onRoll={landlordRoll}
          onBuy={landlordBuy}
          onDecline={landlordDecline}
          onAckCard={landlordAckCard}
          onPayJailFine={landlordPayJailFine}
          onUseJailCard={landlordUseJailCard}
          onEndTurn={landlordEndTurn}
          onBuild={landlordBuild}
          onSellHouse={landlordSellHouse}
          onMortgage={landlordMortgage}
          onUnmortgage={landlordUnmortgage}
          onBid={landlordBid}
          onBidPass={landlordBidPass}
          onProposeTrade={landlordProposeTrade}
          onCancelTrade={landlordCancelTrade}
          onRespondTrade={landlordRespondTrade}
          onReact={sendEmoji}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          onReactionAck={onReactionAck}
          onRequestLeave={requestLeave}
          syncPending={syncPending}
        />
      )}
      {status === 'playing' && roomGameType === 'landlord' && !landlordPublicState && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass max-w-sm rounded-2xl p-6 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <h2 className="font-display text-2xl font-bold">Loading Oga Landlord</h2>
            <p className="text-sm text-muted-foreground">Syncing board state from the server…</p>
            <Button variant="outline" onClick={handleRetry}>Retry</Button>
          </div>
        </div>
      )}

      {status === 'playing' && roomGameType === 'half-half' && (
        <InvalidGame reason="game_disabled" detail="Half & Half has been retired from this release." />
      )}

      {status === 'playing' && roomGameType === 'color-wahala' && colorWahalaPublicState && isHost && (
        <ColorWahalaDisplay
          state={colorWahalaPublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'color-wahala' && colorWahalaPublicState && !isHost && !isCrowd && (
        <ColorWahalaController
          publicState={colorWahalaPublicState}
          privateState={privateColorWahalaState}
          playerId={playerId}
          onTap={colorWahalaTap}
          onReact={sendEmoji}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          onReactionAck={onReactionAck}
          onRequestLeave={requestLeave}
          syncPending={syncPending}
        />
      )}

      {status === 'playing' && roomGameType === 'hustle' && hustlePublicState && isHost && (
        <HustleDisplay
          state={hustlePublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'hustle' && hustlePublicState && !isHost && !isCrowd && (
        <HustleController
          state={hustlePublicState}
          playerId={playerId}
          onRoll={hustleRoll}
          onPlayCard={hustlePlayCard}
          onClaimJapa={hustleClaimJapa}
          onDeclineJapa={hustleDeclineJapa}
          syncPending={syncPending}
        />
      )}

      {status === 'playing' && roomGameType === 'word-wahala' && wordWahalaPublicState && isHost && (
        <WordWahalaDisplay
          state={wordWahalaPublicState}
          roomCode={roomState.code}
          joinUrl={`${window.location.origin}/${meta.slug}/join/${roomState.code}`}
          commentaryLine={commentaryLine}
          aiStatus={aiStatus}
        />
      )}
      {status === 'playing' && roomGameType === 'word-wahala' && wordWahalaPublicState && !isHost && !isCrowd && (
        <WordWahalaController
          publicState={wordWahalaPublicState}
          privateState={privateWordWahalaState ?? null}
          playerId={playerId}
          onPlay={wordWahalaPlay}
          onPass={wordWahalaPass}
          onSwap={wordWahalaSwap}
          syncPending={syncPending}
        />
      )}

      {status === 'playing' && roomGameType !== 'whot' && roomGameType !== 'trivia' && roomGameType !== 'connect-4' && roomGameType !== 'ettt' && roomGameType !== 'logo' && roomGameType !== 'landlord' && roomGameType !== 'half-half' && roomGameType !== 'color-wahala' && roomGameType !== 'hustle' && roomGameType !== 'word-wahala' && isHost && gameState && (
        <DisplayGame
          roomState={roomState}
          onReact={sendEmoji}
          commentaryLine={commentaryLine}
          presenceMap={presenceMap}
          aiStatus={aiStatus}
          transportKind={transportKind}
          onApproveJoin={approveJoin}
          onRejectJoin={rejectJoin}
          onReplaceBotWithHuman={replaceBotWithHuman}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          reactionStats={roomState.reactionStats}
          rendererMode={showDiagnostics ? rendererMode : undefined}
          onSetReactionPolicy={setReactionPolicy}
          onSetTauntPolicy={setTauntPolicy}
          onClearReactions={clearReactions}
          onPauseGame={pauseGame}
          onEndGame={() => endGame('Host ended the game')}
        />
      )}

      {status === 'playing' && roomGameType !== 'whot' && roomGameType !== 'trivia' && roomGameType !== 'connect-4' && roomGameType !== 'ettt' && roomGameType !== 'logo' && roomGameType !== 'landlord' && roomGameType !== 'half-half' && roomGameType !== 'color-wahala' && roomGameType !== 'hustle' && roomGameType !== 'word-wahala' && !isHost && !isCrowd && gameState && (
        <PlayerController
          gameState={gameState}
          playerId={playerId}
          onAction={performAction}
          onReact={sendEmoji}
          syncPending={syncPending}
          reactionPolicy={roomState.reactionPolicy}
          tauntPolicy={roomState.tauntPolicy}
          onReactionAck={onReactionAck}
          onRequestPause={requestPause}
          onResume={resumeGame}
          onRequestLeave={requestLeave}
          pauseState={roomState.pauseState}
        />
      )}

      {status === 'playing' && isHost && roomGameType !== 'ludo' && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button size="sm" variant="destructive" onClick={() => endGame('Host ended the game')}>
            End game
          </Button>
        </div>
      )}

      {status === 'finished' && roomGameType === 'trivia' && triviaPublicState && (
        <TriviaRecap
          state={triviaPublicState}
          isHost={isHost}
          onPlayAgain={playAgain}
          recap={recap}
        />
      )}
      {status === 'finished' && roomGameType !== 'trivia' && (
        <GameOver roomState={roomState} playerId={playerId} isHost={isHost} onPlayAgain={playAgain} recap={recap} />
      )}
      {isHost && status !== 'playing' && (
        <div className="fixed top-3 left-3 z-40">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/display/stats')}>
            <BarChart3 className="w-4 h-4" />
            Stats
          </Button>
        </div>
      )}
      {status !== 'playing' && (
        <div className="relative z-10 pb-4">
          <BuiltByFooter />
        </div>
      )}
    </div>
  );
}
