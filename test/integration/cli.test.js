import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runCli } from '../../src/cli.js';

async function workspace() {
  return mkdtemp(path.join(os.tmpdir(), 'saddle-cli-'));
}

function capture() {
  const output = [];
  const errors = [];
  return { output, errors, io: { out: (value) => output.push(value), err: (value) => errors.push(value) } };
}

test('init creates a loadable neutral profile with continuity procedures', async () => {
  const root = await workspace();
  const profile = path.join(root, 'my-profile');
  const result = capture();
  assert.equal(await runCli(['init', profile, '--id', 'my-profile'], result.io), 0);
  const manifest = JSON.parse(await readFile(path.join(profile, 'saddle.profile.json'), 'utf8'));
  assert.equal(manifest.profile.id, 'my-profile');
  assert.deepEqual(Object.keys(manifest.lifecycle), [
    'session.start',
    'session.checkpoint',
    'context.before-reset',
    'context.after-reset',
    'session.end',
  ]);
  assert.match(await readFile(path.join(profile, 'instructions/session-continuity.md'), 'utf8'), /Before context reset/);
});

test('import defaults to dry-run, applies only an accepted digest, verifies, and rolls back', async () => {
  const root = await workspace();
  const profile = path.join(root, 'profile');
  const target = path.join(root, 'home');
  const state = path.join(root, 'state');
  await runCli(['init', profile], capture().io);

  const dry = capture();
  assert.equal(await runCli(['import', profile, '--target', target, '--json'], dry.io), 0);
  const preview = JSON.parse(dry.output[0]);
  await assert.rejects(stat(path.join(target, '.claude', 'CLAUDE.md')), { code: 'ENOENT' });

  const rejected = capture();
  assert.equal(await runCli(['import', profile, '--target', target, '--state', state, '--apply', '--accept-plan', 'bad'], rejected.io), 1);
  await assert.rejects(stat(path.join(target, '.codex', 'AGENTS.md')), { code: 'ENOENT' });

  const applied = capture();
  assert.equal(await runCli([
    'import', profile, '--target', target, '--state', state, '--apply', '--accept-plan', preview.digest, '--json',
  ], applied.io), 0);
  const result = JSON.parse(applied.output[0]);
  assert.ok(result.verification.every((item) => item.verification.status === 'exact'));
  assert.match(await readFile(path.join(target, '.claude', 'CLAUDE.md'), 'utf8'), /Saddle operating profile/);
  assert.match(await readFile(path.join(target, '.codex', 'AGENTS.md'), 'utf8'), /Saddle operating profile/);

  const rolledBack = capture();
  assert.equal(await runCli([
    'rollback', result.transaction.id, '--target', target, '--state', state,
  ], rolledBack.io), 0);
  await assert.rejects(stat(path.join(target, '.claude', 'CLAUDE.md')), { code: 'ENOENT' });
  await assert.rejects(stat(path.join(target, '.codex', 'AGENTS.md')), { code: 'ENOENT' });
});

test('doctor reports lifecycle support and detects managed drift', async () => {
  const root = await workspace();
  const profile = path.join(root, 'profile');
  const target = path.join(root, 'home');
  await runCli(['init', profile], capture().io);
  const dry = capture();
  await runCli(['import', profile, '--target', target, '--json'], dry.io);
  const digest = JSON.parse(dry.output[0]).digest;
  await runCli(['import', profile, '--target', target, '--apply', '--accept-plan', digest], capture().io);

  const healthy = capture();
  assert.equal(await runCli(['doctor', '--profile', profile, '--target', target], healthy.io), 0);
  assert.match(healthy.output[0], /session\.start=fallback/);

  await writeFile(path.join(target, '.codex', 'AGENTS.md'), 'drifted');
  const drifted = capture();
  assert.equal(await runCli(['doctor', '--profile', profile, '--target', target], drifted.io), 1);
  assert.match(drifted.output[0], /codex: drifted/);
});

