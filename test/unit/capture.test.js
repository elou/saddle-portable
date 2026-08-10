import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inventoryRuntimeSources, readCandidate } from '../../src/capture/index.js';

async function runtime(files = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'saddle-capture-'));
  for (const [name, content] of Object.entries(files)) { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), content); }
  return root;
}

test('splits global instructions and classifies advisory sections', async () => {
  const root = await runtime({ 'CLAUDE.md': 'Intro policy.\n## Dev Server Safety\nCap servers.\n## Pre-context Resume\nSave notes before compact.\n## Human context\nFamily schedule.\n' });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  assert.deepEqual(candidates.map((item) => [item.heading, item.suggestedKind, item.suggestedSensitivity]), [[undefined, 'operating-policy', 'standard'], ['Dev Server Safety', 'operating-policy', 'standard'], ['Pre-context Resume', 'session-continuity', 'standard'], ['Human context', 'personal-context', 'personal']]);
  assert.match(candidates[1].reasons[0], /advisory/);
});

test('heading intent wins over ambiguous body verbs', async () => {
  const root = await runtime({ 'AGENTS.md': '## Model routing\nUse the least costly tier that can clear the acceptance gate.\n' });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  assert.equal(candidates[0].suggestedKind, 'project-standard');
  assert.equal(candidates[0].portableTransform, 'model-routing-v1');
  assert.match(candidates[0].reasons[0], /model-neutral/);
});

