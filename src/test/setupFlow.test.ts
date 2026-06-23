import { describe, expect, it } from 'vitest';
import {
  initialSetupState,
  setupReducer,
  canAdvance,
  toCreateSessionInput,
  selectedPacks,
  type SetupState,
} from '@/lib/setupFlow';
import { buildHouseSession } from '../../server/src/foundations';

// AC-3.1: setup wizard produces a session with selected packs + settings; review reflects them.
describe('setup flow', () => {
  it('cannot advance from pack selection with no packs', () => {
    const s = initialSetupState();
    expect(canAdvance(s)).toBe(false);
    expect(setupReducer(s, { type: 'next' }).step).toBe('select_packs');
  });

  it('toggles packs and ignores unknown ones', () => {
    let s = initialSetupState();
    s = setupReducer(s, { type: 'toggle_pack', packId: 'pack.naija' });
    s = setupReducer(s, { type: 'toggle_pack', packId: 'pack.bogus' });
    expect(s.selectedPackIds).toEqual(['pack.naija']);
    s = setupReducer(s, { type: 'toggle_pack', packId: 'pack.naija' }); // untoggle
    expect(s.selectedPackIds).toEqual([]);
  });

  it('walks select -> settings -> review and back', () => {
    let s = initialSetupState();
    s = setupReducer(s, { type: 'toggle_pack', packId: 'pack.naija' });
    s = setupReducer(s, { type: 'next' });
    expect(s.step).toBe('settings');
    s = setupReducer(s, { type: 'set_setting', key: 'language', value: 'pcm' });
    s = setupReducer(s, { type: 'next' });
    expect(s.step).toBe('review');
    s = setupReducer(s, { type: 'back' });
    expect(s.step).toBe('settings');
    expect(s.settings.language).toBe('pcm');
  });

  it('review emits a payload that builds a valid HouseSession', () => {
    let s: SetupState = initialSetupState();
    s = setupReducer(s, { type: 'toggle_pack', packId: 'pack.classics' });
    s = setupReducer(s, { type: 'toggle_pack', packId: 'pack.naija' });
    s = setupReducer(s, { type: 'set_setting', key: 'allowBots', value: false });

    const input = toCreateSessionInput(s, 'host-9');
    expect(input.activePackId).toBe('pack.classics'); // first selected
    expect(input.selectedPackIds).toEqual(['pack.classics', 'pack.naija']);

    const session = buildHouseSession(input);
    expect(session.hostDeviceId).toBe('host-9');
    expect(session.selectedPackIds).toEqual(['pack.classics', 'pack.naija']);
    expect(session.settings.allowBots).toBe(false);
    expect(session.status).toBe('setup');
  });

  it('selectedPacks resolves manifests in order', () => {
    let s = initialSetupState();
    s = setupReducer(s, { type: 'toggle_pack', packId: 'pack.brains' });
    expect(selectedPacks(s).map((p) => p.id)).toEqual(['pack.brains']);
  });

  it('throws if reviewing with no packs', () => {
    expect(() => toCreateSessionInput(initialSetupState(), 'h')).toThrow();
  });
});
