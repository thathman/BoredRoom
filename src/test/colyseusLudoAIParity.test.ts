import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/hooks/useColyseusRoom.ts', 'utf8');

describe('Colyseus Ludo AI parity', () => {
  it('runs a host-side Ludo AI loop with explicit gameType and server fan-out', () => {
    expect(source).toContain('mapLudoTransitionToEvents');
    expect(source).toContain("getCommentary({ roomCode: roomState.code, events: dedup, players, gameType: 'ludo', persona: roomState.roomSettings?.aiPersona })");
    expect(source).toContain("handleRef.current?.send({ type: 'host:broadcast_commentary', line })");
  });

  it('broadcasts Ludo recap through the same Colyseus path as Whot', () => {
    expect(source).toContain('buildLudoRecapInput');
    expect(source).toContain("handleRef.current?.send({ type: 'host:broadcast_recap', recap: r })");
  });
});
