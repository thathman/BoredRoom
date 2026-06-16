#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const artifactPath = process.env.SMOKE_MATRIX_ARTIFACT ?? 'artifacts/smoke-matrix.json';
const expected = [
  'ludo',
  'whot',
  'trivia',
  'connect-4',
  'ettt',
  'logo',
  'landlord',
  'color-wahala',
  'hustle',
  'word-wahala',
];

function fail(msg) {
  console.error(`[smoke-assert] ${msg}`);
  process.exit(1);
}

let artifact;
try {
  artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
} catch (err) {
  fail(`unable to read artifact "${artifactPath}": ${String(err)}`);
}

if (!artifact || typeof artifact !== 'object') fail('artifact is not an object');
if (!Array.isArray(artifact.results)) fail('artifact.results missing');
if (artifact.ok !== true) fail('artifact.ok must be true');

const rows = new Map();
for (const row of artifact.results) {
  if (!row || typeof row !== 'object') continue;
  if (typeof row.gameType !== 'string') continue;
  rows.set(row.gameType, row);
}

const missing = expected.filter((g) => !rows.has(g));
if (missing.length > 0) fail(`missing expected game rows: ${missing.join(', ')}`);

const notPassing = expected.filter((g) => rows.get(g)?.status !== 'pass');
if (notPassing.length > 0) fail(`rows not passing: ${notPassing.join(', ')}`);

console.log(`[smoke-assert] PASS (${expected.length} expected game rows)`);
