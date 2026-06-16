// Mirror of @boredroom/shared contracts for the web client.
// Keep in lockstep with shared/src/contracts/index.ts.

export const PROTOCOL_VERSION = 2;

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type DieChoice = 'd1' | 'd2' | 'sum';

export interface Token {
  id: number;
  position: number;
  color: PlayerColor;
}

export interface LudoPlayer {
  id: string;
  color: PlayerColor;
  tokens: Token[];
  displayName: string;
  finishedTokens: number;
  isBot?: boolean;
  botDifficulty?: 'easy' | 'smart';
}

export interface LudoState {
  players: LudoPlayer[];
  currentPlayerIndex: number;
  dice: [number, number] | null;
  diceRemaining: number[];
  diceValue: number | null;
  diceRolled: boolean;
  phase: 'rolling' | 'moving' | 'finished';
  winner: string | null;
  consecutiveSixes: number;
  consecutiveDoubleSixes: number;
  lastAction: string;
  turnNumber: number;
}

export interface RoomMember {
  id: string;
  displayName: string;
  color: string;
  isReady: boolean;
  isHost: boolean;
  isBot?: boolean;
  isSpectator?: boolean;
  role?: 'host' | 'player' | 'crowd';
}

// Canonical platform-wide phase enum (mirror of shared contract).
export type CanonicalGamePhase =
  | 'lobby'
  | 'game_intro'
  | 'round_active'
  | 'round_resolution'
  | 'game_over';

export interface PendingJoinRequest {
  id: string;
  deviceId: string;
  displayName: string;
  requestedAt: number;
}

export type AIStatus = 'active' | 'fallback' | 'degraded' | 'offline';
export type RoomPolicy = 'open' | 'approval' | 'locked';

export type PauseReason = 'host' | 'player_visibility' | 'player_request' | 'ended';

export interface PauseState {
  paused: boolean;
  reason: PauseReason | null;
  requestedBy?: string | null;
  since?: number | null;
  message?: string | null;
}

export interface SeatPresence {
  connected: boolean;
  hidden: boolean;
  lastSeenAt: number;
  pauseRequested?: boolean;
}

export type AIPersona = 'classic' | 'naija_hype' | 'chaos_mc' | 'banker';

export const AI_PERSONA_LABELS: Record<AIPersona, string> = {
  classic: 'Classic Host',
  naija_hype: 'Naija Hype',
  chaos_mc: 'Chaos MC',
  banker: 'The Banker',
};

export interface RoomSettings {
  aiAssistance: boolean;
  maxPlayers: number;
  whotPenaltyStreaks: boolean;
  reactionBursts: boolean;
  /** Optional — defaults to 'classic' when missing for backward compat. */
  aiPersona?: AIPersona;
}

// ──────────────────────────────────────────────────────────────────────────
// Reactions
// ──────────────────────────────────────────────────────────────────────────

export interface ReactionPolicy {
  enabled: boolean;
  cooldownMs: number;
  burstMax: number;
  burstWindowMs: number;
  duplicateWindowMs: number;
  maxBufferedReactions: number;
}

export interface TauntPolicy {
  enabled: boolean;
}

export const DEFAULT_REACTION_POLICY: ReactionPolicy = {
  enabled: true,
  cooldownMs: 600,
  burstMax: 6,
  burstWindowMs: 3000,
  duplicateWindowMs: 500,
  maxBufferedReactions: 40,
};

export const DEFAULT_TAUNT_POLICY: TauntPolicy = {
  enabled: true,
};

export interface ReactionStats {
  totalAccepted: number;
  rejected: {
    cooldown: number;
    rate_limited: number;
    disabled: number;
    duplicate: number;
  };
  perUserAccepted: Record<string, number>;
}

export interface ReactionMoment {
  id: string;
  emoji: string;
  count: number;
  windowStart: number;
  windowEnd: number;
}

export type ReactionRejectReason = 'cooldown' | 'rate_limited' | 'disabled' | 'duplicate';

