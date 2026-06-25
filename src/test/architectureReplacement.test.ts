import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const server = readFileSync('server/src/index.ts', 'utf8');
const sessionRoom = readFileSync('server/src/rooms/HouseSessionRoom.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('unified architecture replacement', () => {
  it('registers only HouseSessionRoom and exposes no direct room API', () => {
    const definitions = [...server.matchAll(/gameServer\.define\(/g)];
    expect(definitions).toHaveLength(1);
    expect(server).toContain("gameServer.define('house-session'");
    expect(server).not.toMatch(/app\.(get|post|delete|patch)\('\/rooms/);
  });

  it('uses installed runtime factories with no secondary runtime identifiers', () => {
    expect(sessionRoom).toContain('createInstalledGameRuntime');
    expect(sessionRoom).not.toContain('runtimeId');
    expect(sessionRoom).not.toContain('hostToken');
    expect(sessionRoom).not.toContain('NativeGameRuntime');
  });

  it('keeps only unified product routes', () => {
    expect(app).toContain('path="/session/:code/:screen"');
    expect(app).toContain('path="/packs"');
    expect(app).not.toMatch(/path="\/:game/);
    expect(app).not.toContain('/operator');
  });
});
