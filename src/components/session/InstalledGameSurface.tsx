import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Bot, Check, FastForward, MessageCircle, Trophy, Users, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sounds, vibrate } from '@/lib/sounds';
import { PidginVoiceSurface } from '@/components/session/PidginVoiceSurface';
import { WordWahalaSurface } from '@/components/session/WordWahalaSurface';
import { MoneyTriviaSurface } from '@/components/session/MoneyTriviaSurface';

type PlayerScore = { id: string; name: string; score: number };
type Challenge = { kind: 'choice' | 'number' | 'text' | 'order'; prompt: string; options?: string[] };
type WhotCard = { id?: string; label: string; shape?: string; number?: number; isWhot?: boolean };
type GameState = {
  gameType: string;
  name: string;
  emoji: string;
  mode?: string;
  phase: string;
  round?: number;
  totalRounds?: number;
  challenge?: Challenge | null;
  board?: Array<Array<string | null>>;
  tokens?: Record<string, number[]>;
  topCard?: WhotCard;
  requestedShape?: string | null;
  drawPileCount?: number;
  pendingPick?: number;
  pendingRoll?: number | null;
  currentPlayerId?: string;
  players: Array<PlayerScore & { disc?: string; mark?: string; handCount?: number; roundWins?: number; pipScore?: number }>;
  submittedCount?: number;
  lastResults?: Array<{ playerId: string; points: number }>;
  winnerPlayerIds: string[];
  lastAction: string;
  roundsToWin?: number;
  roundWins?: Record<string, number>;
  callout?: { kind: string; playerName: string; text: string; sequence: number } | null;
  turnDirection?: number;
  settings?: Record<string, unknown>;
};
type PrivateState = {
  seated?: boolean;
  submitted?: boolean;
  submission?: unknown;
  isTurn?: boolean;
  tokens?: number[];
  hand?: Array<WhotCard & { id: string }>;
  pendingPick?: number;
  legalIntents?: Array<Record<string, unknown> & { label?: string }>;
};

const whotShapeGlyph: Record<string, string> = {
  Circle: '●',
  Triangle: '▲',
  Cross: '✚',
  Square: '■',
  Star: '★',
  Whot: 'W',
};
const WHOT_SHAPES = ['Circle', 'Triangle', 'Cross', 'Square', 'Star'];

