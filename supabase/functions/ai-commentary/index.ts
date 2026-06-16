// AI commentary edge function — generates short game-show style lines for the public display.
// Public-only inputs. No private state accepted.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Defaults to OpenRouter auto-routing. Set AI_MODEL to "google/gemini-2.0-flash-001" if preferred.
const MODEL = Deno.env.get('AI_MODEL') ?? 'openrouter/auto';
const MAX_LEN = 110;
const COOLDOWN_MS = 4000;

const lastCallByRoomGame = new Map<string, number>();

const BANNED = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot', 'retard'];

function clean(text: string): string {
  let out = text.trim().replace(/^["'`]|["'`]$/g, '').replace(/\s+/g, ' ');
  for (const bad of BANNED) {
    if (out.toLowerCase().includes(bad)) return '';
  }
  if (out.length > MAX_LEN) out = out.slice(0, MAX_LEN - 1).trim() + '…';
  return out;
}

interface PublicEvent {
  type: string;
  actor: string;
  target?: string;
  value?: number;
  shape?: string;
}

type GameType = 'ludo' | 'whot';
type AIPersona = 'classic' | 'naija_hype' | 'chaos_mc' | 'banker';

function parseGameType(value: unknown): GameType {
  return value === 'whot' ? 'whot' : 'ludo';
}

function parsePersona(value: unknown): AIPersona {
  if (value === 'naija_hype' || value === 'chaos_mc' || value === 'banker') return value;
  return 'classic';
}

// Persona modifier appended to the base game prompt. Keeps line length and
// safety rules from the base prompt intact while changing voice.
const PERSONA_MODIFIERS: Record<AIPersona, string> = {
  classic: '',
  naija_hype: `\nVOICE: Lagos street-energy hype-man. Light Pidgin sprinkles ("oya", "wahala", "no shaking", "sharp sharp"). Stay PG. Never overdo accent — lines must read clearly.`,
  chaos_mc: `\nVOICE: Unhinged, gleeful chaos commentator. Short bursts. Drama on every move. Treat every play like the title fight. Stay PG.`,
  banker: `\nVOICE: Cold deadpan accountant. Frame plays as profit/loss/risk. Dry humor. No exclamation marks. Stay PG.`,
};

export function buildSystemPrompt(gameType: GameType, persona: AIPersona = 'classic'): string {
  const base = gameType === 'whot' ? SYSTEM_WHOT : SYSTEM_LUDO;
  return base + PERSONA_MODIFIERS[persona];
}

export function buildEventLines(events: PublicEvent[]): string {
  return events.map(e => {
    switch (e.type) {
      // Ludo
      case 'capture': return `${e.actor} captured ${e.target ?? 'a token'}`;
      case 'home': return `${e.actor} sent a token home`;
      case 'win': return `${e.actor} WON the game`;
      case 'skip': return `${e.actor} got 3 sixes and was skipped`;
      case 'roll': return `${e.actor} rolled a ${e.value ?? '?'}`;
      // Whot
      case 'whot_play': return `${e.actor} played ${e.value ?? '?'}${e.shape ? ' of ' + e.shape : ''}`;
      case 'whot_pick_chain': return `${e.actor} stacked a pick chain (${e.value ?? '?'} to draw)`;
      case 'whot_pick_consume': return `${e.actor} picked up ${e.value ?? '?'} cards`;
      case 'whot_suit_call': return `${e.actor} called ${e.shape ?? 'a suit'}`;
      case 'whot_suspension': return `${e.actor} played Suspension`;
      case 'whot_general_market': return `${e.actor} played General Market`;
      case 'whot_last_card': return `${e.actor} announced LAST CARD`;
      case 'whot_win': return `${e.actor} WON the match`;
      default: return '';
    }
  }).filter(Boolean).join('\n');
}

const SYSTEM_LUDO = `You are a witty, family-friendly board-game show host commenting on a live Ludo match.
Rules:
- Output ONE short line, present tense, max 90 characters.
- Keep it punchy and fun. Use names. No targeted insults, no profanity, no slurs.
- React to the most exciting recent event (capture > home > big roll).
- Never reveal strategy advice. Never address only one viewer.
- Plain text only. No quotes, no emojis at start.`;

const SYSTEM_WHOT = `You are a witty, family-friendly card-game show host commenting on a live Whot match.
Whot concepts you understand:
- Pick chains: 2 = pick two, 5 = pick three (stackable, countered with same rank).
- Whot 20: shape-call card; player calls a suit (circle, triangle, cross, square, star).
- Suspension (8): next player loses turn. General Market (14): everyone draws.
- Last card: a player must announce before playing their final card.
Rules:
- Output ONE short line, present tense, max 90 characters.
- Use Whot terminology naturally (pick two, suit call, suspension, general market, last card).
- Punchy and fun. Use names. No insults, profanity, or slurs.
- React to the most exciting recent event (win > pick chain > suit call > suspension).
- No strategy advice. Plain text only. No quotes, no emojis at start.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const roomCode = String(body?.roomCode ?? '');
    const events = Array.isArray(body?.events) ? body.events.slice(-6) as PublicEvent[] : [];
    const players = Array.isArray(body?.players)
      ? body.players.map((p: unknown) => {
        const player = p && typeof p === 'object' ? p as Record<string, unknown> : {};
        return { name: String(player.name ?? ''), color: String(player.color ?? '') };
      }).slice(0, 4)
      : [];

    const gameType = parseGameType(body?.gameType);
    const persona = parsePersona(body?.persona);

    if (!roomCode || events.length === 0) {
      return new Response(JSON.stringify({ line: null, reason: 'invalid_input' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cooldownKey = `${roomCode}:${gameType}`;
    const last = lastCallByRoomGame.get(cooldownKey) ?? 0;
    if (Date.now() - last < COOLDOWN_MS) {
      return new Response(JSON.stringify({ line: null, reason: 'cooldown' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    lastCallByRoomGame.set(cooldownKey, Date.now());

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ line: null, reason: 'no_key' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = buildSystemPrompt(gameType, persona);
    const eventLines = buildEventLines(events);

    const userMsg = `Players: ${players.map((p: { name: string; color: string }) => `${p.name} (${p.color})`).join(', ')}\n\nRecent events:\n${eventLines}\n\nWrite the next commentary line.`;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('AI_APP_URL') ?? 'https://boredroom.local',
        'X-Title': Deno.env.get('AI_APP_NAME') ?? 'BoredRoom',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 80,
        temperature: 0.9,
      }),
    });
    clearTimeout(timeout);

    if (resp.status === 429 || resp.status === 402) {
      return new Response(JSON.stringify({ line: null, reason: resp.status === 429 ? 'rate_limit' : 'credits' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!resp.ok) {
      console.error('ai-commentary gateway error', resp.status, await resp.text());
      return new Response(JSON.stringify({ line: null, reason: 'gateway_error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? '';
    const line = clean(String(raw));

    return new Response(JSON.stringify({ line: line || null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-commentary error', e);
    return new Response(JSON.stringify({ line: null, reason: 'exception' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
