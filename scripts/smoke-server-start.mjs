#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HTTP_URL = process.env.SMOKE_HTTP_URL ?? 'http://localhost:2567';
const PORT = new URL(HTTP_URL).port || '2567';
const SERVER_ENTRY = fileURLToPath(new URL('../server/dist/server/src/index.js', import.meta.url));
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function npmCommand(args) {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath, ...args], options: {} };
  }
  return {
    command: npmBin,
    args,
    options: process.platform === 'win32' ? { shell: true } : {},
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)));
    child.on('error', reject);
  });
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${HTTP_URL}/healthz`);
      if (res.ok) return;
    } catch {
      // keep polling until timeout
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server health check timed out');
}

async function main() {
  const build = npmCommand(['--prefix', 'server', 'run', 'build']);
  await run(build.command, build.args, build.options);
  const server = spawn(process.execPath, [SERVER_ENTRY], {
    stdio: 'inherit',
    env: { ...process.env, PORT },
  });
  try {
    await waitForHealth();
    console.log('[server-start-smoke] PASS');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(`[server-start-smoke] FAIL: ${err?.message ?? err}`);
  process.exit(1);
});
