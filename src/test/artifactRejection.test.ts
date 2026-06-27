import { describe, it, expect } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifyArtifactBytes } from '../../server/src/installedGames';

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
