// AI hint edge function — private suggestion for one player.
// Strict visibility: input is one player's slice only.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Defaults to OpenRouter auto-routing. Set AI_MODEL to "google/gemini-2.0-flash-001" if preferred.
const MODEL = Deno.env.get('AI_MODEL') ?? 'openrouter/auto';
const MAX_LEN = 160;
const COOLDOWN_MS = 2000;

const lastCallByPlayer = new Map<string, number>();

function clean(text: string): string {
  let out = text.trim().replace(/^["'`]|["'`]$/g, '').replace(/\s+/g, ' ');
  if (out.length > MAX_LEN) out = out.slice(0, MAX_LEN - 1).trim() + '…';
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const playerId = String(body?.playerId ?? '');
    const deviceId = String(body?.deviceId ?? '');
    const diceValue = Number(body?.diceValue ?? 0);
    const myColor = String(body?.myColor ?? '');
    const myTokens = Array.isArray(body?.myTokens) ? body.myTokens : [];
    const movableTokenIds = Array.isArray(body?.movableTokenIds) ? body.movableTokenIds : [];
    const opponentsSummary = Array.isArray(body?.opponentsSummary) ? body.opponentsSummary : [];

    // Visibility guard: playerId must equal deviceId (player is asking about themselves)
    if (!playerId || playerId !== deviceId) {
      return new Response(JSON.stringify({ hint: null, reason: 'visibility' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!diceValue || movableTokenIds.length === 0) {
      return new Response(JSON.stringify({ hint: null, reason: 'no_choice' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const last = lastCallByPlayer.get(playerId) ?? 0;
    if (Date.now() - last < COOLDOWN_MS) {
      return new Response(JSON.stringify({ hint: null, reason: 'cooldown' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    lastCallByPlayer.set(playerId, Date.now());

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ hint: null, reason: 'no_key' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = `You are a friendly Ludo coach for ONE player.
Rules:
- Suggest ONE move from the movable tokens list. Reference token by id (e.g. "Token 2").
- Max 140 characters. One sentence. Plain language. No quotes.
- Mention briefly why (capture, safety, progress, enter home).
- Never reveal what other players will do.`;

    const userMsg = `My color: ${myColor}. Dice: ${diceValue}.
My tokens: ${JSON.stringify(myTokens)}
Movable token ids: ${JSON.stringify(movableTokenIds)}
Opponents (color, tokens-home): ${JSON.stringify(opponentsSummary)}

Suggest the best move.`;

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
        max_tokens: 100,
        temperature: 0.5,
      }),
    });
    clearTimeout(timeout);

    if (resp.status === 429 || resp.status === 402) {
      return new Response(JSON.stringify({ hint: null, reason: resp.status === 429 ? 'rate_limit' : 'credits' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!resp.ok) {
      console.error('ai-hint gateway error', resp.status, await resp.text());
      return new Response(JSON.stringify({ hint: null, reason: 'gateway_error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? '';
    const hint = clean(String(raw));

    return new Response(JSON.stringify({ hint: hint || null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-hint error', e);
    return new Response(JSON.stringify({ hint: null, reason: 'exception' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
