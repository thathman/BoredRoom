import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';
import { isValidRoomCode, normalizeRoomCode } from '@/lib/roomCode';

interface QrScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCode: (code: string) => void;
  /**
   * MediaStream acquired in the click handler that opened this dialog.
   * Required because browsers (esp. iOS Safari and embedded iframes) only
   * grant camera access when getUserMedia is called inside the original
   * user gesture — the Dialog mount effect would lose that context.
   */
  stream: MediaStream | null;
  /** Optional permission/acquire error from the caller. */
  acquireError?: string | null;
  /** Allow the dialog to ask the caller to retry acquisition. */
  onRetryAcquire?: () => void;
}

function extractCode(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
    // Unified session URLs only. Game routes and secondary room codes are deliberately rejected.
    try {
      const url = new URL(trimmed);
      const match =
        url.pathname.match(/^\/join\/([A-Za-z0-9]{4})\/?$/i) ??
        url.pathname.match(/^\/session\/([A-Za-z0-9]{4})\/(?:display|controller|crowd|companion)\/?$/i);
      const raw = match?.[1];
      if (raw) {
        const code = normalizeRoomCode(raw);
        return isValidRoomCode(code) ? code : null;
      }
  } catch {
    // not a URL
  }
  // Fallback: bare 4-char alphanumeric
  const bare = normalizeRoomCode(trimmed);
  if (isValidRoomCode(bare)) return bare;
  // Last resort: search anywhere
  const m = trimmed.match(/\/(?:join|session)\/([A-Za-z0-9]{4})(?:\/|$)/i);
  if (m) {
    const code = normalizeRoomCode(m[1]);
    return isValidRoomCode(code) ? code : null;
  }
  return null;
}

export function QrScanner({
  open,
  onOpenChange,
  onCode,
  stream,
  acquireError,
  onRetryAcquire,
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning'>('idle');

  // Surface caller-side acquire errors.
  useEffect(() => {
    if (open && acquireError) setError(acquireError);
  }, [open, acquireError]);

  // Wire the pre-acquired stream into the video and start the decoder.
  useEffect(() => {
    if (!open || !stream) return;

    let cancelled = false;
    setError(null);
    const reader = new BrowserMultiFormatReader();
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    video.play().catch(() => {
      // Autoplay may need a user gesture; the click that opened the dialog satisfies it.
    });

    let cancelled2 = false;
    let activeControls: IScannerControls | null = null;

    reader
      .decodeFromVideoElement(video, (result) => {
        if (!result) return;
        const code = extractCode(result.getText());
        if (code) {
          activeControls?.stop();
          onCode(code);
          onOpenChange(false);
        }
      })
      .then((controls) => {
        if (cancelled2) {
          controls.stop();
          return;
        }
        activeControls = controls;
        controlsRef.current = controls;
        setStatus('scanning');
      })
      .catch((err: unknown) => {
        if (cancelled2) return;
        setError(err instanceof Error ? err.message : 'Could not start scanner.');
      });

    return () => {
      cancelled = true;
      cancelled2 = true;
      void cancelled;
      activeControls?.stop();
      controlsRef.current = null;
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [open, stream, onCode, onOpenChange]);

  // When the dialog closes, fully stop the stream tracks so the camera light goes off.
  useEffect(() => {
    if (open) return;
    setStatus('idle');
    setError(null);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  }, [open, stream]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan room QR code</DialogTitle>
          <DialogDescription>
            Point your camera at the QR code on the host screen.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />
          {!stream && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Requesting camera…
            </div>
          )}
          {status === 'scanning' && (
            <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-secondary/70" />
          )}
        </div>

        {error && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            {onRetryAcquire && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onRetryAcquire();
                }}
                className="w-full rounded-lg border border-border bg-muted py-2 text-sm font-display hover:bg-muted/80"
              >
                Retry camera
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-lg border border-border bg-background py-2 text-sm font-display hover:bg-muted/80"
            >
              Enter code manually instead
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
