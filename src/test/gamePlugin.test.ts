import { describe, expect, it } from 'vitest';
import { GamePluginManifest, OfficialGameCatalog } from '../../shared/src/contracts/gamePlugin';

const manifest = {
  schemaVersion: 1 as const,
  id: 'whot',
  name: 'Whot',
  emoji: '🃏',
  description: 'Nigerian card game.',
  version: '1.0.0.0',
  minPlayers: 2,
  maxPlayers: 8,
  capabilities: { bots: true, audience: true, hints: false, restore: true },
  entrypoints: {
    server: 'source/server.js',
    display: 'source/display.js',
    controller: 'source/controller.js',
    companion: 'source/companion.js',
  },
};

describe('installable game contracts', () => {
  it('accepts independently versioned game manifests', () => {
    expect(GamePluginManifest.parse(manifest).id).toBe('whot');
  });

  it('rejects non-four-part versions and unsafe ids', () => {
    expect(() => GamePluginManifest.parse({ ...manifest, version: '1.0.0' })).toThrow();
    expect(() => GamePluginManifest.parse({ ...manifest, id: '../whot' })).toThrow();
  });

  it('restricts the official catalog repository and artifact size', () => {
    const artifact = {
      url: 'https://github.com/thathman/BoredRoom-Games/releases/download/v1.0.0.0/whot.tgz',
      sha256: 'a'.repeat(64),
      signature: 'signed',
      size: 1000,
    };
    expect(OfficialGameCatalog.parse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      repository: 'https://github.com/thathman/BoredRoom-Games',
      games: [{ ...manifest, artifact }],
    }).games).toHaveLength(1);
    expect(() => OfficialGameCatalog.parse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      repository: 'https://example.com/games',
      games: [{ ...manifest, artifact }],
    })).toThrow();
  });
});
