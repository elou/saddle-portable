import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { inventoryRuntimeSources } from '../../src/capture/index.js';
import * as claude from '../../src/adapters/claude.js';
import { createProfileFromCandidates } from '../../src/onboarding/profile-builder.js';
import { loadProfile } from '../../src/profile/index.js';

test('selected runtime sections and skills become one valid neutral profile', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-captured-profile-'));
  const runtimeRoot = path.join(root, '.claude');
  await mkdir(path.join(runtimeRoot, 'skills', 'review', 'scripts'), { recursive: true });
  await writeFile(path.join(runtimeRoot, 'CLAUDE.md'), '# Global\n\n## Dev server safety\nCap the complete process tree.\n\n## Session notes\nSave before compact and reload after resume.\n');
  await writeFile(path.join(runtimeRoot, 'skills', 'review', 'SKILL.md'), '---\nname: review\ndescription: "Check a result against its acceptance criteria."\n---\n# Review\n\nCheck the result.\n');
  await writeFile(path.join(runtimeRoot, 'skills', 'review', 'scripts', 'check.sh'), '#!/bin/sh\nexit 0\n');
  const inventory = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot });
  const outputRoot = path.join(root, 'portable');
  const result = await createProfileFromCandidates({
    sources: inventory.candidates.filter((candidate) => candidate.selectable).map((candidate) => ({
      runtimeRoot,
      candidate,
    })),
    outputRoot,
    profile: { id: 'my-terra', name: 'My Terra' },
  });

  assert.equal(result.profile.id, 'my-terra');
  const loaded = await loadProfile(outputRoot);
  assert.ok(loaded.modules.some((module) => module.kind === 'operating-policy'));
  assert.ok(loaded.modules.some((module) => module.kind === 'session-continuity'));
  const capability = loaded.modules.find((module) => module.kind === 'capability');
  assert.equal(capability.sensitivity, 'restricted');
  assert.deepEqual(capability.assets.map((asset) => asset.kind), ['script']);
  const capabilityContent = await readFile(path.join(outputRoot, capability.source), 'utf8');
  assert.match(capabilityContent, /Imported capability digest/);
  assert.doesNotMatch(capabilityContent, /claude|codex/i);
  assert.match(await readFile(path.join(outputRoot, 'instructions/session-continuity.md'), 'utf8'), /Before context reset/);
  const targetRoot = path.join(root, 'destination-claude');
  await mkdir(targetRoot);
  const projection = await claude.plan(loaded, { targetRoot });
  const skill = projection.operations.find((operation) => operation.target === 'skills/saddle-review/SKILL.md');
  assert.match(skill.content, /^---\nname: saddle-review\ndescription: "Check a result against its acceptance criteria\."\n---\n<!-- Saddle managed projection/);
});

test('capture rereads candidates, rejects drift, and leaves no partial output', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-capture-drift-'));
  const runtimeRoot = path.join(root, '.codex');
  await mkdir(runtimeRoot);
  await writeFile(path.join(runtimeRoot, 'AGENTS.md'), '## Session notes\nSave before compact.\n');
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot });
  await writeFile(path.join(runtimeRoot, 'AGENTS.md'), '## Session notes\nChanged.\n');
  const outputRoot = path.join(root, 'portable');

  await assert.rejects(createProfileFromCandidates({
    sources: [{ runtimeRoot, candidate: candidates[0] }],
    outputRoot,
    profile: { id: 'drift-test', name: 'Drift test' },
  }), /changed/);
  await assert.rejects(stat(outputRoot), { code: 'ENOENT' });
});

test('capture rejects selected capabilities with the same canonical skill directory before writing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-capture-collision-'));
  const claudeRoot = path.join(root, '.claude');
  const codexRoot = path.join(root, '.codex');
  for (const runtimeRoot of [claudeRoot, codexRoot]) {
    await mkdir(path.join(runtimeRoot, 'skills', 'writing-analyze-best-practices'), { recursive: true });
    await writeFile(path.join(runtimeRoot, 'skills', 'writing-analyze-best-practices', 'SKILL.md'), '# Writing analysis\n');
  }
  const [claude, codex] = await Promise.all([
    inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: claudeRoot }),
    inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: codexRoot }),
  ]);
  const outputRoot = path.join(root, 'portable');

  await assert.rejects(createProfileFromCandidates({
    sources: [
      { runtimeRoot: claudeRoot, candidate: claude.candidates[0] },
      { runtimeRoot: codexRoot, candidate: codex.candidates[0] },
    ],
    outputRoot,
    profile: { id: 'collision-test', name: 'Collision test' },
  }), /choose one source.*writing-analyze-best-practices/i);
  await assert.rejects(stat(outputRoot), { code: 'ENOENT' });
});

test('captured provider routing becomes structured and model-neutral', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-routing-capture-'));
  const runtimeRoot = path.join(root, '.claude');
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(path.join(runtimeRoot, 'CLAUDE.md'), `## Sub-Agent Model Routing
Use Haiku for file checks, Sonnet for synthesis, and Opus or Claude Code for architecture through the Agent tool.
`);
  const inventory = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot });
  const routing = inventory.candidates[0];
  const outputRoot = path.join(root, 'portable');
  await createProfileFromCandidates({
    sources: [{ runtimeRoot, candidate: routing }],
    outputRoot,
    profile: { id: 'neutral-routing', name: 'Neutral routing' },
  });
  const manifest = JSON.parse(await readFile(path.join(outputRoot, 'saddle.profile.json'), 'utf8'));
  assert.ok(manifest.routing.routes.length >= 3);
  assert.equal(manifest.routing.routes.every((route) => !Object.hasOwn(route, 'model')), true);
  const standards = await readFile(path.join(outputRoot, 'instructions/project-standard.md'), 'utf8');
  assert.doesNotMatch(standards, /Claude|Codex|Haiku|Sonnet|Opus|Agent tool/i);
});
