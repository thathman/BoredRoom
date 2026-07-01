import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listTriviaQuestions, generateTriviaDrafts, updateTriviaQuestion, deleteTriviaQuestion,
  type TriviaQuestion,
} from '@/lib/serverApi';

// Owner-only Money Trivia question review: list, generate AI drafts, verify sources, and
// approve / reject / retire / delete. Mutations require durable persistence (server 503s
// otherwise). AI drafts land un-approved with an unverified source that must be replaced.
const AGE_BANDS = ['pre_teen', 'teen', 'adult'] as const;
const STATUSES = ['draft', 'approved', 'rejected', 'retired'] as const;

export function MoneyTriviaReview() {
  const [ageBand, setAgeBand] = useState<string>('adult');
  const [status, setStatus] = useState<string>('draft');
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gen, setGen] = useState({ difficulty: 8, category: 'General knowledge', count: 4 });

  const refresh = useCallback(async () => {
    setQuestions(await listTriviaQuestions({ ageBand, status }));
  }, [ageBand, status]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function act(fn: () => Promise<{ ok?: boolean; error?: string } | boolean>, ok: string) {
    setBusy(true); setMsg(null);
    const r = await fn();
    const failed = r === false || (typeof r === 'object' && r?.ok === false);
    setMsg(failed ? `Failed: ${(typeof r === 'object' && r?.error) || 'error'}` : ok);
    await refresh();
    setBusy(false);
  }

  return (
    <section className="neon-panel rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">💰 Money Trivia questions</h2>
        <div className="flex gap-2 text-xs">
          <select className="rounded-lg bg-black/40 px-2 py-1" value={ageBand} onChange={(e) => setAgeBand(e.target.value)}>
            {AGE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="rounded-lg bg-black/40 px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* AI draft generation */}
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-secondary/30 bg-black/30 p-3">
        <label className="text-xs">Category<Input className="mt-1 h-9 w-40 bg-black/40" value={gen.category} onChange={(e) => setGen((g) => ({ ...g, category: e.target.value }))} /></label>
        <label className="text-xs">Difficulty<Input type="number" min={1} max={15} className="mt-1 h-9 w-20 bg-black/40" value={gen.difficulty} onChange={(e) => setGen((g) => ({ ...g, difficulty: Number(e.target.value) || 8 }))} /></label>
        <label className="text-xs">Count<Input type="number" min={1} max={8} className="mt-1 h-9 w-16 bg-black/40" value={gen.count} onChange={(e) => setGen((g) => ({ ...g, count: Number(e.target.value) || 4 }))} /></label>
        <Button className="neon-primary h-9 rounded-lg text-xs" disabled={busy}
          onClick={() => act(() => generateTriviaDrafts({ ageBand, ...gen }), 'AI drafts generated — verify sources before approving.')}>
          Generate AI drafts
        </Button>
      </div>
      {msg && <p className="mt-2 text-xs text-amber-300">{msg}</p>}

      <div className="mt-4 space-y-3">
        {questions.length === 0 && <p className="text-sm text-muted-foreground">No {status} questions for {ageBand}.</p>}
        {questions.map((q) => (
          <QuestionRow key={q.id} q={q} busy={busy}
            onSaveSource={(url) => act(() => updateTriviaQuestion(q.id, { sourceUrl: url }), 'Source updated.')}
            onStatus={(s) => act(() => updateTriviaQuestion(q.id, { reviewStatus: s }), `Marked ${s}.`)}
            onDelete={() => act(() => deleteTriviaQuestion(q.id), 'Deleted.')} />
        ))}
      </div>
    </section>
  );
}

function QuestionRow({ q, busy, onSaveSource, onStatus, onDelete }: {
  q: TriviaQuestion; busy: boolean;
  onSaveSource: (url: string) => void;
  onStatus: (s: TriviaQuestion['reviewStatus']) => void;
  onDelete: () => void;
}) {
  const [source, setSource] = useState(q.sourceUrl);
  const unverified = q.sourceUrl.includes('unverified');
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-sm font-semibold">{q.prompt}</p>
      <p className="mt-1 text-xs text-white/70">L{q.difficulty} · {q.category} · answer: <b>{q.options[q.answer]}</b></p>
      <p className="mt-1 text-xs text-white/55">{q.explanation}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input className={`h-8 flex-1 bg-black/40 text-xs ${unverified ? 'border-amber-400/60' : ''}`} value={source} onChange={(e) => setSource(e.target.value)} />
        <Button variant="outline" className="h-8 rounded-lg text-xs" disabled={busy || source === q.sourceUrl} onClick={() => onSaveSource(source)}>Save source</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {q.reviewStatus !== 'approved' && <Button className="neon-primary h-8 rounded-lg text-xs" disabled={busy || unverified} title={unverified ? 'Verify the source first' : ''} onClick={() => onStatus('approved')}>Approve</Button>}
        {q.reviewStatus !== 'rejected' && <Button variant="outline" className="h-8 rounded-lg text-xs" disabled={busy} onClick={() => onStatus('rejected')}>Reject</Button>}
        {q.reviewStatus === 'approved' && <Button variant="outline" className="h-8 rounded-lg text-xs" disabled={busy} onClick={() => onStatus('retired')}>Retire</Button>}
        <Button variant="ghost" className="h-8 rounded-lg text-xs text-red-400" disabled={busy} onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
