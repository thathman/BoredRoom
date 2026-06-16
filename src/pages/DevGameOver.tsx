import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { GameOver } from '@/components/room/GameOver';
import type { RoomState } from '@/lib/realtimeRoom';

const BASE: RoomState = {
  code: 'TEST',
  hostId: 'h1',
  status: 'finished',
  members: [],
  gameState: null,
  reactions: [],
};

function makeState(gameId: string): RoomState & Record<string, unknown> {
  const players = [
    { id: 'p1', displayName: 'Ada', color: 'red' },
    { id: 'p2', displayName: 'Bola', color: 'blue' },
  ];
  switch (gameId) {
    case 'whot':
      return {
        ...BASE,
        gameType: 'whot',
        whotState: { winnerId: 'p1', players: [{ ...players[0], handCount: 0 }, { ...players[1], handCount: 3 }] },
      };
    case 'trivia':
      return { ...BASE, gameType: 'trivia', triviaState: { winnerId: 'p1', players: [{ ...players[0], score: 120 }, { ...players[1], score: 90 }] } };
    case 'logo':
      return { ...BASE, gameType: 'logo', logoState: { winnerId: 'p1', players: [{ ...players[0], score: 10 }, { ...players[1], score: 7 }] } };
    case 'half-half':
      return { ...BASE, gameType: 'half-half', halfHalfState: { winnerId: 'p1', players: [{ ...players[0], score: 350 }, { ...players[1], score: 240 }] } };
    case 'color-wahala':
      return { ...BASE, gameType: 'color-wahala', colorWahalaState: { winnerId: 'p1', players: [{ ...players[0], score: 440 }, { ...players[1], score: 380 }] } };
    case 'landlord':
      return {
        ...BASE,
        gameType: 'landlord',
        landlordState: { winnerId: 'p1', players: [{ ...players[0], money: 1800, bankrupt: false }, { ...players[1], money: 0, bankrupt: true }] },
      };
    case 'connect-4':
      return { ...BASE, gameType: 'connect-4', connect4State: { winnerId: 'p1', players } };
    case 'ettt':
      return { ...BASE, gameType: 'ettt', etttState: { winnerId: 'p1', players } };
    case 'ludo':
    default:
      return {
        ...BASE,
        gameType: 'ludo',
        gameState: {
          winner: 'p1',
          turnNumber: 10,
          players: [
            { ...players[0], finishedTokens: 4, tokens: [] },
            { ...players[1], finishedTokens: 2, tokens: [] },
          ],
          currentPlayerIndex: 0,
          phase: 'playing',
          dice: [],
          rollCountThisTurn: 0,
          sixesInRow: 0,
          winnerColor: 'red',
        } as unknown as RoomState['gameState'],
      };
  }
}

export default function DevGameOverPage() {
  const { gameId = 'ludo' } = useParams();
  const state = useMemo(() => makeState(gameId), [gameId]);
  return <GameOver roomState={state as RoomState} playerId="p1" isHost={false} recap={null} />;
}
