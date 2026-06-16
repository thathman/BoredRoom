// Ludo game engine — Nigerian (Naija) variant with 2 dice.
// Server-authoritative logic. Mirrored in shared/src/rules/index.ts.
//
// Rules summary:
//  - Each turn rolls two independent dice [d1, d2].
//  - Player can move ONE token using d1+d2 (sum), OR move two different tokens
//    one with d1 and another with d2.
//  - A 6 (on either die) is required to bring a token out of base; consumes that 6.
//  - Double 6 → may bring out two tokens (one per 6), but sum cannot leave base.
//  - A 6 on either die grants the player another full turn after consuming both dice.
//  - Three consecutive double-sixes → forfeit turn (penalty).
//  - Blockades: two same-color tokens on a non-safe main-board square block opponents
//    from landing/passing unless the moving die value is a 6 (pass-with-six).
//  - Exact roll required to land a token in the home center (position 58).

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type DieChoice = 'd1' | 'd2' | 'sum';

export interface Token {
  id: number; // 0-3
  position: number; // -1 = base, 0-51 = board, 52-57 = home stretch, 58 = home
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
  /** Two-dice roll for the current turn. null before rolling. */
  dice: [number, number] | null;
  /** Values still consumable this roll (subset of [d1, d2]). */
  diceRemaining: number[];
  /** Legacy mirror: sum of dice (or last single value) for back-compat readers. */
  diceValue: number | null;
  diceRolled: boolean;
  phase: 'rolling' | 'moving' | 'finished';
  winner: string | null;
  /** Legacy single-six counter; kept at 0 in 2-dice mode. */
  consecutiveSixes: number;
  /** New: consecutive double-sixes by current player. 3 → forfeit. */
  consecutiveDoubleSixes: number;
  lastAction: string;
  turnNumber: number;
}

// Starting positions for each color on the main board
const START_POSITIONS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Safe zone positions on the main board
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

// Home stretch entry points
const HOME_ENTRY: Record<PlayerColor, number> = {
  red: 50,
  green: 11,
  yellow: 24,
  blue: 37,
};

