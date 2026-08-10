import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import * as claude from '../../src/adapters/claude.js';
import * as codex from '../../src/adapters/codex.js';
import { profile } from '../../fixtures/runtime-targets/profile.js';

async function target() {
  return mkdtemp(path.join(os.tmpdir(), 'saddle-adapter-'));
}

async function snapshot(root) {
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const collected = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) collected.push(...await walk(child));
      else collected.push([path.relative(root, child), await readFile(child, 'utf8')]);
    }
    return collected;
  }
  return walk(root);
}

async function applyProjection(root, projection) {
  for (const item of projection.operations) {
    const filename = path.join(root, item.target);
    if (item.action === 'create-directory') await mkdir(filename, { recursive: true });
    else {
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, item.content);
    }
  }
}

async function profileWithAssets() {
  const sourceRoot = await target();
  const capabilityDir = path.join(sourceRoot, 'capabilities', 'release-notes');
  await mkdir(path.join(capabilityDir, 'references'), { recursive: true });
  await mkdir(path.join(capabilityDir, 'scripts'), { recursive: true });
  const reference = path.join(capabilityDir, 'references', 'guide.md');
  const script = path.join(capabilityDir, 'scripts', 'check.js');
  await writeFile(reference, 'Reference guidance.\n');
  await writeFile(script, 'throw new Error("must not execute");\n');
  return { ...profile, sourceRoot, modules: profile.modules.map((module) => module.kind !== 'capability' ? module : {
    ...module, absoluteSource: path.join(capabilityDir, 'CAPABILITY.md'), sensitivity: 'restricted', consent: 'explicit',
    assets: [
      { path: 'capabilities/release-notes/scripts/check.js', absolutePath: script, digest: 'unused', kind: 'script' },
      { path: 'capabilities/release-notes/references/guide.md', absolutePath: reference, digest: 'unused', kind: 'reference' },
    ],
  }) };
}

