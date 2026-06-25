// Shared, transport-agnostic contracts between web client and game server.

// NOTE: We intentionally stay on protocol v2 even though reaction hardening
// added new fields/events. All additions are additive + backward-compatible
// (clients tolerate missing fields via `?? defaults`), so no version churn.
export const PROTOCOL_VERSION = 2;

// Session-aware platform schemas (HouseSession / GameRun / devices / votes).
export * from './session.js';

// Pack system schemas (PackManifest / PackTheme).
export * from './pack.js';

// Installable pack repo format + URL resolution.
export * from './packRepo.js';

// Game adapter contract (logic core).
export * from './adapter.js';
export * from './gameRuntime.js';
export * from './gamePlugin.js';

import type {
  Connect4PublicState as _Connect4PublicState,
} from '../games/connect4/engine.js';
type Connect4PublicState = _Connect4PublicState;
import type {
  EtttPublicState as _EtttPublicState,
} from '../games/ettt/engine.js';
type EtttPublicState = _EtttPublicState;
import type {
  LogoPublicState as _LogoPublicState,
  LogoPrivateState as _LogoPrivateState,
  LogoSettings as _LogoSettings,
} from '../games/logo/engine.js';
type LogoPublicState = _LogoPublicState;
type LogoPrivateState = _LogoPrivateState;
type LogoSettings = _LogoSettings;
import type {
  LandlordPublicState as _LandlordPublicState,
  LandlordSettings as _LandlordSettings,
} from '../games/landlord/engine.js';
type LandlordPublicState = _LandlordPublicState;
type LandlordSettings = _LandlordSettings;
import type {
  HalfHalfPublicState as _HalfHalfPublicState,
  HalfHalfPrivateState as _HalfHalfPrivateState,
  HalfHalfSettings as _HalfHalfSettings,
} from '../games/halfhalf/engine.js';
type HalfHalfPublicState = _HalfHalfPublicState;
type HalfHalfPrivateState = _HalfHalfPrivateState;
type HalfHalfSettings = _HalfHalfSettings;
import type {
  ColorWahalaPublicState as _ColorWahalaPublicState,
  ColorWahalaPrivateState as _ColorWahalaPrivateState,
  ColorWahalaSettings as _ColorWahalaSettings,
} from '../games/colorwahala/engine.js';
type ColorWahalaPublicState = _ColorWahalaPublicState;
type ColorWahalaPrivateState = _ColorWahalaPrivateState;
type ColorWahalaSettings = _ColorWahalaSettings;
import type {
  HustlePublicState as _HustlePublicState,
  HustleSettings as _HustleSettings,
} from '../games/hustle/engine.js';
type HustlePublicState = _HustlePublicState;
type HustleSettings = _HustleSettings;
import type {
  WordWahalaPublicState as _WordWahalaPublicState,
  WordWahalaPrivateState as _WordWahalaPrivateState,
  WordWahalaSettings as _WordWahalaSettings,
  PlacementIntent as _WordWahalaPlacementIntent,
} from '../games/wordwahala/engine.js';
type WordWahalaPublicState = _WordWahalaPublicState;
type WordWahalaPrivateState = _WordWahalaPrivateState;
type WordWahalaSettings = _WordWahalaSettings;
type WordWahalaPlacementIntent = _WordWahalaPlacementIntent;


// ──────────────────────────────────────────────────────────────────────────
// Game state (mirrors src/game/ludoEngine.ts — Nigerian 2-dice variant)
// ──────────────────────────────────────────────────────────────────────────

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
  /** Two-dice roll [d1, d2]. */
  dice: [number, number] | null;
  /** Values still consumable this roll. */
  diceRemaining: number[];
  /** Legacy: sum of dice (or null). */
  diceValue: number | null;
  diceRolled: boolean;
  phase: 'rolling' | 'moving' | 'finished';
  winner: string | null;
  consecutiveSixes: number;
  consecutiveDoubleSixes: number;
  lastAction: string;
  turnNumber: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Room / member state
// ──────────────────────────────────────────────────────────────────────────

export interface RoomMember {
  id: string;
  displayName: string;
  color: string;
  isReady: boolean;
  isHost: boolean;
  isBot?: boolean;
  isSpectator?: boolean;
  /**
   * Platform-wide role. Optional for backward compat; absence implies
   * 'host' when isHost is true, otherwise 'player'. 'crowd' = audience-mode
   * joiner who exceeds maxPlayers (reactions + Trivia consensus voting only).
   */
  role?: 'host' | 'player' | 'crowd';
}

