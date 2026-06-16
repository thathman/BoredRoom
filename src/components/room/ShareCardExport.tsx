/**
 * Share-card export — captures a polished PNG of the end-game recap so players
 * can share it. Uses `html-to-image` against a hidden, fixed-width DOM node
 * (1200×630 — Open Graph friendly).
 *
 * Falls back to a download when the Web Share API is unavailable or rejects.
 */
import { toPng } from 'html-to-image';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareCardProps {
  gameLabel: string;
  winnerName?: string | null;
  standings: { displayName: string; label: string }[];
  roomCode: string;
  recapHeadline?: string;
}

export function ShareCardExport({ gameLabel, winnerName, standings, roomCode, recapHeadline }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const generate = async (): Promise<{ blob: Blob; dataUrl: string } | null> => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#0a0e1a',
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return { blob, dataUrl };
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const out = await generate();
      if (!out) return;
      const file = new File([out.blob], `boredroom-${roomCode}.png`, { type: 'image/png' });

      // Try Web Share API with files first.
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `BoredRoom — ${gameLabel}`, text: `Room ${roomCode}` });
          return;
        } catch {
          // user cancelled or share failed — fall through to download
        }
      }

      // Fallback — trigger download.
      const a = document.createElement('a');
      a.href = out.dataUrl;
      a.download = `boredroom-${roomCode}.png`;
      a.click();
      toast.success('Share card saved to downloads');
    } catch (err) {
      console.error('share-card export failed', err);
      toast.error('Could not generate share card');
    } finally {
      setBusy(false);
    }
  };

  const top = standings.slice(0, 4);

  return (
    <>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="controller-button gap-2 px-8"
        onClick={handleShare}
        disabled={busy}
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
        {busy ? 'Generating…' : 'Share result'}
      </Button>

      {/* Hidden render target — positioned off-screen so html-to-image can rasterize it. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: 1200,
          height: 630,
          pointerEvents: 'none',
        }}
      >
        <div
          ref={cardRef}
          style={{
            width: 1200,
            height: 630,
            background: 'linear-gradient(135deg, #0a0e1a 0%, #14172b 50%, #0a0e1a 100%)',
            color: '#e6e9f2',
            padding: 56,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div>
            <div style={{ fontSize: 18, letterSpacing: 6, color: '#5eead4', textTransform: 'uppercase' }}>
              BoredRoom · {gameLabel}
            </div>
            <div style={{ fontSize: 96, fontWeight: 800, marginTop: 16, lineHeight: 1 }}>
              {winnerName ? `${winnerName} won!` : 'Game over'}
            </div>
            {recapHeadline && (
              <div style={{ fontSize: 28, marginTop: 20, color: '#a5b4cf', maxWidth: 1000 }}>
                {recapHeadline}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {top.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 16, fontSize: 24 }}>
                  <span style={{ color: '#5eead4', fontWeight: 700, width: 36 }}>#{i + 1}</span>
                  <span style={{ fontWeight: 600 }}>{p.displayName}</span>
                  <span style={{ color: '#a5b4cf' }}>{p.label}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, color: '#a5b4cf', letterSpacing: 4, textTransform: 'uppercase' }}>Room</div>
              <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: 8, color: '#5eead4' }}>{roomCode}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
