import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/hooks/useColyseusRoom.ts', 'utf8');

describe('Whot AI host loop broadcast parity', () => {
  it('queues Whot transitions, folds signals, sends commentary, and broadcasts recap once', () => {
    expect(source).toContain('mapWhotTransitionToEvents');
    expect(source).toContain('foldEventsIntoSignals');
    expect(source).toContain("getCommentary({ roomCode: roomState.code, events: dedup, players, gameType: 'whot', persona: roomState.roomSettings?.aiPersona })");
    expect(source).toContain("handleRef.current?.send({ type: 'host:broadcast_commentary', line })");
    expect(source).toContain('if (whotRecapRequestedRef.current) return;');
    expect(source).toContain('buildWhotRecapInput');
    expect(source).toContain("handleRef.current?.send({ type: 'host:broadcast_recap', recap: r })");
  });

  it('resets Whot AI refs on lobby/play-again', () => {
    expect(source).toContain("roomState.status === 'lobby'");
    expect(source).toContain('resetWhotAIRefs();');
  });
});