for (const adapter of [claude, codex]) {
  test(`${adapter.id}: plan is deterministic and is read-only under the supplied root`, async () => {
    const root = await target();
    await writeFile(path.join(root, 'untouched.txt'), 'keep');
    const before = await snapshot(root);
    const first = await adapter.plan(profile, { targetRoot: root });
    const second = await adapter.plan(profile, { targetRoot: root });
    assert.deepEqual(first, second);
    assert.deepEqual(await snapshot(root), before);
    assert.equal(first.targetRoot, root);
    assert.ok(first.operations.every((operation) => !path.isAbsolute(operation.target)));
    assert.ok(first.operations.every((operation) => operation.id && operation.action && operation.expectedPriorDigest && operation.resultingDigest && operation.sourceModule && operation.adapter && operation.reason && operation.risk));
    assert.match(first.operations.find((operation) => operation.id.endsWith('global-instructions')).content, /source profile version: 1\.2\.3; source profile digest: a{64}/);
    assert.ok(first.operations.some((operation) => operation.target === 'skills/saddle-release-notes/SKILL.md'));
  });

  test(`${adapter.id}: detect and verify never write and verification distinguishes exact and drift`, async () => {
    const root = await target();
    const before = await snapshot(root);
    const detection = await adapter.detect({ targetRoot: root });
    const missing = await adapter.verify(profile, { targetRoot: root });
    assert.equal(detection.targetRoot, root);
    assert.equal(missing.status, 'missing');
    assert.deepEqual(await snapshot(root), before);

    const projection = await adapter.plan(profile, { targetRoot: root });
    await applyProjection(root, projection);
    assert.equal((await adapter.verify(profile, { targetRoot: root })).status, 'exact');
    await writeFile(path.join(root, adapter.id === 'claude' ? 'CLAUDE.md' : 'AGENTS.md'), 'hand edit');
    assert.equal((await adapter.verify(profile, { targetRoot: root })).status, 'drifted');
  });

  test(`${adapter.id}: has conservative lifecycle labels and does not plan configuration writes`, async () => {
    const root = await target();
    const matrix = adapter.capabilities().lifecycle;
    assert.deepEqual(Object.keys(matrix).sort(), ['context.after-reset', 'context.before-reset', 'session.checkpoint', 'session.end', 'session.start', 'subagent.end', 'subagent.start', 'tool.after', 'tool.before', 'tool.error']);
    assert.ok(Object.values(matrix).every((label) => ['native', 'fallback', 'unsupported'].includes(label)));
    assert.equal(matrix['tool.before'], 'unsupported');
    const projection = await adapter.plan(profile, { targetRoot: root });
    assert.ok(projection.operations.every((item) => !item.target.includes('config.toml') && !item.target.includes('settings')));
  });

  test(`${adapter.id}: preserves unmanaged instructions and replaces only its managed block`, async () => {
    const root = await target();
    const global = adapter.id === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
    const before = 'User instructions before.\n';
    const after = '\nUser instructions after.\n';
    await writeFile(path.join(root, global), before);
    const initial = await adapter.plan(profile, { targetRoot: root });
    const initialGlobal = initial.operations.find((item) => item.target === global);
    assert.ok(initialGlobal.content.startsWith(`${before}\n<!-- saddle:managed:start`));
    await applyProjection(root, initial);
    await writeFile(path.join(root, global), `${before}${initialGlobal.content.slice(before.length)}${after}`);
    const replanned = await adapter.plan(profile, { targetRoot: root });
    const replanGlobal = replanned.operations.find((item) => item.target === global);
    assert.ok(replanGlobal.content.startsWith(before));
    assert.ok(replanGlobal.content.endsWith(after));
    await applyProjection(root, replanned);
    const stable = await adapter.plan(profile, { targetRoot: root });
    assert.equal(stable.operations.find((item) => item.target === global).content, replanGlobal.content);
  });

  test(`${adapter.id}: rejects malformed managed blocks and unmanaged capability collisions`, async () => {
    const root = await target();
    const global = adapter.id === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
    await writeFile(path.join(root, global), `<!-- saddle:managed:start adapter=${adapter.id} -->\nbroken`);
    await assert.rejects(() => adapter.plan(profile, { targetRoot: root }), { code: 'SADDLE_PROJECTION_CONFLICT' });
    assert.equal((await adapter.verify(profile, { targetRoot: root })).status, 'unverifiable');
    await writeFile(path.join(root, global), 'ordinary user file');
    await mkdir(path.join(root, 'skills', 'saddle-release-notes'), { recursive: true });
    await writeFile(path.join(root, 'skills', 'saddle-release-notes', 'SKILL.md'), 'user capability');
    await assert.rejects(() => adapter.plan(profile, { targetRoot: root }), { code: 'SADDLE_PROJECTION_CONFLICT' });
  });

  test(`${adapter.id}: projects declared assets deterministically as inert content`, async () => {
    const root = await target();
    const withAssets = await profileWithAssets();
    const first = await adapter.plan(withAssets, { targetRoot: root });
    const second = await adapter.plan(withAssets, { targetRoot: root });
    assert.deepEqual(first, second);
    const reference = first.operations.find((item) => item.target.endsWith('/references/guide.md'));
    const script = first.operations.find((item) => item.target.endsWith('/scripts/check.js'));
    assert.equal(reference.target, 'skills/saddle-release-notes/references/guide.md');
    assert.equal(reference.content, 'Reference guidance.\n');
    assert.equal(script.risk, 'restricted');
    assert.match(script.reason, /inert content; it is not executed/);
    await applyProjection(root, first);
    assert.equal((await adapter.verify(withAssets, { targetRoot: root })).status, 'exact');
  });

  test(`${adapter.id}: rejects an unmanaged asset collision without execution or writes`, async () => {
    const root = await target();
    const withAssets = await profileWithAssets();
    const collision = path.join(root, 'skills', 'saddle-release-notes', 'references', 'guide.md');
    await mkdir(path.dirname(collision), { recursive: true });
    await writeFile(collision, 'user content');
    await assert.rejects(() => adapter.plan(withAssets, { targetRoot: root }), { code: 'SADDLE_PROJECTION_CONFLICT' });
    assert.equal(await readFile(collision, 'utf8'), 'user content');
  });
}

test('adapters reject an omitted or non-absolute caller target root', async () => {
  await assert.rejects(() => claude.plan(profile, {}), /caller-supplied/);
  await assert.rejects(() => codex.plan(profile, { targetRoot: 'relative-root' }), /caller-supplied/);
});

test('capability projections require the neutral CAPABILITY.md entrypoint', async () => {
  const invalid = { ...profile, modules: profile.modules.map((module) => module.kind === 'capability' ? { ...module, source: 'capabilities/release-notes/README.md' } : module) };
  const root = await target();
  await assert.rejects(() => claude.plan(invalid, { targetRoot: root }), /CAPABILITY\.md/);
  await assert.rejects(() => codex.plan(invalid, { targetRoot: root }), /CAPABILITY\.md/);
});
