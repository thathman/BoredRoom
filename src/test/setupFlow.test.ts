import { describe, expect, it } from 'vitest';
import {
  initialSetupState,
  setupReducer,
  toCreateSessionInput,
} from '@/lib/setupFlow';
import { buildHouseSession } from '../../server/src/foundations';

// Rooms aren't pack-scoped: the wizard just tunes settings, then opens a room (all installed games
// available). AC-3.1 reframed around the new model.
describe('room setup flow', () => {
  it('starts at settings and advances to review', () => {
    let s = initialSetupState();
    expect(s.step).toBe('settings');
    s = setupReducer(s, { type: 'next' });
    expect(s.step).toBe('review');
    s = setupReducer(s, { type: 'back' });
    expect(s.step).toBe('settings');
  });

  it('tunes settings', () => {
    let s = initialSetupState();
    s = setupReducer(s, { type: 'set_setting', key: 'language', value: 'pcm' });
    s = setupReducer(s, { type: 'set_setting', key: 'allowBots', value: false });
    expect(s.settings.language).toBe('pcm');
    expect(s.settings.allowBots).toBe(false);
  });

  it('review emits a payload that builds a valid, pack-agnostic HouseSession', () => {
    let s = initialSetupState();
    s = setupReducer(s, { type: 'set_setting', key: 'allowBots', value: false });
    const input = toCreateSessionInput(s, 'host-9');
    const session = buildHouseSession(input);
    expect(session.hostDeviceId).toBe('host-9');
    expect(session.settings.allowBots).toBe(false);
    expect(session.status).toBe('open_lobby');
  });
});