// ──────────────────────────────────────────────────────────────────────────
// Canonical platform-wide game state machine.
// Every game room MUST project into this enum alongside its game-specific
// phase. UI rendering and analytics keys off canonicalPhase. Per-game
// detailed phases (e.g. Trivia 'options', Whot 'playing') remain authoritative
// for game logic — canonicalPhase is the cross-game lens.
// ──────────────────────────────────────────────────────────────────────────

export type CanonicalGamePhase =
  | 'lobby'
  | 'game_intro'
  | 'round_active'
  | 'round_resolution'
  | 'game_over';

/** Legal forward transitions. Backward jumps allowed only via lobby reset. */
export const CANONICAL_PHASE_TRANSITIONS: Record<CanonicalGamePhase, CanonicalGamePhase[]> = {
  lobby: ['game_intro', 'lobby'],
  game_intro: ['round_active', 'game_over', 'lobby'],
  round_active: ['round_resolution', 'game_over', 'lobby'],
  round_resolution: ['round_active', 'game_intro', 'game_over', 'lobby'],
  game_over: ['lobby'],
};

export function canTransitionCanonicalPhase(
  from: CanonicalGamePhase,
  to: CanonicalGamePhase,
): boolean {
  if (from === to) return true;
  return CANONICAL_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

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

/**
 * AI commentary persona. Cosmetic — picks a system-prompt flavor for the
 * `ai-commentary` edge function. Defaults to 'classic' for backward compat
 * (clients that don't know about personas get the original prompt).
 */
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
  /** Nigerian variant toggle: Pick Two reverses play direction before passing chain. */
  whotDirectionOnPickTwo?: boolean;
  /** Optional — defaults to 'classic' when missing for backward compat. */
  aiPersona?: AIPersona;
}

// ──────────────────────────────────────────────────────────────────────────
// Reactions (server-authoritative policy + bounded buffers)
// ──────────────────────────────────────────────────────────────────────────

export interface ReactionPolicy {
  /** Master switch. When false, all reaction intents are rejected as 'disabled'. */
  enabled: boolean;
  /** Per-user min gap between any two accepted reactions (ms). */
  cooldownMs: number;
  /** Max accepted reactions per user inside `burstWindowMs`. */
  burstMax: number;
  /** Sliding window for burst counting (ms). */
  burstWindowMs: number;
  /** Window in which the same user repeating the same emoji is suppressed (ms). */
  duplicateWindowMs: number;
  /** Max kept in `PublicRoomState.reactions` for replay. */
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
  /** Total accepted reactions in this room since lobby creation. */
  totalAccepted: number;
  /** Total rejected reactions, by reason. */
  rejected: {
    cooldown: number;
    rate_limited: number;
    disabled: number;
    duplicate: number;
  };
  /** Per-user counters for moderation visibility. Keyed by deviceId. */
  perUserAccepted: Record<string, number>;
}

export interface ReactionMoment {
  /** Stable id; `${emoji}:${windowStart}`. */
  id: string;
  emoji: string;
  count: number;
  /** Inclusive window start (ms epoch). */
  windowStart: number;
  /** Inclusive window end (ms epoch). */
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
  /** Server-enforced reaction policy. */
  reactionPolicy: ReactionPolicy;
  /** Server-enforced taunt policy. */
  tauntPolicy: TauntPolicy;
  /** Live reaction analytics, useful for host diagnostics. */
  reactionStats: ReactionStats;
  /** Bounded list of recent "hype" moments (combo bursts crossing threshold). */
  reactionMoments: ReactionMoment[];
  pauseState?: PauseState;
  presenceBySeat?: Record<string, SeatPresence>;
  roomSettings?: RoomSettings;
  maxPlayers?: number;
  /**
   * Selected game type for this room. Defaults to 'ludo' for backward
   * compatibility with v2 clients that ignore this field.
   */
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
  /** Canonical cross-game phase. Optional for backward compat. */
  canonicalPhase?: CanonicalGamePhase;
}

