import {
  createInitialMarketPriceState,
  resolveRound as resolveMarketRound,
  startRound as startMarketRound,
  submitGuess as submitMarketGuess,
  type MarketPriceItem,
  type MarketPriceState,
} from '../../shared/src/games/marketprice/engine.js';
import {
  createInitialPidginState,
  resolveRound as resolvePidginRound,
  startRound as startPidginRound,
  submitAnswer as submitPidginAnswer,
  type PidginPrompt,
  type PidginState,
} from '../../shared/src/games/pidgintranslator/engine.js';
import {
  createInitialFaithFeudState,
  endRound as endFeudRound,
  roundOver as feudRoundOver,
  startRound as startFeudRound,
  submitGuess as submitFeudGuess,
  type FaithFeudState,
  type FeudQuestion,
} from '../../shared/src/games/faithfeud/engine.js';
import {
  createInitialBibleTimelineState,
  resolveRound as resolveTimelineRound,
  startRound as startTimelineRound,
  submitOrder as submitTimelineOrder,
  type BibleTimelineState,
  type TimelineEvent,
} from '../../shared/src/games/bibletimeline/engine.js';
import type {
  GameRuntime,
  GameRuntimeContext,
  GameRuntimeMetadata,
  GameRuntimePlayer,
} from '../../shared/src/contracts/gameRuntime.js';

export const NATIVE_GAME_TYPES = [
  'market-price',
  'pidgin-translator',
  'faith-feud',
  'bible-timeline',
] as const;

export type NativeGameType = (typeof NATIVE_GAME_TYPES)[number];

export interface NativePlayer {
  id: string;
  name: string;
}

export interface NativeGameRuntime extends GameRuntime {
  gameType: NativeGameType;
  isFinished(): boolean;
  winnerPlayerIds(): string[];
}

abstract class NativeRuntimeBase implements NativeGameRuntime {
  abstract gameType: NativeGameType;
  abstract publicState(): unknown;
  abstract privateState(playerId: string): unknown;
  abstract handleIntent(playerId: string, intent: Record<string, unknown>, isHost: boolean): boolean;
  abstract snapshot(): unknown;
  abstract restore(snapshot: unknown): void;
  abstract isFinished(): boolean;
  abstract winnerPlayerIds(): string[];

  get metadata(): GameRuntimeMetadata {
    return {
      gameType: this.gameType,
      capabilities: {
        playerCount: { min: 1, max: 12 },
        bots: false,
        audience: true,
        hints: false,
        voice: false,
        restore: true,
      },
    };
  }

  configure(_context: GameRuntimeContext): void {}
  seatPlayers(_players: GameRuntimePlayer[]): void {}
  start(): void {}
  companionState(): unknown { return this.publicState(); }
  crowdState(): unknown { return this.publicState(); }
  finish(): { winnerPlayerIds: string[] } { return { winnerPlayerIds: this.winnerPlayerIds() }; }
  dispose(): void {}
}

const MARKET_ITEMS: MarketPriceItem[] = [
  { id: 'rice', name: '50kg bag of rice', price: 78000, region: 'Lagos' },
  { id: 'oil', name: '5L vegetable oil', price: 14500, region: 'Abuja' },
  { id: 'yam', name: 'A tuber of yam', price: 4200, region: 'Enugu' },
];

const PIDGIN_PROMPTS: PidginPrompt[] = [
  {
    id: 'p1',
    source: 'How are you?',
    direction: 'en_to_pcm',
    options: ['How you dey?', 'Wetin be dat?', 'No wahala'],
    answerIndex: 0,
  },
  {
    id: 'p2',
    source: 'I am coming',
    direction: 'en_to_pcm',
    options: ['I don reach', 'I dey come', 'I no sabi'],
    answerIndex: 1,
  },
  {
    id: 'p3',
    source: 'No wahala',
    direction: 'pcm_to_en',
    options: ['No problem', 'Be careful', 'Go away'],
    answerIndex: 0,
  },
];

const FEUD_QUESTIONS: FeudQuestion[] = [
  {
    id: 'f1',
    prompt: 'Name a fruit of the Spirit',
    answers: [
      { text: 'Love', points: 40 },
      { text: 'Joy', points: 30 },
      { text: 'Peace', points: 20 },
      { text: 'Patience', points: 10, aliases: ['longsuffering'] },
    ],
  },
  {
    id: 'f2',
    prompt: 'Name something people bring to church',
    answers: [
      { text: 'Bible', points: 45 },
      { text: 'Offering', points: 30, aliases: ['money'] },
      { text: 'Notebook', points: 15 },
      { text: 'Water', points: 10 },
    ],
  },
];

