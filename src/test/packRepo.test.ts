import { describe, expect, it } from 'vitest';
import {
  resolvePackManifestUrl,
  resolveContentUrl,
  PackRepoManifest,
} from '../../shared/src/contracts/packRepo';

// Pack install: resolve a GitHub repo URL to its raw manifest and validate the manifest shape.
describe('pack repo install', () => {
  it('resolves a github repo URL to the raw boredroom-pack.json', () => {
    expect(resolvePackManifestUrl('https://github.com/owner/repo')).toBe(
      'https://raw.githubusercontent.com/owner/repo/HEAD/boredroom-pack.json',
    );
    expect(resolvePackManifestUrl('https://github.com/owner/repo/tree/main')).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/boredroom-pack.json',
    );
    expect(resolvePackManifestUrl('https://github.com/owner/repo.git')).toBe(
      'https://raw.githubusercontent.com/owner/repo/HEAD/boredroom-pack.json',
    );
  });

  it('passes raw URLs through and rejects non-github input', () => {
    const raw = 'https://raw.githubusercontent.com/o/r/main/boredroom-pack.json';
    expect(resolvePackManifestUrl(raw)).toBe(raw);
    expect(resolvePackManifestUrl('not a url')).toBeNull();
    expect(resolvePackManifestUrl('https://gitlab.com/o/r')).toBeNull();
  });

  it('resolves relative content URLs against the manifest', () => {
    const mUrl = 'https://raw.githubusercontent.com/o/r/main/boredroom-pack.json';
    expect(resolveContentUrl(mUrl, './content/ot.json')).toBe(
      'https://raw.githubusercontent.com/o/r/main/content/ot.json',
    );
    expect(resolveContentUrl(mUrl, 'https://cdn.example.com/x.json')).toBe('https://cdn.example.com/x.json');
  });

  it('validates a well-formed manifest and applies defaults', () => {
    const m = PackRepoManifest.parse({
      id: 'pack.faith',
      name: 'Faith & Family',
      version: '1.0.0',
      theme: { tokenSet: 'faith' },
      games: [{ slug: 'faith-feud-church', engine: 'faith-feud', name: 'Church Feud' }],
    });
    expect(m.games[0].emoji).toBe('🎮');
    expect(m.games[0].maxPlayers).toBe(12);
  });

  it('rejects an unknown engine kind and empty game list', () => {
    expect(
      PackRepoManifest.safeParse({ id: 'p', name: 'n', version: '1', games: [{ slug: 's', engine: 'doom', name: 'x' }] }).success,
    ).toBe(false);
    expect(PackRepoManifest.safeParse({ id: 'p', name: 'n', version: '1', games: [] }).success).toBe(false);
  });
});
