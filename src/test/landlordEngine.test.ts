import { describe, it, expect } from 'vitest';
import {
  createInitialLandlordState,
  startLandlord,
  rollAndMove,
  endTurn,
  buyProperty,
  declinePurchase,
  passAuctionBid,
  acknowledgeCard,
  createDecks,
  type LandlordPublicState,
} from '../../shared/src/games/landlord/engine';
import {
  LANDLORD_PROPERTIES,
  propertyAt,
  LANDLORD_GO_BONUS,
  LANDLORD_STARTING_CASH,
} from '../../shared/src/games/landlord/properties';

const players = [
  { id: 'p1', displayName: 'Ada', color: 'red' },
  { id: 'p2', displayName: 'Bola', color: 'green' },
];

function rngFor(values: number[]) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

describe('Landlord engine — Pass A2 (port of Monopoly-Game)', () => {
  it('initializes players at GO with starting cash', () => {
    const s = createInitialLandlordState(players);
    expect(s.phase).toBe('lobby');
    expect(s.players.every((p) => p.position === 0)).toBe(true);
    expect(s.players.every((p) => p.money === LANDLORD_STARTING_CASH)).toBe(true);
    expect(s.currentPlayerId).toBe('p1');
    expect(s.ownership.length).toBe(LANDLORD_PROPERTIES.length);
  });

  it('startLandlord transitions to rolling', () => {
    const s = startLandlord(createInitialLandlordState(players));
    expect(s.phase).toBe('rolling');
  });

  it('non-double roll moves and ends turn', () => {
    let s = startLandlord(createInitialLandlordState(players));
    // d1=1 (rng=0.16→1), d2=4 (rng=0.5→4). Total 5 → land on tile 5 (Iddo Terminal, railroad).
    // Lands on unowned purchasable → awaiting_buy (does NOT advance turn yet).
    s = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.16, 0.5])).state;
    expect(s.players[0].position).toBe(5);
    expect(s.phase).toBe('awaiting_buy');
    expect(s.pendingPurchasePropertyId).toBe(5);
    expect(s.currentPlayerId).toBe('p1');
  });

  it('decline + advance turn after non-double', () => {
    let s = startLandlord(createInitialLandlordState(players));
    s = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.16, 0.5])).state;
    s = declinePurchase(s);
    // Declining now opens an auction (Monopoly rules). Both players pass → no
    // sale, and on a non-double roll the turn ends.
    expect(s.phase).toBe('auction');
    while (s.phase === 'auction') s = passAuctionBid(s, s.auction!.currentBidderId);
    expect(s.phase).toBe('turn_end');
    s = endTurn(s);
    expect(s.currentPlayerId).toBe('p2');
  });

  it('buy deducts money and assigns ownership', () => {
    let s = startLandlord(createInitialLandlordState(players));
    s = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.16, 0.5])).state;
    expect(s.pendingPurchasePropertyId).toBe(5);
    const railroadPrice = propertyAt(5).price;
    s = buyProperty(s);
    expect(s.players[0].money).toBe(LANDLORD_STARTING_CASH - railroadPrice);
    expect(s.players[0].propertyIds).toContain(5);
    expect(s.ownership.find((o) => o.id === 5)?.ownerId).toBe('p1');
    expect(s.phase).toBe('turn_end');
  });

  it('rent: paying owner of a property', () => {
    let s = startLandlord(createInitialLandlordState(players));
    // Manually seat p2 owning Ojuelegba (pos 1, base rent 2).
    const tile = propertyAt(1);
    s.ownership.find((o) => o.id === 1)!.ownerId = 'p2';
    s.players.find((p) => p.id === 'p2')!.propertyIds.push(1);
    // Roll p1 to land on tile 1: d1=1 (rng 0.16→1) d2 needs 0; impossible (d2 min 1).
    // Use d1=1, d2 such that sum lands on 1: but minimum sum is 2. So position 0+2=2 lands community.
    // Force position to 39 then roll 2 → 39+2=41 % 40 = 1.
    s.players[0].position = 39;
    // d1=1 (rng=0.0→1) d2=1 (rng=0.0→1) → doubles. We want non-double so use d1=1 d2=2.
    // rng 0.0 → 1; rng 0.2 → floor(1.2)+1 = 2.
    s = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.0, 0.2])).state;
    expect(s.players[0].position).toBe(2); // 39 + 1 + 2 = 42 % 40 = 2 (community pot)
    // ah, rng 0.0 → floor(0)+1 = 1, rng 0.2 → floor(1.2)+1 = 2. Total 3 → landed on 2.
    // Test rent landing differently: p1 starts at 0, p2 owns tile 3 (Mushin).
    s = startLandlord(createInitialLandlordState(players));
    s.ownership.find((o) => o.id === 3)!.ownerId = 'p2';
    s.players.find((p) => p.id === 'p2')!.propertyIds.push(3);
    const startCash = s.players[0].money;
    const mushin = propertyAt(3);
    s = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.0, 0.2])).state;
    expect(s.players[0].position).toBe(3);
    expect(s.players[0].money).toBe(startCash - mushin.rent[0]);
    void tile;
  });

  it('passing GO grants ₦200', () => {
    let s = startLandlord(createInitialLandlordState(players));
    s.players[0].position = 38;
    const startCash = s.players[0].money;
    // Roll 2+4=6 (non-double). 38+6 = 44 % 40 = 4 (Income Tax).
    s = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.2, 0.6])).state;
    expect(s.players[0].position).toBe(4);
    // Tax tile takes ₦200, but GO bonus added ₦200. Net should still equal start - 200 + 200 = start - 200 + 200 = start.
    // Income tax is rent[0]=200 → -200; GO bonus +200; net = start.
    expect(s.players[0].money).toBe(startCash);
  });

  it('three doubles in a row sends to jail', () => {
    let s = startLandlord(createInitialLandlordState(players));
    // d1=d2=3 (rng=0.4→3): each roll lands on a buyable tile, so we decline and
    // clear the resulting auction. On a double, a finished auction returns to
    // 'rolling', keeping the doubles chain alive for the next roll.
    const decks = createDecks(rngFor([0.99]));
    const clearAuction = (st: LandlordPublicState) => {
      while (st.phase === 'auction') st = passAuctionBid(st, st.auction!.currentBidderId);
      return st;
    };
    s = rollAndMove(s, decks, rngFor([0.4, 0.4])).state;
    if (s.phase === 'awaiting_buy') s = clearAuction(declinePurchase(s));
    s = rollAndMove(s, decks, rngFor([0.4, 0.4])).state;
    if (s.phase === 'awaiting_buy') s = clearAuction(declinePurchase(s));
    const r = rollAndMove(s, decks, rngFor([0.4, 0.4]));
    expect(r.sentToJail).toBe(true);
    expect(r.state.players[0].position).toBe(10);
    expect(r.state.players[0].jailed).toBe(true);
    expect(r.state.currentPlayerId).toBe('p2');
  });

  it('landing on Go-To-Jail relocates', () => {
    const s = startLandlord(createInitialLandlordState(players));
    s.players[0].position = 24;
    // 2+4=6 non-double → 30 (go-to-jail)
    const r = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.2, 0.6]));
    expect(r.sentToJail).toBe(true);
    expect(r.state.players[0].position).toBe(10);
    expect(r.state.players[0].jailed).toBe(true);
    void s;
  });

  it('jailed player rolling non-doubles stays in jail', () => {
    const s = startLandlord(createInitialLandlordState(players));
    s.players[0].jailed = true;
    s.players[0].position = 10;
    const r = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.0, 0.2])); // 1+2=3, no double
    expect(r.state.players[0].jailed).toBe(true);
    expect(r.state.players[0].position).toBe(10);
    expect(r.state.currentPlayerId).toBe('p2');
    void LANDLORD_GO_BONUS;
  });

  it('jailed player rolling doubles breaks out and moves', () => {
    const s = startLandlord(createInitialLandlordState(players));
    s.players[0].jailed = true;
    s.players[0].position = 10;
    // 3+3=6 doubles. Lands on tile 16 (Ikeja, orange). Awaiting_buy.
    const r = rollAndMove(s, createDecks(rngFor([0.99])), rngFor([0.4, 0.4]));
    expect(r.state.players[0].jailed).toBe(false);
    expect(r.state.players[0].position).toBe(16);
  });

  it('community card "collect 200" credits the player', () => {
    const s = startLandlord(createInitialLandlordState(players));
    // Force a deterministic deck: top card collects ₦200.
    const decks = {
      owambe: [],
      community: [{ id: 'cp-2', text: 'Bank error in your favor.', action: { kind: 'collect' as const, amount: 200 } }],
    };
    // Roll p1 to land on tile 2 (community pot). Need total=2 from 0 → 1+1 doubles.
    // We'll pre-place to tile 1, then roll 1+? but min 2. Pre-place to tile 0, roll 1+1=2 doubles.
    const r = rollAndMove(s, decks, rngFor([0.0, 0.0]));
    expect(r.state.players[0].position).toBe(2);
    expect(r.state.phase).toBe('card_drawn');
    const startCash = LANDLORD_STARTING_CASH;
    const after = acknowledgeCard(r.state, decks);
    expect(after.players[0].money).toBe(startCash + 200);
  });
});

