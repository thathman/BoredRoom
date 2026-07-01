// Money Trivia question store — validation, approval workflow, and run selection.
//
// Only APPROVED, non-expired, well-formed, sourced, correctly-tiered questions reach a cash run.
// Live AI generation is never used here; the owner panel can add drafts and approve them. The
// store is in-memory over the shipped seed bank (persistence can layer on later); this keeps the
// money path deterministic and auditable.

import { MONEY_TRIVIA_SEED, type TriviaQuestion, type AgeBand, type ReviewStatus } from './moneyTriviaBank.js';
import { MONEY_TRIVIA_FF_SEED } from './moneyTriviaFastestFinger.js';

const AGE_BANDS: AgeBand[] = ['pre_teen', 'teen', 'adult'];
const HOT_SEAT_LEVELS = 15;

const store = new Map<string, TriviaQuestion>();
for (const q of MONEY_TRIVIA_SEED) store.set(q.id, { ...q });
// Dedicated Fastest Finger ordering questions live in a separate store (structurally different:
// the full option order is the answer, so they never mix into the hot-seat difficulty selection).
const ffStore = new Map<string, TriviaQuestion>();
for (const q of MONEY_TRIVIA_FF_SEED) ffStore.set(q.id, { ...q });

function normalizePrompt(prompt: string): string {
  return String(prompt ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

// Structural + policy validation. `existingId` lets an update skip the duplicate check against
// itself. Returns every problem found so the owner panel can show them all at once.
export function validateQuestion(input: Partial<TriviaQuestion>, existingId?: string): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['not_an_object'] };
  if (typeof input.prompt !== 'string' || input.prompt.trim().length < 5) errors.push('prompt_too_short');
  if (!Array.isArray(input.options) || input.options.length !== 4
    || input.options.some((o) => typeof o !== 'string' || !o.trim())) errors.push('options_must_be_four_nonempty');
  else if (new Set(input.options.map((o) => o.trim().toLowerCase())).size !== 4) errors.push('options_must_be_distinct');
  if (!Number.isInteger(input.answer) || (input.answer as number) < 0 || (input.answer as number) > 3) errors.push('answer_out_of_range');
  if (!input.ageBand || !AGE_BANDS.includes(input.ageBand)) errors.push('invalid_age_band');
  if (!Number.isInteger(input.difficulty) || (input.difficulty as number) < 1 || (input.difficulty as number) > HOT_SEAT_LEVELS) errors.push('difficulty_out_of_range');
  if (typeof input.category !== 'string' || !input.category.trim()) errors.push('missing_category');
  if (typeof input.sourceUrl !== 'string' || !/^https?:\/\/.+/i.test(input.sourceUrl)) errors.push('missing_or_invalid_source');
  if (input.expiry && Number.isNaN(Date.parse(input.expiry))) errors.push('invalid_expiry_date');
  if (typeof input.prompt === 'string') {
    const norm = normalizePrompt(input.prompt);
    for (const q of store.values()) {
      if (q.id !== existingId && normalizePrompt(q.prompt) === norm) { errors.push('duplicate_prompt'); break; }
    }
  }
  return { ok: errors.length === 0, errors };
}

function isExpired(q: TriviaQuestion, now = Date.now()): boolean {
  return Boolean(q.expiry && Date.parse(q.expiry) <= now);
}

export function isPlayable(q: TriviaQuestion, now = Date.now()): boolean {
  return q.reviewStatus === 'approved' && !isExpired(q, now);
}

export function listQuestions(filter: { ageBand?: AgeBand; status?: ReviewStatus; category?: string } = {}): TriviaQuestion[] {
  return [...store.values()].filter((q) =>
    (!filter.ageBand || q.ageBand === filter.ageBand)
    && (!filter.status || q.reviewStatus === filter.status)
    && (!filter.category || q.category === filter.category))
    .map((q) => ({ ...q }));
}

export function getQuestion(id: string): TriviaQuestion | undefined {
  const q = store.get(id);
  return q ? { ...q } : undefined;
}