test('heading intent classifies operating and project standards before incidental body language', async () => {
  const root = await runtime({
    'AGENTS.md': `## HARD RULE — dev server memory cap
Save a session note after every change.
## De-Slop Before Voice
Resume the writing check after a compact.
## Delivery Orchestration (Draft)
Use a session checkpoint before handoff.
## Product Conversations — talk like a PM
Keep continuity notes concise.
## Analytical Discipline
Record the session evidence.
`,
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  assert.deepEqual(candidates.map((candidate) => candidate.suggestedKind), [
    'operating-policy', 'project-standard', 'project-standard', 'project-standard', 'project-standard',
  ]);
});

test('replaces a runtime Memory Protocol with self-contained neutral continuity procedures', async () => {
  const root = await runtime({
    'CLAUDE.md': `## Memory Protocol
Read ~/.claude/memory/projects/example/memory.md and the latest session note at session start.
Before /clear, /compact, /resume, or /branch, run /exit-check and write to ~/.claude/memory/projects/example/session-notes/.
`,
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  const memory = candidates[0];
  assert.equal(memory.selectable, true);
  assert.equal(memory.suggestedKind, 'session-continuity');
  assert.equal(memory.portableTransform, 'memory-protocol-v1');
  const content = await readCandidate(memory, { runtimeRoot: root });
  assert.match(content, /session start/i);
  assert.match(content, /before a context reset/i);
  assert.match(content, /session end/i);
  assert.doesNotMatch(content, /\.claude|\/clear|\/compact|\/resume|\/branch|exit-check/i);
});

test('replaces provider-specific model routing with a neutral cost-and-capability policy', async () => {
  const root = await runtime({
    'CLAUDE.md': `## Sub-Agent Model Routing
Use the Agent tool. Route file checks to Haiku, code synthesis to Sonnet, and architecture to Opus or Claude Code.
`,
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  const routing = candidates[0];
  assert.equal(routing.selectable, true);
  assert.equal(routing.suggestedKind, 'project-standard');
  assert.equal(routing.portableTransform, 'model-routing-v1');
  const content = await readCandidate(routing, { runtimeRoot: root });
  assert.match(content, /least expensive capable tier/i);
  assert.match(content, /mechanical|bounded implementation|architecture/i);
  assert.doesNotMatch(content, /Claude|Codex|Haiku|Sonnet|Opus|Agent tool/i);
});

test('replaces named runtime command policies with self-contained portable procedures', async () => {
  const root = await runtime({
    'CLAUDE.md': `## Project Kickoff
Ask whether to run /kickoff before building.
## De-Slop Before Voice
Run /de-slop before /voice-check.
## Save as you go (chat is ephemeral; files are durable)
Run /exit-check before /clear, /compact, /branch, or /resume.
`,
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  assert.deepEqual(candidates.map((candidate) => candidate.portableTransform), [
    'project-kickoff-v1', 'voice-preflight-v1', 'durable-session-v1',
  ]);
  for (const candidate of candidates) {
    assert.equal(candidate.selectable, true);
    const content = await readCandidate(candidate, { runtimeRoot: root });
    assert.doesNotMatch(content, /\/(?:kickoff|de-slop|voice-check|exit-check|clear|compact|branch|resume)\b/i);
  }
});

test('does not offer a runtime-bound skill as a universal capability', async () => {
  const root = await runtime({
    'skills/provider-bound/SKILL.md': '# Provider workflow\nUse Claude Code and the Agent tool, then run /compact.\n',
    'skills/slash-command/SKILL.md': '# Invocation\nRun `/five-whys` after a repeated failure.\n',
    'skills/neutral/SKILL.md': '# Neutral workflow\nInspect the evidence, run the relevant checks, and report residuals.\n',
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  const providerBound = candidates.find((candidate) => candidate.source.includes('provider-bound'));
  const slashCommand = candidates.find((candidate) => candidate.source.includes('slash-command'));
  const neutral = candidates.find((candidate) => candidate.source.includes('/neutral/'));
  assert.equal(providerBound.selectable, false);
  assert.match(providerBound.reasons[0], /runtime-specific|neutral CAPABILITY/i);
  assert.equal(slashCommand.selectable, false);
  assert.match(slashCommand.reasons[0], /runtime-specific|neutral CAPABILITY/i);
  assert.equal(neutral.selectable, true);
});

test('inventories capability assets and marks scripts restricted', async () => {
  const root = await runtime({ 'skills/example/SKILL.md': '# Example\n', 'skills/example/references/guide.md': 'Guide\n', 'skills/example/scripts/check.sh': '#!/bin/sh\nexit 0\n' });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  const skill = candidates[0];
  assert.equal(skill.sourceType, 'capability'); assert.equal(skill.suggestedSensitivity, 'restricted');
  assert.deepEqual(skill.assets.map((asset) => [asset.path, asset.kind]), [['skills/example/references/guide.md', 'reference'], ['skills/example/scripts/check.sh', 'script']]);
});

test('rejects prose slash invocations while preserving neutral absolute-path examples', async () => {
  const root = await runtime({
    'skills/invocation/SKILL.md': 'Use when the user invokes /pre-mortem or $pre-mortem.\n',
    'skills/path-example/SKILL.md': 'Read the neutral example at /absolute/path/to/file.\n',
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  const invocation = candidates.find((candidate) => candidate.source === 'skills/invocation/SKILL.md');
  const pathExample = candidates.find((candidate) => candidate.source === 'skills/path-example/SKILL.md');
  assert.equal(invocation.selectable, false);
  assert.match(invocation.reasons[0], /runtime-specific/);
  assert.equal(pathExample.selectable, true);
});

test('rejects backtick-wrapped lowercase dollar-skill invocations without blocking uppercase environment placeholders', async () => {
  const root = await runtime({
    'skills/invocation/SKILL.md': 'Use `$delivery-orchestration` before starting work.\n',
    'skills/home-placeholder/SKILL.md': 'Use $HOME only as an environment placeholder in this neutral example.\n',
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  assert.equal(candidates.find((candidate) => candidate.source === 'skills/invocation/SKILL.md').selectable, false);
  assert.equal(candidates.find((candidate) => candidate.source === 'skills/home-placeholder/SKILL.md').selectable, true);
});

test('marks imperative undeclared executable guidance as needing attention without rejecting neutral path examples', async () => {
  const root = await runtime({
    'AGENTS.md': `## External action
Open it: \`roughdraft open "/absolute/path/to/file.md"\`
## Neutral example
This prose documents the path \`/absolute/path/to/file.md\` without instructing execution.
`,
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  const externalAction = candidates.find((candidate) => candidate.heading === 'External action');
  const neutralExample = candidates.find((candidate) => candidate.heading === 'Neutral example');
  assert.equal(externalAction.selectable, false);
  assert.match(externalAction.reasons[0], /external executable|needs attention/i);
  assert.equal(neutralExample.selectable, true);
});

test('excludes generated, secret-bearing, transcript, settings, and absolute-home candidates', async () => {
  const root = await runtime({ 'AGENTS.md': '## Generated\nGenerated by Saddle\n## Secret\napi_key=abc\n## Home\nUse /Users/emily/private\n', 'skills/history/SKILL.md': '# History\n', 'skills/settings/SKILL.md': '# Settings\n' });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  assert.equal(candidates.every((candidate) => !candidate.selectable), true);
  await assert.rejects(readCandidate(candidates[0], { runtimeRoot: root }), /not selectable/);
});

test('skips symlink escapes, binary and large content without writes', async () => {
  const root = await runtime({ 'CLAUDE.md': Buffer.from([0, 1, 2]), 'skills/a/SKILL.md': 'x', 'skills/a/large.txt': 'x'.repeat(256 * 1024 + 1) });
  const outside = path.join(tmpdir(), `capture-outside-${Date.now()}`); await writeFile(outside, 'outside'); await symlink(outside, path.join(root, 'skills/a/link.txt'));
  const before = await readFile(path.join(root, 'skills/a/SKILL.md'), 'utf8');
  const first = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root }); const second = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  assert.deepEqual(first, second); assert.equal(await readFile(path.join(root, 'skills/a/SKILL.md'), 'utf8'), before);
  assert.ok(first.warnings.some((warning) => /binary|large|size/i.test(warning.reason)));
});

test('requires absolute roots and detects drift before returning exact content', async () => {
  await assert.rejects(inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: 'relative' }), /absolute/);
  const root = await runtime({ 'CLAUDE.md': '## Keep\nOriginal\n' }); const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  assert.equal(await readCandidate(candidates[0], { runtimeRoot: root }), '## Keep\nOriginal\n');
  await writeFile(path.join(root, 'CLAUDE.md'), '## Keep\nChanged\n');
  await assert.rejects(readCandidate(candidates[0], { runtimeRoot: root }), /changed/);
});

test('does not offer sections inside an existing Saddle-managed block', async () => {
  const root = await runtime({
    'CLAUDE.md': `## User policy\nKeep this.\n<!-- saddle:managed:start adapter=claude -->\n# Saddle operating profile\n## projected-policy\nDo not capture this generated section.\n<!-- saddle:managed:end adapter=claude -->\n`,
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  assert.equal(candidates.find((candidate) => candidate.heading === 'User policy').selectable, true);
  assert.equal(candidates.some((candidate) => candidate.heading === 'projected-policy' && candidate.selectable), false);
});

test('keeps authored policy prose about permissions selectable', async () => {
  const root = await runtime({
    'AGENTS.md': '## Permission safety\nDo not transfer permission allowlists or trust grants.\n',
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  assert.equal(candidates[0].selectable, true);
  assert.equal(candidates[0].suggestedKind, 'operating-policy');
});

test('excludes structural MCP connection configuration in global instructions', async () => {
  const root = await runtime({
    'AGENTS.md': '## MCP connection\nmcpServers:\n  internal:\n    url: https://mcp.internal.example/v1\n    command: private-launcher\n',
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'codex', runtimeRoot: root });
  assert.equal(candidates[0].selectable, false);
  assert.match(candidates[0].reasons[0], /connection/);
});

test('offers canonical human context as personal and never pre-authorizes it', async () => {
  const root = await runtime({
    'CLAUDE.md': '## Operating policy\nKeep changes reversible.\n',
    'human.md': '## Working preferences\nPrefer concise progress updates.\n',
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  const personal = candidates.find((candidate) => candidate.source === 'human.md');
  assert.equal(personal.suggestedKind, 'personal-context');
  assert.equal(personal.suggestedSensitivity, 'personal');
  assert.equal(personal.selectable, true);
  assert.match(personal.reasons[0], /explicit selection/);
});

test('replaces source-machine dev-safety references with a self-contained portable policy', async () => {
  const root = await runtime({
    'CLAUDE.md': '## Dev server safety\nCanonical spec: `~/.claude/memory/_scripts/dev-safety/SPEC.md`\nUse the local wrapper.\n',
  });
  const { candidates } = await inventoryRuntimeSources({ runtime: 'claude', runtimeRoot: root });
  assert.equal(candidates[0].selectable, true);
  assert.equal(candidates[0].portableTransform, 'dev-server-safety-v1');
  const content = await readCandidate(candidates[0], { runtimeRoot: root });
  assert.match(content, /complete process tree/);
  assert.match(content, /2048 MB/);
  assert.doesNotMatch(content, /~\/\.claude/);
});