export interface PublicRoomState {
  protocolVersion: number;
  code: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'finished';
  members: RoomMember[];
  gameState: LudoState | null;
  reactions: { playerId: string; emoji: string; timestamp: number }[];
  pendingJoinRequests: PendingJoinRequest[];
  aiStatus: AIStatus;
  roomPolicy: RoomPolicy;
  reactionPolicy: ReactionPolicy;
  tauntPolicy: TauntPolicy;
  reactionStats: ReactionStats;
  reactionMoments: ReactionMoment[];
  pauseState?: PauseState;
  presenceBySeat?: Record<string, SeatPresence>;
  roomSettings?: RoomSettings;
  maxPlayers?: number;
  /** Selected game type for this room. Defaults to 'ludo' for older clients. */
  gameType?: GameType;
  /** Public Whot scaffold state. Only present when gameType === 'whot'. */
  whotState?: WhotPublicState | null;
  /** Public Trivia state. Only present when gameType === 'trivia'. */
  triviaState?: TriviaPublicState | null;
  /** Public Connect 4 state. Only present when gameType === 'connect-4'. */
  connect4State?: Connect4PublicState | null;
  /** Public Endless Tic Tac Toe state. Only present when gameType === 'ettt'. */
  etttState?: EtttPublicState | null;
  /** Public Logo Guesser state. Only present when gameType === 'logo'. */
  logoState?: LogoPublicState | null;
  /** Public Oga Landlord state. Only present when gameType === 'landlord'. */
  landlordState?: LandlordPublicState | null;
  /** Public Half & Half state. Only present when gameType === 'half-half'. */
  halfHalfState?: HalfHalfPublicState | null;
  /** Public Color Wahala state. Only present when gameType === 'color-wahala'. */
  colorWahalaState?: ColorWahalaPublicState | null;
  /** Public Hustle state. Only present when gameType === 'hustle'. */
  hustleState?: HustlePublicState | null;
  /** Public Word Wahala state. Only present when gameType === 'word-wahala'. */
  wordWahalaState?: WordWahalaPublicState | null;
  /** Canonical cross-game phase. */
  canonicalPhase?: CanonicalGamePhase;
}