// Owner adds an AI/manual draft. Drafts are never playable until approved.
export function createDraft(input: Partial<TriviaQuestion>): { question?: TriviaQuestion; errors: string[] } {
  const candidate: Partial<TriviaQuestion> = { ...input, reviewStatus: 'draft' };
  const { ok, errors } = validateQuestion(candidate);
  if (!ok) return { errors };
  const id = `mt-draft-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const question: TriviaQuestion = {
    id,
    prompt: candidate.prompt!.trim(),
    options: candidate.options as [string, string, string, string],
    answer: candidate.answer as number,
    category: candidate.category!.trim(),
    ageBand: candidate.ageBand as AgeBand,
    difficulty: candidate.difficulty as number,
    explanation: String(candidate.explanation ?? '').trim(),
    sourceUrl: candidate.sourceUrl!.trim(),
    reviewStatus: 'draft',
    reviewDate: new Date().toISOString().slice(0, 10),
    expiry: candidate.expiry,
  };
  store.set(id, question);
  return { question: { ...question }, errors: [] };
}

// Edit or change review status (approve/reject/retire). Re-validates content fields.
export function updateQuestion(id: string, patch: Partial<TriviaQuestion>): { question?: TriviaQuestion; errors: string[] } {
  const existing = store.get(id);
  if (!existing) return { errors: ['not_found'] };
  const merged: TriviaQuestion = { ...existing, ...patch, id };
  const statusChanged = patch.reviewStatus && patch.reviewStatus !== existing.reviewStatus;
  // Validate content unless this is only a retire/reject status flip.
  if (!(statusChanged && (patch.reviewStatus === 'retired' || patch.reviewStatus === 'rejected'))) {
    const { ok, errors } = validateQuestion(merged, id);
    if (!ok) return { errors };
  }
  if (statusChanged) merged.reviewDate = new Date().toISOString().slice(0, 10);
  store.set(id, merged);
  return { question: { ...merged }, errors: [] };
}

export function deleteQuestion(id: string): boolean {
  return store.delete(id);
}

export interface RunContentRequest {
  ageBand: AgeBand;
  categories?: string[]; // optional filter; ignored if it would starve a difficulty level
}

export interface RunContent {
  ok: boolean;
  reason?: string;
  questions?: TriviaQuestion[]; // 15 hot-seat questions in ascending difficulty
  fastestFingerQuestions?: TriviaQuestion[]; // dedicated ordering questions for the FF round
}

// Build a playable run: exactly one approved question per difficulty 1..15 for the age band,
// plus a couple of fastest-finger spares. Insufficient approved content BLOCKS setup rather than
// silently widening the age band or categories (spec requirement). `rng` keeps it deterministic.
export function selectRunContent(req: RunContentRequest, rng: () => number = Math.random): RunContent {
  const { ageBand } = req;
  if (!AGE_BANDS.includes(ageBand)) return { ok: false, reason: 'invalid_age_band' };
  const now = Date.now();
  const pool = [...store.values()].filter((q) => q.ageBand === ageBand && isPlayable(q, now));
  const wanted = req.categories?.length ? new Set(req.categories) : null;

  const picked: TriviaQuestion[] = [];
  for (let level = 1; level <= HOT_SEAT_LEVELS; level += 1) {
    // Category filters are STRICT: if the selected categories can't provide a question at some
    // difficulty level, block setup rather than silently widening the selection.
    const candidates = pool.filter((q) => q.difficulty === level && (!wanted || wanted.has(q.category)));
    if (candidates.length === 0) {
      return { ok: false, reason: wanted ? `categories_cannot_fill_level_${level}` : `insufficient_approved_questions_level_${level}` };
    }
    picked.push(candidates[Math.floor(rng() * candidates.length)]);
  }
  // Dedicated fastest-finger ordering questions for the age band (shuffled selection).
  const ffPool = [...ffStore.values()].filter((q) => q.ageBand === ageBand && isPlayable(q, now));
  if (ffPool.length === 0) return { ok: false, reason: 'insufficient_fastest_finger_questions' };
  const ffShuffled = [...ffPool].sort(() => rng() - 0.5).slice(0, 3);
  return {
    ok: true,
    questions: picked.map((q) => ({ ...q })),
    fastestFingerQuestions: ffShuffled.map((q) => ({ ...q })),
  };
}

// FF question CRUD is owner-managed alongside the hot-seat bank.
export function listFastestFingerQuestions(ageBand?: AgeBand): TriviaQuestion[] {
  return [...ffStore.values()].filter((q) => !ageBand || q.ageBand === ageBand).map((q) => ({ ...q }));
}

// Load reviewed questions persisted in the database over the shipped seed, so owner edits and
// approvals survive a restart. Best-effort: with no backend this is a no-op and the seed stands.
export async function hydrateFromRows(rows: Record<string, unknown>[]): Promise<number> {
  let loaded = 0;
  for (const r of rows) {
    if (!r || typeof r.id !== 'string') continue;
    const q: TriviaQuestion = {
      id: r.id, prompt: String(r.prompt ?? ''),
      options: (r.options as [string, string, string, string]) ?? ['', '', '', ''],
      answer: Number(r.answer ?? 0),
      category: String(r.category ?? ''), ageBand: r.age_band as AgeBand,
      difficulty: Number(r.difficulty ?? 1), explanation: String(r.explanation ?? ''),
      sourceUrl: String(r.source_url ?? ''), reviewStatus: (r.review_status as ReviewStatus) ?? 'draft',
      reviewDate: String(r.review_date ?? new Date().toISOString().slice(0, 10)),
      expiry: (r.expiry as string) ?? undefined,
    };
    (r.kind === 'fastest_finger' ? ffStore : store).set(q.id, q);
    loaded += 1;
  }
  return loaded;
}

// Reset to the shipped seed (used by tests).
export function resetStore(): void {
  store.clear();
  for (const q of MONEY_TRIVIA_SEED) store.set(q.id, { ...q });
  ffStore.clear();
  for (const q of MONEY_TRIVIA_FF_SEED) ffStore.set(q.id, { ...q });
}
