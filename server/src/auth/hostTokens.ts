// One-time host token store. Issued at room creation, consumed on first
// host connect. Tokens are bound to (roomCode, deviceId). After consumption
// the binding is remembered so the same host device can reconnect without
// requiring a new token (until the room is disposed).

interface Binding {
  deviceId: string;
  token: string;
  consumed: boolean;
  issuedAt: number;
}

const bindings = new Map<string, Binding>(); // roomCode -> binding

function randomToken(): string {
  // 32 hex chars, ~128 bits.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const hostTokenStore = {
  issue(roomCode: string, deviceId: string): string {
    const token = randomToken();
    bindings.set(roomCode, { deviceId, token, consumed: false, issuedAt: Date.now() });
    return token;
  },

  /**
   * Verify a host claim. Returns true if:
   *  - the deviceId matches the binding AND
   *  - either the token matches (first-use) OR the binding was already consumed
   *    by this same deviceId (reconnect).
   */
  verify(roomCode: string, deviceId: string, token: string | undefined): boolean {
    const b = bindings.get(roomCode);
    if (!b) return false;
    if (b.deviceId !== deviceId) return false;
    if (b.consumed) return true; // reconnect by same host device
    if (!token || token !== b.token) return false;
    b.consumed = true;
    return true;
  },

  release(roomCode: string): void {
    bindings.delete(roomCode);
  },
};