const TIMELINE_DEALS: TimelineEvent[][] = [
  [
    { id: 'creation', label: 'Creation', order: -4000 },
    { id: 'flood', label: 'Noah and the flood', order: -2500 },
    { id: 'exodus', label: 'The Exodus', order: -1446 },
    { id: 'cross', label: 'The Crucifixion', order: 30 },
  ],
  [
    { id: 'david', label: 'David becomes king', order: -1010 },
    { id: 'temple', label: 'Solomon builds the temple', order: -966 },
    { id: 'exile', label: 'Babylonian exile', order: -586 },
    { id: 'pentecost', label: 'Pentecost', order: 30.5 },
  ],
];

class MarketRuntime extends NativeRuntimeBase {
  gameType = 'market-price' as const;
  private state: MarketPriceState;
  private itemIndex = 0;

  constructor(players: NativePlayer[]) {
    super();
    this.state = createInitialMarketPriceState(players, {
      rounds: MARKET_ITEMS.length,
      maxPoints: 1000,
      zeroAtError: 1,
      exactBonus: 250,
    });
    this.state = startMarketRound(this.state, MARKET_ITEMS[0]);
  }

  publicState() {
    const state = structuredClone(this.state);
    if (state.phase === 'guessing' && state.currentItem) state.currentItem.price = 0;
    return state;
  }

  privateState(playerId: string) {
    return { submitted: playerId in this.state.guesses, guess: this.state.guesses[playerId] };
  }
  snapshot() { return structuredClone({ state: this.state, itemIndex: this.itemIndex }); }
  restore(snapshot: unknown) {
    const value = snapshot as { state: MarketPriceState; itemIndex: number };
    this.state = structuredClone(value.state);
    this.itemIndex = value.itemIndex;
  }

  handleIntent(playerId: string, intent: Record<string, unknown>, isHost: boolean): boolean {
    if (intent.type === 'guess') {
      const amount = Number(intent.amount);
      const next = submitMarketGuess(this.state, playerId, amount);
      const changed = next !== this.state;
      this.state = next;
      return changed;
    }
    if (intent.type === 'advance' && isHost) {
      if (this.state.phase === 'guessing') this.state = resolveMarketRound(this.state);
      else if (this.state.phase === 'scoring') {
        this.itemIndex += 1;
        this.state = startMarketRound(this.state, MARKET_ITEMS[this.itemIndex]);
      }
      return true;
    }
    return false;
  }

  isFinished() { return this.state.phase === 'finished'; }
  winnerPlayerIds() {
    const top = Math.max(...this.state.players.map((p) => p.score));
    return this.state.players.filter((p) => p.score === top).map((p) => p.id);
  }
}

class PidginRuntime extends NativeRuntimeBase {
  gameType = 'pidgin-translator' as const;
  private state: PidginState;
  private promptIndex = 0;

  constructor(players: NativePlayer[]) {
    super();
    this.state = createInitialPidginState(players, {
      rounds: PIDGIN_PROMPTS.length,
      basePoints: 100,
      firstBonus: 50,
    });
    this.state = startPidginRound(this.state, PIDGIN_PROMPTS[0]);
  }

  publicState() {
    const state = structuredClone(this.state);
    if (state.currentPrompt) state.currentPrompt.answerIndex = state.phase === 'answer' ? -1 : state.currentPrompt.answerIndex;
    return state;
  }

  privateState(playerId: string) {
    return { submitted: playerId in this.state.answers, answer: this.state.answers[playerId] };
  }
  snapshot() { return structuredClone({ state: this.state, promptIndex: this.promptIndex }); }
  restore(snapshot: unknown) {
    const value = snapshot as { state: PidginState; promptIndex: number };
    this.state = structuredClone(value.state);
    this.promptIndex = value.promptIndex;
  }

  handleIntent(playerId: string, intent: Record<string, unknown>, isHost: boolean): boolean {
    if (intent.type === 'answer') {
      const next = submitPidginAnswer(this.state, playerId, Number(intent.optionIndex));
      const changed = next !== this.state;
      this.state = next;
      return changed;
    }
    if (intent.type === 'advance' && isHost) {
      if (this.state.phase === 'answer') this.state = resolvePidginRound(this.state);
      else if (this.state.phase === 'reveal') {
        this.promptIndex += 1;
        this.state = startPidginRound(this.state, PIDGIN_PROMPTS[this.promptIndex]);
      }
      return true;
    }
    return false;
  }

  isFinished() { return this.state.phase === 'finished'; }
  winnerPlayerIds() {
    const top = Math.max(...this.state.players.map((p) => p.score));
    return this.state.players.filter((p) => p.score === top).map((p) => p.id);
  }
}

