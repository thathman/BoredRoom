// One-time generator for the WWTBAM-style trivia suspense bed.
// Calls ElevenLabs Music API and returns raw MP3 bytes.
// Clients should cache the result aggressively (we use the Cache API client-side).
import { corsHeaders } from "@supabase/supabase-js/cors";

const PROMPT = `An intense, suspenseful instrumental loop in the style of "Who Wants to Be a Millionaire" question rounds. \
Slow pulsing low strings and synth bass at ~70 BPM, sparse high tension chimes, deep heartbeat-like sub kick on the downbeat, \
faint orchestral swells building unresolved tension. Cinematic, dark blue, electrified, no melody, no drums fills, \
loopable, minimal, focused — pure dramatic anticipation for a quiz show answer reveal. Studio quality, 4/4, key of D minor.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const elevenResp = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: PROMPT,
        music_length_ms: 30000,
      }),
    });

    if (!elevenResp.ok) {
      const errText = await elevenResp.text();
      console.error("ElevenLabs music error", elevenResp.status, errText);
      return new Response(
        JSON.stringify({ error: `eleven_music_failed_${elevenResp.status}`, detail: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const audio = await elevenResp.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("generate-trivia-bed crash", msg);
    return new Response(JSON.stringify({ error: "internal", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