export interface PrivateSeatState {
  seatId: string;
  hint?: { line: string; createdAt: number } | null;
  whotState?: WhotPrivateState | null;
  triviaState?: TriviaPrivateState | null;
  logoState?: LogoPrivateState | null;
  halfHalfState?: HalfHalfPrivateState | null;
  colorWahalaState?: ColorWahalaPrivateState | null;
  wordWahalaState?: WordWahalaPrivateState | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Whot (Nigerian) — scaffold contracts (mirrors shared/src/contracts)
// ──────────────────────────────────────────────────────────────────────────

export type GameType = 'ludo' | 'whot' | 'trivia' | 'connect-4' | 'ettt' | 'logo' | 'landlord' | 'half-half' | 'color-wahala' | 'hustle' | 'word-wahala';

// ──────────────────────────────────────────────────────────────────────────
// Connect 4 (mirrors shared/src/games/connect4/engine)
// ──────────────────────────────────────────────────────────────────────────

export type Connect4Disc = 'red' | 'yellow';
export type Connect4Cell = Connect4Disc | null;
export type Connect4Phase = 'playing' | 'finished';
export type Connect4Team = 'A' | 'B';

export interface Connect4Player {
  id: string;
  displayName: string;
  disc: Connect4Disc;
  /** Tag-team assignment. Undefined for legacy 1v1 rooms. */
  team?: Connect4Team;
  color?: string;
}

export interface Connect4WinningCell {
  row: number;
  col: number;
}

export interface Connect4PublicState {
  phase: Connect4Phase;
  board: Connect4Cell[][];
  players: Connect4Player[];
  currentPlayerIndex: number;
  currentPlayerId: string;
  turnNumber: number;
  winnerId: string | null;
  winningTeam: Connect4Team | null;
  winningCells: Connect4WinningCell[] | null;
  lastAction: string;
  lastDropCol: number | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Endless Tic Tac Toe (mirrors shared/src/games/ettt/engine)
// ──────────────────────────────────────────────────────────────────────────

export type EtttMark = 'X' | 'O';
export type EtttCell = EtttMark | null;
export type EtttPhase = 'playing' | 'finished';
export type EtttTeam = 'A' | 'B';

export interface EtttPlayer {
  id: string;
  displayName: string;
  mark: EtttMark;
  team?: EtttTeam;
  color?: string;
}

export interface EtttPieceRef {
  row: number;
  col: number;
}

export interface EtttPublicState {
  phase: EtttPhase;
  board: EtttCell[][];
  players: EtttPlayer[];
  currentPlayerIndex: number;
  currentPlayerId: string;
  turnNumber: number;
  winnerId: string | null;
  winningTeam: EtttTeam | null;
  winningCells: EtttPieceRef[] | null;
  piecesByPlayer: Record<string, EtttPieceRef[]>;
  piecesByTeam: Record<EtttTeam, EtttPieceRef[]>;
  oldestForCurrent: EtttPieceRef | null;
  lastAction: string;
  lastPlacement: EtttPieceRef | null;
}

export type WhotShape = 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';

export interface WhotCard {
  id: string;
  shape: WhotShape;
  value: number;
  isWhot: boolean;
}

export interface WhotPlayerState {
  id: string;
  displayName: string;
  /** Optional visual identity copied from the room seat color. */
  color?: string;
  handCount: number;
  isBot?: boolean;
}

export type WhotPhase = 'playing' | 'finished';

export interface WhotPublicState {
  phase: WhotPhase;
  players: WhotPlayerState[];
  currentPlayerIndex: number;
  currentPlayerId: string;
  topDiscard: WhotCard | null;
  activeShape: WhotShape;
  turnDirection?: 1 | -1;
  drawPileCount: number;
  turnDeadlineAt?: number;
  turnTimeLimitMs?: number;
  turnNumber: number;
  winnerId: string | null;
  lastAction: string;
  pendingDrawCount?: number;
  pendingDrawRank?: '2' | '3' | null;
  mustCallSuit?: boolean;
  lastCardAnnounced?: string[];
  semiLastCardAnnounced?: string[];
  matchScoreBySeat?: Record<string, number>;
  targetScore?: number;
  roundIndex?: number;
  penaltyContinuation?: {
    seatId: string;
    rank: '2' | '3' | '14';
    pendingCount: number;
  } | null;
}

export interface WhotPrivateState {
  hand: WhotCard[];
}

// ──────────────────────────────────────────────────────────────────────────
// Trivia (mirrors shared/src/contracts)
// ──────────────────────────────────────────────────────────────────────────

export type TriviaCategory =
  | 'history'
  | 'geography'
  | 'culture'
  | 'music'
  | 'nollywood'
  | 'sports'
  | 'food'
  | 'language'
  | 'literature'
  | 'general';

export type TriviaDifficulty = 'easy' | 'medium' | 'hard';

export type TriviaPhase =
  | 'lobby'
  | 'intro'
  | 'question'
  | 'options'
  | 'reveal'
  | 'leaderboard'
  | 'finished';

export interface TriviaPlayerState {
  id: string;
  displayName: string;
  color?: string;
  score: number;
  streak: number;
  correctCount: number;
  isBot?: boolean;
}

export interface TriviaSettings {
  rounds: number;
  questionsPerRound: number;
  questionRevealMs: number;
  answerWindowMs: number;
  revealHoldMs: number;
  topicMode: 'rotate' | 'host_pick' | 'mixed';
  topics?: TriviaCategory[];
}

export const DEFAULT_TRIVIA_SETTINGS: TriviaSettings = {
  rounds: 5,
  questionsPerRound: 10,
  questionRevealMs: 2000,
  answerWindowMs: 20000,
  revealHoldMs: 3000,
  topicMode: 'rotate',
};

export interface TriviaPublicState {
  phase: TriviaPhase;
  settings: TriviaSettings;
  players: TriviaPlayerState[];
  round: number;
  questionIndex: number;
  activeCategory: TriviaCategory | null;
  currentQuestion: {
    id: string;
    question: string;
    options: [string, string, string, string];
    category: TriviaCategory;
    difficulty: TriviaDifficulty;
  } | null;
  phaseEndsAt: number | null;
  revealedCorrectIndex: 0 | 1 | 2 | 3 | null;
  lastQuestionResults: {
    playerId: string;
    pickedIndex: number | null;
    correct: boolean;
    pointsAwarded: number;
    speedRank: number | null;
  }[];
  lockedInCount: number;
  winnerId: string | null;
  lastAction: string;
  crowdConsensus?: {
    questionId: string;
    tally: Record<string, number>;
    total: number;
  } | null;
}

export interface TriviaPrivateState {
  optionOrder: [number, number, number, number] | null;
  hasLockedIn: boolean;
  lockedPick: number | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Logo Guesser (mirrors shared/src/games/logo/engine)
// ──────────────────────────────────────────────────────────────────────────

export type LogoInputMode = 'multiple_choice' | 'free_text';
export type LogoRegionFilter = 'naija' | 'global' | 'mixed';
export type LogoPhase =
  | 'lobby'
  | 'intro'
  | 'question'
  | 'options'
  | 'reveal'
  | 'leaderboard'
  | 'finished';

export interface LogoSettings {
  rounds: number;
  questionRevealMs: number;
  answerWindowMs: number;
  revealHoldMs: number;
  inputMode: LogoInputMode;
  regionFilter: LogoRegionFilter;
}

export const DEFAULT_LOGO_SETTINGS: LogoSettings = {
  rounds: 10,
  questionRevealMs: 2000,
  answerWindowMs: 20000,
  revealHoldMs: 4000,
  inputMode: 'multiple_choice',
  regionFilter: 'mixed',
};

export interface LogoPlayerState {
  id: string;
  displayName: string;
  color?: string;
  score: number;
  streak: number;
  correctCount: number;
  isBot?: boolean;
}

export interface LogoPublicQuestion {
  id: string;
  domain: string;
  options?: [string, string, string, string];
  difficulty: 'easy' | 'medium' | 'hard';
  region: 'naija' | 'africa' | 'global';
}

export interface LogoPlayerResult {
  playerId: string;
  guessText: string | null;
  pickedIndex: number | null;
  correct: boolean;
  matchKind: 'exact' | 'close' | 'wrong' | 'none';
  pointsAwarded: number;
  speedRank: number | null;
}

export interface LogoPublicState {
  phase: LogoPhase;
  settings: LogoSettings;
  players: LogoPlayerState[];
  round: number;
  currentQuestion: LogoPublicQuestion | null;
  phaseEndsAt: number | null;
  revealedAnswer: { name: string; domain: string } | null;
  lastQuestionResults: LogoPlayerResult[];
  lockedInCount: number;
  winnerId: string | null;
  lastAction: string;
}

export interface LogoPrivateState {
  optionOrder: [number, number, number, number] | null;
  hasLockedIn: boolean;
  lockedPick: number | null;
  lastGuess: string | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Oga Landlord (mirrors shared/src/games/landlord/engine)
// ──────────────────────────────────────────────────────────────────────────

export type LandlordPhase =
  | 'lobby'
  | 'rolling'
  | 'awaiting_buy'
  | 'auction'
  | 'card_drawn'
  | 'turn_end'
  | 'finished';

export interface LandlordPlayerState {
  id: string;
  displayName: string;
  color?: string;
  position: number;
  money: number;
  propertyIds: number[];
  jailed: boolean;
  jailTurnsLeft: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
  totalRolls: number;
  totalDoubles: number;
  isBot?: boolean;
}

export interface LandlordPropertyOwnership {
  id: number;
  ownerId: string | null;
  houses: number;
  mortgaged: boolean;
}

export interface LandlordCardEvent {
  deck: 'owambe' | 'community';
  card: { id: string; text: string; action: { kind: string; [k: string]: unknown } };
}

export interface LandlordSettings {
  maxPlayers: number;
  startingCash: number;
}

export const DEFAULT_LANDLORD_SETTINGS: LandlordSettings = {
  maxPlayers: 4,
  startingCash: 1500,
};

export interface LandlordAuctionState {
  propertyId: number;
  eligible: string[];
  currentBidderId: string;
  highBid: number;
  highBidderId: string | null;
  minBid: number;
}

export interface LandlordTradeOffer {
  id: string;
  fromId: string;
  toId: string;
  cashFromOfferer: number;
  offererPropertyIds: number[];
  targetPropertyIds: number[];
  offererJailCards: number;
  targetJailCards: number;
}

export interface LandlordPublicState {
  phase: LandlordPhase;
  players: LandlordPlayerState[];
  ownership: LandlordPropertyOwnership[];
  currentPlayerIndex: number;
  currentPlayerId: string;
  dice: [number, number] | null;
  diceTotal: number | null;
  rolledDoubles: boolean;
  consecutiveDoubles: number;
  pendingPurchasePropertyId: number | null;
  lastCard: LandlordCardEvent | null;
  auction: LandlordAuctionState | null;
  pendingTrade: LandlordTradeOffer | null;
  turnNumber: number;
  lastAction: string;
  winnerId: string | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Half & Half (mirrors shared/src/games/halfhalf/engine)
// ──────────────────────────────────────────────────────────────────────────

export type HalfHalfPhase =
  | 'lobby'
  | 'intro'
  | 'reveal_object'
  | 'lock_in'
  | 'reveal_truth'
  | 'leaderboard'
  | 'finished';

export interface HalfHalfPlayerState {
  id: string;
  displayName: string;
  color?: string;
  score: number;
  bullseyes: number;
  lastAccuracy?: number;
  isBot?: boolean;
}

export interface HalfHalfSettings {
  rounds: number;
  revealMs: number;
  lockInMs: number;
  truthHoldMs: number;
  closestBonus: number;
}

export const DEFAULT_HALFHALF_SETTINGS: HalfHalfSettings = {
  rounds: 8,
  revealMs: 1500,
  lockInMs: 12000,
  truthHoldMs: 5000,
  closestBonus: 200,
};

export interface HalfHalfPublicObject {
  id: string;
  name: string;
  shape: string;
  axis: 'horizontal' | 'vertical';
  category: string;
}

export interface HalfHalfPlayerGuess {
  playerId: string;
  position: number;
  lockedAtMs: number;
}

export interface HalfHalfPlayerResult {
  playerId: string;
  position: number | null;
  delta: number | null;
  pointsAwarded: number;
  closest: boolean;
}

export interface HalfHalfPublicState {
  phase: HalfHalfPhase;
  settings: HalfHalfSettings;
  players: HalfHalfPlayerState[];
  round: number;
  currentObject: HalfHalfPublicObject | null;
  phaseEndsAt: number | null;
  revealedTruth: number | null;
  lastRoundResults: HalfHalfPlayerResult[];
  lockedGuesses: HalfHalfPlayerGuess[];
  lockedInCount: number;
  winnerId: string | null;
  lastAction: string;
}

export interface HalfHalfPrivateState {
  lockedPosition: number | null;
  hasLockedIn: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Color Wahala (mirrors shared/src/games/colorwahala/engine)
// ──────────────────────────────────────────────────────────────────────────

export type ColorId = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export interface ColorEntry {
  id: ColorId;
  word: string;
  hsl: string;
  textHsl: string;
}

export const COLOR_PALETTE: readonly ColorEntry[] = [
  { id: 'red',    word: 'RED',    hsl: '0 85% 55%',   textHsl: '0 0% 100%' },
  { id: 'blue',   word: 'BLUE',   hsl: '220 90% 55%', textHsl: '0 0% 100%' },
  { id: 'green',  word: 'GREEN',  hsl: '140 70% 42%', textHsl: '0 0% 100%' },
  { id: 'yellow', word: 'YELLOW', hsl: '48 95% 55%',  textHsl: '0 0% 10%'  },
  { id: 'purple', word: 'PURPLE', hsl: '280 70% 55%', textHsl: '0 0% 100%' },
  { id: 'orange', word: 'ORANGE', hsl: '24 95% 55%',  textHsl: '0 0% 10%'  },
] as const;

export type ColorWahalaMode = 'say_word' | 'say_color' | 'say_heard';

export type ColorWahalaPhase =
  | 'lobby'
  | 'intro'
  | 'prompt'
  | 'answer'
  | 'reveal'
  | 'finished';

export interface ColorWahalaSettings {
  rounds: number;
  startLockMs: number;
  endLockMs: number;
  revealHoldMs: number;
  modeMix: { say_word: number; say_color: number; say_heard: number };
  firstCorrectBonus: number;
  audioEnabled: boolean;
}

export const DEFAULT_COLORWAHALA_SETTINGS: ColorWahalaSettings = {
  rounds: 15,
  startLockMs: 6000,
  endLockMs: 2500,
  revealHoldMs: 2500,
  modeMix: { say_word: 0.6, say_color: 0.25, say_heard: 0.15 },
  firstCorrectBonus: 250,
  audioEnabled: false,
};

export interface ColorWahalaPlayerState {
  id: string;
  displayName: string;
  color?: string;
  score: number;
  correctCount: number;
  bestStreak: number;
  currentStreak: number;
  totalLatencyMs: number;
  isBot?: boolean;
}

export interface ColorWahalaPlayerResult {
  playerId: string;
  pickedColor: ColorId | null;
  correct: boolean;
  pointsAwarded: number;
  latencyMs: number | null;
  speedRank: number | null;
  lockedOut: boolean;
}

export interface ColorWahalaPublicState {
  phase: ColorWahalaPhase;
  settings: ColorWahalaSettings;
  players: ColorWahalaPlayerState[];
  round: number;
  currentPrompt: {
    mode: ColorWahalaMode;
    word: ColorId;
    ink: ColorId;
    heard: ColorId | null;
    lockMs: number;
  } | null;
  phaseEndsAt: number | null;
  revealedAnswer: ColorId | null;
  lastRoundResults: ColorWahalaPlayerResult[];
  wrongCount: number;
  winnerId: string | null;
  lastAction: string;
}

export interface ColorWahalaPrivateState {
  hasTapped: boolean;
  tappedColor: ColorId | null;
  lockedOut: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Hustle (mirrors shared/src/games/hustle/engine)
// ──────────────────────────────────────────────────────────────────────────

export type HustleCardId = 'connection' | 'side_hustle' | 'owambe_invite';

export interface HustleCardInstance {
  instanceId: string;
  cardId: HustleCardId;
}

export interface HustleCardDef {
  id: HustleCardId;
  name: string;
  caption: string;
  description: string;
  needsTarget: boolean;
  timing: 'own_turn' | 'reactive';
}

export const HUSTLE_CARDS: Record<HustleCardId, HustleCardDef> = {
  connection: {
    id: 'connection',
    name: 'Connection',
    caption: 'pulled strings to dodge the next setback.',
    description: 'Skip your next snake automatically. One-shot.',
    needsTarget: false,
    timing: 'reactive',
  },
  side_hustle: {
    id: 'side_hustle',
    name: 'Side hustle',
    caption: 'cashed in a side hustle for a re-roll.',
    description: 'Re-roll the dice on your turn. Take the better result.',
    needsTarget: false,
    timing: 'own_turn',
  },
  owambe_invite: {
    id: 'owambe_invite',
    name: 'Owambe invite',
    caption: 'sent an Owambe invite — somebody is on the dance floor.',
    description: 'Force a chosen player to skip their next turn.',
    needsTarget: true,
    timing: 'reactive',
  },
};

export type HustleGlyph =
  | 'nysc-lagos'
  | 'dollar-uncle'
  | 'visa-stamp'
  | 'viral-music'
  | 'pos-business'
  | 'right-marriage'
  | 'nepa-light'
  | 'yahoo-scam'
  | 'aunty-stay'
  | 'mmm-crash'
  | 'naira-devalue'
  | 'bounced-cheque';

export interface HustleEvent {
  from: number;
  to: number;
  caption: string;
  glyph: HustleGlyph;
}

export type HustlePhase =
  | 'lobby'
  | 'intro'
  | 'rolling'
  | 'moving'
  | 'resolving'
  | 'cardPrompt'
  | 'japaPrompt'
  | 'finished';

export type JapaExit = 'uk' | 'canada' | 'us';

export interface HustleSettings {
  startingCards: number;
  cardEveryNSquares: number;
  resolveHoldMs: number;
  movePerSquareMs: number;
  collisionPushback: number;
  startingMoney: number;
  japaEndgame: boolean;
}

export const DEFAULT_HUSTLE_SETTINGS: HustleSettings = {
  startingCards: 2,
  cardEveryNSquares: 5,
  resolveHoldMs: 2400,
  movePerSquareMs: 110,
  collisionPushback: 5,
  startingMoney: 100,
  japaEndgame: true,
};

export interface HustlePlayerState {
  id: string;
  displayName: string;
  color?: string;
  position: number;
  squaresAdvanced: number;
  money: number;
  documents: number;
  hand: HustleCardInstance[];
  skipsNextTurn: boolean;
  hasSnakeShield: boolean;
  bribeGoBonus: boolean;
  cardDripProgress: number;
  isBot?: boolean;
}

export interface HustleLastBanner {
  headline: string;
  detail: string;
  event?: HustleEvent | null;
  kind: 'roll' | 'move' | 'ladder' | 'snake' | 'collision' | 'card' | 'win' | 'skip' | 'shield' | 'market' | 'japa';
  actorId?: string | null;
  targetId?: string | null;
}

export interface HustlePublicState {
  phase: HustlePhase;
  settings: HustleSettings;
  players: HustlePlayerState[];
  currentPlayerIndex: number;
  lastDie: number | null;
  phaseEndsAt: number | null;
  lastBanner: HustleLastBanner | null;
  lastAction: string;
  winnerId: string | null;
  winnerExit: JapaExit | null;
  turnNumber: number;
  pendingJapaExit: JapaExit | null;
}

export const HUSTLE_BOARD_SIZE = 60;
export const HUSTLE_WIN_SQUARE = HUSTLE_BOARD_SIZE;

// ──────────────────────────────────────────────────────────────────────────
// Word Wahala (mirrors shared/src/games/wordwahala/engine)
// ──────────────────────────────────────────────────────────────────────────

export type WordWahalaPhase = 'lobby' | 'playing' | 'finished';
export type WordWahalaDictionaryTier = 'standard' | 'pidgin' | 'slang' | 'indigenous';
export type WordWahalaBoardBonus = 'none' | 'dl' | 'tl' | 'dw' | 'tw' | 'star';

export interface WordWahalaSettings {
  maxConsecutivePasses: number;
  mode: 'standard' | 'pidgin_only' | 'yarn_battle';
  turnTimerSec: number;
}

export interface WordWahalaPlayerState {
  id: string;
  displayName: string;
  color?: string;
  score: number;
  rackSize: number;
}

export interface WordWahalaBoardTile {
  letter: string;
  wildAs?: string | null;
  placedBy: string;
}

export type WordWahalaBoardCell = WordWahalaBoardTile | null;

export interface WordWahalaPlacementIntent {
  row: number;
  col: number;
  letter: string;
  wildAs?: string;
}

export interface WordWahalaScoredWord {
  word: string;
  tier: WordWahalaDictionaryTier;
  baseLetterScore: number;
  multiplier: number;
  flatBonus: number;
  finalScore: number;
}

export interface WordWahalaLastBanner {
  kind: 'play' | 'pass' | 'swap' | 'reject' | 'win' | 'timeout';
  actorId: string;
  headline: string;
  detail: string;
  scoredWords?: WordWahalaScoredWord[];
}

export interface WordWahalaPublicState {
  phase: WordWahalaPhase;
  settings: WordWahalaSettings;
  players: WordWahalaPlayerState[];
  currentPlayerIndex: number;
  board: WordWahalaBoardCell[][];
  bagSize: number;
  consecutivePasses: number;
  turnNumber: number;
  lastBanner: WordWahalaLastBanner | null;
  lastAction: string;
  winnerId: string | null;
  bonusMap: WordWahalaBoardBonus[][];
  turnEndsAt: number | null;
}

export interface WordWahalaPrivateState {
  seatId: string;
  rack: string[];
}

export type Intent =
  | { type: 'roll_dice' }
  | { type: 'move_token'; tokenId: number; dieChoice?: DieChoice }
  | { type: 'toggle_ready' }
  | { type: 'send_reaction'; emoji: string; clientNonce?: string }
  | { type: 'request_state' }
  | { type: 'player:set_visibility'; hidden: boolean }
  | { type: 'player:pause_request' }
  | { type: 'player:leave_request' }
  | { type: 'controller:transfer_start' }
  | { type: 'controller:transfer_accept'; transferCode: string }
  | { type: 'host:start_game' }
  | { type: 'host:play_again' }
  | { type: 'host:pause_game' }
  | { type: 'host:resume_game' }
  | { type: 'host:end_game'; reason?: string }
  | { type: 'host:kick'; playerId: string }
  | { type: 'host:approve_join'; requestId: string; mode: 'spectator' | 'transfer' | 'spawn'; targetSeatId?: string }
  | { type: 'host:reject_join'; requestId: string }
  | { type: 'host:add_bot'; difficulty: 'easy' | 'smart' }
  | { type: 'host:remove_bot'; botId: string }
  | { type: 'host:replace_bot_with_human'; botId: string; humanDeviceId: string }
  | { type: 'host:autofill_bots'; targetCount: number; difficulty: 'easy' | 'smart' }
  | { type: 'host:set_room_policy'; policy: RoomPolicy }
  | { type: 'host:set_reaction_policy'; policy: Partial<ReactionPolicy> }
  | { type: 'host:set_taunt_policy'; policy: Partial<TauntPolicy> }
  | { type: 'host:clear_reactions' }
  | { type: 'host:set_ai_status'; status: AIStatus }
  | { type: 'host:set_ai_assistance'; enabled: boolean }
  | { type: 'host:set_game_settings'; settings: Partial<RoomSettings> }
  | { type: 'host:broadcast_commentary'; line: string }
  | {
      type: 'host:broadcast_recap';
      recap: { headline: string; paragraph: string; mvp: string };
    }
  | { type: 'host:set_game_type'; gameType: GameType }
  | { type: 'whot:draw_card' }
  | { type: 'whot:play_card'; cardId: string; calledShape?: WhotShape }
  | { type: 'whot:call_suit'; shape: WhotShape }
  | { type: 'whot:announce_last_card' }
  | { type: 'whot:announce_semi_last_card' }
  | { type: 'whot:check_up'; targetSeatId: string }
  | { type: 'host:set_trivia_settings'; settings: Partial<TriviaSettings> }
  | { type: 'trivia:lock_answer'; pickedIndex: 0 | 1 | 2 | 3 }
  | { type: 'connect4:drop'; column: number }
  | { type: 'ettt:place'; row: number; col: number }
  | { type: 'crowd:vote_trivia'; pickedIndex: 0 | 1 | 2 | 3 }
  | { type: 'host:set_logo_settings'; settings: Partial<LogoSettings> }
  | { type: 'logo:lock_pick'; pickedIndex: 0 | 1 | 2 | 3 }
  | { type: 'logo:lock_text'; guess: string }
  | { type: 'host:set_landlord_settings'; settings: Partial<LandlordSettings> }
  | { type: 'landlord:roll' }
  | { type: 'landlord:buy' }
  | { type: 'landlord:decline' }
  | { type: 'landlord:ack_card' }
  | { type: 'landlord:pay_jail_fine' }
  | { type: 'landlord:use_jail_card' }
  | { type: 'landlord:end_turn' }
  | { type: 'landlord:build'; propertyId: number }
  | { type: 'landlord:sell_house'; propertyId: number }
  | { type: 'landlord:mortgage'; propertyId: number }
  | { type: 'landlord:unmortgage'; propertyId: number }
  | { type: 'landlord:bid'; amount: number }
  | { type: 'landlord:bid_pass' }
  | {
      type: 'landlord:propose_trade';
      toId: string;
      cashFromOfferer: number;
      offererPropertyIds: number[];
      targetPropertyIds: number[];
      offererJailCards: number;
      targetJailCards: number;
    }
  | { type: 'landlord:cancel_trade' }
  | { type: 'landlord:respond_trade'; accept: boolean }
  | { type: 'host:set_halfhalf_settings'; settings: Partial<HalfHalfSettings> }
  | { type: 'halfhalf:lock_guess'; position: number }
  | { type: 'host:set_colorwahala_settings'; settings: Partial<ColorWahalaSettings> }
  | { type: 'colorwahala:tap'; colorId: string; clientTs: number }
  | { type: 'host:set_hustle_settings'; settings: Partial<HustleSettings> }
  | { type: 'hustle:roll' }
  | { type: 'hustle:play_card'; instanceId: string; targetPlayerId?: string | null }
  | { type: 'hustle:claim_japa' }
  | { type: 'hustle:decline_japa' }
  | { type: 'host:set_wordwahala_settings'; settings: Partial<WordWahalaSettings> }
  | { type: 'wordwahala:play'; placements: WordWahalaPlacementIntent[] }
  | { type: 'wordwahala:pass' }
  | { type: 'wordwahala:swap'; letters: string[] };

export type ServerEvent =
  | { type: 'public_state'; state: PublicRoomState }
  | { type: 'private_state'; state: PrivateSeatState }
  | { type: 'kicked'; reason?: string }
  | { type: 'ai_commentary'; line: string; timestamp: number }
  | { type: 'ai_recap'; recap: { headline: string; paragraph: string; mvp: string }; timestamp: number }
  | { type: 'reaction_accepted'; emoji: string; timestamp: number; clientNonce?: string }
  | { type: 'reaction_rejected'; reason: ReactionRejectReason; emoji: string; clientNonce?: string; retryAfterMs?: number }
  | { type: 'error'; code: string; message: string };
