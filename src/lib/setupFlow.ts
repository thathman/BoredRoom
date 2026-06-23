// Pack-first setup wizard (Phase 3) — pure state machine.
//
// Drives the host through: pick packs -> tune settings -> review -> create session. Kept as a
// reducer so the flow is fully testable and the React screen stays a thin renderer (constitution
// Art. IV.3). The review step emits the input for foundations.buildHouseSession (Phase 1).

import { getPack, type PackManifest } from '@/lib/packs';

export type SetupStep = 'select_packs' | 'settings' | 'review';

export const SETUP_STEPS: SetupStep[] = ['select_packs', 'settings', 'review'];

// Subset of HouseSessionSettings the host tunes in the wizard; the rest take schema defaults.
export interface SetupSettings {
  allowBots: boolean;
  hintsEnabled: boolean;
  allowCrowdVotes: boolean;
  language: 'en' | 'pcm';
}

export const DEFAULT_SETUP_SETTINGS: SetupSettings = {
  allowBots: true,
  hintsEnabled: true,
  allowCrowdVotes: false,
  language: 'en',
};

export interface SetupState {
  step: SetupStep;
  selectedPackIds: string[];
  settings: SetupSettings;
}

export type SetupAction =
  | { type: 'toggle_pack'; packId: string }
  | { type: 'set_setting'; key: keyof SetupSettings; value: SetupSettings[keyof SetupSettings] }
  | { type: 'next' }
  | { type: 'back' };

export function initialSetupState(): SetupState {
  return { step: 'select_packs', selectedPackIds: [], settings: { ...DEFAULT_SETUP_SETTINGS } };
}

// A step is only complete enough to advance when its requirements are met.
export function canAdvance(state: SetupState): boolean {
  if (state.step === 'select_packs') return state.selectedPackIds.length > 0;
  return true;
}

function stepIndex(step: SetupStep): number {
  return SETUP_STEPS.indexOf(step);
}

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'toggle_pack': {
      if (!getPack(action.packId)) return state; // ignore unknown packs
      const has = state.selectedPackIds.includes(action.packId);
      return {
        ...state,
        selectedPackIds: has
          ? state.selectedPackIds.filter((id) => id !== action.packId)
          : [...state.selectedPackIds, action.packId],
      };
    }
    case 'set_setting':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };
    case 'next': {
      if (!canAdvance(state)) return state;
      const next = SETUP_STEPS[Math.min(stepIndex(state.step) + 1, SETUP_STEPS.length - 1)];
      return { ...state, step: next };
    }
    case 'back': {
      const prev = SETUP_STEPS[Math.max(stepIndex(state.step) - 1, 0)];
      return { ...state, step: prev };
    }
    default:
      return state;
  }
}

export interface CreateSessionInput {
  hostDeviceId: string;
  selectedPackIds: string[];
  activePackId?: string;
  settings: SetupSettings;
}

// Review -> the payload consumed by foundations.buildHouseSession. The first selected pack is the
// active one by default.
export function toCreateSessionInput(state: SetupState, hostDeviceId: string): CreateSessionInput {
  if (state.selectedPackIds.length === 0) throw new Error('no_packs_selected');
  return {
    hostDeviceId,
    selectedPackIds: state.selectedPackIds,
    activePackId: state.selectedPackIds[0],
    settings: state.settings,
  };
}

export function selectedPacks(state: SetupState): PackManifest[] {
  return state.selectedPackIds.map((id) => getPack(id)).filter((p): p is PackManifest => p !== null);
}