function casinoSeatPosition(index: number, total: number): React.CSSProperties {
  const angle = (-90 + (360 / Math.max(1, total)) * index) * (Math.PI / 180);
  const left = 50 + Math.cos(angle) * 42;
  const top = Math.min(82, Math.max(7, 45 + Math.sin(angle) * 38));
  return { left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' };
}

function whotCardTone(card?: WhotCard): string {
  if (!card) return 'border-[#7d1228] text-[#7d1228]';
  if (card.isWhot || card.shape === 'Whot') return 'border-secondary/90 text-[#7d1228] shadow-[0_0_22px_rgba(179,76,255,.26)]';
  return 'border-[#7d1228] text-[#7d1228] shadow-[0_0_18px_rgba(125,18,40,.28)]';
}

function WhotCardFace({
  card,
  disabled,
  playable,
  compact = false,
}: {
  card?: WhotCard;
  disabled?: boolean;
  playable?: boolean;
  compact?: boolean;
}) {
  const shape = card?.shape ?? (card?.isWhot ? 'Whot' : '');
  const glyph = whotShapeGlyph[shape] ?? (shape.slice(0, 1) || 'W');
  const number = card?.number ?? card?.label.match(/\d+/)?.[0] ?? (card?.isWhot ? '20' : '');
  return (
    <div
      className={`whot-card-face relative grid ${compact ? 'h-28 w-20' : 'h-40 w-28'} place-items-center overflow-hidden rounded-[.8rem] border-2 bg-[radial-gradient(circle_at_50%_46%,#fffdf6_0%,#f4f0e6_58%,#eadfd6_100%)] p-3 shadow-[0_18px_36px_rgba(0,0,0,.42)] transition ${
        whotCardTone(card)
      } ${playable ? 'scale-105 ring-4 ring-primary/80 shadow-[0_0_30px_rgba(69,243,107,.48),0_18px_36px_rgba(0,0,0,.42)]' : ''} ${disabled ? 'opacity-48 saturate-50' : ''}`}
    >
      <span className="pointer-events-none absolute inset-1 rounded-[.55rem] border border-[#7d1228]/30" />
      <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent shadow-[0_0_8px_rgba(69,243,107,.7)]" />
      <span className="absolute left-2 top-1 text-lg font-black leading-none">{number}</span>
      {shape === 'Whot' ? (
        <span className={`${compact ? 'text-xl' : 'text-2xl'} rotate-[-18deg] font-black uppercase tracking-tight text-[#7d1228] drop-shadow-[0_0_7px_rgba(179,76,255,.45)]`}>WHOT</span>
      ) : (
        <span className={`${compact ? 'text-4xl' : 'text-6xl'} drop-shadow-[0_0_8px_rgba(125,18,40,.3)]`}>{glyph}</span>
      )}
      <span className="absolute bottom-1 right-2 rotate-180 text-lg font-black leading-none">{number}</span>
    </div>
  );
}

function WhotCardBack({ compact = false }: { compact?: boolean }) {
  // Neon "BoredRoom" branded back matching the app theme.
  return (
    <div className={`whot-card-back relative grid ${compact ? 'h-24 w-16' : 'h-32 w-24'} place-items-center overflow-hidden rounded-2xl border border-primary/50 bg-[#03130b] shadow-[0_0_22px_rgba(69,243,107,.28)]`}>
      <div className="absolute inset-1.5 rounded-xl border border-primary/40" />
      <div className="absolute inset-0 opacity-[0.18] [background:repeating-linear-gradient(45deg,rgba(69,243,107,.5)_0,rgba(69,243,107,.5)_2px,transparent_2px,transparent_8px)]" />
      <div className="relative text-center leading-none">
        <span className={`block brush-display ${compact ? 'text-base' : 'text-xl'} text-primary drop-shadow-[0_0_10px_rgba(69,243,107,.7)]`}>Bored</span>
        <span className={`block brush-display ${compact ? 'text-base' : 'text-xl'} text-secondary drop-shadow-[0_0_10px_rgba(168,85,247,.7)]`}>Room</span>
      </div>
    </div>
  );
}

// ── Oga Landlord board surface ───────────────────────────────────────────────
const LANDLORD_SET_COLORS: Record<string, string> = {
  market: '#a855f7', tech: '#38bdf8', estate: '#f59e0b', island: '#45f36b',
};
// Recognisable Lagos transport as player tokens — Danfo, Okada, Keke, Molue, boat, chopper.
// The first four use 3D-rendered art; the rest fall back to themed emoji.
const LANDLORD_TOKENS = ['🚐', '🏍️', '🛺', '🚌', '🛥️', '🚁'];
const LANDLORD_TOKEN_NAMES = ['Danfo', 'Okada', 'Keke', 'Molue', 'Speedboat', 'Chopper'];
const LANDLORD_TOKEN_ART = ['/tokens/danfo.jpg', '/tokens/okada.jpg', '/tokens/keke.jpg', '/tokens/molue.jpg'];

function LagosToken({ index, active, size = 22 }: { index: number; active?: boolean; size?: number }) {
  const art = LANDLORD_TOKEN_ART[index];
  const cls = `lagos-token ${active ? 'lagos-token-active' : ''}`;
  if (art) {
    return (
      <img
        src={art}
        alt={LANDLORD_TOKEN_NAMES[index]}
        title={LANDLORD_TOKEN_NAMES[index]}
        className={`${cls} inline-block rounded-full border border-white/30 object-cover`}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return <span className={cls} style={{ fontSize: size * 0.8 }}>{LANDLORD_TOKENS[index % LANDLORD_TOKENS.length]}</span>;
}

interface LandlordState {
  board?: Array<{ name: string; type: string; price?: number; rent?: number; set?: string; amount?: number }>;
  players?: Array<{ id: string; name: string; cash?: number }>;
  positions?: Record<string, number>;
  properties?: Record<string, number[]>;
  houses?: Record<string, number>;
  mortgaged?: string[];
  jail?: Record<string, number>;
  diceValue?: number | null;
  currentPlayerId?: string;
  cellProps?: { price: number; owned: boolean } | null;
  auction?: {
    propertyPosition: number; propertyName: string; currentBid: number; highestBidderId?: string | null;
    minimumNextBid: number; passedPlayerIds: string[];
  } | null;
  pendingTrade?: {
    id: string; proposerId: string; targetPlayerId: string; offeredProperties: number[];
    requestedProperties: number[]; offeredCash: number; requestedCash: number;
  } | null;
  wahalaCard?: { text: string } | null;
  lastAction?: string;
  phase?: string;
}

function LandlordSurface({
  state, mine, role, sendIntent,
}: {
  state: LandlordState;
  mine: { isTurn?: boolean; cash?: number; position?: number; properties?: number[]; legalIntents?: Array<Record<string, unknown>> };
  role: 'display' | 'controller' | 'crowd' | 'companion';
  sendIntent: (intent: Record<string, unknown>) => void;
}) {
  const board = state.board ?? [];
  const players = state.players ?? [];
  const isController = role === 'controller';
  const legalIntents = mine.legalIntents ?? [];
  const diceRef = useRef<HTMLDivElement | null>(null);
  const prevDice = useRef<number | null>(null);
  const [auctionBid, setAuctionBid] = useState('');
  const [showTrade, setShowTrade] = useState(false);
  const [tradeTarget, setTradeTarget] = useState('');
  const [offeredProperties, setOfferedProperties] = useState<number[]>([]);
  const [requestedProperties, setRequestedProperties] = useState<number[]>([]);
  const [offeredCash, setOfferedCash] = useState('0');
  const [requestedCash, setRequestedCash] = useState('0');
  const auctionMinimumNextBid = state.auction?.minimumNextBid;
  const pendingTradeId = state.pendingTrade?.id;

  // Re-trigger the 3D roll animation whenever the dice value changes.
  useEffect(() => {
    const el = diceRef.current;
    if (!el || state.diceValue == null || state.diceValue === prevDice.current) return;
    prevDice.current = state.diceValue;
    el.classList.remove('rolling');
    void el.offsetWidth; // reflow to restart the animation
    el.classList.add('rolling');
    sounds.landlordRoll();
  }, [state.diceValue]);

  useEffect(() => {
    setAuctionBid(auctionMinimumNextBid == null ? '' : String(auctionMinimumNextBid));
  }, [auctionMinimumNextBid]);

  useEffect(() => {
    if (!pendingTradeId) return;
    setShowTrade(false);
    setOfferedProperties([]);
    setRequestedProperties([]);
  }, [pendingTradeId]);

  const ownerOf = (idx: number) => players.find((p) => (state.properties?.[p.id] ?? []).includes(idx));
  const indexOf = (id: string) => players.findIndex((p) => p.id === id);

  function act(intent: Record<string, unknown>) {
    if (intent.type === 'buy') sounds.landlordBuy();
    else if (intent.type === 'roll') sounds.landlordRoll();
    sendIntent(intent);
  }

  const cell = mine.position != null ? board[mine.position] : null;
  const tradeIntent = legalIntents.find((intent) => intent.type === 'propose_trade');
  const targetPlayers = players.filter((player) => player.id !== state.currentPlayerId);
  const selectedTarget = targetPlayers.find((player) => player.id === tradeTarget) ?? targetPlayers[0];
  const targetPropertyIds = selectedTarget ? (state.properties?.[selectedTarget.id] ?? []) : [];
  const propertyNames = (positions: number[]) => positions.map((position) => board[position]?.name ?? `Space ${position}`).join(', ') || 'none';

  function toggleProperty(list: number[], position: number, setter: (value: number[]) => void) {
    setter(list.includes(position) ? list.filter((value) => value !== position) : [...list, position]);
  }

  function proposeTrade() {
    if (!selectedTarget) return;
    sendIntent({
      type: 'propose_trade', targetPlayerId: selectedTarget.id,
      offeredProperties, requestedProperties,
      offeredCash: Number(offeredCash) || 0, requestedCash: Number(requestedCash) || 0,
    });
  }

  return (
    <main className="star-field min-h-screen bg-[#020817] px-4 pb-6 pt-4 text-white sm:px-6">
      <header className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3"><BrandLogo className="text-2xl" /><span className="text-sm font-semibold">🏠 Oga Landlord</span></div>
        <div className="text-xs text-muted-foreground">{state.lastAction}</div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 py-5 lg:grid-cols-[1fr_280px]">
        <section>
          {/* Board ring as a wrapping track; each cell tinted by its colour set, over a Lagos
              landmark backdrop dimmed so tiles stay readable. */}
          <div
            className="relative grid grid-cols-5 gap-1.5 rounded-2xl border border-white/10 p-2 sm:grid-cols-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(2,8,23,.82), rgba(2,8,23,.92)), url(/tokens/lagos-board-bg.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}>
            {board.map((bcell, idx) => {
              const owner = ownerOf(idx);
              const here = players.filter((p) => (state.positions?.[p.id] ?? 0) === idx);
              const houses = state.houses?.[String(idx)] ?? 0;
              const mortgaged = (state.mortgaged ?? []).includes(String(idx));
              const setColor = bcell.set ? LANDLORD_SET_COLORS[bcell.set] : undefined;
              return (
                <div
                  key={idx}
                  className={`landlord-cell-3d relative min-h-[72px] rounded-lg border p-1.5 text-[9px] leading-tight ${owner ? 'border-white/30 landlord-cell-owned' : 'border-white/10'} ${mortgaged ? 'opacity-50' : ''}`}
                  style={setColor ? { borderTopColor: setColor, borderTopWidth: 4 } : undefined}
                >
                  <div className="font-semibold text-white/80">{bcell.name}</div>
                  {bcell.type === 'property' || bcell.type === 'rail' ? (
                    <div className="text-white/40">₦{(bcell.price ?? 0).toLocaleString()}</div>
                  ) : null}
                  {houses > 0 && <div className="text-primary">{'🏠'.repeat(houses)}</div>}
                  {owner && <div className="flex items-center gap-1 text-[8px] text-white/60"><LagosToken index={indexOf(owner.id)} size={14} /> {owner.name}</div>}
                  <div className="absolute right-1 top-1 flex gap-0.5">
                    {here.map((p) => (
                      <LagosToken key={p.id} index={indexOf(p.id)} active={p.id === state.currentPlayerId} size={24} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {state.diceValue != null && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <div ref={diceRef} className="landlord-dice grid h-14 w-14 place-items-center rounded-xl border-2 border-primary bg-[#06150f] text-2xl font-black text-primary shadow-[0_0_18px_rgba(69,243,107,.4)]">
                {state.diceValue}
              </div>
              {state.wahalaCard && <div className="landlord-card max-w-xs rounded-xl border border-secondary/50 bg-secondary/10 p-3 text-xs">{state.wahalaCard.text}</div>}
            </div>
          )}

          {state.auction && (
            <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-amber-300/50 bg-amber-300/10 p-4 text-center shadow-[0_0_24px_rgba(252,211,77,.2)]">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-200">Bank auction</p>
              <h2 className="mt-1 text-xl font-black">{state.auction.propertyName}</h2>
              <p className="mt-2 text-sm">Highest bid: <strong className="text-amber-200">₦{state.auction.currentBid.toLocaleString()}</strong>{state.auction.highestBidderId ? ` · ${players.find((player) => player.id === state.auction?.highestBidderId)?.name ?? 'Bidder'}` : ''}</p>
            </div>
          )}

          {state.pendingTrade && (
            <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-secondary/50 bg-secondary/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Trade offer</p>
              <p className="mt-2 text-sm"><strong>{players.find((player) => player.id === state.pendingTrade?.proposerId)?.name}</strong> offers {propertyNames(state.pendingTrade.offeredProperties)}{state.pendingTrade.offeredCash ? ` + ₦${state.pendingTrade.offeredCash.toLocaleString()}` : ''}</p>
              <p className="mt-1 text-sm">For {propertyNames(state.pendingTrade.requestedProperties)}{state.pendingTrade.requestedCash ? ` + ₦${state.pendingTrade.requestedCash.toLocaleString()}` : ''} from <strong>{players.find((player) => player.id === state.pendingTrade?.targetPlayerId)?.name}</strong>.</p>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <div className="neon-panel rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bank</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {[...players].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0)).map((p) => (
                <li key={p.id} className={`flex items-center justify-between ${p.id === state.currentPlayerId ? 'text-primary' : ''}`}>
                  <span className="flex items-center gap-1.5">
                    <LagosToken index={indexOf(p.id)} active={p.id === state.currentPlayerId} size={22} />
                    {p.name}{(state.jail?.[p.id] ?? 0) > 0 ? ' 🚓' : ''}
                  </span>
                  <span className="font-mono">₦{(p.cash ?? 0).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>

          {isController && (
            <div className="neon-panel rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {mine.isTurn ? 'Your move' : 'Waiting…'} · ₦{(mine.cash ?? 0).toLocaleString()}
              </p>
              {cell && <p className="mt-1 text-xs text-white/60">On: {cell.name}</p>}
              <div className="mt-3 grid gap-2">
                {legalIntents.some((intent) => intent.type === 'auction_bid') && (
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input value={auctionBid} onChange={(event) => setAuctionBid(event.target.value)} inputMode="numeric" aria-label="Auction bid amount" className="h-11 bg-black/30" />
                    <Button className="h-11 bg-amber-300 text-black hover:bg-amber-200" onClick={() => sendIntent({ type: 'auction_bid', amount: Number(auctionBid) })}>Bid</Button>
                  </div>
                )}
                {legalIntents.filter((intent) => intent.type !== 'auction_bid' && intent.type !== 'propose_trade').map((intent, i) => (
                  <Button key={i} variant={intent.type === 'roll' || intent.type === 'buy' ? 'default' : 'outline'}
                    className={intent.type === 'roll' || intent.type === 'buy' ? 'neon-primary h-11 rounded-xl' : 'h-10 rounded-xl text-xs'}
                    disabled={!mine.isTurn && !['auction_pass', 'accept_trade', 'reject_trade', 'cancel_trade'].includes(String(intent.type))}
                    onClick={() => act(intent)}>
                    {String(intent.label ?? intent.type)}
                  </Button>
                ))}
                {tradeIntent && !showTrade && <Button variant="outline" className="h-10 rounded-xl text-xs" onClick={() => { setShowTrade(true); setTradeTarget(targetPlayers[0]?.id ?? ''); }}>Propose a trade</Button>}
                {legalIntents.length === 0 && <p className="text-xs text-muted-foreground">Wait for your turn.</p>}
              </div>

              {showTrade && tradeIntent && selectedTarget && (
                <div className="mt-4 space-y-3 rounded-xl border border-secondary/35 bg-secondary/5 p-3 text-xs">
                  <label className="block">Trade with
                    <select value={selectedTarget.id} onChange={(event) => { setTradeTarget(event.target.value); setRequestedProperties([]); }} className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#080b15] px-2">
                      {targetPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                    </select>
                  </label>
                  <fieldset><legend className="mb-1 text-muted-foreground">You offer</legend>
                    <div className="grid gap-1">{(mine.properties ?? []).map((position) => <label key={position} className="flex items-center gap-2"><input type="checkbox" checked={offeredProperties.includes(position)} onChange={() => toggleProperty(offeredProperties, position, setOfferedProperties)} /> {board[position]?.name}</label>)}</div>
                    <Input value={offeredCash} onChange={(event) => setOfferedCash(event.target.value)} inputMode="numeric" placeholder="Cash offered" className="mt-2 h-9 bg-black/30" />
                  </fieldset>
                  <fieldset><legend className="mb-1 text-muted-foreground">You request</legend>
                    <div className="grid gap-1">{targetPropertyIds.map((position) => <label key={position} className="flex items-center gap-2"><input type="checkbox" checked={requestedProperties.includes(position)} onChange={() => toggleProperty(requestedProperties, position, setRequestedProperties)} /> {board[position]?.name}</label>)}</div>
                    <Input value={requestedCash} onChange={(event) => setRequestedCash(event.target.value)} inputMode="numeric" placeholder="Cash requested" className="mt-2 h-9 bg-black/30" />
                  </fieldset>
                  <div className="grid grid-cols-2 gap-2"><Button variant="ghost" onClick={() => setShowTrade(false)}>Cancel</Button><Button className="neon-primary" onClick={proposeTrade}>Send offer</Button></div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

// ── Faith Feud answer board ──────────────────────────────────────────────────
interface FeudState {
  challenge?: { prompt?: string } | null;
  totalSlots?: number;
  maxStrikes?: number;
  revealedAnswers?: Array<{ index: number; text: string; points: number }>;
  strikes?: number;
  stealActive?: boolean;
  activeTeam?: number;
  team1Ids?: string[];
  team2Ids?: string[];
  teamScores?: number[];
  roundBank?: number;
  faceoffPlayerIds?: string[];
  buzzedPlayerId?: string | null;
  collectionIndex?: number;
  collectionTotal?: number;
  players?: Array<{ id: string; name: string; score?: number }>;
  phase?: string;
  lastAction?: string;
}

function FaithFeudSurface({
  state, mine, role, sendIntent, value, setValue,
}: {
  state: FeudState;
  mine: { seated?: boolean; team?: number; submitted?: boolean; legalIntents?: Array<Record<string, unknown>> };
  role: 'display' | 'controller' | 'crowd' | 'companion';
  sendIntent: (intent: Record<string, unknown>) => void;
  value: string;
  setValue: (v: string) => void;
}) {
  const isController = role === 'controller';
  const revealed = state.revealedAnswers ?? [];
  const revealedByIndex = new Map(revealed.map((r) => [r.index, r]));
  const totalSlots = Math.max(state.totalSlots ?? 0, revealed.length || 5);
  const maxStrikes = state.maxStrikes ?? 3;
  const strikes = state.strikes ?? 0;
  const teamScore = (team: number, ids?: string[]) => state.teamScores?.[team]
    ?? (state.players ?? []).filter((p) => ids?.includes(p.id)).reduce((s, p) => s + (p.score ?? 0), 0);
  const legalTypes = new Set((mine.legalIntents ?? []).map((intent) => intent.type));
  const canSurvey = legalTypes.has('survey_answer');
  const canBuzz = legalTypes.has('buzz');
  const canAnswer = legalTypes.has('answer_text');
  const phaseLabel: Record<string, string> = {
    survey_collection: `Survey ${Number(state.collectionIndex ?? 0) + 1} / ${state.collectionTotal ?? 1}`,
    faceoff_buzz: 'Faceoff · buzz now',
    faceoff_answer: 'Faceoff answer',
    play: `Team ${Number(state.activeTeam ?? 0) + 1} has control`,
    steal: `Team ${2 - Number(state.activeTeam ?? 0)} can steal`,
    round_reveal: 'Round board',
    finished: 'Final result',
  };

  return (
    <main className="star-field min-h-screen bg-[#020817] px-4 pb-6 pt-4 text-white sm:px-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3"><BrandLogo className="text-2xl" /><span className="text-sm font-semibold">📣 Faith Feud</span></div>
        <div className="flex gap-1">
          {Array.from({ length: maxStrikes }).map((_, i) => (
            <span key={i} className={`text-xl ${i < strikes ? 'text-red-400' : 'text-white/15'}`}>✘</span>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-5xl py-5">
        <div className="flex items-center justify-between gap-3">
          <div className={`flex-1 rounded-2xl border p-3 text-center ${state.activeTeam === 0 ? 'border-primary bg-primary/10' : 'border-white/10'}`}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary">Team 1</p>
            <p className="text-2xl font-black">{teamScore(0, state.team1Ids)}</p>
          </div>
          {state.stealActive && <div className="px-2 text-xs uppercase tracking-[0.2em] text-amber-300">Steal!</div>}
          <div className={`flex-1 rounded-2xl border p-3 text-center ${state.activeTeam === 1 ? 'border-primary bg-primary/10' : 'border-white/10'}`}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary">Team 2</p>
            <p className="text-2xl font-black">{teamScore(1, state.team2Ids)}</p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs uppercase tracking-[0.25em] text-secondary">{phaseLabel[state.phase ?? ''] ?? 'Faith Feud'}</p>
        <h1 className="mt-2 text-center text-xl font-bold sm:text-3xl">{state.challenge?.prompt ?? 'Faith Feud'}</h1>
        {(state.roundBank ?? 0) > 0 && <p className="mt-2 text-center text-sm text-primary">Round bank: {state.roundBank} points</p>}

        {/* Answer board — revealed answers show; the rest stay covered. */}
        {totalSlots > 0 && <div className="mx-auto mt-5 grid max-w-2xl gap-2">
          {Array.from({ length: totalSlots }).map((_, slot) => {
            const ans = revealedByIndex.get(slot) ?? revealed[slot];
            return (
              <div key={slot} className={`landlord-card flex items-center justify-between rounded-xl border px-4 py-3 ${ans ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.03]'}`}>
                {ans ? (
                  <>
                    <span className="font-semibold">{ans.text}</span>
                    <span className="font-mono text-primary">{ans.points}</span>
                  </>
                ) : (
                  <span className="mx-auto text-lg font-black text-white/30">{slot + 1}</span>
                )}
              </div>
            );
          })}
        </div>}

        {isController && mine.seated !== false && (
          <div className="mx-auto mt-6 max-w-md">
            {canBuzz ? (
              <button type="button" className="mx-auto grid h-32 w-32 place-items-center rounded-full border-4 border-red-200 bg-red-500 text-xl font-black text-white shadow-[0_0_36px_rgba(239,68,68,.6)] active:scale-95"
                onClick={() => { sounds.feudBuzz(); vibrate([60, 30, 60]); sendIntent({ type: 'buzz' }); }}>BUZZ!</button>
            ) : canSurvey || canAnswer ? (
              <div className="flex gap-2">
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { sendIntent(canSurvey ? { type: 'survey_answer', answers: value.split(',').map((item) => item.trim()).filter(Boolean) } : { type: 'answer_text', text: value.trim() }); setValue(''); } }}
                  placeholder={canSurvey ? 'Your answers, separated by commas' : 'Your answer'}
                  className="h-12 flex-1 rounded-xl border border-white/15 bg-black/35 px-4 text-center"
                />
                <Button className="neon-primary h-12 rounded-xl" disabled={!value.trim()} onClick={() => { sendIntent(canSurvey ? { type: 'survey_answer', answers: value.split(',').map((item) => item.trim()).filter(Boolean) } : { type: 'answer_text', text: value.trim() }); setValue(''); }}>{canSurvey ? 'Submit survey' : 'Answer'}</Button>
              </div>
            ) : <p className="text-center text-sm text-muted-foreground">Waiting for the active player or team…</p>}
          </div>
        )}
        {(role === 'display' || role === 'companion') && state.phase === 'round_reveal' && (
          <div className="mx-auto mt-6 max-w-md"><Button className="neon-primary h-12 w-full rounded-xl" onClick={() => sendIntent({ type: 'advance' })}>Next round</Button></div>
        )}
        <p className="mt-5 text-center text-xs text-muted-foreground">{state.lastAction}</p>
      </div>
    </main>
  );
}

const ludoPalette = [
  { name: 'Emerald', token: 'bg-primary text-[#031008]', glow: 'shadow-[0_0_18px_rgba(69,243,107,.65)]', border: 'border-primary/80', area: 'bg-primary/10' },
  { name: 'Violet', token: 'bg-secondary text-white', glow: 'shadow-[0_0_18px_rgba(179,76,255,.65)]', border: 'border-secondary/80', area: 'bg-secondary/10' },
  { name: 'Amber', token: 'bg-amber-300 text-black', glow: 'shadow-[0_0_18px_rgba(252,211,77,.55)]', border: 'border-amber-300/80', area: 'bg-amber-300/10' },
  { name: 'Sky', token: 'bg-sky-300 text-black', glow: 'shadow-[0_0_18px_rgba(125,211,252,.55)]', border: 'border-sky-300/80', area: 'bg-sky-300/10' },
];

const ludoPath = (() => {
  const cells: Array<{ row: number; col: number }> = [];
  for (let col = 1; col <= 13; col += 1) cells.push({ row: 1, col });
  for (let row = 2; row <= 13; row += 1) cells.push({ row, col: 13 });
  for (let col = 13; col >= 1; col -= 1) cells.push({ row: 13, col });
  for (let row = 12; row >= 2; row -= 1) cells.push({ row, col: 1 });
  return cells;
})();

const ludoHomeCells = [
  { row: 5, col: 7 },
  { row: 6, col: 7 },
  { row: 7, col: 7 },
  { row: 8, col: 7 },
  { row: 9, col: 7 },
  { row: 7, col: 6 },
];

const ludoYards = [
  { row: 2, col: 2, className: 'items-start justify-start' },
  { row: 2, col: 10, className: 'items-start justify-end' },
  { row: 10, col: 10, className: 'items-end justify-end' },
  { row: 10, col: 2, className: 'items-end justify-start' },
];

function ludoTokenLabel(index: number) {
  return ['A', 'B', 'C', 'D'][index] ?? String(index + 1);
}

// Fast-paced round countdown — a shrinking neon bar + seconds, driven by the server pace deadline.
function RoundTimerBar({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);
  const remaining = Math.max(0, deadline - now);
  const secs = Math.ceil(remaining / 1000);
  // Bar resets each phase; we only know remaining, so scale against a 20s visual ceiling.
  const pct = Math.min(100, (remaining / 20000) * 100);
  const urgent = remaining <= 4000;
  return (
    <div className="mx-auto mt-2 flex max-w-7xl items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${urgent ? 'bg-red-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`min-w-[2.5rem] text-right text-sm font-bold tabular-nums ${urgent ? 'text-red-400' : 'text-primary'}`}>{secs}s</span>
    </div>
  );
}

export function InstalledGameSurface({
  publicState,
  privateState,
  role,
  sendIntent,
  aiHint,
  requestHint,
  aiCommentary,
  hintBudget,
  paceDeadline,
  hostControlsEnabled = true,
  onMarkPayout,
}: {
  publicState: unknown;
  privateState: unknown;
  role: 'display' | 'controller' | 'crowd' | 'companion';
  sendIntent: (intent: Record<string, unknown>) => void;
  aiHint?: string | null;
  requestHint?: () => void;
  aiCommentary?: string | null;
  hintBudget?: number;
  paceDeadline?: number | null;
  hostControlsEnabled?: boolean;
  onMarkPayout?: (settlementStatus: 'paid' | 'waived' | 'unsettled') => void;
}) {
  const state = publicState as GameState;
  const mine = (privateState ?? {}) as PrivateState;
  const isHost = role === 'display' || role === 'companion';
  const canUseHostControls = isHost && hostControlsEnabled;
  const [value, setValue] = useState('');
  const [order, setOrder] = useState<number[]>([]);
  const [whotCardId, setWhotCardId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const whotCelebrationRef = useRef('');

  useEffect(() => {
    setValue('');
    setOrder([]);
  }, [state.round]);

  useEffect(() => {
    if (role !== 'display' || state.mode !== 'whot' || !['round_end', 'finished'].includes(state.phase)) return;
    const winnerId = state.winnerPlayerIds?.[0];
    const winner = state.players.find((player) => player.id === winnerId)?.name ?? 'The winner';
    const key = `${state.phase}:${state.round}:${winnerId ?? ''}`;
    if (whotCelebrationRef.current === key) return;
    whotCelebrationRef.current = key;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      confetti({ particleCount: state.phase === 'finished' ? 180 : 110, spread: 105, origin: { y: 0.45 }, colors: ['#45f36b', '#b34cff', '#f7d154', '#ffffff'] });
    }
    const line = state.phase === 'finished'
      ? `Check up! ${winner} wins the game!`
      : `Check up! ${winner} wins round ${state.round ?? ''}!`;
    void sounds.whotCalloutLine(line, 'check_up');
  }, [role, state.mode, state.phase, state.round, state.winnerPlayerIds, state.players]);

  // Faith Feud audio cues (sampled Family-Feud sounds) driven by lastAction transitions.
  const prevActionRef = useRef<string>('');
  useEffect(() => {
    if (state.gameType !== 'faith-feud') { prevActionRef.current = state.lastAction; return; }
    const action = state.lastAction ?? '';
    if (action && action !== prevActionRef.current) {
      if (action.startsWith('✅')) sounds.feudCorrect();
      else if (/already found/i.test(action)) sounds.feudDuplicate();
      else if (action.includes('❌') || /strike/i.test(action)) sounds.feudWrong();
      else if (/steal/i.test(action)) sounds.feudSteal();
      else if (state.phase === 'reveal') sounds.feudReveal();
    }
    prevActionRef.current = action;
  }, [state.gameType, state.lastAction, state.phase]);

  const sortedPlayers = useMemo(
    () => [...(state.players ?? [])].sort((a, b) => b.score - a.score),
    [state.players],
  );
  const challenge = state.challenge;
  const legalIntents = mine.legalIntents ?? [];
  const isBoardGame = !challenge && ['connect4', 'ettt', 'ludo', 'whot'].includes(state.mode ?? '');

  function submit() {
    if (!challenge || mine.submitted) return;
    if (challenge.kind === 'number') sendIntent({ type: 'guess', amount: Number(value) });
    if (challenge.kind === 'text') sendIntent({ type: 'answer_text', text: value.trim() });
    if (challenge.kind === 'order') {
      const orderedIndexes = order.length === challenge.options?.length
        ? order
        : (challenge.options ?? []).map((_, index) => index);
      sendIntent({ type: 'submit_order', orderedIndexes });
    }
  }

  if (state.mode === 'landlord') {
    return <LandlordSurface state={state as unknown as LandlordState} mine={mine} role={role} sendIntent={sendIntent} />;
  }

  if (state.mode === 'feud') {
    return <FaithFeudSurface state={state as unknown as FeudState} mine={mine} role={role} sendIntent={sendIntent} value={value} setValue={setValue} />;
  }

  if (state.mode === 'word-board') {
    return <WordWahalaSurface state={state as never} mine={mine as never} role={role} sendIntent={sendIntent} />;
  }

  if (state.mode === 'pidgin') {
    return <PidginVoiceSurface state={state as never} mine={mine as never} role={role} sendIntent={sendIntent} />;
  }

  if (state.mode === 'money-trivia') {
    return <MoneyTriviaSurface state={state as never} mine={mine as never} role={role} sendIntent={sendIntent} onMarkPayout={onMarkPayout} />;
  }

  if (role === 'controller' && state.mode === 'ludo') {
    return (
      <main className="star-field min-h-screen bg-[#020817] px-4 pb-8 pt-5 text-white">
        <header className="mx-auto flex max-w-xl items-center justify-between border-b border-white/10 pb-4">
          <div><BrandLogo className="text-2xl" /><p className="mt-1 text-sm font-bold">🎲 Ludo controller</p></div>
          <span className={mine.isTurn ? 'text-primary' : 'text-muted-foreground'}>{mine.isTurn ? 'Your turn' : 'Waiting'}</span>
        </header>
        <section className="mx-auto mt-6 max-w-xl space-y-5">
          <div className="neon-panel rounded-3xl p-6 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Your dice</p>
            <div className="mx-auto mt-4 grid h-24 w-24 place-items-center rounded-3xl border border-primary/50 bg-primary/10 text-5xl font-black text-primary shadow-[0_0_24px_rgba(69,243,107,.22)]">
              {state.pendingRoll ?? '—'}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{state.lastAction}</p>
          </div>
          <div className="neon-panel rounded-3xl p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">Your tokens</p>
            <div className="grid grid-cols-4 gap-3">
              {(mine.tokens ?? []).map((position, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
                  <span className="text-2xl font-black text-primary">{ludoTokenLabel(index)}</span>
                  <p className="mt-1 text-[10px] text-muted-foreground">{position < 0 ? 'Yard' : position >= 57 ? 'Home' : `Step ${position}`}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {legalIntents.map((intent, index) => (
              <Button key={index} className="neon-primary h-16 rounded-2xl text-base" onClick={() => {
                if (intent.type === 'roll') sounds.ludoDiceGlassRoll(); else sounds.tokenMove();
                vibrate(intent.type === 'roll' ? [30, 20, 30] : 45);
                sendIntent(intent);
              }}>
                {intent.label ?? (intent.type === 'roll' ? 'Roll dice' : 'Move token')}
              </Button>
            ))}
            {legalIntents.length === 0 && <p className="text-center text-sm text-muted-foreground">Waiting for the active player.</p>}
          </div>
        </section>
      </main>
    );
  }

  if (role === 'controller' && state.mode === 'whot') {
    return (
      <main className="star-field min-h-[100dvh] bg-[#020817] px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-[calc(env(safe-area-inset-top)+4.75rem)] text-white">
        <header className="mx-auto flex max-w-xl items-center justify-between border-b border-white/10 pb-4">
          <div><BrandLogo className="text-2xl" /><p className="mt-1 text-sm font-bold">🃏 Whot controller</p></div>
          <div className="text-right text-xs"><p className="text-primary">Round {state.round} of 5</p><p className="text-muted-foreground">First to {state.roundsToWin ?? 3}{state.settings?.enableDirection ? ` · ${state.turnDirection === -1 ? '↺' : '↻'}` : ''}</p></div>
        </header>
        <section className="mx-auto mt-5 max-w-xl space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
            <div><p className="text-xs text-muted-foreground">{mine.isTurn ? 'Your turn' : `Waiting for ${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? 'player'}`}</p><p className="mt-1 font-bold">{state.lastAction}</p></div>
            <WhotCardFace card={state.topCard} compact />
          </div>
          {state.requestedShape && (
            <div className="rounded-2xl border border-secondary/60 bg-secondary/10 px-4 py-3 text-center font-bold text-secondary" role="status">
              Requested shape: {whotShapeGlyph[state.requestedShape] ?? ''} {state.requestedShape}
            </div>
          )}
          {mine.pendingPick && mine.pendingPick > 0 ? <p className="rounded-xl border border-amber-300/50 bg-amber-300/10 p-3 text-center text-sm text-amber-100">Pick {mine.pendingPick}, or stack a matching penalty card.</p> : null}
          <div>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black uppercase tracking-[0.2em]">Your hand</h2><span className="text-xs text-primary">{(mine.hand ?? []).length} cards</span></div>
            {/* All cards laid out in a wrapping grid (scrolls down) — no dead horizontal space. */}
            <div className="flex flex-wrap justify-center gap-2 pb-3">
              {(mine.hand ?? []).map((card) => {
                const legal = legalIntents.find((intent) => intent.type === 'play_card' && intent.cardId === card.id);
                return <button key={card.id} type="button" disabled={!legal || state.phase !== 'playing'} onClick={() => {
                  if (!legal) return;
                  sounds.hustleCard(); vibrate(45);
                  if (card.isWhot) setWhotCardId(card.id); else sendIntent(legal);
                }} className="disabled:cursor-not-allowed" aria-label={legal ? `Play ${card.label}` : `${card.label} cannot be played now`}><WhotCardFace card={card} disabled={!legal} playable={Boolean(legal)} /></button>;
              })}
              {(mine.hand ?? []).length === 0 && <p className="py-6 text-sm text-muted-foreground">No cards.</p>}
            </div>
          </div>
          {/* Persistent market button — always visible, disabled when not a legal draw. */}
          <Button
            className="neon-primary h-14 w-full rounded-xl disabled:opacity-40"
            disabled={!legalIntents.some((intent) => intent.type === 'draw')}
            onClick={() => sendIntent({ type: 'draw' })}
          >
            {mine.pendingPick && mine.pendingPick > 0 ? `Pick ${mine.pendingPick}` : 'Go to market'}
          </Button>
        </section>
        {requestHint && (
          <>
            <button
              type="button"
              className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-40 grid h-14 w-14 place-items-center rounded-full border border-secondary/70 bg-[#160b25] text-secondary shadow-[0_0_25px_rgba(179,76,255,.42)]"
              aria-label="Open personal game assistant"
              onClick={() => setAssistantOpen(true)}
            >
              <MessageCircle className="h-6 w-6" />
              {typeof hintBudget === 'number' && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-black">{hintBudget}</span>}
            </button>
            {assistantOpen && (
              <div className="fixed inset-0 z-[80] flex items-end bg-black/70 p-3 pb-[calc(env(safe-area-inset-bottom)+.75rem)] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Personal game assistant">
                <div className="mx-auto w-full max-w-md rounded-3xl border border-secondary/50 bg-[#090713] p-5 shadow-[0_0_36px_rgba(179,76,255,.25)]">
                  <div className="flex items-center gap-3"><Bot className="text-secondary" /><div className="flex-1"><h2 className="font-bold">Your private assistant</h2><p className="text-xs text-muted-foreground">Only your hand and legal moves are used.</p></div><Button size="icon" variant="ghost" aria-label="Close assistant" onClick={() => setAssistantOpen(false)}><X /></Button></div>
                  <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-sm leading-relaxed">
                    {aiHint ?? ((hintBudget ?? 0) > 0 ? 'Ask me for one clear move when you need it.' : 'Win a round or score to earn another hint.')}
                  </div>
                  <Button className="neon-primary mt-4 h-12 w-full rounded-xl" disabled={(hintBudget ?? 0) <= 0} onClick={requestHint}>Suggest my next move</Button>
                </div>
              </div>
            )}
          </>
        )}
        {whotCardId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-secondary/40 bg-[#090713] p-6">
              <p className="mb-4 text-center text-lg font-bold text-secondary">Call a shape</p>
              <div className="grid grid-cols-2 gap-3">{WHOT_SHAPES.map((shape) => <Button key={shape} variant="outline" onClick={() => { sendIntent({ type: 'play_card', cardId: whotCardId, calledShape: shape }); setWhotCardId(null); }}>{whotShapeGlyph[shape]} {shape}</Button>)}</div>
              <Button variant="ghost" className="mt-4 w-full" onClick={() => setWhotCardId(null)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="star-field min-h-screen bg-[#020817] px-4 pb-5 pt-4 text-white sm:px-6">
      <header className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-4">
          <BrandLogo className="text-2xl" />
          <span className="text-sm font-semibold">{state.emoji} {state.name}</span>
        </div>
        {state.mode !== 'whot' && <div className="text-xs text-muted-foreground">Round {state.round} / {state.totalRounds}</div>}
        <div className="flex items-center gap-2 text-xs"><Users className="h-4 w-4" /> {state.players?.length ?? 0}</div>
      </header>

      {paceDeadline ? <RoundTimerBar deadline={paceDeadline} /> : null}

      <div className={`mx-auto grid min-h-[calc(100vh-76px)] gap-5 py-5 ${state.mode === 'whot' ? 'max-w-[1600px]' : 'max-w-7xl lg:grid-cols-[1fr_270px]'}`}>
        <section className="flex flex-col items-center justify-center">
          <div className={`neon-panel w-full overflow-hidden rounded-2xl ${state.mode === 'whot' ? 'max-w-none border-0 bg-transparent shadow-none' : 'max-w-3xl'}`}>
            {/* The Whot table carries its own round bar, callout and turn status — skip the
                redundant challenge-prompt header for it. */}
            {state.mode !== 'whot' && (
              <div className="border-b border-white/10 px-5 py-8 text-center">
                <p className="text-xs uppercase tracking-[0.24em] text-secondary">{state.phase === 'reveal' ? 'Round result' : state.mode ?? 'Your challenge'}</p>
                <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">
                  {challenge?.prompt ?? (state.phase === 'finished' ? 'Game complete' : state.lastAction)}
                </h1>
              </div>
            )}

            {challenge?.kind === 'choice' && (
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {(challenge.options ?? []).map((option, optionIndex) => (
                  <Button
                    key={`${option}-${optionIndex}`}
                    variant={mine.submission === optionIndex ? 'default' : 'outline'}
                    className="min-h-14 justify-start rounded-xl bg-white/[0.035] text-left"
                    disabled={isHost || role === 'crowd' || mine.seated === false || mine.submitted || state.phase !== 'playing'}
                    onClick={() => sendIntent({ type: 'answer', optionIndex })}
                  >
                    <span className="mr-3 text-lg font-bold text-primary">{String.fromCharCode(65 + optionIndex)}</span>{option}
                  </Button>
                ))}
              </div>
            )}

            {!isHost && role !== 'crowd' && mine.seated !== false && challenge && challenge.kind !== 'choice' && (
              <div className="p-4">
                {challenge.kind === 'order' ? (
                  <div className="space-y-2">
                    {(order.length ? order : (challenge.options ?? []).map((_, index) => index)).map((sourceIndex, displayIndex, current) => (
                      <div key={sourceIndex} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                        <span className="w-7 text-center font-mono text-primary">{displayIndex + 1}</span>
                        <span className="flex-1">{challenge.options?.[sourceIndex]}</span>
                        <Button size="sm" variant="ghost" disabled={displayIndex === 0 || mine.submitted} onClick={() => {
                          const next = [...current];
                          [next[displayIndex - 1], next[displayIndex]] = [next[displayIndex], next[displayIndex - 1]];
                          setOrder(next);
                        }}>↑</Button>
                        <Button size="sm" variant="ghost" disabled={displayIndex === current.length - 1 || mine.submitted} onClick={() => {
                          const next = [...current];
                          [next[displayIndex + 1], next[displayIndex]] = [next[displayIndex], next[displayIndex + 1]];
                          setOrder(next);
                        }}>↓</Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Input
                    value={value}
                    inputMode={challenge.kind === 'number' ? 'numeric' : 'text'}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={challenge.kind === 'number' ? 'Enter your estimate' : 'Type your answer'}
                    className="h-14 rounded-xl bg-black/30 text-center text-lg"
                    disabled={mine.submitted}
                  />
                )}
                <Button className="neon-primary mt-3 h-13 w-full rounded-xl" disabled={mine.submitted || (challenge.kind !== 'order' && !value.trim())} onClick={submit}>
                  {mine.submitted ? <><Check /> Locked in</> : 'Submit answer'}
                </Button>
                {requestHint && !mine.submitted && (
                  <Button variant="ghost" className="mt-2 w-full text-secondary disabled:opacity-40" disabled={(hintBudget ?? 0) <= 0} onClick={requestHint}>
                    💡 Hint {typeof hintBudget === 'number' ? `(${hintBudget})` : ''}
                  </Button>
                )}
                {aiHint && <p className="mt-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm">{aiHint}</p>}
              </div>
            )}

            {isBoardGame && (
              <div className="p-4">
                {(state.mode === 'connect4' || state.mode === 'ettt') && (
                  <div className="mx-auto max-w-xl">
                    <div
                      className={`grid gap-2 ${state.mode === 'connect4' ? 'grid-cols-7' : 'grid-cols-3'}`}
                      aria-label={state.mode === 'connect4' ? 'Connect 4 board' : 'Endless Tic Tac Toe board'}
                    >
                      {(state.board ?? []).flatMap((row, rowIndex) =>
                        row.map((cell, columnIndex) => {
                          const cellIndex = state.mode === 'connect4' ? columnIndex : rowIndex * 3 + columnIndex;
                          const legal = legalIntents.find((intent) =>
                            state.mode === 'connect4'
                              ? intent.type === 'drop' && intent.column === columnIndex
                              : intent.type === 'place' && intent.cell === cellIndex,
                          );
                          return (
                            <button
                              key={`${rowIndex}-${columnIndex}`}
                              type="button"
                              disabled={isHost || role === 'crowd' || !legal || state.phase !== 'playing'}
                              onClick={() => legal && sendIntent(legal)}
                              className={`grid aspect-square place-items-center rounded-xl border text-lg font-black transition ${
                                cell
                                  ? 'border-primary/50 bg-primary/15 text-primary'
                                  : legal
                                    ? 'border-secondary/70 bg-secondary/10 text-secondary hover:bg-secondary/20'
                                    : 'border-white/10 bg-white/[0.035] text-white/30'
                              }`}
                            >
                              {cell ?? (state.mode === 'connect4' ? columnIndex + 1 : cellIndex + 1)}
                            </button>
                          );
                        }),
                      )}
                    </div>
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                      {mine.isTurn ? 'Your turn.' : `Waiting for ${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? 'the next player'}.`}
                    </p>
                  </div>
                )}

                {state.mode === 'ludo' && (
                  <div className="mx-auto w-full max-w-5xl">
                    <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                      <div className="ludo-board relative mx-auto aspect-square w-full max-w-[720px] overflow-hidden rounded-[2rem] border border-primary/25 bg-[#071018] p-3 shadow-[inset_0_0_70px_rgba(0,0,0,.55),0_0_34px_rgba(69,243,107,.12)]">
                        <div className="grid h-full w-full grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] gap-1">
                          {ludoPath.map((cell, index) => {
                            const safe = [0, 8, 13, 21, 26, 34, 39, 47].includes(index);
                            return (
                              <div
                                key={`path-${index}`}
                                className={`ludo-cell rounded-md border text-[9px] ${safe ? 'border-primary/55 bg-primary/18 text-primary' : 'border-white/10 bg-white/[0.045] text-white/28'}`}
                                style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
                              >
                                {safe ? '★' : ''}
                              </div>
                            );
                          })}
                          {ludoHomeCells.map((cell, index) => (
                            <div
                              key={`home-${index}`}
                              className="ludo-cell rounded-md border border-primary/50 bg-primary/15 text-[9px] text-primary"
                              style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
                            >
                              HOME
                            </div>
                          ))}
                        </div>

                        <div className="absolute inset-[34%] grid place-items-center rounded-3xl border border-primary/40 bg-[radial-gradient(circle,rgba(69,243,107,.22),rgba(2,8,23,.9))] text-center shadow-[0_0_28px_rgba(69,243,107,.18)]">
                          <p className="brush-display text-4xl text-primary">Ludo</p>
                          <p className="text-xs text-white/60">Race home</p>
                        </div>

                        {(state.players ?? []).map((player, playerIndex) => {
                          const palette = ludoPalette[playerIndex % ludoPalette.length];
                          const yard = ludoYards[playerIndex % ludoYards.length];
                          const tokens = state.tokens?.[player.id] ?? [];
                          return (
                            <div
                              key={`yard-${player.id}`}
                              className={`absolute grid h-[25%] w-[25%] ${yard.className} rounded-[1.5rem] border ${palette.border} ${palette.area} p-3`}
                              style={{
                                top: `${(yard.row / 15) * 100}%`,
                                left: `${(yard.col / 15) * 100}%`,
                              }}
                            >
                              <p className="mb-2 truncate text-xs font-bold">{player.name}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {tokens.map((position, tokenIndex) => {
                                  if (position >= 0) return null;
                                  const legal = legalIntents.find((intent) => intent.type === 'move_token' && intent.tokenIndex === tokenIndex);
                                  return (
                                    <button
                                      key={`yard-token-${player.id}-${tokenIndex}`}
                                      type="button"
                                      disabled={isHost || role === 'crowd' || !legal || state.phase !== 'playing'}
                                      onClick={() => {
                                        if (!legal) return;
                                        sounds.tokenMove();
                                        vibrate(45);
                                        sendIntent(legal);
                                      }}
                                      className={`ludo-token ${palette.token} ${palette.glow} ${legal ? 'ring-2 ring-white/80' : ''}`}
                                      aria-label={`${player.name} token ${tokenIndex + 1} in yard`}
                                    >
                                      {ludoTokenLabel(tokenIndex)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {(state.players ?? []).flatMap((player, playerIndex) => {
                          const palette = ludoPalette[playerIndex % ludoPalette.length];
                          const tokens = state.tokens?.[player.id] ?? [];
                          return tokens.map((position, tokenIndex) => {
                            if (position < 0) return null;
                            const cell = position >= 52
                              ? ludoHomeCells[Math.min(position - 52, ludoHomeCells.length - 1)]
                              : ludoPath[(position + playerIndex * 13) % ludoPath.length];
                            const legal = player.id === state.currentPlayerId
                              ? legalIntents.find((intent) => intent.type === 'move_token' && intent.tokenIndex === tokenIndex)
                              : null;
                            return (
                              <button
                                key={`track-token-${player.id}-${tokenIndex}`}
                                type="button"
                                disabled={isHost || role === 'crowd' || !legal || state.phase !== 'playing'}
                                onClick={() => {
                                  if (!legal) return;
                                  sounds.tokenMove();
                                  vibrate(45);
                                  sendIntent(legal);
                                }}
                                className={`ludo-token absolute ${palette.token} ${palette.glow} ${legal ? 'ring-2 ring-white/80' : ''}`}
                                style={{
                                  top: `calc(${(cell.row / 15) * 100}% + 2px + ${(tokenIndex % 2) * 12}px)`,
                                  left: `calc(${(cell.col / 15) * 100}% + 2px + ${Math.floor(tokenIndex / 2) * 12}px)`,
                                }}
                                aria-label={`${player.name} token ${tokenIndex + 1} at ${position >= 57 ? 'home' : `position ${position}`}`}
                              >
                                {ludoTokenLabel(tokenIndex)}
                              </button>
                            );
                          });
                        })}
                      </div>

                      <aside className="space-y-4">
                        <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4 text-center">
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Dice</p>
                          <div className="ludo-die mx-auto mt-3 grid h-24 w-24 place-items-center rounded-3xl border border-primary/60 bg-primary/10 text-5xl font-black text-primary shadow-[0_0_28px_rgba(69,243,107,.22)]">
                            {state.pendingRoll ?? '•'}
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">
                            {mine.isTurn ? 'Your turn.' : `Waiting for ${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? 'the next player'}.`}
                          </p>
                        </div>

                        <div className="space-y-2">
                          {(state.players ?? []).map((player, playerIndex) => {
                            const palette = ludoPalette[playerIndex % ludoPalette.length];
                            const active = player.id === state.currentPlayerId;
                            return (
                              <div key={`rail-${player.id}`} className={`rounded-2xl border p-3 ${active ? `${palette.border} ${palette.area}` : 'border-white/10 bg-white/[0.035]'}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`h-4 w-4 rounded-full ${palette.token}`} />
                                  <strong className="min-w-0 flex-1 truncate text-sm">{player.name}</strong>
                                  <span className="text-xs text-muted-foreground">{player.score}</span>
                                </div>
                                <div className="mt-2 flex gap-1">
                                  {(state.tokens?.[player.id] ?? []).map((position, index) => (
                                    <span key={index} className="rounded-full bg-black/35 px-2 py-1 text-[10px] text-white/65">
                                      {position < 0 ? 'Yard' : position >= 57 ? 'Home' : position}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {!isHost && role !== 'crowd' && (
                          <div className="grid gap-2">
                            {legalIntents.map((intent, index) => (
                              <Button
                                key={index}
                                className="neon-primary h-13 rounded-xl"
                                disabled={state.phase !== 'playing'}
                                onClick={() => {
                                  if (intent.type === 'roll') sounds.ludoDiceGlassRoll();
                                  else sounds.tokenMove();
                                  vibrate(intent.type === 'roll' ? [30, 20, 30] : 45);
                                  sendIntent(intent);
                                }}
                              >
                                {intent.label ?? (intent.type === 'roll' ? 'Roll dice' : 'Move token')}
                              </Button>
                            ))}
                          </div>
                        )}
                      </aside>
                    </div>
                  </div>
                )}

                {state.mode === 'whot' && (
                  <div className="mx-auto w-full max-w-[1500px]">
                    <div className="mb-3 flex flex-col items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center sm:flex-row sm:text-left">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                        Round {state.round ?? 1} of {state.totalRounds ?? 5} · First to {state.roundsToWin ?? 3}
                        {state.settings?.enableDirection ? ` · ${state.turnDirection === -1 ? '↺ Counter-clockwise' : '↻ Clockwise'}` : ''}
                        {state.pendingPick ? ` · Pick stack ${state.pendingPick}` : ''}
                      </p>
                      {role === 'display' && aiCommentary && (
                        <p className="max-w-2xl text-sm text-white/85"><span className="mr-2 text-secondary">🎙️ MC</span>{aiCommentary}</p>
                      )}
                    </div>
                    {state.callout && (
                      <div className="mb-3 rounded-2xl border border-secondary/60 bg-secondary/10 px-4 py-3 text-center text-lg font-black text-secondary shadow-[0_0_24px_rgba(179,76,255,.2)]" role="status">
                        {state.callout.text}
                      </div>
                    )}
                    <div className="relative min-h-[68vh] overflow-hidden rounded-[2rem] border border-primary/25 bg-[radial-gradient(circle_at_50%_48%,rgba(20,92,52,.92),rgba(4,24,18,.96)_42%,rgba(2,8,23,.98)_72%)] p-5 shadow-[inset_0_0_90px_rgba(0,0,0,.45),0_0_42px_rgba(69,243,107,.12)]">
                      <div className="pointer-events-none absolute inset-8 rounded-full border border-primary/15" />
                      <div className="pointer-events-none absolute inset-[18%] rounded-full border border-white/10 bg-black/10" />
                      <div className="absolute inset-0">
                        {(state.players ?? []).map((player, index) => {
                          const active = player.id === state.currentPlayerId;
                          const pending = state.pendingPick !== undefined && state.pendingPick > 0;
                          return (
                            <div
                              key={player.id}
                              className={`whot-seat flex min-w-28 items-center gap-2 rounded-2xl border px-3 py-2 ${
                                active && pending
                                  ? 'border-amber-300/60 bg-amber-300/10 shadow-[0_0_16px_rgba(252,211,77,.28)]'
                                  : active
                                    ? 'border-primary bg-primary/15 shadow-[0_0_20px_rgba(69,243,107,.28)]'
                                    : 'border-white/10 bg-black/28'
                              }`}
                              style={{ ...casinoSeatPosition(index, state.players.length), animationDelay: `${index * 80}ms`, position: 'absolute' }}
                            >
                              <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/50 bg-primary/10 text-xs font-black">
                                {player.name.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-bold">{player.name}</span>
                                <span className="block text-[10px] text-muted-foreground">{player.handCount ?? 0} cards · {player.roundWins ?? player.score ?? 0} win{(player.roundWins ?? player.score ?? 0) === 1 ? '' : 's'}{active && pending ? ' · ⚠️' : ''}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 grid-cols-2 items-center gap-7">
                        <div className="text-center">
                          <button
                            type="button"
                            disabled={isHost || role === 'crowd' || !legalIntents.some((intent) => intent.type === 'draw') || state.phase !== 'playing'}
                            onClick={() => {
                              sounds.hustleCard();
                              vibrate(35);
                              sendIntent({ type: 'draw' });
                            }}
                            className="group relative disabled:cursor-default"
                          >
                            <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-xl transition group-enabled:group-hover:bg-primary/25" />
                            <WhotCardBack />
                          </button>
                          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/60">Market · {state.drawPileCount ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <div className="whot-played-card">
                            <WhotCardFace card={state.topCard} />
                          </div>
                          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/60">
                            Discard
                          </p>
                          {state.requestedShape && (
                            <p className="mt-1 text-sm font-bold text-secondary">
                              Requested: {whotShapeGlyph[state.requestedShape] ?? ''} {state.requestedShape}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="absolute inset-x-4 bottom-4 text-center">
                        <div className="mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm backdrop-blur">
                          <span className={mine.isTurn ? 'text-primary' : 'text-muted-foreground'}>
                            {mine.isTurn ? 'Your turn — play a card or go market.' : `Waiting for ${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? 'the next player'}.`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isHost && role !== 'crowd' && (
                      <div className="mt-5 rounded-3xl border border-white/10 bg-black/35 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Your hand</h2>
                          <span className="text-xs text-primary">{(mine.hand ?? []).length} cards</span>
                        </div>
                        {mine.pendingPick && mine.pendingPick > 0 && (
                          <div className="mb-3 rounded-xl border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-center text-sm text-amber-200">
                            ⚠️ You need to pick {mine.pendingPick} card{mine.pendingPick > 1 ? 's' : ''}.{' '}
                            {legalIntents.some((i) => i.type === 'play_card') ? 'Or stack with a matching card.' : ''}
                          </div>
                        )}
                        <div className="flex min-h-44 gap-3 overflow-x-auto pb-3">
                          {(mine.hand ?? []).map((card, index) => {
                            const legal = legalIntents.find((intent) => intent.type === 'play_card' && intent.cardId === card.id);
                            return (
                              <button
                                key={card.id}
                                type="button"
                                disabled={!legal || state.phase !== 'playing'}
                                onClick={() => {
                                  if (!legal) return;
                                  sounds.hustleCard();
                                  vibrate(45);
                                  if (card.isWhot) {
                                    setWhotCardId(card.id);
                                  } else {
                                    sendIntent(legal);
                                  }
                                }}
                                className="whot-hand-card shrink-0 disabled:cursor-not-allowed"
                                style={{ animationDelay: `${index * 45}ms` }}
                                aria-label={legal ? `Play ${card.label}` : `${card.label} cannot be played now`}
                              >
                                <WhotCardFace card={card} disabled={!legal} playable={Boolean(legal)} />
                              </button>
                            );
                          })}
                        </div>
                        {legalIntents.some((intent) => intent.type === 'draw') && (
                          <Button
                            className="neon-primary h-14 w-full rounded-xl"
                            onClick={() => {
                              sounds.hustleCard();
                              vibrate(35);
                              sendIntent({ type: 'draw' });
                            }}
                          >
                            {mine.pendingPick && mine.pendingPick > 0 ? `Pick ${mine.pendingPick}` : 'Go to market'}
                          </Button>
                        )}
                      </div>
                    )}

                    {whotCardId && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setWhotCardId(null)}>
                        <div className="rounded-2xl border border-secondary/40 bg-[#090713] p-6 shadow-[0_0_40px_rgba(179,76,255,.3)]" onClick={(e) => e.stopPropagation()}>
                          <p className="mb-4 text-center text-lg font-bold text-secondary">Call a shape</p>
                          <p className="mb-4 text-center text-xs text-muted-foreground">The next player must match the shape you pick.</p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {WHOT_SHAPES.map((shape) => (
                              <button
                                key={shape}
                                type="button"
                                className="flex flex-col items-center gap-1 rounded-xl border border-white/20 bg-white/[0.035] px-5 py-4 transition hover:border-secondary/70 hover:bg-secondary/10"
                                onClick={() => {
                                  sounds.hustleCard();
                                  vibrate(45);
                                  sendIntent({ type: 'play_card', cardId: whotCardId, calledShape: shape });
                                  setWhotCardId(null);
                                }}
                              >
                                <span className="text-3xl">{whotShapeGlyph[shape]}</span>
                                <span className="text-xs font-bold">{shape}</span>
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.035] py-2 text-xs text-muted-foreground hover:text-white"
                            onClick={() => setWhotCardId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(role === 'crowd' || (!isHost && mine.seated === false)) && (
              <p className="p-5 text-center text-sm text-muted-foreground">
                You joined after this game started. You’re watching from the crowd and will be seated in the next game.
              </p>
            )}
            {canUseHostControls && state.phase !== 'finished' && (
              <div className="border-t border-white/10 p-4 text-center">
                {challenge ? (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">{state.submittedCount ?? 0} of {state.players.length} players locked in</p>
                    <Button className="neon-primary min-w-52 rounded-xl" onClick={() => sendIntent({ type: 'advance' })}>
                      <FastForward className="h-4 w-4" /> {state.phase === 'playing' ? 'Reveal answers' : 'Next round'}
                    </Button>
                  </>
                ) : state.mode === 'whot' && state.phase === 'round_end' ? (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Round {state.round} complete — {state.players.find((p) => p.id === state.winnerPlayerIds[0])?.name ?? 'Winner'} won this round!
                    </p>
                    <Button className="neon-primary min-w-52 rounded-xl" onClick={() => sendIntent({ type: 'advance' })}>
                      <FastForward className="h-4 w-4" /> Next round
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Board actions are controlled by the active player’s controller.</p>
                )}
              </div>
            )}
            {state.phase === 'finished' && (
              <div className="flex items-center justify-center gap-3 p-8 text-2xl font-bold text-primary"><Trophy /> Game complete</div>
            )}
          </div>
        </section>

        {state.mode !== 'whot' && <aside className="neon-panel rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Players</p>
          <div className="mt-3 space-y-2">
            {sortedPlayers.map((player, index) => {
              const points = state.lastResults?.find((result) => result.playerId === player.id)?.points;
              return (
                <div key={player.id} className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-3 py-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-primary/60 bg-primary/10 text-xs">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{player.name}</span>
                  <span className="text-sm font-bold text-primary">{player.score}{points ? <small className="ml-1">+{points}</small> : null}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">{state.lastAction}</p>
        </aside>}
      </div>
      {aiCommentary && state.mode !== 'whot' && (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-xl border border-secondary/50 bg-[#090713]/95 px-5 py-3 text-center text-sm shadow-[0_0_24px_rgba(179,76,255,.25)]">
          {aiCommentary}
        </div>
      )}
    </main>
  );
}