export function createInitialState(players: { id: string; displayName: string }[]): LudoState {
  const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

  return {
    players: players.map((p, i) => ({
      id: p.id,
      color: colors[i],
      displayName: p.displayName,
      tokens: Array.from({ length: 4 }, (_, j) => ({
        id: j,
        position: -1,
        color: colors[i],
      })),
      finishedTokens: 0,
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
// Blockade detection
// ──────────────────────────────────────────────────────────────────────────

/** Squares (main-board pos 0-51) where the given player has formed a blockade. */
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

/**
 * Compute destination position for a token moving `steps` squares.
 * Returns null if the move is illegal (overshoots home, or blocked).
 */
function computeDestination(
  state: LudoState,
  player: LudoPlayer,
  token: Token,
  steps: number,
): number | null {
  if (token.position === 58) return null; // already home
  if (token.position === -1) {
    // Need an individual die showing 6 to leave base. The caller prevents
    // using a summed value from base, even if that sum equals 6.
    if (steps !== 6) return null;
    return START_POSITIONS[player.color];
  }
  if (token.position >= 52) {
    // Home stretch — exact roll only, no blockades possible here.
    const dest = token.position + steps;
    return dest <= 58 ? dest : null;
  }
  return advanceFromBoard(player.color, token.position, steps);
}

function advanceFromBoard(color: PlayerColor, fromPos: number, steps: number): number | null {
  const homeEntry = HOME_ENTRY[color];
  let stepsToHome = (homeEntry - fromPos + 52) % 52;
  if (stepsToHome === 0) stepsToHome = 52;

  if (steps > stepsToHome) {
    const extra = steps - stepsToHome;
    if (extra > 6) return null; // overshoot home
    return 51 + extra;
  } else if (steps === stepsToHome) {
    return 52;
  }
  return (fromPos + steps) % 52;
}

/**
 * Check if a move is blocked by an opponent blockade along the path.
 * Pass-with-six rule: a single 6 may pass/land on a blockade square.
 */
function isBlocked(
  state: LudoState,
  player: LudoPlayer,
  token: Token,
  steps: number,
  dest: number,
): boolean {
  if (steps === 6) return false; // pass-with-six
  if (token.position === -1) return false; // emerging onto start (start is safe)
  if (token.position >= 52) return false; // home stretch — no opponents

  const blockades = blockadesAgainst(state, player.color);
  if (blockades.size === 0) return false;

  // Walk every square from current+1 to dest along the main path.
  let cur = token.position;
  let remaining = steps;
  while (remaining > 0) {
    cur = (cur + 1) % 52;
    remaining--;
    // If we've left the main board into home stretch, stop checking.
    if (cur === HOME_ENTRY[player.color] && remaining < 0) break;
    if (dest >= 52 && remaining === 0) break; // last step lands in stretch
    if (blockades.has(cur)) return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────────
// Public helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Return token ids movable with the given step count, considering blockades.
 * Does NOT consider whether the value is currently in diceRemaining — caller
 * must filter on that for sum/d1/d2 specifically.
 */
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

export function getMovableTokensForChoice(
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

/**
 * Backwards-compat: the old getMovableTokens(player, diceValue) API.
 * Builds a dummy state with no opponents — only base/home-stretch rules apply.
 * Prefer getMovableTokensFor for full rule checking.
 */
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

/** All available step values for the current player given diceRemaining. */
export function availableStepValues(state: LudoState): { value: number; choice: DieChoice }[] {
  if (!state.dice) return [];
  const [d1, d2] = state.dice;
  const out: { value: number; choice: DieChoice }[] = [];
  if (state.diceRemaining.includes(d1)) out.push({ value: d1, choice: 'd1' });
  // If both dice are identical, only emit d2 once it differs from d1 by index;
  // we treat them as distinct slots — diceRemaining holds two copies.
  if (state.diceRemaining.length === 2 || (state.diceRemaining.includes(d2) && d1 !== d2)) {
    out.push({ value: d2, choice: 'd2' });
  }
  if (state.diceRemaining.length === 2) {
    out.push({ value: d1 + d2, choice: 'sum' });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Engine actions
// ──────────────────────────────────────────────────────────────────────────

export function rollDice(state: LudoState): LudoState {
  if (state.phase !== 'rolling' || state.diceRolled) return state;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return applyRoll(state, [d1, d2]);
}

/** Internal: deterministic roll with given values (used by tests too). */
export function applyRoll(state: LudoState, dice: [number, number]): LudoState {
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

  // Triple double-6 → forfeit turn (penalty).
  if (isDoubleSix && next.consecutiveDoubleSixes >= 3) {
    next.lastAction += ' (3 double-sixes — turn forfeited!)';
    return advanceTurn(next, /*sameAgain*/ false, /*forceNext*/ true);
  }

  // Determine if any move is legal with any of {d1, d2, d1+d2}.
  // Sum is allowed on board tokens, but cannot bring a token out of base.
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
    return advanceTurn(next, sixRolled, /*forceNext*/ !sixRolled);
  }

  next.phase = 'moving';
  return next;
}

export function moveToken(state: LudoState, tokenId: number, dieChoice?: DieChoice): LudoState {
  if (state.phase !== 'moving' || !state.dice) return state;

  const [d1, d2] = state.dice;
  const currentPlayer = state.players[state.currentPlayerIndex];

  // Resolve dieChoice → step value. Default: first legal individual die.
  let choice: DieChoice;
  let steps: number;
  if (dieChoice) {
    choice = dieChoice;
    if (choice === 'd1') steps = d1;
    else if (choice === 'd2') steps = d2;
    else steps = d1 + d2;
  } else {
    // Pick first die value that legally moves this token.
    const tryOrder: { c: DieChoice; v: number }[] = [
      { c: 'd1', v: d1 },
      { c: 'd2', v: d2 },
      { c: 'sum', v: d1 + d2 },
    ];
    const found = tryOrder.find(({ v, c }) => {
      if (c === 'sum') return state.diceRemaining.length === 2;
      const idx = state.diceRemaining.indexOf(v);
      return idx !== -1;
    });
    if (!found) return state;
    choice = found.c;
    steps = found.v;
  }

  // Validate diceRemaining
  if (choice === 'sum') {
    if (state.diceRemaining.length !== 2) return state;
  } else {
    if (!state.diceRemaining.includes(steps)) return state;
  }

  // Validate token is movable with this step count.
  const movable = getMovableTokensForChoice(state, currentPlayer, steps, choice);
  if (!movable.includes(tokenId)) return state;

  const next = JSON.parse(JSON.stringify(state)) as LudoState;
  const player = next.players[next.currentPlayerIndex];
  const token = player.tokens[tokenId];
  const dest = computeDestination(next, player, token, steps);
  if (dest == null) return state;
  token.position = dest;

  // Capture (only on main board, not on safe zones, and not on own blockade).
  if (dest >= 0 && dest < 52 && !SAFE_ZONES.includes(dest)) {
    for (const otherPlayer of next.players) {
      if (otherPlayer.id === player.id) continue;
      // If opponent has a blockade on dest, capture is impossible (we already
      // gated via isBlocked, except for pass-with-six which also can't capture
      // a stacked pair). So only capture single tokens.
      const oppOnSquare = otherPlayer.tokens.filter((t) => t.position === dest);
      if (oppOnSquare.length === 1) {
        oppOnSquare[0].position = -1;
        next.lastAction = `${player.displayName} captured ${otherPlayer.displayName}'s token!`;
      }
    }
  }

  // Token reached home
  if (dest === 58) {
    player.finishedTokens++;
    if (!next.lastAction.includes('captured')) {
      next.lastAction = `${player.displayName} got a token home!`;
    }
  }

  // Win check
  if (player.finishedTokens === 4) {
    next.phase = 'finished';
    next.winner = player.id;
    next.lastAction = `🎉 ${player.displayName} wins!`;
    return next;
  }

  // Consume dice values
  if (choice === 'sum') {
    next.diceRemaining = [];
  } else {
    const idx = next.diceRemaining.indexOf(steps);
    if (idx !== -1) next.diceRemaining.splice(idx, 1);
  }

  // If dice remaining and any legal move exists with them, stay in moving phase.
  if (next.diceRemaining.length > 0) {
    const stillMovable = next.diceRemaining.some(
      (v) => getMovableTokensFor(next, player, v).length > 0,
    );
    if (stillMovable) {
      next.phase = 'moving';
      return next;
    }
  }

  // Turn ends. If either original die was a 6 → same player rolls again.
  const sixRolled = d1 === 6 || d2 === 6;
  return advanceTurn(next, sixRolled, /*forceNext*/ false);
}

function advanceTurn(state: LudoState, rolledSix: boolean, forceNext: boolean): LudoState {
  const next = { ...state };

  if (forceNext) {
    next.consecutiveDoubleSixes = 0;
    next.currentPlayerIndex = (next.currentPlayerIndex + 1) % next.players.length;
    next.turnNumber++;
  } else if (rolledSix) {
    // Same player rolls again. consecutiveDoubleSixes already updated by applyRoll.
    // Don't reset it here — only the new roll resets if it's not a double-6.
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
// Board rendering helpers (unchanged)
// ──────────────────────────────────────────────────────────────────────────

export function getBoardPosition(color: PlayerColor, position: number): { x: number; y: number } {
  if (position === -1) return getBasePosition(color);
  if (position === 58) return getHomePosition(color);
  if (position >= 52) return getHomeStretchPosition(color, position - 52);
  return getMainBoardPosition(position);
}

function getBasePosition(color: PlayerColor): { x: number; y: number } {
  const bases: Record<PlayerColor, { x: number; y: number }> = {
    red: { x: 2, y: 2 },
    green: { x: 11, y: 2 },
    yellow: { x: 11, y: 11 },
    blue: { x: 2, y: 11 },
  };
  return bases[color];
}

function getHomePosition(_color: PlayerColor): { x: number; y: number } {
  return { x: 7, y: 7 };
}

const MAIN_PATH: { x: number; y: number }[] = [
  { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
  { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 },
  { x: 7, y: 0 }, { x: 8, y: 0 },
  { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
  { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
  { x: 14, y: 7 }, { x: 14, y: 8 },
  { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
  { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 },
  { x: 7, y: 14 }, { x: 6, y: 14 },
  { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
  { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
  { x: 0, y: 7 }, { x: 0, y: 6 },
];

function getMainBoardPosition(position: number): { x: number; y: number } {
  return MAIN_PATH[position] || { x: 7, y: 7 };
}

function getHomeStretchPosition(color: PlayerColor, step: number): { x: number; y: number } {
  const stretches: Record<PlayerColor, { x: number; y: number }[]> = {
    red: [
      { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 },
    ],
    green: [
      { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 },
    ],
    yellow: [
      { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 },
    ],
    blue: [
      { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 },
    ],
  };
  return stretches[color][step] || { x: 7, y: 7 };
}

export { SAFE_ZONES, START_POSITIONS, MAIN_PATH };
