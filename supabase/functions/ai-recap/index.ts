// AI recap edge function — end-of-game summary using tool-calling for structure.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Defaults to OpenRouter auto-routing. Set AI_MODEL to "google/gemini-2.0-flash-001" if preferred.
const MODEL = Deno.env.get('AI_MODEL') ?? 'openrouter/auto';
const BANNED = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot', 'retard'];

function trim(s: string, n: number): string {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

type GameType = 'ludo' | 'whot';

function parseGameType(value: unknown): GameType {
  return value === 'whot' ? 'whot' : 'ludo';
}

export function buildRecapSystemPrompt(gameType: GameType): string {
  return gameType === 'whot'
    ? `You write energetic, family-friendly recaps of a Whot card-game match. Reference Whot concepts (pick chains, suit calls via Whot 20, suspensions, general market, last-card announces) when signals support it. No profanity, slurs, player-directed abuse, or strategy coaching. Use real names. Celebrate the winner.`
    : `You write energetic, family-friendly recaps of a Ludo match. No profanity, slurs, player-directed abuse, or strategy coaching. Use real names. Celebrate the winner. Keep it warm and inclusive.`;
}

export function sanitizeRecap(input: null | { headline: string; paragraph: string; mvp: string }) {
  if (!input) return null;
  const cleanPart = (value: string, max: number) => {
    let out = trim(value, max);
    for (const bad of BANNED) {
      out = out.replace(new RegExp(`\\b${bad}\\b`, 'gi'), '***');
    }
    out = out.replace(/\b(kill yourself|you suck|loser|idiot|stupid)\b/gi, 'great effort');
    out = out.replace(/\b(should|must|need to)\s+(play|draw|block|counter|move)\b/gi, 'kept the table guessing');
    return out;
  };
  return {
    headline: cleanPart(input.headline, 80),
    paragraph: cleanPart(input.paragraph, 320),
    mvp: cleanPart(input.mvp, 100),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const roomCode = String(body?.roomCode ?? '');
    const players = Array.isArray(body?.players) ? body.players : [];
    const winnerName = String(body?.winnerName ?? '');
    const turnCount = Number(body?.turnCount ?? 0);
    const matchDurationMs = Number(body?.matchDurationMs ?? 0);
    const gameType = parseGameType(body?.gameType);
    const signals = (body?.signals && typeof body.signals === 'object') ? body.signals : null;

    if (!roomCode || players.length === 0) {
      return new Response(JSON.stringify({ recap: null, reason: 'invalid_input' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ recap: null, reason: 'no_key' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = buildRecapSystemPrompt(gameType);

    const minutes = Math.max(1, Math.round(matchDurationMs / 60000));
    const signalsLine = (gameType === 'whot' && signals)
      ? `\nWhot signals: ${JSON.stringify(signals)}`
      : '';
    const userMsg = `Room ${roomCode}. ${turnCount} turns over ~${minutes} min.
Players (name, ${gameType === 'whot' ? 'hand-proxy' : 'color, tokens-home'}): ${JSON.stringify(players)}
Winner: ${winnerName}${signalsLine}

Generate a recap.`;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);

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
        max_tokens: 300,
        temperature: 0.8,
        tools: [
          {
            type: 'function',
            function: {
              name: 'emit_recap',
              description: 'Return the final game recap.',
              parameters: {
                type: 'object',
                properties: {
                  headline: { type: 'string', description: 'Punchy headline, max 60 chars.' },
                  paragraph: { type: 'string', description: '2-3 sentence summary, max 280 chars.' },
                  mvp: { type: 'string', description: 'Name of MVP (often winner) plus 1-line reason, max 80 chars.' },
                },
                required: ['headline', 'paragraph', 'mvp'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'emit_recap' } },
      }),
    });
    clearTimeout(timeout);

    if (resp.status === 429 || resp.status === 402) {
      return new Response(JSON.stringify({ recap: null, reason: resp.status === 429 ? 'rate_limit' : 'credits' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!resp.ok) {
      console.error('ai-recap gateway error', resp.status, await resp.text());
      return new Response(JSON.stringify({ recap: null, reason: 'gateway_error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await resp.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    let recap = null as null | { headline: string; paragraph: string; mvp: string };
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        recap = sanitizeRecap({
          headline: trim(args.headline, 80),
          paragraph: trim(args.paragraph, 320),
          mvp: trim(args.mvp, 100),
        });
      } catch (err) {
        console.error('ai-recap parse error', err);
      }
    }

    return new Response(JSON.stringify({ recap }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-recap error', e);
    return new Response(JSON.stringify({ recap: null, reason: 'exception' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
