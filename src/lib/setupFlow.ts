// Room setup wizard — pure state machine.
//
// You create a room and tune house rules; all installed games are available at play time (packs are
// an install mechanism, not a play-time choice — see /packs). Kept as a reducer so the flow is fully
// testable and the screen stays a thin renderer. Review emits the input for buildHouseSession.

export type SetupStep = 'settings' | 'review';

export const SETUP_STEPS: SetupStep[] = ['settings', 'review'];

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
  settings: SetupSettings;
}

export type SetupAction =
  | { type: 'set_setting'; key: keyof SetupSettings; value: SetupSettings[keyof SetupSettings] }
  | { type: 'next' }
  | { type: 'back' };

export function initialSetupState(): SetupState {
  return { step: 'settings', settings: { ...DEFAULT_SETUP_SETTINGS } };
}

export function canAdvance(_state: SetupState): boolean {
  return true; // no required pack choice anymore
}

function stepIndex(step: SetupStep): number {
  return SETUP_STEPS.indexOf(step);
}

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'set_setting':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };
    case 'next':
      return { ...state, step: SETUP_STEPS[Math.min(stepIndex(state.step) + 1, SETUP_STEPS.length - 1)] };
    case 'back':
      return { ...state, step: SETUP_STEPS[Math.max(stepIndex(state.step) - 1, 0)] };
    default:
      return state;
  }
}

export interface CreateSessionInput {
  hostDeviceId: string;
  selectedPackIds: string[];
  settings: SetupSettings;
}

// Review -> the payload consumed by foundations.buildHouseSession. Sessions are not pack-scoped, so
// selectedPackIds is empty; all installed games are available to the room.
export function toCreateSessionInput(state: SetupState, hostDeviceId: string): CreateSessionInput {
  return { hostDeviceId, selectedPackIds: [], settings: state.settings };
}
