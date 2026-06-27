import { describe, it, expect, afterAll } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyArtifactBytes, inspectArchiveSafety } from '../../server/src/installedGames';

// Sign the way the release pipeline does: Ed25519 over the hex sha256 digest string.
function makeArtifact(bytes: Buffer, privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const signature = sign(null, Buffer.from(sha256, 'utf8'), privateKey).toString('base64');
  return { size: bytes.length, sha256, signature };
}

describe('verifyArtifactBytes (installable game artifact gate)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const bytes = Buffer.from('a legitimately packaged game tarball', 'utf8');
  const good = makeArtifact(bytes, privateKey);

  it('accepts a correctly sized, hashed and signed artifact', () => {
    expect(verifyArtifactBytes(bytes, good, pubPem)).toBe(good.sha256);
  });

  it('rejects a size mismatch', () => {
    expect(() => verifyArtifactBytes(bytes, { ...good, size: good.size + 1 }, pubPem)).toThrow('artifact_size_mismatch');
  });

  it('rejects a digest mismatch (tampered bytes, same length)', () => {
    const tampered = Buffer.from('A legitimately packaged game tarball', 'utf8'); // same length, different content
    expect(() => verifyArtifactBytes(tampered, good, pubPem)).toThrow('artifact_digest_invalid');
  });

  it('rejects a forged signature (signed by a different key)', () => {
    const { privateKey: attacker } = generateKeyPairSync('ed25519');
    const forged = makeArtifact(bytes, attacker);
    expect(() => verifyArtifactBytes(bytes, forged, pubPem)).toThrow('artifact_signature_invalid');
  });

  it('rejects an oversized artifact before hashing', () => {
    const huge = Buffer.alloc(25_000_001);
    expect(() => verifyArtifactBytes(huge, { ...good, size: huge.length }, pubPem)).toThrow('artifact_too_large');
  });
});

describe('inspectArchiveSafety (archive-level artifact gate)', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'artifact-test-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  // Build a .tgz from a staged dir; -C keeps stored paths relative to the staging root.
  function tgz(name: string, build: (dir: string) => void): string {
    const src = mkdtempSync(path.join(work, `${name}-`));
    build(src);
    const out = path.join(work, `${name}.tgz`);
    const r = spawnSync('tar', ['-czf', out, '-C', src, '.']);
    if (r.status !== 0) throw new Error(`tar build failed: ${r.stderr}`);
    return out;
  }

  it('accepts a clean archive of regular files', async () => {
    const archive = tgz('clean', (d) => {
      writeFileSync(path.join(d, 'manifest.json'), '{}');
      writeFileSync(path.join(d, 'game-runtime.js'), 'export {}');
    });
    await expect(inspectArchiveSafety(archive)).resolves.toBeUndefined();
  });

  it('rejects a symlink entry', async () => {
    const archive = tgz('symlinked', (d) => {
      writeFileSync(path.join(d, 'manifest.json'), '{}');
      symlinkSync('/etc/passwd', path.join(d, 'leak'));
    });
    await expect(inspectArchiveSafety(archive)).rejects.toThrow('artifact_links_invalid');
  });

  it('rejects a parent-traversal path', async () => {
    // Craft a tarball whose stored path escapes via `..` using an absolute -C transform.
    const src = mkdtempSync(path.join(work, 'evil-'));
    writeFileSync(path.join(src, 'evil.js'), 'boom');
    const out = path.join(work, 'traversal.tgz');
    const r = spawnSync('tar', ['-czf', out, '-C', src, '--transform', 's,^\\./,../escaped/,', '.'], { encoding: 'utf8' });
    if (r.status !== 0) {
      // BSD tar (macOS) lacks --transform; build the entry name directly instead.
      const r2 = spawnSync('tar', ['-czf', out, '-C', path.dirname(src), `../${path.basename(src)}/evil.js`]);
      if (r2.status !== 0) return; // environment can't craft it; skip rather than false-fail
    }
    await expect(inspectArchiveSafety(out)).rejects.toThrow('artifact_paths_invalid');
  });
});
