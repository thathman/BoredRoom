import { describe, expect, it } from 'vitest';
import { resolveRoomSessionRole } from '@/lib/roomSession';

describe('resolveRoomSessionRole', () => {
  it('allows host mode only when token is bound to the current room and game', () => {
    expect(resolveRoomSessionRole({
      requestedHostMode: true,
      storedHostToken: 'token',
      storedRoomCode: 'XWC8',
      storedGameType: 'trivia',
      routeRoomCode: 'xwc8',
      routeGameType: 'trivia',
    })).toEqual({ isHost: true, shouldClearHostSession: false });
  });

  it('downgrades stale host sessions on controller URLs', () => {
    expect(resolveRoomSessionRole({
      requestedHostMode: true,
      storedHostToken: 'old-token',
      storedRoomCode: '56YK',
      storedGameType: 'ludo',
      routeRoomCode: 'XWC8',
      routeGameType: 'trivia',
    })).toEqual({ isHost: false, shouldClearHostSession: true });
  });

  it('does not clear normal player sessions', () => {
    expect(resolveRoomSessionRole({
      requestedHostMode: false,
      storedHostToken: '',
      storedRoomCode: null,
      storedGameType: null,
      routeRoomCode: 'XWC8',
      routeGameType: 'trivia',
    })).toEqual({ isHost: false, shouldClearHostSession: false });
  });
});
