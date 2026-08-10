import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyCustomization, previewCustomization } from '../../src/onboarding/customizer.js';
import { loadProfile } from '../../src/profile/index.js';

const digest = (text) => createHash('sha256').update(text).digest('hex');
const lifecycle = Object.fromEntries([['session.start', 'session-start'], ['session.checkpoint', 'session-checkpoint'], ['context.before-reset', 'before-context-reset'], ['context.after-reset', 'after-context-reset'], ['session.end', 'session-end']].map(([event, procedure]) => [event, { module: 'continuity', procedure }]));

async function sourceProfile() {
  const root = await mkdtemp(path.join(tmpdir(), 'saddle-customizer-'));
  const continuity = '# Continuity\n\n## session-start\nStart.\n## session-checkpoint\nCheckpoint.\n## before-context-reset\nSave.\n## after-context-reset\nReload.\n## session-end\nEnd.\n';
  const operating = '# Operating\nKeep work reversible.\n';
  await mkdir(path.join(root, 'instructions'), { recursive: true });
  await writeFile(path.join(root, 'instructions/continuity.md'), continuity); await writeFile(path.join(root, 'instructions/operating.md'), operating);
  const modules = [
    { id: 'continuity', kind: 'session-continuity', source: 'instructions/continuity.md', enabled: true, sensitivity: 'standard', consent: 'implicit', digest: digest(continuity) },
    { id: 'existing-policy', kind: 'operating-policy', source: 'instructions/operating.md', enabled: true, sensitivity: 'standard', consent: 'implicit', digest: digest(operating) },
  ];
  const manifest = { schemaVersion: '1.0', profile: { id: 'base', name: 'Base profile', version: '1.2.3', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z' }, modules, lifecycle, routing: { strategy: 'minimum-cost-that-clears-gate', routes: [] }, portability: { personalContext: 'prompt', integrations: 'declarations-only', scripts: 'copy-inert', absolutePaths: 'alias-only' } };
  await writeFile(path.join(root, 'saddle.profile.json'), JSON.stringify(manifest)); return root;
}

const draft = (entries = [], retainModuleIds = ['continuity', 'existing-policy']) => ({ retainModuleIds, entries });

test('previews deterministically without writing and returns UI-friendly review data', async () => {
  const profileRoot = await sourceProfile(); const outRoot = path.join(await mkdtemp(path.join(tmpdir(), 'saddle-custom-out-')), 'derived');
  const input = draft([{ id: 'work-style', kind: 'personal-context', label: 'How I prefer to work', content: 'Prefer concise updates.' }]);
  const [first, second] = await Promise.all([previewCustomization({ profileRoot, outRoot, draft: input }), previewCustomization({ profileRoot, outRoot, draft: input })]);
  assert.equal(first.digest, second.digest); assert.deepEqual(first.plan.sourceProfile, { id: 'base', name: 'Base profile', version: '1.2.3' });
  assert.deepEqual(first.plan.addedModules, [{ id: 'work-style', label: 'How I prefer to work', kind: 'personal-context', sensitivity: 'personal', source: 'instructions/personal/work-style.md' }]);
  assert.deepEqual(first.plan.requiredConsents, [{ id: 'work-style', kind: 'personal-context', sensitivity: 'personal' }]);
  await assert.rejects(stat(outRoot), { code: 'ENOENT' });
});

test('applies only an accepted preview into a manifest-committed no-overwrite profile', async () => {
  const profileRoot = await sourceProfile(); const parent = await mkdtemp(path.join(tmpdir(), 'saddle-custom-apply-')); const outRoot = path.join(parent, 'derived');
  const input = draft([{ id: 'family-rhythm', kind: 'personal-context', label: 'Family rhythm & care needs', content: 'Ask before scheduling late work.' }]);
  const preview = await previewCustomization({ profileRoot, outRoot, draft: input });
  await assert.rejects(applyCustomization({ profileRoot, outRoot, draft: input, expectedPreviewDigest: 'stale' }), /preview changed/);
  const result = await applyCustomization({ profileRoot, outRoot, draft: input, expectedPreviewDigest: preview.digest });
  assert.equal(result.previewDigest, preview.digest); assert.equal(result.profile.version, '1.2.4');
  const loaded = await loadProfile(outRoot); const personal = loaded.modules.find((module) => module.id === 'family-rhythm');
  assert.deepEqual({ kind: personal.kind, sensitivity: personal.sensitivity, consent: personal.consent }, { kind: 'personal-context', sensitivity: 'personal', consent: 'explicit' });
  assert.match(await readFile(path.join(outRoot, personal.source), 'utf8'), /Family rhythm & care needs/);
  await assert.rejects(applyCustomization({ profileRoot, outRoot, draft: input, expectedPreviewDigest: preview.digest }), /must be absent/);
  assert.equal(await readFile(path.join(profileRoot, 'instructions/operating.md'), 'utf8'), '# Operating\nKeep work reversible.\n');
});

test('formats neutral capability entries and supports removing non-lifecycle modules', async () => {
  const profileRoot = await sourceProfile(); const outRoot = path.join(await mkdtemp(path.join(tmpdir(), 'saddle-custom-cap-')), 'derived');
  const input = draft([{ id: 'evidence-review', kind: 'capability', label: 'Evidence review', content: 'Inspect inputs, record findings, and verify the conclusion.' }], ['continuity']);
  const preview = await previewCustomization({ profileRoot, outRoot, draft: input });
  assert.deepEqual(preview.plan.removedModules, [{ id: 'existing-policy', kind: 'operating-policy', sensitivity: 'standard' }]);
  await applyCustomization({ profileRoot, outRoot, draft: input, expectedPreviewDigest: preview.digest });
  const capability = await readFile(path.join(outRoot, 'capabilities/evidence-review/CAPABILITY.md'), 'utf8');
  assert.match(capability, /^---\nname: evidence-review\ndescription: "Evidence review"\n---/);
  await assert.rejects(readFile(path.join(outRoot, 'instructions/operating.md')), { code: 'ENOENT' });
});

test('protects lifecycle modules and rejects malformed or unsafe drafts', async () => {
  const profileRoot = await sourceProfile(); const outRoot = path.join(await mkdtemp(path.join(tmpdir(), 'saddle-custom-invalid-')), 'derived');
  await assert.rejects(previewCustomization({ profileRoot, outRoot, draft: draft([], ['existing-policy']) }), /lifecycle-referenced/);
  for (const entry of [
    { id: '../escape', kind: 'personal-context', label: 'Escape', content: 'Safe.' },
    { id: 'secret', kind: 'personal-context', label: 'Secret', content: 'api_key=abc' },
    { id: 'home', kind: 'personal-context', label: 'Home', content: 'Read /Users/example/private.' },
    { id: 'runtime', kind: 'personal-context', label: 'Runtime', content: 'Run /compact now.' },
    { id: 'destination', kind: 'personal-context', label: 'Destination', content: 'Read AGENTS.md first and use the Linear MCP server.' },
    { id: 'credential', kind: 'personal-context', label: 'Credential', content: ['s', 'k-', 'proj-', 'abcdefghijklmnop'].join('') },
    { id: 'github-value', kind: 'personal-context', label: 'GitHub value', content: ['gh', 'p_', 'abcdefghijklmnopqrstuvwx'].join('') },
    { id: 'slack-value', kind: 'personal-context', label: 'Slack value', content: ['xo', 'xb-', '1234567890-', 'abcdefghijklmnop'].join('') },
    { id: 'private-material', kind: 'personal-context', label: 'Private material', content: '-----BEGIN PRIVATE KEY-----' },
    { id: 'aws-key', kind: 'personal-context', label: 'AWS key', content: ['A', 'KIA', '1234567890ABCDEF'].join('') },
    { id: 'github-pat', kind: 'personal-context', label: 'GitHub PAT', content: ['github_', 'pat_', 'abcdefghijklmnopqrstuvwx'].join('') },
    { id: 'generic-sk', kind: 'personal-context', label: 'Generic key', content: ['s', 'k-', 'abcdefghijklmnopqrstuvwx'].join('') },
    { id: 'label-secret', kind: 'personal-context', label: 'api_key=abc', content: 'Safe prose.' },
    { id: 'mcp-connection', kind: 'personal-context', label: 'Integration', content: 'Configure the Linear MCP connection.' },
    { id: 'skill-file', kind: 'personal-context', label: 'Runtime file', content: 'Read SKILL.md before acting.' },
    { id: 'runtime-config', kind: 'personal-context', label: 'Runtime config', content: 'Write config.toml under model_reasoning_effort.' },
  ]) await assert.rejects(previewCustomization({ profileRoot, outRoot, draft: draft([entry]) }), /invalid|secret-bearing|machine-specific|runtime-bound/);
  await assert.rejects(previewCustomization({ profileRoot, outRoot, draft: { ...draft(), profile: { name: 'api_key=abc' } } }), /secret-bearing|profile/);
  await assert.rejects(previewCustomization({ profileRoot, outRoot, draft: { entries: [] } }), /retainModuleIds/);
});

test('allows expressive personal context but keeps portable authoring runtime-neutral', async () => {
  const profileRoot = await sourceProfile(); const outRoot = path.join(await mkdtemp(path.join(tmpdir(), 'saddle-custom-tier-')), 'derived');
  const personal = draft([
    { id: 'openai-work', kind: 'personal-context', label: 'Work', content: 'I work at OpenAI.' },
    { id: 'writing-tool', kind: 'personal-context', label: 'Writing', content: 'My preferred writing tool is Claude.' },
    { id: 'astronomy', kind: 'personal-context', label: 'Research', content: 'My project is about Gemini astronomy data.' },
  ]);
  await assert.doesNotReject(previewCustomization({ profileRoot, outRoot, draft: personal }));
  for (const content of ['npm install private-package', 'node setup.js', 'Configure the Slack webhook OAuth API']) {
    await assert.rejects(previewCustomization({ profileRoot, outRoot, draft: draft([{ id: 'portable-rule', kind: 'operating-policy', label: 'Portable rule', content }]) }), /runtime-bound/);
  }
});

test('refuses an output routed through a symlink alias of the source profile', async () => {
  const profileRoot = await sourceProfile(); const alias = `${profileRoot}-alias`; const outRoot = path.join(alias, 'derived');
  await symlink(profileRoot, alias);
  const input = draft();
  await assert.rejects(previewCustomization({ profileRoot, outRoot, draft: input }), /source profile/);
  await assert.rejects(applyCustomization({ profileRoot, outRoot, draft: input, expectedPreviewDigest: 'stale' }), /source profile/);
  await assert.rejects(stat(path.join(profileRoot, 'derived')), { code: 'ENOENT' });
});

test('retains exact validated bytes and rejects source drift before publishing', async () => {
  const profileRoot = await sourceProfile(); const outRoot = path.join(await mkdtemp(path.join(tmpdir(), 'saddle-custom-bytes-')), 'derived');
  const bytes = Buffer.from([0xc3, 0x28]);
  await writeFile(path.join(profileRoot, 'instructions/operating.md'), bytes);
  const manifestPath = path.join(profileRoot, 'saddle.profile.json'); const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.modules.find((module) => module.id === 'existing-policy').digest = digest(bytes);
  await writeFile(manifestPath, JSON.stringify(manifest));
  const input = draft(); const preview = await previewCustomization({ profileRoot, outRoot, draft: input });
  await applyCustomization({ profileRoot, outRoot, draft: input, expectedPreviewDigest: preview.digest });
  assert.deepEqual(await readFile(path.join(outRoot, 'instructions/operating.md')), bytes);
  await writeFile(path.join(profileRoot, 'instructions/operating.md'), 'changed');
  await assert.rejects(previewCustomization({ profileRoot, outRoot: path.join(path.dirname(outRoot), 'drifted'), draft: input }), /digest mismatch|changed/);
});
