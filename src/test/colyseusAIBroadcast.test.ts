import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const roomSource = readFileSync('server/src/rooms/LudoRoom.ts', 'utf8');

describe('Colyseus AI broadcast hardening', () => {
  it('keeps host-only gating for host broadcast intents', () => {
    expect(roomSource).toContain("intent.type.startsWith('host:')");
    expect(roomSource).toContain("return this.error(client, 'forbidden', 'host_only')");
    expect(roomSource).toContain("case 'host:broadcast_commentary'");
    expect(roomSource).toContain("case 'host:broadcast_recap'");
  });

  it('sanitizes AI commentary and recap payloads before fan-out', () => {
    expect(roomSource).toContain('sanitizeText(intent.line, 280)');
    expect(roomSource).toContain('sanitizeText(r.headline, 200)');
    expect(roomSource).toContain('sanitizeText(r.paragraph, 1200)');
    expect(roomSource).toContain('sanitizeText(r.mvp, 120)');
  });
});
