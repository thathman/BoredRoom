// Rules adapter — Nigerian 2-dice Ludo. Mirrors src/game/ludoEngine.ts.
// Server is authoritative; this module is shared by /server.

import {
  LudoState,
  LudoPlayer,
  PlayerColor,
  Token,
  DieChoice,
} from '../contracts';

const START_POSITIONS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const HOME_ENTRY: Record<PlayerColor, number> = {
  red: 50,
  green: 11,
  yellow: 24,
  blue: 37,
};

export function createInitialLudoState(
  seats: { id: string; displayName: string; isBot?: boolean; botDifficulty?: 'easy' | 'smart' }[],
): LudoState {
  const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  return {
    players: seats.map((p, i) => ({
      id: p.id,
      color: colors[i],
      displayName: p.displayName,
      tokens: Array.from({ length: 4 }, (_, j) => ({
        id: j,
        position: -1,
        color: colors[i],
      })),
      finishedTokens: 0,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
    })),
    currentPlayerIndex: 0,
    dice: null,
    diceRemaining: [],
    diceValue: null,
    diceRolled: false,
    phase: 'rolling',
    winner: null,
    consecutiveSixes: 0,
    consecutiveDoubleSixes: 0,
    lastAction: 'Game started!',
    turnNumber: 1,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Geometry / blockade helpers
// ──────────────────────────────────────────────────────────────────────────

function blockadesAgainst(state: LudoState, movingColor: PlayerColor): Set<number> {
  const set = new Set<number>();
  for (const p of state.players) {
    if (p.color === movingColor) continue;
    const counts = new Map<number, number>();
    for (const t of p.tokens) {
      if (t.position < 0 || t.position > 51) continue;
      if (SAFE_ZONES.includes(t.position)) continue;
      counts.set(t.position, (counts.get(t.position) ?? 0) + 1);
    }
    for (const [pos, count] of counts) if (count >= 2) set.add(pos);
  }
  return set;
}

function advanceFromBoard(color: PlayerColor, fromPos: number, steps: number): number | null {
  const homeEntry = HOME_ENTRY[color];
  let stepsToHome = (homeEntry - fromPos + 52) % 52;
  if (stepsToHome === 0) stepsToHome = 52;
  if (steps > stepsToHome) {
    const extra = steps - stepsToHome;
    if (extra > 6) return null;
    return 51 + extra;
  } else if (steps === stepsToHome) {
    return 52;
  }
  return (fromPos + steps) % 52;
}

function computeDestination(state: LudoState, player: LudoPlayer, token: Token, steps: number): number | null {
  if (token.position === 58) return null;
  if (token.position === -1) {
    if (steps !== 6) return null;
    return START_POSITIONS[player.color];
  }
  if (token.position >= 52) {
    const dest = token.position + steps;
    return dest <= 58 ? dest : null;
  }
  return advanceFromBoard(player.color, token.position, steps);
}

function isBlocked(
  state: LudoState,
  player: LudoPlayer,
  token: Token,
  steps: number,
  dest: number,
): boolean {
  if (steps === 6) return false;
  if (token.position === -1) return false;
  if (token.position >= 52) return false;
  const blockades = blockadesAgainst(state, player.color);
  if (blockades.size === 0) return false;
  let cur = token.position;
  let remaining = steps;
  while (remaining > 0) {
    cur = (cur + 1) % 52;
    remaining--;
    if (dest >= 52 && remaining === 0) break;
    if (blockades.has(cur)) return true;
  }
  return false;
}

export function getMovableTokensFor(state: LudoState, player: LudoPlayer, steps: number): number[] {
  return player.tokens
    .filter((t) => {
      const dest = computeDestination(state, player, t, steps);
      if (dest == null) return false;
      if (isBlocked(state, player, t, steps, dest)) return false;
      return true;
    })
    .map((t) => t.id);
}

function getMovableTokensForChoice(
  state: LudoState,
  player: LudoPlayer,
  steps: number,
  choice: DieChoice,
): number[] {
  return getMovableTokensFor(state, player, steps).filter((tokenId) => {
    const token = player.tokens[tokenId];
    return !(choice === 'sum' && token.position === -1);
  });
}

// Backwards-compat (no opponents considered).
export function getMovableTokens(player: LudoPlayer, diceValue: number): number[] {
  const fakeState: LudoState = {
    players: [player],
    currentPlayerIndex: 0,
    dice: null,
    diceRemaining: [],
    diceValue,
    diceRolled: true,
    phase: 'moving',
    winner: null,
    consecutiveSixes: 0,
    consecutiveDoubleSixes: 0,
    lastAction: '',
    turnNumber: 0,
  };
  return getMovableTokensFor(fakeState, player, diceValue);
}

// ──────────────────────────────────────────────────────────────────────────
// RNG + apply functions
// ──────────────────────────────────────────────────────────────────────────

export type DiceRng = () => number;
const defaultRng: DiceRng = () => Math.floor(Math.random() * 6) + 1;

export interface MoveResult {
  state: LudoState;
  ok: boolean;
  reason?: string;
}

export function applyRollDice(state: LudoState, rng: DiceRng = defaultRng): MoveResult {
  if (state.phase !== 'rolling' || state.diceRolled) {
    return { state, ok: false, reason: 'not_in_rolling_phase' };
  }
  const d1 = rng();
  const d2 = rng();
  const next = applyRollWithValues(state, [d1, d2]);
  return { state: next, ok: true };
}

export function applyRollWithValues(state: LudoState, dice: [number, number]): LudoState {
  const [d1, d2] = dice;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isDoubleSix = d1 === 6 && d2 === 6;

  const next: LudoState = {
    ...state,
    dice: [d1, d2],
    diceRemaining: [d1, d2],
    diceValue: d1 + d2,
    diceRolled: true,
    consecutiveDoubleSixes: isDoubleSix ? state.consecutiveDoubleSixes + 1 : 0,
    lastAction: `${currentPlayer.displayName} rolled ${d1} + ${d2}`,
  };

  if (isDoubleSix && next.consecutiveDoubleSixes >= 3) {
    next.lastAction += ' (3 double-sixes — turn forfeited!)';
    return advanceTurn(next, false, true);
  }

  const choicesToTry: { choice: DieChoice; value: number }[] = [
    { choice: 'd1', value: d1 },
    { choice: 'd2', value: d2 },
    { choice: 'sum', value: d1 + d2 },
  ];
  const anyMovable = choicesToTry.some(({ choice, value }) =>
    getMovableTokensForChoice(next, currentPlayer, value, choice).length > 0,
  );
  if (!anyMovable) {
    next.lastAction += ' — no valid move';
    const sixRolled = d1 === 6 || d2 === 6;
    return advanceTurn(next, sixRolled, !sixRolled);
  }

  next.phase = 'moving';
  return next;
}

export function applyMoveToken(
  state: LudoState,
  tokenId: number,
  dieChoice?: DieChoice,
): MoveResult {
  if (state.phase !== 'moving' || !state.dice) {
    return { state, ok: false, reason: 'not_in_moving_phase' };
  }

  const [d1, d2] = state.dice;
  const currentPlayer = state.players[state.currentPlayerIndex];

  let choice: DieChoice;
  let steps: number;
  if (dieChoice) {
    choice = dieChoice;
    if (choice === 'd1') steps = d1;
    else if (choice === 'd2') steps = d2;
    else steps = d1 + d2;
  } else {
    const tryOrder: { c: DieChoice; v: number }[] = [
      { c: 'd1', v: d1 },
      { c: 'd2', v: d2 },
      { c: 'sum', v: d1 + d2 },
    ];
    const found = tryOrder.find(({ v, c }) => {
      if (c === 'sum') return state.diceRemaining.length === 2;
      return state.diceRemaining.includes(v);
    });
    if (!found) return { state, ok: false, reason: 'no_die_available' };
    choice = found.c;
    steps = found.v;
  }

  if (choice === 'sum') {
    if (state.diceRemaining.length !== 2) return { state, ok: false, reason: 'sum_unavailable' };
  } else if (!state.diceRemaining.includes(steps)) {
    return { state, ok: false, reason: 'die_consumed' };
  }

  const movable = getMovableTokensForChoice(state, currentPlayer, steps, choice);
  if (!movable.includes(tokenId)) {
    return { state, ok: false, reason: 'illegal_move' };
  }

  const next = JSON.parse(JSON.stringify(state)) as LudoState;
  const player = next.players[next.currentPlayerIndex];
  const token = player.tokens[tokenId];
  const dest = computeDestination(next, player, token, steps);
  if (dest == null) return { state, ok: false, reason: 'illegal_move' };
  token.position = dest;

  if (dest >= 0 && dest < 52 && !SAFE_ZONES.includes(dest)) {
    for (const otherPlayer of next.players) {
      if (otherPlayer.id === player.id) continue;
      const oppOnSquare = otherPlayer.tokens.filter((t) => t.position === dest);
      if (oppOnSquare.length === 1) {
        oppOnSquare[0].position = -1;
        next.lastAction = `${player.displayName} captured ${otherPlayer.displayName}'s token!`;
      }
    }
  }

  if (dest === 58) {
    player.finishedTokens++;
    if (!next.lastAction.includes('captured')) {
      next.lastAction = `${player.displayName} got a token home!`;
    }
  }

  if (player.finishedTokens === 4) {
    next.phase = 'finished';
    next.winner = player.id;
    next.lastAction = `🎉 ${player.displayName} wins!`;
    return { state: next, ok: true };
  }

  if (choice === 'sum') {
    next.diceRemaining = [];
  } else {
    const idx = next.diceRemaining.indexOf(steps);
    if (idx !== -1) next.diceRemaining.splice(idx, 1);
  }

  if (next.diceRemaining.length > 0) {
    const stillMovable = next.diceRemaining.some(
      (v) => getMovableTokensFor(next, player, v).length > 0,
    );
    if (stillMovable) {
      next.phase = 'moving';
      return { state: next, ok: true };
    }
  }

  const sixRolled = d1 === 6 || d2 === 6;
  return { state: advanceTurn(next, sixRolled, false), ok: true };
}

function advanceTurn(state: LudoState, rolledSix: boolean, forceNext: boolean): LudoState {
  const next = { ...state };
  if (forceNext) {
    next.consecutiveDoubleSixes = 0;
    next.currentPlayerIndex = (next.currentPlayerIndex + 1) % next.players.length;
    next.turnNumber++;
  } else if (rolledSix) {
    // Same player rolls again. Keep consecutiveDoubleSixes.
  } else {
    next.consecutiveDoubleSixes = 0;
    next.currentPlayerIndex = (next.currentPlayerIndex + 1) % next.players.length;
    next.turnNumber++;
  }
  next.phase = 'rolling';
  next.diceRolled = false;
  next.dice = null;
  next.diceRemaining = [];
  next.diceValue = null;
  return next;
}

// ──────────────────────────────────────────────────────────────────────────
// Bot policy — picks both a token and a dieChoice.
// ──────────────────────────────────────────────────────────────────────────

export interface BotMove {
  tokenId: number;
  dieChoice: DieChoice;
}

export function pickBotMove(
  state: LudoState,
  difficulty: 'easy' | 'smart',
): BotMove | null {
  if (!state.dice) return null;
  const player = state.players[state.currentPlayerIndex];
  const [d1, d2] = state.dice;

  // Build candidate (tokenId, dieChoice, steps) list from currently available values.
  type Cand = { tokenId: number; choice: DieChoice; steps: number };
  const cands: Cand[] = [];
  const has = (v: number) => state.diceRemaining.includes(v);

  if (has(d1)) {
    for (const tid of getMovableTokensFor(state, player, d1)) cands.push({ tokenId: tid, choice: 'd1', steps: d1 });
  }
  if (d1 !== d2 ? has(d2) : state.diceRemaining.length === 2) {
    for (const tid of getMovableTokensFor(state, player, d2)) cands.push({ tokenId: tid, choice: 'd2', steps: d2 });
  }
  if (state.diceRemaining.length === 2) {
    for (const tid of getMovableTokensForChoice(state, player, d1 + d2, 'sum')) cands.push({ tokenId: tid, choice: 'sum', steps: d1 + d2 });
  }

  if (cands.length === 0) return null;
  if (difficulty === 'easy') {
    const c = cands[Math.floor(Math.random() * cands.length)];
    return { tokenId: c.tokenId, dieChoice: c.choice };
  }

  // Smart heuristic: capture > leave base on 6 > advance lead > home.
  let best = cands[0];
  let bestScore = -Infinity;
  for (const c of cands) {
    const token = player.tokens[c.tokenId];
    const dest = computeDestination(state, player, token, c.steps);
    if (dest == null) continue;
    let score = 0;

    if (dest >= 0 && dest < 52 && !SAFE_ZONES.includes(dest)) {
      for (const op of state.players) {
        if (op.id === player.id) continue;
        const onSquare = op.tokens.filter((t) => t.position === dest);
        if (onSquare.length === 1) score += 50;
      }
    }
    if (token.position === -1 && c.steps === 6) score += 20;
    if (token.position >= 0) score += token.position * 0.1;
    if (dest >= 52) score += 10;
    if (dest === 58) score += 30;
    // Prefer using single dice over sum (keeps options open).
    if (c.choice !== 'sum') score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return { tokenId: best.tokenId, dieChoice: best.choice };
}

export const LudoGameDefinition = {
  name: 'boredroom-ludo',
  setup: (ctx: { numPlayers: number; seats?: Parameters<typeof createInitialLudoState>[0] }) =>
    createInitialLudoState(
      ctx.seats ?? Array.from({ length: ctx.numPlayers }, (_, i) => ({
        id: `seat-${i}`,
        displayName: `Player ${i + 1}`,
      })),
    ),
  moves: {
    rollDice: (G: LudoState) => applyRollDice(G).state,
    moveToken: (G: LudoState, _ctx: unknown, tokenId: number, dieChoice?: DieChoice) =>
      applyMoveToken(G, tokenId, dieChoice).state,
  },
  endIf: (G: LudoState) => (G.phase === 'finished' ? { winner: G.winner } : undefined),
} as const;
