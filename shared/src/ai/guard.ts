// AI safety guard + hint wallet (Phase 9).
//
// Constitution Art. II.4 / III.5: AI never mutates state — it emits *intents* the server validates
// like any other actor, and hints are earned/limited. This module is the chokepoint the AI edge
// functions (supabase/functions/ai-*) run their output through before anything reaches a game. Pure
// and deterministic so it is trivially testable and cannot be bypassed by a chatty model.

import type { LegalAction } from '../contracts/adapter.js';

// What the AI is allowed to produce: a proposed intent + why. Never raw state.
export interface AIProposal {
  intentType: string;
  payload?: Record<string, unknown>;
  rationale?: string;
}

export type ProposalRejectReason =
  | 'not_a_legal_action' // the intent isn't in the adapter's legal-action set for this player/state
  | 'forbidden_field' // payload tried to smuggle a state mutation
  | 'empty';

export interface ProposalEvaluation {
  ok: boolean;
  reason?: ProposalRejectReason;
  action?: LegalAction;
}

// Payload keys that would indicate the model is trying to set state directly rather than act through
// a legal intent. These are always rejected.
const FORBIDDEN_PAYLOAD_KEYS = ['state', 'score', 'scores', 'winner', 'phase', 'players'];

// Validate an AI proposal against the legal actions the (server-side) adapter computed. The AI can
// only ever pick from moves that are already legal — it gains no special power.
export function validateProposal(proposal: AIProposal, legalActions: LegalAction[]): ProposalEvaluation {
  if (!proposal || !proposal.intentType) return { ok: false, reason: 'empty' };

  if (proposal.payload) {
    for (const key of Object.keys(proposal.payload)) {
      if (FORBIDDEN_PAYLOAD_KEYS.includes(key)) return { ok: false, reason: 'forbidden_field' };
    }
  }

  const match = legalActions.find((a) => a.type === proposal.intentType);
  if (!match) return { ok: false, reason: 'not_a_legal_action' };

  return { ok: true, action: match };
}

// --- Hint wallet (earned/limited) -----------------------------------------

export interface HintWallet {
  budget: number; // total hints allowed this game/session
  used: number;
}

export function createHintWallet(budget: number): HintWallet {
  return { budget: Math.max(0, Math.floor(budget)), used: 0 };
}

export function hintsRemaining(wallet: HintWallet): number {
  return Math.max(0, wallet.budget - wallet.used);
}

export function canSpendHint(wallet: HintWallet): boolean {
  return hintsRemaining(wallet) > 0;
}

// Spend a hint if any remain; returns the new wallet and whether it was granted.
export function spendHint(wallet: HintWallet): { wallet: HintWallet; granted: boolean } {
  if (!canSpendHint(wallet)) return { wallet, granted: false };
  return { wallet: { ...wallet, used: wallet.used + 1 }, granted: true };
}

// Earn extra hints (e.g. won a round) — keeps hints limited but not fixed.
export function earnHint(wallet: HintWallet, amount = 1): HintWallet {
  return { ...wallet, budget: wallet.budget + Math.max(0, Math.floor(amount)) };
}
