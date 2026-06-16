import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { RoomState } from '@/lib/realtimeRoom';
import { Button } from '@/components/ui/button';
import { Users, Play, Copy, Check, X, Bot, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { HostReactionPanel } from '@/components/room/HostReactionPanel';
import { NewGameSettingsPanel } from '@/components/room/NewGameSettingsPanel';
import { HowToPlayLauncher } from '@/components/room/HowToPlayLauncher';
import { LanguageSwitcher } from '@/components/system/LanguageSwitcher';
import { AI_PERSONA_LABELS, AIPersona, ColorWahalaPublicState, ColorWahalaSettings, GameType, HustlePublicState, HustleSettings, LandlordSettings, LogoPublicState, LogoSettings, ReactionPolicy, ReactionStats, RoomMember, RoomSettings, TauntPolicy, TriviaCategory, TriviaPublicState, TriviaSettings, WordWahalaPublicState, WordWahalaSettings } from '@/lib/transport/types';

const TRIVIA_CATEGORIES: { value: TriviaCategory; label: string }[] = [
  { value: 'history', label: 'History' },
  { value: 'geography', label: 'Geography' },
  { value: 'culture', label: 'Culture' },
  { value: 'music', label: 'Music' },
  { value: 'nollywood', label: 'Nollywood' },
  { value: 'sports', label: 'Sports' },
  { value: 'food', label: 'Food' },
  { value: 'language', label: 'Language' },
  { value: 'literature', label: 'Literature' },
  { value: 'general', label: 'General' },
];

interface DisplayLobbyProps {
  roomState: RoomState;
  onStartGame: () => void;
  onKick?: (playerId: string) => void;
  presenceMap?: Record<string, number>;
  transportKind?: 'supabase' | 'supabase-fallback' | 'colyseus';
  onAddBot?: (difficulty?: 'easy' | 'smart') => void;
  onRemoveBot?: (botId: string) => void;
  onAutofillBots?: (targetCount: number, difficulty?: 'easy' | 'smart') => void;
  onSetRoomPolicy?: (policy: 'open' | 'approval' | 'locked') => void;
  /** @deprecated Rooms are per-game now; selector removed. Prop kept for prop-shape compat. */
  onSetGameType?: (gameType: GameType) => void;
  reactionPolicy?: ReactionPolicy;
  tauntPolicy?: TauntPolicy;
  reactionStats?: ReactionStats;
  rendererMode?: string;
  members?: RoomMember[];
  onSetReactionPolicy?: (policy: Partial<ReactionPolicy>) => void;
  onSetTauntPolicy?: (policy: Partial<TauntPolicy>) => void;
  onClearReactions?: () => void;
  onSetAiAssistance?: (enabled: boolean) => void;
  onSetGameSettings?: (settings: Partial<RoomSettings>) => void;
  triviaState?: TriviaPublicState | null;
  onSetTriviaSettings?: (settings: Partial<TriviaSettings>) => void;
  logoState?: LogoPublicState | null;
  onSetLogoSettings?: (settings: Partial<LogoSettings>) => void;
  colorWahalaState?: ColorWahalaPublicState | null;
  onSetColorWahalaSettings?: (settings: Partial<ColorWahalaSettings>) => void;
  hustleState?: HustlePublicState | null;
  onSetHustleSettings?: (settings: Partial<HustleSettings>) => void;
  wordWahalaState?: WordWahalaPublicState | null;
  onSetWordWahalaSettings?: (settings: Partial<WordWahalaSettings>) => void;
  landlordSettings?: LandlordSettings | null;
  onSetLandlordSettings?: (settings: Partial<LandlordSettings>) => void;
}

export function DisplayLobby({
  roomState,
  onStartGame,
  onKick,
  presenceMap = {},
  transportKind = 'supabase',
  onAddBot,
  onRemoveBot,
  onAutofillBots,
  onSetRoomPolicy,
  onSetGameType,
  reactionPolicy,
  tauntPolicy,
  reactionStats,
  rendererMode,
  members,
  onSetReactionPolicy,
  onSetTauntPolicy,
  onClearReactions,
  onSetAiAssistance,
  onSetGameSettings,
  triviaState,
  onSetTriviaSettings,
  logoState,
  onSetLogoSettings,
  colorWahalaState,
  onSetColorWahalaSettings,
  hustleState,
  onSetHustleSettings,
  wordWahalaState,
  onSetWordWahalaSettings,
  landlordSettings,
  onSetLandlordSettings,
}: DisplayLobbyProps) {
  const { t } = useTranslation();
  const gameSlug = (roomState as { gameType?: string }).gameType ?? 'ludo';
  const roomSettings = (roomState as { roomSettings?: RoomSettings }).roomSettings;
  const maxPlayers = (roomState as { maxPlayers?: number }).maxPlayers ?? roomSettings?.maxPlayers ?? (gameSlug === 'whot' ? 8 : 4);
  const joinUrl = `${window.location.origin}/${gameSlug}/join/${roomState.code}`;
  const activeMembers = roomState.members.filter((m) => !m.isSpectator);
  const allReady = activeMembers.length >= 2 && activeMembers.every((m) => m.isReady || m.isBot);
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success('Join link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-8 max-w-4xl w-full"
      >
        <div>
          <h1 className="text-5xl md:text-7xl font-display font-bold neon-text mb-2">
            Bored<span className="text-secondary">Room</span>
          </h1>
          <p className="text-xl text-muted-foreground">Scan to join the game</p>
        </div>

        <div className="flex flex-col md:flex-row gap-12 items-center justify-center">
          {/* QR Code */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="glass rounded-3xl p-8"
          >
            <QRCodeSVG
              value={joinUrl}
              size={250}
              bgColor="transparent"
              fgColor="hsl(160, 100%, 50%)"
              level="M"
            />
          </motion.div>

          {/* Room Code */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">Room Code</p>
              <div className="text-7xl md:text-9xl font-display font-bold tracking-[0.2em] neon-text">
                {roomState.code}
              </div>
            </div>

            <div className="text-lg text-muted-foreground flex items-center gap-2 justify-center">
              <Users className="w-5 h-5" />
              {activeMembers.length}/{maxPlayers} players
            </div>

            <Button
              onClick={copyLink}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy join link'}
            </Button>
          </div>
        </div>

        {/* Player list */}
        <div className="flex gap-4 justify-center flex-wrap">
          {roomState.members.map((member, i) => {
            const seenAt = presenceMap[member.id];
            const presence = derivePresenceState(seenAt);
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl px-6 py-4 flex items-center gap-3 group relative"
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    background: member.isReady ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    boxShadow: member.isReady ? '0 0 10px hsl(var(--neon-glow) / 0.5)' : 'none',
                  }}
                />
                <span className="text-xl font-display font-bold flex items-center gap-1.5">
                  {member.isBot && <Bot className="w-4 h-4 text-secondary" aria-label="Bot" />}
                  {member.displayName}
                </span>
                {!member.isHost && !member.isBot && (
                  <span
                    className="w-2 h-2 rounded-full"
                    title={presence.label}
                    style={{ background: presence.color, boxShadow: presence.glow }}
                  />
                )}
                {member.isHost && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">HOST</span>
                )}
                {member.isBot && (
                  <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded-full">BOT</span>
                )}
                {member.isReady && !member.isHost && !member.isBot && (
                  <span className="text-xs text-primary">Ready</span>
                )}
                {member.isBot && transportKind === 'colyseus' && onRemoveBot && (
                  <button
                    onClick={() => onRemoveBot(member.id)}
                    aria-label={`Remove ${member.displayName}`}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1 hover:bg-destructive/20 text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {onKick && !member.isHost && !member.isBot && (
                  <button
                    onClick={() => onKick(member.id)}
                    aria-label={`Kick ${member.displayName}`}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1 hover:bg-destructive/20 text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, maxPlayers - activeMembers.length) }, (_, i) => (
            <motion.div
              key={`empty-${i}`}
              className="rounded-2xl px-6 py-4 border-2 border-dashed border-muted opacity-30"
            >
              <span className="text-xl font-display">Waiting...</span>
            </motion.div>
          ))}
        </div>

        {/* Game-type selector removed: rooms are per-game now (host picks game at room creation). */}


        {transportKind === 'colyseus' && (onSetAiAssistance || onSetGameSettings) && (
          <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 justify-center items-center">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Host settings</span>
            {onSetAiAssistance && (
              <Button
                variant={roomSettings?.aiAssistance === false ? 'outline' : 'secondary'}
                size="sm"
                onClick={() => onSetAiAssistance(!(roomSettings?.aiAssistance ?? true))}
              >
                Assistance {roomSettings?.aiAssistance === false ? 'Off' : 'On'}
              </Button>
            )}
            {onSetGameSettings && (roomSettings?.aiAssistance ?? true) !== false && (
              <select
                className="text-xs rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                value={roomSettings?.aiPersona ?? 'classic'}
                onChange={(e) => onSetGameSettings({ aiPersona: e.target.value as AIPersona })}
                aria-label="AI commentary persona"
              >
                {(Object.keys(AI_PERSONA_LABELS) as AIPersona[]).map((p) => (
                  <option key={p} value={p}>Voice: {AI_PERSONA_LABELS[p]}</option>
                ))}
              </select>
            )}
            {onSetGameSettings && gameSlug === 'whot' && (
              <select
                className="text-xs rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                value={maxPlayers}
                onChange={(e) => onSetGameSettings({ maxPlayers: Number(e.target.value) })}
                aria-label="Whot player limit"
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>Whot max players: {n}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Trivia: category picker + pacing controls — lobby only */}
        {transportKind === 'colyseus' && gameSlug === 'trivia' && onSetTriviaSettings && triviaState && (
          <div className="glass rounded-2xl p-4 space-y-4 max-w-3xl mx-auto">
            <div className="text-xs uppercase tracking-wider text-muted-foreground text-center">
              Trivia setup
            </div>

            {/* Topic mode */}
            <div className="flex flex-wrap gap-2 justify-center items-center">
              <span className="text-xs text-muted-foreground">Topic mode</span>
              {(['rotate', 'host_pick', 'mixed'] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={triviaState.settings.topicMode === mode ? 'secondary' : 'outline'}
                  onClick={() => onSetTriviaSettings({ topicMode: mode })}
                  className="capitalize"
                >
                  {mode === 'host_pick' ? 'Host pick' : mode}
                </Button>
              ))}
            </div>

            {/* Category multi-pick — only when host_pick */}
            {triviaState.settings.topicMode === 'host_pick' && (
              <div className="flex flex-wrap gap-2 justify-center">
                {TRIVIA_CATEGORIES.map((cat) => {
                  const selected = triviaState.settings.topics?.includes(cat.value) ?? false;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        const current = new Set(triviaState.settings.topics ?? []);
                        if (current.has(cat.value)) current.delete(cat.value);
                        else current.add(cat.value);
                        onSetTriviaSettings({ topics: Array.from(current) as TriviaCategory[] });
                      }}
                      className={`text-xs font-display rounded-full px-3 py-1.5 border transition-colors ${
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card/60 text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pacing controls */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Rounds</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={triviaState.settings.rounds}
                  onChange={(e) => onSetTriviaSettings({ rounds: Number(e.target.value) })}
                >
                  {[1, 2, 3, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Q / round</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={triviaState.settings.questionsPerRound}
                  onChange={(e) => onSetTriviaSettings({ questionsPerRound: Number(e.target.value) })}
                >
                  {[3, 5, 7, 10, 12, 15].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Answer time</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={triviaState.settings.answerWindowMs}
                  onChange={(e) => onSetTriviaSettings({ answerWindowMs: Number(e.target.value) })}
                >
                  {[10000, 15000, 20000, 30000, 45000].map((ms) => (
                    <option key={ms} value={ms}>{ms / 1000}s</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Reveal hold</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={triviaState.settings.revealHoldMs}
                  onChange={(e) => onSetTriviaSettings({ revealHoldMs: Number(e.target.value) })}
                >
                  {[2000, 3000, 4000, 5000, 6000].map((ms) => (
                    <option key={ms} value={ms}>{ms / 1000}s</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Logo Guesser host settings — lobby only */}
        {transportKind === 'colyseus' && gameSlug === 'logo' && onSetLogoSettings && logoState && (
          <div className="glass rounded-2xl p-4 space-y-4 max-w-3xl mx-auto">
            <div className="text-xs uppercase tracking-wider text-muted-foreground text-center">
              Logo Guesser setup
            </div>
            <div className="flex flex-wrap gap-2 justify-center items-center">
              <span className="text-xs text-muted-foreground">Input mode</span>
              {(['multiple_choice', 'free_text'] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={logoState.settings.inputMode === mode ? 'secondary' : 'outline'}
                  onClick={() => onSetLogoSettings({ inputMode: mode })}
                >
                  {mode === 'multiple_choice' ? 'Multiple choice' : 'Free text'}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 justify-center items-center">
              <span className="text-xs text-muted-foreground">Brand pool</span>
              {(['naija', 'mixed', 'global'] as const).map((region) => (
                <Button
                  key={region}
                  size="sm"
                  variant={logoState.settings.regionFilter === region ? 'secondary' : 'outline'}
                  onClick={() => onSetLogoSettings({ regionFilter: region })}
                  className="capitalize"
                >
                  {region}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Rounds</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={logoState.settings.rounds}
                  onChange={(e) => onSetLogoSettings({ rounds: Number(e.target.value) })}
                >
                  {[5, 7, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Answer time</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={logoState.settings.answerWindowMs}
                  onChange={(e) => onSetLogoSettings({ answerWindowMs: Number(e.target.value) })}
                >
                  {[10000, 15000, 20000, 25000, 30000].map((ms) => (
                    <option key={ms} value={ms}>{ms / 1000}s</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Reveal hold</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={logoState.settings.revealHoldMs}
                  onChange={(e) => onSetLogoSettings({ revealHoldMs: Number(e.target.value) })}
                >
                  {[2000, 3000, 4000, 5000, 6000].map((ms) => (
                    <option key={ms} value={ms}>{ms / 1000}s</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {transportKind === 'colyseus' && gameSlug === 'color-wahala' && onSetColorWahalaSettings && colorWahalaState && (
          <div className="glass rounded-2xl p-4 space-y-4 max-w-3xl mx-auto">
            <div className="text-xs uppercase tracking-wider text-muted-foreground text-center">
              Color Wahala setup
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Rounds</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={colorWahalaState.settings.rounds}
                  onChange={(e) => onSetColorWahalaSettings({ rounds: Number(e.target.value) })}
                >
                  {[5, 8, 10, 12, 15, 20, 25].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Start window</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={colorWahalaState.settings.startLockMs}
                  onChange={(e) => onSetColorWahalaSettings({ startLockMs: Number(e.target.value) })}
                >
                  {[4000, 5000, 6000, 7000, 8000].map((ms) => (
                    <option key={ms} value={ms}>{ms / 1000}s</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">End window</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={colorWahalaState.settings.endLockMs}
                  onChange={(e) => onSetColorWahalaSettings({ endLockMs: Number(e.target.value) })}
                >
                  {[1500, 2000, 2500, 3000, 3500, 4000].map((ms) => (
                    <option key={ms} value={ms}>{ms / 1000}s</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-wider">Reveal hold</span>
                <select
                  className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                  value={colorWahalaState.settings.revealHoldMs}
                  onChange={(e) => onSetColorWahalaSettings({ revealHoldMs: Number(e.target.value) })}
                >
                  {[1500, 2000, 2500, 3000, 4000].map((ms) => (
                    <option key={ms} value={ms}>{ms / 1000}s</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground text-center">Mode mix</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {([
                  { key: 'balanced', label: 'Balanced', mix: { say_word: 0.6, say_color: 0.25, say_heard: 0.15 } },
                  { key: 'word-heavy', label: 'Word focus', mix: { say_word: 0.85, say_color: 0.15, say_heard: 0 } },
                  { key: 'color-heavy', label: 'Color focus', mix: { say_word: 0.2, say_color: 0.8, say_heard: 0 } },
                  { key: 'chaos', label: 'Chaos', mix: { say_word: 0.34, say_color: 0.33, say_heard: 0.33 } },
                ] as const).map((preset) => {
                  const cur = colorWahalaState.settings.modeMix;
                  const active =
                    Math.abs(cur.say_word - preset.mix.say_word) < 0.02 &&
                    Math.abs(cur.say_color - preset.mix.say_color) < 0.02 &&
                    Math.abs(cur.say_heard - preset.mix.say_heard) < 0.02;
                  return (
                    <Button
                      key={preset.key}
                      size="sm"
                      variant={active ? 'secondary' : 'outline'}
                      onClick={() => onSetColorWahalaSettings({ modeMix: preset.mix })}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant={colorWahalaState.settings.audioEnabled ? 'secondary' : 'outline'}
                onClick={() => onSetColorWahalaSettings({ audioEnabled: !colorWahalaState.settings.audioEnabled })}
              >
                Audio prompts: {colorWahalaState.settings.audioEnabled ? 'On' : 'Off'}
              </Button>
            </div>
          </div>
        )}

        {transportKind === 'colyseus' && (onAddBot || onAutofillBots) && (
          <div className="flex flex-wrap gap-2 justify-center items-center">
            {onSetRoomPolicy && (
              <select
                className="text-xs rounded-md bg-muted border border-border px-2 py-1.5 font-display"
                value={roomState.roomPolicy ?? 'open'}
                onChange={(e) => onSetRoomPolicy(e.target.value as 'open' | 'approval' | 'locked')}
                aria-label="Room join policy"
              >
                <option value="open">Join policy: open</option>
                <option value="approval">Join policy: approval</option>
                <option value="locked">Join policy: locked</option>
              </select>
            )}
            {onAddBot && activeMembers.length < maxPlayers && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => onAddBot('smart')}>
                <Plus className="w-4 h-4" /> Add bot
              </Button>
            )}
            {onAddBot && activeMembers.length < maxPlayers && (
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => onAddBot('easy')}>
                <Bot className="w-4 h-4" /> Add easy bot
              </Button>
            )}
            {onAutofillBots && activeMembers.length < maxPlayers && (
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => onAutofillBots(maxPlayers, 'smart')}>
                <Sparkles className="w-4 h-4" /> Fill to {maxPlayers}
              </Button>
            )}
          </div>
        )}


        {/* Host moderation: reactions policy — Colyseus only */}
        {transportKind === 'colyseus' && onSetReactionPolicy && onSetTauntPolicy && onClearReactions && (
          <HostReactionPanel
            variant="full"
            reactionPolicy={reactionPolicy}
            tauntPolicy={tauntPolicy}
            reactionStats={reactionStats}
            rendererMode={rendererMode}
            members={members ?? roomState.members}
            onSetReactionPolicy={onSetReactionPolicy}
            onSetTauntPolicy={onSetTauntPolicy}
            onClearReactions={onClearReactions}
          />
        )}

        {transportKind === 'colyseus' && (
          <NewGameSettingsPanel
            gameSlug={gameSlug}
            hustleState={hustleState}
            onSetHustleSettings={onSetHustleSettings}
            wordWahalaState={wordWahalaState}
            onSetWordWahalaSettings={onSetWordWahalaSettings}
            landlordSettings={landlordSettings}
            onSetLandlordSettings={onSetLandlordSettings}
          />
        )}

        <div className="flex justify-center">
          <HowToPlayLauncher gameSlug={gameSlug} />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: allReady ? 1 : 0.5 }}
        >
          <Button
            onClick={onStartGame}
            disabled={!allReady}
            size="lg"
            className="controller-button bg-primary text-primary-foreground hover:bg-primary/90 px-12 py-8 text-2xl gap-3"
          >
            <Play className="w-8 h-8" />
            {t('lobby.startGame')}
          </Button>
          {!allReady && activeMembers.length >= 2 && (
            <p className="text-sm text-muted-foreground mt-2">{t('lobby.waitingReady')}</p>
          )}
          {activeMembers.length < 2 && (
            <p className="text-sm text-muted-foreground mt-2">{t('lobby.needPlayers')}</p>
          )}
        </motion.div>

        <div className="flex justify-center pt-4 opacity-80">
          <LanguageSwitcher compact />
        </div>
      </motion.div>
    </div>
  );
}

function derivePresenceState(seenAt?: number): { color: string; glow: string; label: string } {
  if (!seenAt) {
    return { color: 'hsl(var(--muted-foreground))', glow: 'none', label: 'No signal yet' };
  }
  const age = Date.now() - seenAt;
  if (age < 6000) {
    return {
      color: 'hsl(var(--primary))',
      glow: '0 0 6px hsl(var(--primary) / 0.6)',
      label: 'Connected',
    };
  }
  if (age < 20000) {
    return { color: 'hsl(45, 100%, 55%)', glow: 'none', label: 'Reconnecting…' };
  }
  return { color: 'hsl(var(--muted-foreground))', glow: 'none', label: 'Disconnected' };
}