class FeudRuntime extends NativeRuntimeBase {
  gameType = 'faith-feud' as const;
  private state: FaithFeudState;
  private questionIndex = 0;

  constructor(players: NativePlayer[]) {
    super();
    this.state = createInitialFaithFeudState(
      [{ id: 'house', name: players.map((p) => p.name).join(' & ') || 'The House' }],
      { rounds: FEUD_QUESTIONS.length, maxStrikes: 3 },
    );
    this.state = startFeudRound(this.state, FEUD_QUESTIONS[0]);
  }

  publicState() {
    const state = structuredClone(this.state);
    if (state.currentQuestion) {
      state.currentQuestion.answers = state.currentQuestion.answers.map((answer, index) => (
        state.revealed.includes(index)
          ? answer
          : { ...answer, text: '', aliases: undefined }
      ));
    }
    return state;
  }
  privateState() { return {}; }
  snapshot() { return structuredClone({ state: this.state, questionIndex: this.questionIndex }); }
  restore(snapshot: unknown) {
    const value = snapshot as { state: FaithFeudState; questionIndex: number };
    this.state = structuredClone(value.state);
    this.questionIndex = value.questionIndex;
  }

  handleIntent(_playerId: string, intent: Record<string, unknown>, isHost: boolean): boolean {
    if (intent.type === 'guess' && typeof intent.guess === 'string') {
      this.state = submitFeudGuess(this.state, intent.guess);
      return true;
    }
    if (intent.type === 'advance' && isHost) {
      if (!feudRoundOver(this.state)) return false;
      this.state = endFeudRound(this.state, 'house');
      if (this.state.phase === 'reveal') {
        this.questionIndex += 1;
        this.state = startFeudRound(this.state, FEUD_QUESTIONS[this.questionIndex]);
      }
      return true;
    }
    return false;
  }

  isFinished() { return this.state.phase === 'finished'; }
  winnerPlayerIds() { return []; }
}

class TimelineRuntime extends NativeRuntimeBase {
  gameType = 'bible-timeline' as const;
  private state: BibleTimelineState;
  private dealIndex = 0;

  constructor(players: NativePlayer[]) {
    super();
    this.state = createInitialBibleTimelineState(players, {
      rounds: TIMELINE_DEALS.length,
      pointsPerPair: 100,
      perfectBonus: 200,
    });
    this.state = startTimelineRound(this.state, TIMELINE_DEALS[0]);
  }

  publicState() {
    const state = structuredClone(this.state);
    if (state.phase === 'arranging') {
      state.deal = state.deal.map((event) => ({ ...event, order: 0 }));
    }
    return state;
  }
  privateState(playerId: string) {
    return { submitted: playerId in this.state.submissions, order: this.state.submissions[playerId] };
  }
  snapshot() { return structuredClone({ state: this.state, dealIndex: this.dealIndex }); }
  restore(snapshot: unknown) {
    const value = snapshot as { state: BibleTimelineState; dealIndex: number };
    this.state = structuredClone(value.state);
    this.dealIndex = value.dealIndex;
  }

  handleIntent(playerId: string, intent: Record<string, unknown>, isHost: boolean): boolean {
    if (intent.type === 'submit_order' && Array.isArray(intent.orderedIds)) {
      const orderedIds = intent.orderedIds.filter((id): id is string => typeof id === 'string');
      const next = submitTimelineOrder(this.state, playerId, orderedIds);
      const changed = next !== this.state;
      this.state = next;
      return changed;
    }
    if (intent.type === 'advance' && isHost) {
      if (this.state.phase === 'arranging') this.state = resolveTimelineRound(this.state);
      else if (this.state.phase === 'reveal') {
        this.dealIndex += 1;
        this.state = startTimelineRound(this.state, TIMELINE_DEALS[this.dealIndex]);
      }
      return true;
    }
    return false;
  }

  isFinished() { return this.state.phase === 'finished'; }
  winnerPlayerIds() {
    const top = Math.max(...this.state.players.map((p) => p.score));
    return this.state.players.filter((p) => p.score === top).map((p) => p.id);
  }
}

export function isNativeGameType(gameType: string): gameType is NativeGameType {
  return (NATIVE_GAME_TYPES as readonly string[]).includes(gameType);
}

export function createNativeGameRuntime(
  gameType: NativeGameType,
  players: NativePlayer[],
): NativeGameRuntime {
  if (gameType === 'market-price') return new MarketRuntime(players);
  if (gameType === 'pidgin-translator') return new PidginRuntime(players);
  if (gameType === 'faith-feud') return new FeudRuntime(players);
  return new TimelineRuntime(players);
}
