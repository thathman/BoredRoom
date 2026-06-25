import { describe, expect, it } from 'vitest';
import {
  buildHouseSession,
  buildGameRun,
  buildSessionEvent,
  persistHouseSession,
  persistGameRun,
  appendSessionEvent,
  rememberController,
} from '../../server/src/foundations';
import type { ControllerDevice } from '../../shared/src/contracts/session';

// Live-DB integration (AC-1.2 schema + AC-1.7 controller persistence across sessions).
// Gated on SUPABASE_INTEGRATION=1 so the normal suite stays hermetic.
const RUN = process.env.SUPABASE_INTEGRATION === '1';
const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function getRows(path: string): Promise<unknown[]> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<unknown[]>;
}

describe.runIf(RUN)('foundations against live Supabase', () => {
  it('AC-1.2: persists and reads back a house session + game run + event', async () => {
    const s = buildHouseSession({ hostDeviceId: 'host-int' });
    expect(await persistHouseSession(s)).toBe('ok');

    const run = buildGameRun({ houseSessionId: s.id, gameType: 'whot', gameVersion: '1.1.0.0' });
    expect(await persistGameRun(run)).toBe('ok');

    const ev = buildSessionEvent({ sessionId: s.id, gameRunId: run.id, type: 'game.started' });
    expect(await appendSessionEvent(ev)).toBe('ok');

    const sessions = (await getRows(`house_sessions?id=eq.${s.id}&select=*`)) as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].code).toBe(s.code);

    const runs = await getRows(`game_runs?house_session_id=eq.${s.id}`);
    expect(runs).toHaveLength(1);

    const events = await getRows(`session_events?session_id=eq.${s.id}`);
    expect(events).toHaveLength(1);

  });

  it('AC-1.7: a controller device is remembered across two sessions', async () => {
    const deviceId = `ctrl-int-${Date.now()}`;
    const sA = buildHouseSession({ hostDeviceId: 'h' });
    const sB = buildHouseSession({ hostDeviceId: 'h' });
    await persistHouseSession(sA);
    await persistHouseSession(sB);

    const afterA: ControllerDevice = {
      id: deviceId,
      displayName: 'Ada',
      lastSeenAt: new Date().toISOString(),
      pairedSessionIds: [sA.id],
    };
    expect(await rememberController(afterA)).toBe('ok');

    // Re-join in a later session: same device id, accumulated session list.
    const afterB: ControllerDevice = {
      ...afterA,
      lastSeenAt: new Date().toISOString(),
      pairedSessionIds: [sA.id, sB.id],
    };
    expect(await rememberController(afterB)).toBe('ok');

    const rows = (await getRows(`controller_devices?id=eq.${deviceId}&select=*`)) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1); // upserted, not duplicated
    expect(rows[0].display_name).toBe('Ada');
    expect(rows[0].paired_session_ids).toEqual([sA.id, sB.id]);
  });
});
