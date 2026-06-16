import { describe, it, expect } from 'vitest';
import { deriveGameResult } from '@/lib/gameResult';

type ResultInput = Parameters<typeof deriveGameResult>[0];

describe('deriveGameResult', () => {
  it('derives ludo standings and winner', () => {
    const out = deriveGameResult({
      gameType: 'ludo',
      gameState: {
        winner: 'p2',
        players: [
          { id: 'p1', displayName: 'A', color: 'red', finishedTokens: 2 },
          { id: 'p2', displayName: 'B', color: 'blue', finishedTokens: 4 },
        ],
      },
    } as unknown as ResultInput);
    expect(out.winnerId).toBe('p2');
    expect(out.standings[0].id).toBe('p2');
    expect(out.standings[0].label).toBe('4/4 home');
  });

  it('derives whot hand-count ranking', () => {
    const out = deriveGameResult({
      gameType: 'whot',
      whotState: {
        winnerId: 'p1',
        players: [
          { id: 'p1', displayName: 'A', handCount: 0 },
          { id: 'p2', displayName: 'B', handCount: 3 },
        ],
      },
    } as unknown as ResultInput);
    expect(out.winnerName).toBe('A');
    expect(out.standings[0].label).toBe('0 cards');
  });

  it('derives trivia/logo/half-half/color-wahala scoreboards', () => {
    const gameTypes = ['trivia', 'logo', 'half-half', 'color-wahala'] as const;
    for (const gameType of gameTypes) {
      const key = gameType === 'half-half' ? 'halfHalfState' : gameType === 'color-wahala' ? 'colorWahalaState' : `${gameType}State`;
      const out = deriveGameResult({
        gameType,
        [key]: {
          winnerId: 'p2',
          players: [
            { id: 'p1', displayName: 'A', score: 4 },
            { id: 'p2', displayName: 'B', score: 7 },
          ],
        },
      } as unknown as ResultInput);
      expect(out.winnerId).toBe('p2');
      expect(out.standings[0].label).toBe('7 pts');
    }
  });

  it('derives connect-4 and ettt binary standings', () => {
    for (const gameType of ['connect-4', 'ettt'] as const) {
      const key = gameType === 'connect-4' ? 'connect4State' : 'etttState';
      const out = deriveGameResult({
        gameType,
        [key]: {
          winnerId: 'p1',
          players: [
            { id: 'p1', displayName: 'A' },
            { id: 'p2', displayName: 'B' },
          ],
        },
      } as unknown as ResultInput);
      expect(out.standings.find((s) => s.id === 'p1')?.label).toBe('Winner');
      expect(out.standings.find((s) => s.id === 'p2')?.label).toBe('Player');
    }
  });

  it('derives landlord bankrupt labels', () => {
    const out = deriveGameResult({
      gameType: 'landlord',
      landlordState: {
        winnerId: 'p1',
        players: [
          { id: 'p1', displayName: 'A', money: 1200, bankrupt: false },
          { id: 'p2', displayName: 'B', money: 0, bankrupt: true },
        ],
      },
    } as unknown as ResultInput);
    expect(out.standings[0].label).toBe('₦1200');
    expect(out.standings[1].label).toBe('Bankrupt');
  });
});