// ─── Pass C: houses + mortgage ─────────────────────────────────────────
import {
  buildHouse,
  sellHouse,
  mortgageProperty,
  unmortgageProperty,
} from '../../shared/src/games/landlord/engine';

describe('Landlord engine — Pass C (houses + mortgage)', () => {
  const players2 = [
    { id: 'p1', displayName: 'Ada' },
    { id: 'p2', displayName: 'Tunde' },
  ];

  function seedMonopoly(group: 'brown' = 'brown'): LandlordPublicState {
    const s = startLandlord(createInitialLandlordState(players2));
    const groupTiles = LANDLORD_PROPERTIES.filter((p) => p.group === group);
    for (const t of groupTiles) {
      const o = s.ownership.find((x) => x.id === t.id)!;
      o.ownerId = 'p1';
      s.players[0].propertyIds.push(t.id);
    }
    s.phase = 'turn_end';
    return s;
  }

  it('build a house requires owning the whole color group', () => {
    let s = startLandlord(createInitialLandlordState(players2));
    const t = LANDLORD_PROPERTIES.find((p) => p.group === 'brown')!;
    s.ownership.find((o) => o.id === t.id)!.ownerId = 'p1';
    s.players[0].propertyIds.push(t.id);
    s.phase = 'turn_end';
    const before = s.players[0].money;
    s = buildHouse(s, t.id);
    // Group not fully owned → no-op.
    expect(s.players[0].money).toBe(before);
    expect(s.ownership.find((o) => o.id === t.id)!.houses).toBe(0);
  });

  it('build/sell house transfers correct cash and updates count', () => {
    let s = seedMonopoly('brown');
    const t = LANDLORD_PROPERTIES.find((p) => p.group === 'brown')!; // housePrice 50
    const before = s.players[0].money;
    s = buildHouse(s, t.id);
    expect(s.ownership.find((o) => o.id === t.id)!.houses).toBe(1);
    expect(s.players[0].money).toBe(before - t.housePrice);
    s = sellHouse(s, t.id);
    expect(s.ownership.find((o) => o.id === t.id)!.houses).toBe(0);
    expect(s.players[0].money).toBe(before - t.housePrice + Math.floor(t.housePrice / 2));
  });

  it('even-build rule blocks 2 houses on one tile before others have 1', () => {
    let s = seedMonopoly('brown');
    const [a, b] = LANDLORD_PROPERTIES.filter((p) => p.group === 'brown');
    s = buildHouse(s, a.id);
    expect(s.ownership.find((o) => o.id === a.id)!.houses).toBe(1);
    s = buildHouse(s, a.id);
    // Should be a no-op: b has 0, a has 1, can't go to 2.
    expect(s.ownership.find((o) => o.id === a.id)!.houses).toBe(1);
    s = buildHouse(s, b.id);
    expect(s.ownership.find((o) => o.id === b.id)!.houses).toBe(1);
    s = buildHouse(s, a.id);
    expect(s.ownership.find((o) => o.id === a.id)!.houses).toBe(2);
  });

  it('mortgage credits half-price; unmortgage costs +10%', () => {
    let s = startLandlord(createInitialLandlordState(players2));
    const t = LANDLORD_PROPERTIES.find((p) => p.id === 5)!; // Iddo Terminal (railroad)
    s.ownership.find((o) => o.id === t.id)!.ownerId = 'p1';
    s.players[0].propertyIds.push(t.id);
    s.phase = 'turn_end';
    const before = s.players[0].money;
    s = mortgageProperty(s, t.id);
    expect(s.ownership.find((o) => o.id === t.id)!.mortgaged).toBe(true);
    expect(s.players[0].money).toBe(before + t.mortgageValue);
    s = unmortgageProperty(s, t.id);
    expect(s.ownership.find((o) => o.id === t.id)!.mortgaged).toBe(false);
    expect(s.players[0].money).toBe(before - Math.ceil(t.mortgageValue * 0.1));
  });

  it('cannot mortgage a property whose group has houses', () => {
    let s = seedMonopoly('brown');
    const [a, b] = LANDLORD_PROPERTIES.filter((p) => p.group === 'brown');
    s = buildHouse(s, a.id);
    s = mortgageProperty(s, b.id);
    expect(s.ownership.find((o) => o.id === b.id)!.mortgaged).toBe(false);
  });
});
