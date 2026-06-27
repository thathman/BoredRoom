import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';

type Tile = { id: string; letter: string; value: number };
type BoardCell = { letter: string; value: number; ownerId?: string; turn?: number } | null;
type Placement = { tileId: string; row: number; col: number };
type WordState = {
  board?: BoardCell[][];
  players?: Array<{ id: string; name: string; score: number }>;
  currentPlayerId?: string;
  turn?: number;
  bagCount?: number;
  phase?: string;
  lastMove?: { playerId: string; words: string[]; score: number; placements: Array<{ row: number; col: number; letter: string }> } | null;
  lastAction?: string;
};
type WordPrivateState = {
  isTurn?: boolean;
  rack?: Tile[];
  legalIntents?: Array<Record<string, unknown> & { type?: string }>;
};

const PREMIUMS: Record<string, { label: string; className: string }> = {};
function premium(label: string, className: string, coordinates: number[][]) {
  for (const [row, col] of coordinates) PREMIUMS[`${row}:${col}`] = { label, className };
}
premium('TW', 'bg-rose-500/35 text-rose-100', [[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]]);
premium('DW', 'bg-fuchsia-500/30 text-fuchsia-100', [[1,1],[2,2],[3,3],[4,4],[7,7],[10,10],[11,11],[12,12],[13,13],[1,13],[2,12],[3,11],[4,10],[10,4],[11,3],[12,2],[13,1]]);
premium('TL', 'bg-sky-500/30 text-sky-100', [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]]);
premium('DL', 'bg-emerald-500/25 text-emerald-100', [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]]);

