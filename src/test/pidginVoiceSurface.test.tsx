import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InstalledGameSurface } from '@/components/session/InstalledGameSurface';

const state = {
  gameType: 'pidgin-translator', name: 'Pidgin Translator', emoji: '🗣️', mode: 'pidgin', translationMode: 'speed_voice',
  phase: 'playing', round: 1, totalRounds: 5, challenge: { kind: 'text', prompt: 'Translate this Pidgin: "How you dey?"' },
  players: [{ id: 'p1', name: 'Ada', score: 0 }], lastResults: [], winnerPlayerIds: [], lastAction: 'Translate now.',
};

afterEach(() => {
  delete (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  vi.restoreAllMocks();
});

describe('Pidgin microphone controller', () => {
  it('requests microphone access, captures a transcript and submits transcript only', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    class RecognitionMock {
      lang = ''; continuous = false; interimResults = false;
      onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null = null;
      onerror = null; onend: (() => void) | null = null;
      start() { this.onresult?.({ results: [{ 0: { transcript: 'How are you' }, isFinal: true }] }); this.onend?.(); }
      stop() { this.onend?.(); }
      abort() {}
    }
    (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = RecognitionMock;
    const sendIntent = vi.fn();
    render(<InstalledGameSurface publicState={state} privateState={{ seated: true, submitted: false, legalIntents: [{ type: 'voice_submission' }, { type: 'answer_text' }] }} role="controller" sendIntent={sendIntent} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start microphone' }));
    await waitFor(() => expect(screen.getByDisplayValue('How are you')).toBeInTheDocument());
    expect(stop).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Submit transcript/ }));
    expect(sendIntent).toHaveBeenCalledWith({ type: 'voice_submission', transcript: 'How are you' });
  });

  it('keeps typed fallback available when browser transcription is unavailable', () => {
    render(<InstalledGameSurface publicState={state} privateState={{ seated: true, submitted: false, legalIntents: [{ type: 'voice_submission' }, { type: 'answer_text' }] }} role="controller" sendIntent={() => {}} />);
    expect(screen.getByPlaceholderText('Your transcript or typed translation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit typed answer' })).toBeInTheDocument();
  });
});
