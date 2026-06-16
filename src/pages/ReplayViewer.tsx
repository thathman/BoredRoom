/**
 * /replay/:id — visual replay timeline. Loads the replay + any recorded
 * turn snapshots, lets the user scrub / play / pause through them.
 *
 * If no per-turn snapshots exist (early replays only saved the final state),
 * we fall back to showing just the final result with a notice.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ReplayMeta {
  id: string;
  share_token: string;
  game_type: string;
  room_code: string;
  winner_name: string | null;
  player_names: Record<string, string>;
  standings: Array<{ id: string; displayName: string; label: string }>;
  final_state: Record<string, unknown>;
  created_at: string;
}
interface TurnRow {
  id: string;
  turn_number: number;
  snapshot: Record<string, unknown>;
  caption: string | null;
}

export default function ReplayViewerPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<ReplayMeta | null>(null);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: r }, { data: ts }] = await Promise.all([
        supabase.from('replays').select('*').eq('id', id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('replay_turns').select('*').eq('replay_id', id).order('turn_number', { ascending: true }),
      ]);
      if (cancelled) return;
      if (r) setMeta(r as unknown as ReplayMeta);
      if (Array.isArray(ts)) setTurns(ts as TurnRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!playing || turns.length === 0) return;
    timerRef.current = window.setInterval(() => {
      setIndex((i) => {
        if (i >= turns.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1200);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [playing, turns.length]);

  const current = turns[index];
  const total = turns.length;
  const fallbackOnly = !loading && total === 0;

  const standingsView = useMemo(() => meta?.standings ?? [], [meta]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="text-3xl font-display font-bold neon-text">{t('replay.notFound')}</h1>
        <Button onClick={() => navigate('/')} variant="outline">{t('replay.backHome')}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/r/${meta.share_token}`)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </Button>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {meta.game_type}
        </span>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-display font-bold neon-text">
          {t('replay.viewerTitle')}
        </h1>
        {meta.winner_name && (
          <p className="text-muted-foreground">
            {t('gameOver.takesCrown', { name: meta.winner_name })}
          </p>
        )}
      </div>

      {fallbackOnly ? (
        <div className="glass rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{t('replay.noTurnsRecorded')}</p>
          {standingsView.length > 0 && (
            <div className="space-y-2 text-left">
              {standingsView.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <span className="font-display font-bold">#{i + 1} {p.displayName}</span>
                  <span className="text-sm text-muted-foreground">{p.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-6 min-h-[260px]">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3 text-center">
              {t('replay.turnOf', { current: index + 1, total })}
            </div>
            {current?.caption && (
              <p className="font-display text-xl font-bold text-center mb-3">{current.caption}</p>
            )}
            <pre className="text-[10px] leading-snug overflow-auto max-h-64 bg-muted/30 rounded-lg p-3 text-muted-foreground">
{JSON.stringify(current?.snapshot ?? {}, null, 2)}
            </pre>
          </div>

          <div className="space-y-3">
            <input
              type="range"
              min={0}
              max={Math.max(0, total - 1)}
              value={index}
              onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
              className="w-full"
              aria-label={t('replay.turnOf', { current: index + 1, total }) as string}
            />
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label={t('replay.previousTurn') as string}>
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={() => setPlaying((p) => !p)} className="gap-2" aria-label={t('replay.playPause') as string}>
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {playing ? t('common.cancel') : t('common.next')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} aria-label={t('replay.nextTurn') as string}>
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
