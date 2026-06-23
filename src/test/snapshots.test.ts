import { describe, expect, it } from 'vitest';
import {
  createSnapshot,
  restoreFromSnapshot,
  latestSnapshot,
  issueRecoveryToken,
  isRecoveryTokenValid,
} from '../../shared/src/recovery/snapshots';

// AC-10.1: snapshot + restore returns a recoverable run to its last snapshot after disconnect.
describe('snapshots & recovery', () => {
  it('captures and restores run state', () => {
    const snap = createSnapshot({ gameRunId: 'r1', state: { phase: 'active', turn: 3 } });
    expect(snap.kind).toBe('full_state');
    expect(restoreFromSnapshot<{ turn: number }>(snap, 'r1')?.turn).toBe(3);
  });

  it('refuses to restore a snapshot from another run', () => {
    const snap = createSnapshot({ gameRunId: 'r1', state: { x: 1 } });
    expect(restoreFromSnapshot(snap, 'r2')).toBeNull();
  });

  it('picks the most recent snapshot for a run', () => {
    const a = createSnapshot({ gameRunId: 'r1', state: 'old', now: '2026-06-23T00:00:00.000Z' });
    const b = createSnapshot({ gameRunId: 'r1', state: 'new', now: '2026-06-23T00:05:00.000Z' });
    const other = createSnapshot({ gameRunId: 'r2', state: 'nope', now: '2026-06-23T09:00:00.000Z' });
    expect(latestSnapshot([a, other, b], 'r1')?.state).toBe('new');
    expect(latestSnapshot([other], 'r1')).toBeNull();
  });

  it('supports event-replay snapshots', () => {
    const snap = createSnapshot({ gameRunId: 'r1', state: [{ t: 'move' }], kind: 'event_replay' });
    expect(snap.kind).toBe('event_replay');
  });

  it('issues a recovery token valid only for its device before expiry', () => {
    const t0 = 1_000_000;
    const token = issueRecoveryToken({ sessionId: 's1', deviceId: 'd1', ttlMs: 1000, now: t0 });
    expect(isRecoveryTokenValid(token, 'd1', t0 + 500)).toBe(true);
    expect(isRecoveryTokenValid(token, 'd2', t0 + 500)).toBe(false); // wrong device
    expect(isRecoveryTokenValid(token, 'd1', t0 + 2000)).toBe(false); // expired
  });
});
