/**
 * /r/:token — public read-only recap page for a saved replay.
 * Reused GameOver visuals (lite). No play-again, no controllers.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Trophy, Home, Sparkles, Copy, Check, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchReplayByShareToken, type ReplayRecord } from '@/lib/replay';
import { toast } from 'sonner';

export default function RecapPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [replay, setReplay] = useState<ReplayRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchReplayByShareToken(token);
      if (!cancelled) {
        setReplay(r);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  if (!replay) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="text-3xl font-display font-bold neon-text">{t('replay.notFound')}</h1>
        <p className="text-muted-foreground max-w-md">{t('replay.notFoundBody')}</p>
        <Button onClick={() => navigate('/')} variant="outline" className="gap-2">
          <Home className="w-4 h-4" /> {t('replay.backHome')}
        </Button>
      </div>
    );
  }

  const url = `${window.location.origin}/r/${replay.shareToken}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success(t('replay.linkCopied')); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const ogTitle = replay.winnerName
    ? `${replay.winnerName} won ${replay.gameType.toUpperCase()} on BoredRoom`
    : `${replay.gameType.toUpperCase()} match recap · BoredRoom`;
  const ogDesc = replay.recap?.headline
    ?? (replay.standings.length
        ? `${replay.standings.map((s) => s.displayName).slice(0, 4).join(', ')} played a match. See the full recap.`
        : 'A BoredRoom match recap.');
  const ogImage = `${window.location.origin}/icons/icon-512.png`;
  const canonical = `${window.location.origin}/r/${replay.shareToken}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6 max-w-lg w-full"
      >
        <Trophy className="w-20 h-20 mx-auto text-accent" />
        <div className="space-y-2">
          <span className="inline-block text-[10px] font-display font-bold tracking-[0.2em] px-2 py-0.5 rounded-full border border-primary/40 text-primary uppercase">
            {replay.gameType.toUpperCase()}
          </span>
          <h1 className="text-4xl md:text-6xl font-display font-bold neon-text">
            {replay.winnerName ? t('gameOver.takesCrown', { name: replay.winnerName }) : t('gameOver.gameOver')}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t('replay.savedAt', { when: new Date(replay.createdAt).toLocaleString() })}
          </p>
        </div>

        {replay.recap && (
          <div className="glass neon-border rounded-2xl p-5 space-y-2 text-left">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4 animate-pulse-neon" />
              <span className="text-xs uppercase tracking-wider font-display">{t('gameOver.aiRecap')}</span>
            </div>
            <h3 className="text-xl font-display font-bold leading-tight">{replay.recap.headline}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{replay.recap.paragraph}</p>
          </div>
        )}

        {replay.standings.length > 0 && (
          <div className="glass rounded-2xl p-5 space-y-2 text-left">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              {t('gameOver.finalStandings')}
            </h3>
            {replay.standings.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-display font-bold text-muted-foreground">#{i + 1}</span>
                  <span className="font-display font-bold">{p.displayName}</span>
                </div>
                <span className="text-sm text-muted-foreground">{p.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="outline" className="gap-2" onClick={copy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t('common.copied') : t('replay.copyLink')}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/replay/${replay.id}`)}>
            <PlayCircle className="w-4 h-4" /> {t('replay.viewerTitle')}
          </Button>
          <Button onClick={() => navigate('/')} className="gap-2">
            <Home className="w-4 h-4" /> {t('gameOver.home')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
