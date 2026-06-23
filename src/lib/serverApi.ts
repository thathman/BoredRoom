// HTTP base + session API for the Colyseus server. Centralizes the ws->http derivation that
// Host/Join pages do inline, and wraps the Phase 1 /sessions endpoint.

import type { SetupSettings } from '@/lib/setupFlow';

export function serverHttpBase(): string | null {
  const raw = import.meta.env.VITE_COLYSEUS_URL as string | undefined;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

// Minimal client view of the created session (mirror of the server HouseSession shape).
export interface CreatedSession {
  id: string;
  code: string;
  status: string;
  selectedPackIds: string[];
  activePackId?: string;
}

export async function createSession(input: {
  hostDeviceId: string;
  selectedPackIds: string[];
  activePackId?: string;
  settings?: SetupSettings;
}): Promise<CreatedSession> {
  const base = serverHttpBase();
  if (!base) {
    // Offline/dev fallback: a local-only session so the flow still works without a server.
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    return {
      id: `local_${code}`,
      code,
      status: 'setup',
      selectedPackIds: input.selectedPackIds,
      activePackId: input.activePackId,
    };
  }
  const res = await fetch(`${base}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`session_create_failed_${res.status}`);
  const data = (await res.json()) as { session: CreatedSession };
  return data.session;
}
