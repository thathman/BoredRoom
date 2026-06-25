import { describe, expect, it } from 'vitest';
import {
  createNativeGameRuntime,
  NATIVE_GAME_TYPES,
} from '../../server/src/nativeGames';

describe('native GameRuntime contract', () => {
  for (const gameType of NATIVE_GAME_TYPES) {
    it(`${gameType} seats, starts, snapshots, restores, and isolates private state`, () => {
      const players = [
        { id: 'p1', name: 'Ada' },
        { id: 'p2', name: 'Tobi' },
      ];
      const runtime = createNativeGameRuntime(gameType, players);

      expect(runtime.metadata.gameType).toBe(gameType);
      expect(runtime.metadata.capabilities.restore).toBe(true);
      expect(runtime.publicState()).toBeTruthy();
      expect(runtime.privateState('p1')).not.toBe(runtime.privateState('p2'));

      const saved = runtime.snapshot();
      runtime.restore(saved);
      expect(runtime.snapshot()).toEqual(saved);
      expect(runtime.finish().winnerPlayerIds).toEqual(runtime.winnerPlayerIds());

      runtime.dispose();
    });
  }
});
