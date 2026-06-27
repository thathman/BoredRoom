import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerAvatar } from '@/components/profile/PlayerAvatar';
import type { SessionMember } from '@/lib/serverApi';

type Tab = 'party' | 'players' | 'games' | 'current' | 'votes' | 'settings';

interface VotePoll {
  options: string[];
  tally: Record<string, number>;
  status: string;
  result?: { winnerOption: string | null; applied: boolean } | null;
}
interface VoteResult {
  voteId: string; winnerOption: string | null; tied: boolean; status: string;
  castCount: number; eligibleVoterCount: number; hostOverride?: unknown; autoApplied: boolean;
}

interface CompanionConsoleProps {
  code: string;
  joinUrl: string;
  members: SessionMember[];
  remoteOn: boolean;
  activeGame: { gameType?: string; status?: string } | null;
  votePoll: VotePoll | null;
  voteHistory: VoteResult[];
  pairingCode: string | null;
  // actions
  onOpenGames: () => void;
  admitPlayer: (id: string) => void;
  rejectPlayer: (id: string) => void;
  kickPlayer: (id: string, reason?: string) => void;
  setRemoteMode: (on: boolean) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  callVote: (options: string[], opts?: { type?: string; question?: string }) => void;
  closeVote: () => void;
  cancelVote: () => void;
  applyVoteResult: () => void;
  overrideVote: (option: string, reason?: string) => void;
  endParty: () => void;
  deleteParty: (confirm: string) => void;
  createPairing: () => void;
}

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'party', label: 'Party', icon: '🏠' },
  { id: 'players', label: 'Players', icon: '👥' },
  { id: 'games', label: 'Games', icon: '🎮' },
  { id: 'current', label: 'Current', icon: '🎯' },
  { id: 'votes', label: 'Votes', icon: '🗳️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

// The producer's control booth: every host control in one tabbed surface, separate from the
// public display. Docked bottom-right; opens to a full-height panel on small screens.
export function CompanionConsole(props: CompanionConsoleProps) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>('party');
  const [danger, setDanger] = useState<null | 'end' | 'delete'>(null);
  const [deleteText, setDeleteText] = useState('');
  const pending = props.members.filter((m) => m.pending);
  const controllers = props.members.filter((m) => m.role === 'controller');

  if (!open) {
    return (
      <Button className="fixed bottom-4 right-4 z-[80] rounded-full neon-primary h-12 px-5" onClick={() => setOpen(true)}>
        🎛️ Control booth{pending.length ? ` · ${pending.length} waiting` : ''}
      </Button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-[80] flex max-h-[88vh] w-full flex-col rounded-t-2xl border border-secondary/40 bg-[#050914]/97 shadow-[0_-8px_40px_rgba(0,0,0,.5)] backdrop-blur-xl sm:bottom-4 sm:right-4 sm:w-96 sm:rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Control booth</span>
        <button type="button" className="text-white/50 hover:text-white" onClick={() => setOpen(false)}>✕</button>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] ${tab === t.id ? 'bg-secondary/25 text-white' : 'text-white/55 hover:text-white'}`}
          >
            <span>{t.icon}</span>{t.label}
            {t.id === 'players' && pending.length > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[9px] text-black">{pending.length}</span>}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {tab === 'party' && (
          <div className="space-y-3 text-center">
            <div className="mx-auto w-fit rounded-xl bg-white p-2"><QRCodeSVG value={props.joinUrl} size={120} /></div>
            <p className="font-mono text-3xl font-black tracking-[0.2em] text-primary">{props.code}</p>
            <p className="break-all text-[11px] text-white/50">{props.joinUrl.replace(/^https?:\/\//, '')}</p>
            <p className="text-xs text-white/60">{controllers.length} player(s) joined</p>
          </div>
        )}

        {tab === 'players' && (
          <div className="space-y-3">
            {pending.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Admission queue</p>
                <ul className="mt-2 space-y-1.5">
                  {pending.map((m) => (
                    <li key={m.deviceId} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate"><PlayerAvatar displayName={m.displayName} avatar={m.avatar} accentColor={m.accentColor} size={26} /> {m.displayName}</span>
                      <span className="flex shrink-0 gap-1">
                        <button type="button" className="rounded-md bg-primary/20 px-2 py-1 text-[11px] text-primary" onClick={() => props.admitPlayer(m.deviceId)}>Admit</button>
                        <button type="button" className="rounded-md bg-red-500/20 px-2 py-1 text-[11px] text-red-200" onClick={() => props.rejectPlayer(m.deviceId)}>Reject</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Players</p>
              <ul className="mt-2 space-y-1.5">
                {controllers.filter((m) => !m.pending).map((m) => (
                  <li key={m.deviceId} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate">
                      <PlayerAvatar displayName={m.displayName} avatar={m.avatar} accentColor={m.accentColor} isBot={m.isBot} size={26} />
                      {m.displayName} {m.ready ? '✓' : ''}{!m.connected ? ' ⚠︎' : ''}
                    </span>
                    {!m.isBot && (
                      <button type="button" className="rounded-md bg-red-500/15 px-2 py-1 text-[10px] text-red-200" onClick={() => { if (window.confirm(`Remove ${m.displayName}?`)) props.kickPlayer(m.deviceId, 'Removed by host.'); }}>Kick</button>
                    )}
                  </li>
                ))}
                {controllers.length === 0 && <li className="text-xs text-white/40">No players yet.</li>}
              </ul>
            </div>
          </div>
        )}

        {tab === 'games' && (
          <div className="space-y-3">
            <Button className="neon-primary h-11 w-full rounded-xl" onClick={props.onOpenGames}>Open game selection</Button>
            <Button variant="outline" className="h-10 w-full rounded-xl text-xs" onClick={() => props.callVote([], { type: 'game_selection', question: 'Which game next?' })}>Call a game vote</Button>
            <p className="text-[11px] text-white/45">Pick a game or let the house vote. The game list never shows on the public display during play.</p>
          </div>
        )}

        {tab === 'current' && (
          <div className="space-y-2">
            {props.activeGame ? (
              <>
                <p className="text-xs text-white/70">{props.activeGame.gameType} · {props.activeGame.status}</p>
                {props.activeGame.status === 'paused'
                  ? <Button className="neon-primary h-10 w-full rounded-xl" onClick={props.resumeGame}>Resume game</Button>
                  : <Button variant="outline" className="h-10 w-full rounded-xl" onClick={props.pauseGame}>Pause game</Button>}
                <Button variant="outline" className="h-10 w-full rounded-xl text-xs text-red-200" onClick={() => { if (window.confirm('End the current game? The party continues.')) props.endGame(); }}>End current game</Button>
              </>
            ) : <p className="text-xs text-white/45">No game running. Use the Games tab to start one.</p>}
          </div>
        )}

        {tab === 'votes' && (
          <div className="space-y-3">
            {props.votePoll ? (
              <>
                <p className="text-xs font-semibold">{props.votePoll.status}</p>
                <div className="space-y-1">
                  {props.votePoll.options.map((o) => (
                    <button key={o} type="button" className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs hover:border-secondary/60" onClick={() => props.overrideVote(o, 'host override')}>
                      <span>{o}</span><span className="text-primary">{props.votePoll!.tally[o] ?? 0}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {props.votePoll.status === 'open' && <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={props.closeVote}>Close</Button>}
                  {props.votePoll.result?.winnerOption && !props.votePoll.result.applied && <Button className="neon-primary h-9 rounded-lg text-xs" onClick={props.applyVoteResult}>Apply</Button>}
                  <Button variant="outline" className="col-span-2 h-9 rounded-lg text-xs text-red-200" onClick={props.cancelVote}>Cancel vote</Button>
                </div>
              </>
            ) : <p className="text-xs text-white/45">No active vote.</p>}
            {props.voteHistory.length > 0 && (
              <div className="border-t border-white/10 pt-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Recent</p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-white/65">
                  {props.voteHistory.slice(0, 6).map((r) => (
                    <li key={r.voteId} className="flex justify-between gap-2"><span className="truncate">{r.winnerOption ?? (r.tied ? 'Tie' : r.status)}</span><span className="text-white/40">{r.castCount}/{r.eligibleVoterCount}{r.hostOverride ? ' · override' : r.autoApplied ? ' · auto' : ''}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-3">
            <Button variant="outline" className="h-10 w-full rounded-xl text-xs" onClick={() => props.setRemoteMode(!props.remoteOn)}>
              Remote mode: {props.remoteOn ? 'On' : 'Off'} — tap to toggle
            </Button>
            <Button variant="outline" className="h-10 w-full rounded-xl text-xs" onClick={props.createPairing}>Pair another companion</Button>
            {props.pairingCode && <p className="text-center font-mono text-lg text-primary">{props.pairingCode}</p>}
            <div className="border-t border-red-400/20 pt-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-red-300">Danger zone</p>
              {danger === null && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setDanger('end')}>End party</Button>
                  <Button variant="outline" className="h-9 rounded-lg text-xs text-red-200" onClick={() => setDanger('delete')}>Delete party</Button>
                </div>
              )}
              {danger === 'end' && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-white/80">End for everyone? Recap is saved.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="neon-primary h-9 rounded-lg text-xs" onClick={() => { props.endParty(); setDanger(null); }}>End it</Button>
                    <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setDanger(null)}>Cancel</Button>
                  </div>
                </div>
              )}
              {danger === 'delete' && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-white/80">Type <span className="font-mono text-red-200">{props.code}</span> to delete permanently.</p>
                  <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value.toUpperCase())} maxLength={4} className="h-9 bg-black/40 text-center font-mono tracking-[0.3em]" placeholder={props.code} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-9 rounded-lg text-xs text-red-200" disabled={deleteText !== props.code} onClick={() => { props.deleteParty(deleteText); setDanger(null); setDeleteText(''); }}>Delete</Button>
                    <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => { setDanger(null); setDeleteText(''); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