export function WordWahalaSurface({
  state,
  mine,
  role,
  sendIntent,
}: {
  state: WordState;
  mine: WordPrivateState;
  role: 'display' | 'controller' | 'crowd' | 'companion';
  sendIntent: (intent: Record<string, unknown>) => void;
}) {
  const board = state.board ?? [];
  const rack = useMemo(() => mine.rack ?? [], [mine.rack]);
  const isController = role === 'controller';
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [swapMode, setSwapMode] = useState(false);
  const [swapIds, setSwapIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedTileId(null);
    setPlacements([]);
    setSwapIds([]);
    setSwapMode(false);
  }, [state.currentPlayerId, state.turn]);

  const rackById = useMemo(() => new Map(rack.map((tile) => [tile.id, tile])), [rack]);
  const localByCell = useMemo(() => new Map(placements.map((placement) => [`${placement.row}:${placement.col}`, placement])), [placements]);
  const placedIds = useMemo(() => new Set(placements.map((placement) => placement.tileId)), [placements]);
  const canPlace = mine.isTurn && state.phase === 'playing';

  function chooseTile(tileId: string) {
    if (!canPlace || placedIds.has(tileId)) return;
    if (swapMode) {
      setSwapIds((current) => current.includes(tileId) ? current.filter((id) => id !== tileId) : [...current, tileId]);
      return;
    }
    setSelectedTileId((current) => current === tileId ? null : tileId);
  }

  function chooseCell(row: number, col: number) {
    if (!canPlace || board[row]?.[col]) return;
    const key = `${row}:${col}`;
    const local = localByCell.get(key);
    if (local) {
      setPlacements((current) => current.filter((placement) => placement !== local));
      setSelectedTileId(local.tileId);
      return;
    }
    if (!selectedTileId) return;
    setPlacements((current) => [...current.filter((placement) => placement.tileId !== selectedTileId), { tileId: selectedTileId, row, col }]);
    setSelectedTileId(null);
  }

  function submitPlacement() {
    if (placements.length === 0) return;
    sendIntent({ type: 'place_tiles', placements });
    setPlacements([]);
    setSelectedTileId(null);
  }

  return (
    <main className="star-field min-h-screen bg-[#020817] px-3 pb-5 pt-4 text-white sm:px-6">
      <header className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3"><BrandLogo className="text-2xl" /><span className="text-sm font-semibold">🔡 Word Wahala</span></div>
        <span className="text-xs text-muted-foreground">Turn {state.turn ?? 1} · {state.bagCount ?? 0} tiles left</span>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_250px]">
        <section className="min-w-0">
          <div className="mx-auto w-full max-w-[760px] overflow-auto rounded-2xl border border-primary/25 bg-[#071018] p-1.5 shadow-[0_0_32px_rgba(69,243,107,.12)] sm:p-2">
            <div className="grid aspect-square min-w-[600px] gap-[2px]" style={{ gridTemplateColumns: 'repeat(15,minmax(0,1fr))' }} aria-label="Word Wahala board">
              {board.flatMap((row, rowIndex) => row.map((cell, colIndex) => {
                const local = localByCell.get(`${rowIndex}:${colIndex}`);
                const localTile = local ? rackById.get(local.tileId) : null;
                const premiumSquare = PREMIUMS[`${rowIndex}:${colIndex}`];
                const occupied = cell ?? (localTile ? { letter: localTile.letter, value: localTile.value } : null);
                return (
                  <button
                    key={`${rowIndex}:${colIndex}`}
                    type="button"
                    disabled={!isController || !canPlace || Boolean(cell)}
                    onClick={() => chooseCell(rowIndex, colIndex)}
                    aria-label={occupied ? `${occupied.letter}, ${occupied.value} points` : `Row ${rowIndex + 1}, column ${colIndex + 1}${premiumSquare ? `, ${premiumSquare.label}` : ''}`}
                    className={`relative grid min-h-0 place-items-center rounded-[3px] border text-[clamp(7px,1.25vw,15px)] font-black transition ${
                      localTile
                        ? 'border-amber-200 bg-amber-300 text-[#231600] shadow-[0_0_8px_rgba(252,211,77,.55)]'
                        : cell
                          ? 'border-amber-100/60 bg-[#e6bc63] text-[#261a08]'
                          : premiumSquare?.className ?? 'border-white/[0.06] bg-white/[0.025] text-white/15'
                    }`}
                  >
                    {occupied ? occupied.letter : premiumSquare?.label ?? (rowIndex === 7 && colIndex === 7 ? '★' : '')}
                    {occupied ? <small className="absolute bottom-0 right-[2px] text-[6px] opacity-70 sm:text-[8px]">{occupied.value}</small> : null}
                  </button>
                );
              }))}
            </div>
          </div>

          {isController && (
            <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{mine.isTurn ? 'Your rack' : 'Waiting for your turn'}</p>
                <Button size="sm" variant={swapMode ? 'default' : 'outline'} disabled={!mine.isTurn || placements.length > 0} onClick={() => { setSwapMode((value) => !value); setSelectedTileId(null); setSwapIds([]); }}>
                  {swapMode ? 'Cancel swap' : 'Swap tiles'}
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {rack.map((tile) => {
                  const selected = selectedTileId === tile.id || swapIds.includes(tile.id);
                  const placed = placedIds.has(tile.id);
                  return (
                    <button key={tile.id} type="button" disabled={!mine.isTurn || placed} onClick={() => chooseTile(tile.id)} aria-label={`Tile ${tile.letter}, ${tile.value} points`}
                      className={`relative grid h-12 w-11 place-items-center rounded-lg border font-black ${selected ? 'border-primary bg-primary text-[#031008]' : placed ? 'border-white/10 bg-white/5 text-white/25' : 'border-amber-100/70 bg-[#e6bc63] text-[#261a08]'}`}>
                      {tile.letter}<small className="absolute bottom-1 right-1 text-[9px]">{tile.value}</small>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {swapMode ? (
                  <Button className="neon-primary col-span-2" disabled={swapIds.length === 0} onClick={() => sendIntent({ type: 'swap', tileIds: swapIds })}>Swap {swapIds.length || ''}</Button>
                ) : (
                  <Button className="neon-primary col-span-2" disabled={placements.length === 0} onClick={submitPlacement}><Check className="h-4 w-4" /> Play word</Button>
                )}
                <Button variant="outline" disabled={placements.length === 0} onClick={() => { setPlacements([]); setSelectedTileId(null); }}><RotateCcw className="h-4 w-4" /> Clear</Button>
                <Button variant="outline" disabled={!mine.isTurn || placements.length > 0} onClick={() => sendIntent({ type: 'pass' })}>Pass</Button>
              </div>
            </div>
          )}
        </section>

        <aside className="neon-panel rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Scoreboard</p>
          <div className="mt-3 space-y-2">
            {(state.players ?? []).map((player) => (
              <div key={player.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${player.id === state.currentPlayerId ? 'border border-primary/50 bg-primary/10' : 'bg-white/[0.035]'}`}>
                <span className="truncate text-sm">{player.name}</span><strong className="text-primary">{player.score}</strong>
              </div>
            ))}
          </div>
          {state.lastMove?.words?.length ? <p className="mt-4 text-sm"><span className="text-primary">{state.lastMove.words.join(' + ')}</span> · {state.lastMove.score} pts</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">{state.lastAction}</p>
        </aside>
      </div>
    </main>
  );
}
