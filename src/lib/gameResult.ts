import type { RoomState } from '@/lib/realtimeRoom';
import type { GameType } from '@/lib/transport/types';

export interface ResultStanding {
  id: string;
  displayName: string;
  color?: string;
  score: number;
  label: string;
}

export interface DerivedGameResult {
  gameType: GameType;
  winnerId: string | null;
  winnerName: string;
  winnerColor?: string;
  standings: ResultStanding[];
}

type AnyRoom = RoomState & Record<string, unknown>;

export function deriveGameResult(roomState: AnyRoom): DerivedGameResult {
  const rs = roomState as {
    gameType?: GameType;
    gameState?: {
      winner: string | null;
      players: { id: string; displayName: string; color?: string; finishedTokens: number }[];
    } | null;
    whotState?: { winnerId: string | null; players: { id: string; displayName: string; handCount: number; color?: string }[] } | null;
    triviaState?: { winnerId: string | null; players: { id: string; displayName: string; score: number; color?: string }[] } | null;
    logoState?: { winnerId: string | null; players: { id: string; displayName: string; score: number; color?: string }[] } | null;
    halfHalfState?: { winnerId: string | null; players: { id: string; displayName: string; score: number; color?: string }[] } | null;
    colorWahalaState?: { winnerId: string | null; players: { id: string; displayName: string; score: number; color?: string }[] } | null;
    landlordState?: { winnerId: string | null; players: { id: string; displayName: string; money: number; bankrupt: boolean; color?: string }[] } | null;
    connect4State?: { winnerId: string | null; players: { id: string; displayName: string; color?: string }[] } | null;
    etttState?: { winnerId: string | null; players: { id: string; displayName: string; color?: string }[] } | null;
    hustleState?: { winnerId: string | null; winnerExit?: string | null; players: { id: string; displayName: string; position: number; money: number; documents: number; color?: string }[] } | null;
    wordWahalaState?: { winnerId: string | null; players: { id: string; displayName: string; score: number; color?: string }[] } | null;
  };

  const gameType: GameType = rs.gameType ?? 'ludo';
  let winnerId: string | null = null;
  let winnerName = '';
  let winnerColor: string | undefined;
  let standings: ResultStanding[] = [];

  if (gameType === 'whot' && rs.whotState) {
    winnerId = rs.whotState.winnerId;
    const winner = rs.whotState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = [...rs.whotState.players]
      .sort((a, b) => a.handCount - b.handCount)
      .map((p) => ({ id: p.id, displayName: p.displayName, color: p.color, score: -p.handCount, label: `${p.handCount} cards` }));
  } else if (gameType === 'trivia' && rs.triviaState) {
    winnerId = rs.triviaState.winnerId;
    const winner = rs.triviaState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = scoreStandings(rs.triviaState.players, 'pts');
  } else if (gameType === 'logo' && rs.logoState) {
    winnerId = rs.logoState.winnerId;
    const winner = rs.logoState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = scoreStandings(rs.logoState.players, 'pts');
  } else if (gameType === 'half-half' && rs.halfHalfState) {
    winnerId = rs.halfHalfState.winnerId;
    const winner = rs.halfHalfState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = scoreStandings(rs.halfHalfState.players, 'pts');
  } else if (gameType === 'color-wahala' && rs.colorWahalaState) {
    winnerId = rs.colorWahalaState.winnerId;
    const winner = rs.colorWahalaState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = scoreStandings(rs.colorWahalaState.players, 'pts');
  } else if (gameType === 'landlord' && rs.landlordState) {
    winnerId = rs.landlordState.winnerId;
    const winner = rs.landlordState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = [...rs.landlordState.players]
      .sort((a, b) => (b.bankrupt ? -1 : b.money) - (a.bankrupt ? -1 : a.money))
      .map((p) => ({
        id: p.id,
        displayName: p.displayName,
        color: p.color,
        score: p.bankrupt ? -1 : p.money,
        label: p.bankrupt ? 'Bankrupt' : `₦${p.money}`,
      }));
  } else if (gameType === 'connect-4' && rs.connect4State) {
    winnerId = rs.connect4State.winnerId;
    const winner = rs.connect4State.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = binaryStandings(rs.connect4State.players, winnerId);
  } else if (gameType === 'ettt' && rs.etttState) {
    winnerId = rs.etttState.winnerId;
    const winner = rs.etttState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = binaryStandings(rs.etttState.players, winnerId);
  } else if (gameType === 'hustle' && rs.hustleState) {
    winnerId = rs.hustleState.winnerId;
    const winner = rs.hustleState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = [...rs.hustleState.players]
      .sort((a, b) => b.position - a.position)
      .map((p) => ({
        id: p.id,
        displayName: p.displayName,
        color: p.color,
        score: p.position,
        label: p.id === winnerId ? `Japa'd${rs.hustleState?.winnerExit ? ` ${rs.hustleState.winnerExit.toUpperCase()}` : ''}` : `Sq ${p.position} · ₦${p.money}`,
      }));
  } else if (gameType === 'word-wahala' && rs.wordWahalaState) {
    winnerId = rs.wordWahalaState.winnerId;
    const winner = rs.wordWahalaState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = scoreStandings(rs.wordWahalaState.players, 'pts');
  } else if (rs.gameState) {
    winnerId = rs.gameState.winner ?? null;
    const winner = rs.gameState.players.find((p) => p.id === winnerId);
    winnerName = winner?.displayName ?? '';
    winnerColor = winner?.color;
    standings = [...rs.gameState.players]
      .sort((a, b) => b.finishedTokens - a.finishedTokens)
      .map((p) => ({ id: p.id, displayName: p.displayName, color: p.color, score: p.finishedTokens, label: `${p.finishedTokens}/4 home` }));
  }

  return { gameType, winnerId, winnerName, winnerColor, standings };
}

function scoreStandings<T extends { id: string; displayName: string; score: number; color?: string }>(
  players: T[],
  labelSuffix: string,
): ResultStanding[] {
  return [...players]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ id: p.id, displayName: p.displayName, color: p.color, score: p.score, label: `${p.score} ${labelSuffix}` }));
}

function binaryStandings<T extends { id: string; displayName: string; color?: string }>(
  players: T[],
  winnerId: string | null,
): ResultStanding[] {
  return players.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    color: p.color,
    score: p.id === winnerId ? 1 : 0,
    label: p.id === winnerId ? 'Winner' : 'Player',
  }));
}