export interface PrivateSeatState {
  seatId: string;
  hint?: { line: string; createdAt: number } | null;
  /** Whot private hand for this seat. Only present when gameType === 'whot'. */
  whotState?: WhotPrivateState | null;
  /** Trivia private state for this seat (shuffled options + lock-in flag). */
  triviaState?: TriviaPrivateState | null;
  /** Logo Guesser private state for this seat. */
  logoState?: LogoPrivateState | null;
  /** Half & Half private state for this seat. */
  halfHalfState?: HalfHalfPrivateState | null;
  /** Color Wahala private state for this seat. */
  colorWahalaState?: ColorWahalaPrivateState | null;
  /** Word Wahala private rack for this seat. */
  wordWahalaState?: WordWahalaPrivateState | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Whot (Nigerian) — scaffold contracts
// Authentic 54-card deck, hand counts public, individual hands private.
// Rule resolution beyond deal/turn-pointer is intentionally NOT in this pass.
// ──────────────────────────────────────────────────────────────────────────

export type GameType = 'ludo' | 'whot' | 'trivia' | 'connect-4' | 'ettt' | 'logo' | 'landlord' | 'half-half' | 'color-wahala' | 'hustle' | 'word-wahala';

// Re-exported from games/connect4/engine for client+server symmetry.
export type {
  Connect4Cell,
  Connect4Disc,
  Connect4Phase,
  Connect4Player,
  Connect4PublicState,
  Connect4Team,
  Connect4WinningCell,
} from '../games/connect4/engine.js';
export { TEAM_DISC } from '../games/connect4/engine.js';

// Re-exported from games/ettt/engine for client+server symmetry.
export type {
  EtttCell,
  EtttMark,
  EtttPhase,
  EtttPlayer,
  EtttPieceRef,
  EtttPublicState,
  EtttTeam,
} from '../games/ettt/engine.js';
export { TEAM_MARK } from '../games/ettt/engine.js';

// Re-exported from games/logo/engine for client+server symmetry.
export type {
  LogoInputMode,
  LogoPhase,
  LogoPlayerResult,
  LogoPlayerState,
  LogoPrivateState,
  LogoPublicQuestion,
  LogoPublicState,
  LogoRegionFilter,
  LogoSettings,
} from '../games/logo/engine.js';
export { DEFAULT_LOGO_SETTINGS } from '../games/logo/engine.js';

// Re-exported from games/landlord/engine for client+server symmetry.
export type {
  LandlordPhase,
  LandlordPlayerState,
  LandlordPropertyOwnership,
  LandlordCardEvent,
  LandlordPublicState,
  LandlordSettings,
  LandlordAuctionState,
  LandlordTradeOffer,
} from '../games/landlord/engine.js';
export { DEFAULT_LANDLORD_SETTINGS } from '../games/landlord/engine.js';
export {
  buildHouse as landlordBuildHouse,
  sellHouse as landlordSellHouse,
  mortgageProperty as landlordMortgage,
  unmortgageProperty as landlordUnmortgage,
  createDecks as landlordCreateDecks,
  startLandlord,
  createInitialLandlordState,
  rollAndMove as landlordRollAndMove,
  buyProperty as landlordBuy,
  declinePurchase as landlordDecline,
  acknowledgeCard as landlordAckCard,
  payJailFine as landlordPayJailFine,
  useJailCard as landlordUseJailCard,
  endTurn as landlordEndTurn,
  placeAuctionBid as landlordPlaceAuctionBid,
  passAuctionBid as landlordPassAuctionBid,
  proposeTrade as landlordProposeTrade,
  cancelTrade as landlordCancelTrade,
  respondToTrade as landlordRespondToTrade,
} from '../games/landlord/engine.js';
export type {
  LandlordPropertyDef,
  LandlordPropertyType,
  LandlordGroup,
} from '../games/landlord/properties.js';
export {
  LANDLORD_PROPERTIES,
  LANDLORD_BOARD_SIZE,
  LANDLORD_GO_BONUS,
  LANDLORD_JAIL_FINE,
  LANDLORD_JAIL_POSITION,
  LANDLORD_GOTO_JAIL_POSITION,
  LANDLORD_STARTING_CASH,
  propertyAt as landlordPropertyAt,
  propertyById as landlordPropertyById,
} from '../games/landlord/properties.js';
export type { LandlordCard, CardAction as LandlordCardAction, CardDeck as LandlordCardDeck } from '../games/landlord/cards.js';

// Re-exported from games/halfhalf/engine for client+server symmetry.
export type {
  HalfHalfAxis,
  HalfHalfCategory,
  HalfHalfObject,
  HalfHalfShape,
} from '../games/halfhalf/objects.js';
export { HALFHALF_OBJECTS, objectById as halfHalfObjectById } from '../games/halfhalf/objects.js';
export type {
  HalfHalfPhase,
  HalfHalfPlayerGuess,
  HalfHalfPlayerResult,
  HalfHalfPlayerState,
  HalfHalfPrivateState,
  HalfHalfPublicObject,
  HalfHalfPublicState,
  HalfHalfSettings,
} from '../games/halfhalf/engine.js';
export {
  DEFAULT_HALFHALF_SETTINGS,
  createInitialHalfHalfState,
  pickObjectsForMatch as halfHalfPickObjects,
  pointsForGuess as halfHalfPointsForGuess,
  resolveHalfHalfRound,
  sanitizePosition as halfHalfSanitizePosition,
  toPublicObject as halfHalfToPublicObject,
} from '../games/halfhalf/engine.js';

// Re-exported from games/colorwahala/engine for client+server symmetry.
export type {
  ColorWahalaMode,
  ColorWahalaPhase,
  ColorWahalaPlayerResult,
  ColorWahalaPlayerState,
  ColorWahalaPrivateState,
  ColorWahalaPrompt,
  ColorWahalaPublicState,
  ColorWahalaSettings,
  ColorWahalaTap,
} from '../games/colorwahala/engine.js';
export {
  DEFAULT_COLORWAHALA_SETTINGS,
  createInitialColorWahalaState,
  generatePrompt as colorWahalaGeneratePrompt,
  resolveColorWahalaRound,
  scoreTap as colorWahalaScoreTap,
} from '../games/colorwahala/engine.js';
export type { ColorEntry, ColorId } from '../games/colorwahala/palette.js';
export { COLOR_PALETTE, COLOR_IDS, colorById, isColorId } from '../games/colorwahala/palette.js';

// Re-exported from games/hustle/engine for client+server symmetry.
export type {
  HustleCardId,
  HustleCardInstance,
  HustleCardDef,
} from '../games/hustle/cards.js';
export { HUSTLE_CARDS, HUSTLE_CARD_POOL } from '../games/hustle/cards.js';
export type {
  HustleEvent,
  HustleGlyph,
} from '../games/hustle/board.js';
export {
  HUSTLE_BOARD_SIZE,
  HUSTLE_WIN_SQUARE,
  HUSTLE_LADDERS,
  HUSTLE_SNAKES,
  HUSTLE_EVENT_HEADS,
  HUSTLE_MARKETS,
  HUSTLE_MARKET_LOOKUP,
  HUSTLE_JAPA_EXITS,
} from '../games/hustle/board.js';
export type {
  HustleLastBanner,
  HustlePhase,
  HustlePlayerState,
  HustlePublicState,
  HustleSettings,
} from '../games/hustle/engine.js';
export {
  DEFAULT_HUSTLE_SETTINGS,
  JAPA_EXIT_REQUIREMENTS,
  createInitialHustleState,
  applyRoll as hustleApplyRoll,
  advanceTurn as hustleAdvanceTurn,
  playCard as hustlePlayCard,
  claimJapa as hustleClaimJapa,
  declineJapa as hustleDeclineJapa,
  makeInitialPlayer as hustleMakePlayer,
  rollDie as hustleRollDie,
} from '../games/hustle/engine.js';
export type { JapaExit } from '../games/hustle/engine.js';

// Re-exported from games/wordwahala for client+server symmetry.
export type {
  WordWahalaPhase,
  WordWahalaSettings,
  WordWahalaPlayerState,
  WordWahalaPrivateState,
  WordWahalaPublicState,
  WordWahalaLastBanner,
} from '../games/wordwahala/engine.js';
export type {
  PlacementIntent as WordWahalaPlacementIntent,
  ScoredWord as WordWahalaScoredWord,
  BoardCell as WordWahalaBoardCell,
  BoardTile as WordWahalaBoardTile,
} from '../games/wordwahala/engine.js';
export {
  DEFAULT_WORDWAHALA_SETTINGS,
  createInitialWordWahalaState,
  validateAndScore as wordWahalaValidateAndScore,
  applyPlay as wordWahalaApplyPlay,
  applyPass as wordWahalaApplyPass,
  advanceTurn as wordWahalaAdvanceTurn,
  finishGame as wordWahalaFinish,
  makeInitialPlayer as wordWahalaMakePlayer,
  shuffleBag as wordWahalaShuffleBag,
  drawTiles as wordWahalaDrawTiles,
} from '../games/wordwahala/engine.js';
export {
  TILE_DEFS as WORDWAHALA_TILE_DEFS,
  RACK_SIZE as WORDWAHALA_RACK_SIZE,
  BINGO_BONUS as WORDWAHALA_BINGO_BONUS,
  buildTileBag as wordWahalaBuildTileBag,
  tileDef as wordWahalaTileDef,
  tileBagSize as wordWahalaTileBagSize,
} from '../games/wordwahala/tiles.js';
export type { TileLetter as WordWahalaTileLetter, TileDef as WordWahalaTileDef } from '../games/wordwahala/tiles.js';
export {
  BOARD_SIZE as WORDWAHALA_BOARD_SIZE,
  CENTER as WORDWAHALA_CENTER,
  BOARD_BONUSES as WORDWAHALA_BOARD_BONUSES,
  BONUS_LABEL as WORDWAHALA_BONUS_LABEL,
  BONUS_SHORT as WORDWAHALA_BONUS_SHORT,
  bonusAt as wordWahalaBonusAt,
} from '../games/wordwahala/board.js';
export type { BoardBonus as WordWahalaBoardBonus } from '../games/wordwahala/board.js';
export {
  TIER_CONFIGS as WORDWAHALA_TIER_CONFIGS,
  lookupWord as wordWahalaLookupWord,
  tierConfig as wordWahalaTierConfig,
} from '../games/wordwahala/dictionary.js';
export type { DictionaryTier as WordWahalaDictionaryTier } from '../games/wordwahala/dictionary.js';
export type WhotShape = 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';

export interface WhotCard {
  /** Stable id, e.g. "circle-7" or "whot-20-a". */
  id: string;
  shape: WhotShape;
  /** Numeric face value. Whot wildcards are value 20. */
  value: number;
  /** True for the five Whot wildcards. */
  isWhot: boolean;
}

export interface WhotPlayerState {
  id: string;
  displayName: string;
  /** Optional visual identity copied from the room seat color. */
  color?: string;
  /** Public hand size; actual cards are private. */
  handCount: number;
  isBot?: boolean;
}

export type WhotPhase = 'playing' | 'finished';

export interface WhotPublicState {
  phase: WhotPhase;
  players: WhotPlayerState[];
  currentPlayerIndex: number;
  /** Whose seat must move next; mirrors players[currentPlayerIndex].id. */
  currentPlayerId: string;
  /** Top of the discard pile (face-up). Null only at the very first start. */
  topDiscard: WhotCard | null;
  /** Active suit/shape players must follow. Driven by topDiscard or by call_suit. */
  activeShape: WhotShape;
  /** Rotation direction. 1 = clockwise, -1 = anti-clockwise. */
  turnDirection?: 1 | -1;
  /** Cards remaining in the draw pile, surfaced for UI badges. */
  drawPileCount: number;
  /** Server-authoritative turn deadline epoch (ms). Optional for backward compat. */
  turnDeadlineAt?: number;
  /** Recommended turn window in ms (Nigerian table default: 10s). */
  turnTimeLimitMs?: number;
  turnNumber: number;
  winnerId: string | null;
  /** Last server-narrated action, mirrors LudoState.lastAction shape. */
  lastAction: string;
  /**
   * Pending pick-card penalty. When >0, the next non-countering player must
   * draw this many cards. Stackable only with the same rank ('2' or '3').
   */
  pendingDrawCount?: number;
  /** The rank that started the current pending draw chain ('2'|'3'|null). */
  pendingDrawRank?: '2' | '3' | null;
  /**
   * If true, the active player's last move was a Whot 20 and they must
   * follow up with `whot:call_suit`. While true, no other intent is accepted.
   */
  mustCallSuit?: boolean;
  /**
   * Seat ids that have announced "last card" (hand size dropped to 1 and
   * they explicitly checked up). Required to legally win on the next turn.
   */
  lastCardAnnounced?: string[];
  /** Seats that announced "semi-last card" at hand size 2. */
  semiLastCardAnnounced?: string[];
  /** Tournament scoring map (single-round games may ignore). */
  matchScoreBySeat?: Record<string, number>;
  /** Penalty-point elimination threshold, usually 100. */
  targetScore?: number;
  /** Current round number in match play. */
  roundIndex?: number;
  /**
   * House-rule continuation after same-turn penalty streaks. When set, the
   * active player has played one or more penalty cards and must either play a
   * non-penalty continue card or draw from market to end the streak.
   */
  penaltyContinuation?: {
    seatId: string;
    rank: '2' | '3' | '14';
    pendingCount: number;
  } | null;
}

export interface WhotPrivateState {
  /** This seat's hand. Only sent to the owning client. */
  hand: WhotCard[];
}

// ──────────────────────────────────────────────────────────────────────────
// Trivia (WWTBAM-style fastest-finger) — public + private contracts.
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

/** A question stored in the canonical bank. `correctIndex` indexes into the
 *  canonical `options` array — clients see a per-seat shuffled order via
 *  `optionOrder` in private state. Source URL kept for audit. */
export interface TriviaQuestion {
  id: string;
  category: TriviaCategory;
  difficulty: TriviaDifficulty;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Optional public-domain reference URL used during fact-checking. */
  source?: string;
}

export type TriviaPhase =
  | 'lobby'        // pre-game; shows host config
  | 'intro'        // round banner ("Round 2: Music")
  | 'question'     // question text shown, options hidden
  | 'options'      // options visible, controllers can lock in
  | 'reveal'       // correct answer + per-question scoreboard
  | 'leaderboard'  // end-of-round table
  | 'finished';    // winner spotlight

export interface TriviaPlayerState {
  id: string;
  displayName: string;
  color?: string;
  score: number;
  streak: number;
  /** Number of questions answered correctly across the whole match. */
  correctCount: number;
  isBot?: boolean;
}

export interface TriviaSettings {
  /** Total rounds in the match. */
  rounds: number;
  /** Questions per round. */
  questionsPerRound: number;
  /** ms between question-show and options-show. */
  questionRevealMs: number;
  /** ms players have to lock in once options are visible. */
  answerWindowMs: number;
  /** ms reveal pause before next question / round transition. */
  revealHoldMs: number;
  /** Topic mode: rotate categories per round, or pick one. */
  topicMode: 'rotate' | 'host_pick' | 'mixed';
  /** When topicMode === 'host_pick', the chosen categories per round. */
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
  /** 1-indexed for UI clarity. */
  round: number;
  /** 1-indexed within the current round. */
  questionIndex: number;
  /** Category active for this round. */
  activeCategory: TriviaCategory | null;
  /** Public-safe question payload — `correctIndex` is omitted until reveal. */
  currentQuestion: {
    id: string;
    question: string;
    /** Canonical option order — clients display per-seat shuffled order. */
    options: [string, string, string, string];
    category: TriviaCategory;
    difficulty: TriviaDifficulty;
  } | null;
  /** Server epoch ms when the current phase ends (for client countdowns). */
  phaseEndsAt: number | null;
  /** Revealed only during 'reveal' phase. */
  revealedCorrectIndex: 0 | 1 | 2 | 3 | null;
  /** Per-player results for the most recently revealed question. */
  lastQuestionResults: {
    playerId: string;
    pickedIndex: number | null;
    correct: boolean;
    pointsAwarded: number;
    /** Rank in fastest-finger order among correct answerers (1 = fastest). */
    speedRank: number | null;
  }[];
  /** Seats that have locked in for the current question (count only). */
  lockedInCount: number;
  winnerId: string | null;
  lastAction: string;
  /** Aggregated audience (crowd) votes for the current question.
   *  Cleared each new question. Tally indexes are CANONICAL option indexes. */
  crowdConsensus?: {
    questionId: string;
    tally: Record<string, number>; // '0'|'1'|'2'|'3' -> count
    total: number;
  } | null;
}

export interface TriviaPrivateState {
  /** Per-seat shuffled option order. Indexes into the canonical options array.
   *  Length 4. Sent ONLY to the owning seat to defeat screen-peeking. */
  optionOrder: [number, number, number, number] | null;
  /** Whether this seat has already locked in for the current question. */
  hasLockedIn: boolean;
  /** Index they picked (in shuffled order) once they lock in. */
  lockedPick: number | null;
}



// ──────────────────────────────────────────────────────────────────────────
// Client → Server intents
// ──────────────────────────────────────────────────────────────────────────

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
  // Host-relayed AI lines. Server fan-outs as ai_commentary / ai_recap events.
  // Additive, host-only; clients without these still work.
  | { type: 'host:broadcast_commentary'; line: string }
  | {
      type: 'host:broadcast_recap';
      recap: { headline: string; paragraph: string; mvp: string };
    }
  // Whot — additive, never removes existing intents.
  | { type: 'host:set_game_type'; gameType: GameType }
  | { type: 'whot:draw_card' }
  | { type: 'whot:play_card'; cardId: string; calledShape?: WhotShape }
  | { type: 'whot:call_suit'; shape: WhotShape }
  | { type: 'whot:announce_last_card' }
  | { type: 'whot:announce_semi_last_card' }
  | { type: 'whot:check_up'; targetSeatId: string }
  // Trivia — additive, never removes existing intents.
  | { type: 'host:set_trivia_settings'; settings: Partial<TriviaSettings> }
  | { type: 'trivia:lock_answer'; pickedIndex: 0 | 1 | 2 | 3 }
  // Connect 4 — additive.
  | { type: 'connect4:drop'; column: number }
  | { type: 'ettt:place'; row: number; col: number }
  // Logo Guesser — additive.
  | { type: 'host:set_logo_settings'; settings: Partial<LogoSettings> }
  | { type: 'logo:lock_pick'; pickedIndex: 0 | 1 | 2 | 3 }
  | { type: 'logo:lock_text'; guess: string }
  // Oga Landlord — additive.
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
  // Half & Half
  | { type: 'host:set_halfhalf_settings'; settings: Partial<HalfHalfSettings> }
  | { type: 'halfhalf:lock_guess'; position: number }
  // Color Wahala
  | { type: 'host:set_colorwahala_settings'; settings: Partial<ColorWahalaSettings> }
  | { type: 'colorwahala:tap'; colorId: string; clientTs: number }
  // Hustle (Naija snakes & ladders)
  | { type: 'host:set_hustle_settings'; settings: Partial<HustleSettings> }
  | { type: 'hustle:roll' }
  | { type: 'hustle:play_card'; instanceId: string; targetPlayerId?: string | null }
  | { type: 'hustle:claim_japa' }
  | { type: 'hustle:decline_japa' }
  // Word Wahala (layered Naija Scrabble)
  | { type: 'host:set_wordwahala_settings'; settings: Partial<WordWahalaSettings> }
  | { type: 'wordwahala:play'; placements: WordWahalaPlacementIntent[] }
  | { type: 'wordwahala:pass' }
  | { type: 'wordwahala:swap'; letters: string[] }
  // Crowd (audience) intents — only valid when issuer's role === 'crowd'.
  | { type: 'crowd:vote_trivia'; pickedIndex: 0 | 1 | 2 | 3 };

export type ServerEvent =
  | { type: 'public_state'; state: PublicRoomState }
  | { type: 'private_state'; state: PrivateSeatState }
  | { type: 'kicked'; reason?: string }
  | { type: 'ai_commentary'; line: string; timestamp: number }
  | { type: 'ai_recap'; recap: { headline: string; paragraph: string; mvp: string }; timestamp: number }
  | { type: 'reaction_accepted'; emoji: string; timestamp: number; clientNonce?: string }
  | { type: 'reaction_rejected'; reason: ReactionRejectReason; emoji: string; clientNonce?: string; retryAfterMs?: number }
  | { type: 'error'; code: string; message: string };

// ──────────────────────────────────────────────────────────────────────────
// Auth payloads
// ──────────────────────────────────────────────────────────────────────────

export interface JoinAuth {
  protocolVersion: number;
  deviceId: string;
  displayName: string;
  hostToken?: string;
  role: 'host' | 'player';
  /** Optional: requested gameType. Honored only on first room creation. */
  gameType?: GameType;
  /** Host display's local party id, used only for display-party history. */
  partyId?: string;
}

export interface RoomCreateRequest {
  hostDeviceId: string;
  hostDisplayName?: string;
  gameType?: GameType;
  partyId?: string;
}

export interface RoomCreateResponse {
  code: string;
  hostToken: string;
  gameType?: GameType;
}
