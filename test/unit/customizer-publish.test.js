import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { cleanupReservation, createReservationJournal, publishReservedOutput, recoverReservedOutput, reserveOutput, stagingPath } from '../../src/onboarding/customizer-publish.js';
import { runCli } from '../../src/cli.js';

test('publish never overwrites foreign content and cleanup preserves the reservation marker', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'saddle-publish-race-'));
  const outputRoot = path.join(parent, 'derived');
  const staging = stagingPath(parent, outputRoot);
  await mkdir(staging);
  await writeFile(path.join(staging, 'saddle.profile.json'), 'validated manifest');
  const reservation = await reserveOutput(outputRoot, await createReservationJournal(staging, outputRoot));
  await writeFile(path.join(outputRoot, 'saddle.profile.json'), 'foreign manifest');
  await assert.rejects(publishReservedOutput(staging, reservation), /already exists/);
  assert.equal(await cleanupReservation(reservation), false);
  assert.equal(await readFile(path.join(outputRoot, 'saddle.profile.json'), 'utf8'), 'foreign manifest');
  assert.ok((await readdir(outputRoot)).includes(path.basename(reservation.marker)));
});

test('recovers a clean stale reservation but preserves mutated planned files', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'saddle-publish-recover-'));
  const cleanOut = path.join(parent, 'clean'); const cleanStage = stagingPath(parent, cleanOut);
  await mkdir(path.join(cleanStage, 'instructions'), { recursive: true }); await writeFile(path.join(cleanStage, 'instructions', 'policy.md'), 'planned'); await writeFile(path.join(cleanStage, 'saddle.profile.json'), 'planned manifest');
  const cleanReservation = await reserveOutput(cleanOut, await createReservationJournal(cleanStage, cleanOut));
  await mkdir(path.join(cleanOut, 'instructions')); await writeFile(path.join(cleanOut, 'instructions', 'policy.md'), 'planned');
  assert.equal((await recoverReservedOutput(cleanOut)).status, 'recovered');
  await assert.rejects(readdir(cleanOut), { code: 'ENOENT' });
  const changedOut = path.join(parent, 'changed'); const changedStage = stagingPath(parent, changedOut);
  await mkdir(changedStage); await writeFile(path.join(changedStage, 'policy.md'), 'planned');
  await reserveOutput(changedOut, await createReservationJournal(changedStage, changedOut)); await writeFile(path.join(changedOut, 'policy.md'), 'changed');
  assert.equal((await recoverReservedOutput(changedOut)).status, 'incomplete');
  assert.equal(await readFile(path.join(changedOut, 'policy.md'), 'utf8'), 'changed');
});

test('rejects a hand-edited journal path outside its reservation without touching the sibling', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'saddle-publish-unsafe-')); const outRoot = path.join(parent, 'derived'); const sibling = path.join(parent, 'sibling.txt');
  await mkdir(outRoot); await writeFile(sibling, 'do not touch');
  await writeFile(path.join(outRoot, '.saddle-customize-reservation-test'), JSON.stringify({ version: 1, token: '123e4567-e89b-42d3-a456-426614174000', outputRoot: outRoot, files: [{ path: '../sibling.txt', digest: '0'.repeat(64) }], directories: [] }));
  await assert.rejects(recoverReservedOutput(outRoot), /reservation changed|unsafe/);
  assert.equal(await readFile(sibling, 'utf8'), 'do not touch');
});

test('preserves a symlinked planned path and its target during recovery', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'saddle-publish-symlink-')); const outRoot = path.join(parent, 'derived'); const outside = path.join(parent, 'outside');
  await mkdir(outRoot); await mkdir(outside); await writeFile(path.join(outside, 'keep.txt'), 'keep'); await symlink(outside, path.join(outRoot, 'linked'));
  await writeFile(path.join(outRoot, '.saddle-customize-reservation-test'), JSON.stringify({ version: 1, token: '123e4567-e89b-42d3-a456-426614174000', outputRoot: outRoot, files: [{ path: 'linked/keep.txt', digest: '6ca7ea2feefc88ecb5ed6356ed963f47d6c3f3986c59eec8bc6f8ed2fddbd4ce' }], directories: ['linked'] }));
  assert.equal((await recoverReservedOutput(outRoot)).status, 'incomplete');
  assert.equal(await readFile(path.join(outside, 'keep.txt'), 'utf8'), 'keep');
});

test('preserves a foreign manifest and reports incomplete recovery', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'saddle-publish-manifest-')); const outRoot = path.join(parent, 'derived'); const staging = stagingPath(parent, outRoot);
  await mkdir(staging); await writeFile(path.join(staging, 'saddle.profile.json'), 'expected'); await reserveOutput(outRoot, await createReservationJournal(staging, outRoot)); await writeFile(path.join(outRoot, 'saddle.profile.json'), 'foreign');
  assert.equal((await recoverReservedOutput(outRoot)).status, 'incomplete');
  assert.equal(await readFile(path.join(outRoot, 'saddle.profile.json'), 'utf8'), 'foreign');
});

test('recognizes a valid committed profile with a matching journal', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'saddle-publish-committed-')); const outRoot = path.join(parent, 'profile');
  const io = { out() {}, err() {} }; assert.equal(await runCli(['init', outRoot], io), 0);
  const staging = path.join(parent, 'staging'); await cp(outRoot, staging, { recursive: true }); const journal = await createReservationJournal(staging, outRoot);
  await writeFile(path.join(outRoot, '.saddle-customize-reservation-test'), JSON.stringify(journal));
  assert.equal((await recoverReservedOutput(outRoot)).status, 'committed');
  assert.ok((await stat(path.join(outRoot, 'saddle.profile.json'))).isFile());
  assert.equal((await readdir(outRoot)).some((name) => name.startsWith('.saddle-customize-reservation-')), false);
});
