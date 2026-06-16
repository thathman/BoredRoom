/**
 * Host-side settings for the three newer games (Hustle, Word Wahala, Landlord).
 *
 * Mirrors the look of the trivia / logo / color-wahala setup blocks already in
 * DisplayLobby.tsx. Each game is rendered conditionally based on the active
 * gameSlug; the panel is invisible for any other game.
 */
import {
  HustlePublicState,
  HustleSettings,
  LandlordSettings,
  WordWahalaPublicState,
  WordWahalaSettings,
} from '@/lib/transport/types';

const LANDLORD_STARTING_CASH_DEFAULT = 1500;

interface Props {
  gameSlug: string;
  // Hustle
  hustleState?: HustlePublicState | null;
  onSetHustleSettings?: (settings: Partial<HustleSettings>) => void;
  // Word Wahala
  wordWahalaState?: WordWahalaPublicState | null;
  onSetWordWahalaSettings?: (settings: Partial<WordWahalaSettings>) => void;
  // Landlord (no public-state settings — track locally with sensible defaults)
  landlordSettings?: LandlordSettings | null;
  onSetLandlordSettings?: (settings: Partial<LandlordSettings>) => void;
}

export function NewGameSettingsPanel({
  gameSlug,
  hustleState,
  onSetHustleSettings,
  wordWahalaState,
  onSetWordWahalaSettings,
  landlordSettings,
  onSetLandlordSettings,
}: Props) {
  if (gameSlug === 'hustle' && hustleState && onSetHustleSettings) {
    const s = hustleState.settings;
    return (
      <div className="glass rounded-2xl p-4 space-y-3 max-w-3xl mx-auto">
        <div className="text-xs uppercase tracking-wider text-muted-foreground text-center">
          Hustle setup
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Field label="Starting cards">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.startingCards}
              onChange={(e) => onSetHustleSettings({ startingCards: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Starting ₦">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.startingMoney}
              onChange={(e) => onSetHustleSettings({ startingMoney: Number(e.target.value) })}
            >
              {[50, 100, 150, 200, 300].map((n) => <option key={n} value={n}>₦{n}</option>)}
            </select>
          </Field>
          <Field label="Card every">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.cardEveryNSquares}
              onChange={(e) => onSetHustleSettings({ cardEveryNSquares: Number(e.target.value) })}
            >
              {[3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n} squares</option>)}
            </select>
          </Field>
          <Field label="Endgame">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.japaEndgame ? 'japa' : 'classic'}
              onChange={(e) => onSetHustleSettings({ japaEndgame: e.target.value === 'japa' })}
            >
              <option value="japa">Japa exits</option>
              <option value="classic">Reach 60</option>
            </select>
          </Field>
        </div>
      </div>
    );
  }

  if (gameSlug === 'word-wahala' && wordWahalaState && onSetWordWahalaSettings) {
    const s = wordWahalaState.settings;
    return (
      <div className="glass rounded-2xl p-4 space-y-3 max-w-3xl mx-auto">
        <div className="text-xs uppercase tracking-wider text-muted-foreground text-center">
          Word Wahala setup
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <Field label="Mode">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.mode}
              onChange={(e) => onSetWordWahalaSettings({ mode: e.target.value as WordWahalaSettings['mode'] })}
            >
              <option value="standard">Standard</option>
              <option value="pidgin_only">Pidgin only</option>
              <option value="yarn_battle">Yarn battle</option>
            </select>
          </Field>
          <Field label="Turn timer">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.turnTimerSec}
              onChange={(e) => onSetWordWahalaSettings({ turnTimerSec: Number(e.target.value) })}
            >
              <option value={0}>No timer</option>
              {[30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n}s</option>)}
            </select>
          </Field>
          <Field label="Max passes">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.maxConsecutivePasses}
              onChange={(e) => onSetWordWahalaSettings({ maxConsecutivePasses: Number(e.target.value) })}
            >
              {[3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
      </div>
    );
  }

  if (gameSlug === 'landlord' && onSetLandlordSettings) {
    const s = landlordSettings ?? { maxPlayers: 4, startingCash: LANDLORD_STARTING_CASH_DEFAULT };
    return (
      <div className="glass rounded-2xl p-4 space-y-3 max-w-3xl mx-auto">
        <div className="text-xs uppercase tracking-wider text-muted-foreground text-center">
          Oga Landlord setup
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Starting cash">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.startingCash}
              onChange={(e) => onSetLandlordSettings({ startingCash: Number(e.target.value) })}
            >
              {[750, 1000, 1500, 2000, 2500, 3000].map((n) => <option key={n} value={n}>₦{n.toLocaleString()}</option>)}
            </select>
          </Field>
          <Field label="Max players">
            <select
              className="rounded-md bg-muted border border-border px-2 py-1.5 font-display"
              value={s.maxPlayers}
              onChange={(e) => onSetLandlordSettings({ maxPlayers: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Changes apply when the next game starts.
        </p>
      </div>
    );
  }

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
