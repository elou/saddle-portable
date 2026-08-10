import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createSetupServer } from '../../src/ui/server.js';
import { runCli } from '../../src/cli.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');

test('setup server is loopback-only, token protected, and serves the onboarding shell', async (t) => {
  const setup = createSetupServer({ token: 'test-token' });
  const listener = await setup.listen();
  t.after(() => setup.close());

  const page = await fetch(listener.url);
  assert.equal(page.status, 200);
  const pageSource = await page.text();
  assert.match(pageSource, /Bring your working methods with you/);
  assert.doesNotMatch(pageSource, /\bTerra\b/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);

  const denied = await fetch(`http://127.0.0.1:${listener.port}/api/status`);
  assert.equal(denied.status, 403);
  const status = await fetch(`http://127.0.0.1:${listener.port}/api/status`, {
    headers: { 'x-saddle-token': listener.token },
  });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).localOnly, true);

  const app = await fetch(`http://127.0.0.1:${listener.port}/app.js`);
  const appSource = await app.text();
  assert.match(appSource, /What should an agent know or do\?/);
  assert.match(appSource, /exported or installed/);
  assert.doesNotMatch(appSource, /What should Terra know or do\?/);

  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-ui-target-'));
  const scan = await fetch(`http://127.0.0.1:${listener.port}/api/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-saddle-token': listener.token },
    body: JSON.stringify({ targetRoot: root, runtimes: ['claude', 'codex'] }),
  });
  assert.equal(scan.status, 200);
  assert.deepEqual((await scan.json()).results.map((item) => item.id), ['claude', 'codex']);
});

test('setup server rejects non-loopback bind requests', async () => {
  const setup = createSetupServer();
  await assert.rejects(setup.listen({ host: '0.0.0.0' }), /only binds to loopback/);
});

test('customization server exposes only token-protected profile metadata and requires no target', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-ui-customize-config-'));
  const profileRoot = path.join(root, 'profile');
  const outRoot = path.join(root, 'customized-profile');
  await runCli(['init', profileRoot], { out() {}, err() {} });
  const setup = createSetupServer({
    token: 'customize-config-token',
    config: { mode: 'customize', profileRoot, outRoot },
  });
  const listener = await setup.listen();
  t.after(() => setup.close());

  const denied = await fetch(`http://127.0.0.1:${listener.port}/api/config`);
  assert.equal(denied.status, 403);
  const response = await fetch(`http://127.0.0.1:${listener.port}/api/config`, {
    headers: { 'x-saddle-token': listener.token },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    mode: 'customize',
    profileRoot,
    outRoot,
    profile: {
      id: 'profile',
      name: 'profile',
      version: '1.0.0',
      modules: [
        { id: 'operating-policy', kind: 'operating-policy', sensitivity: 'standard', enabled: true, required: false },
        { id: 'session-continuity', kind: 'session-continuity', sensitivity: 'standard', enabled: true, required: true },
        { id: 'project-standards', kind: 'project-standard', sensitivity: 'standard', enabled: true, required: false },
      ],
    },
  });
});

test('customization preview is deterministic, non-writing, and apply enforces its digest', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-ui-customize-'));
  const profileRoot = path.join(root, 'profile');
  const outRoot = path.join(root, 'customized-profile');
  await runCli(['init', profileRoot], { out() {}, err() {} });
  const setup = createSetupServer({ token: 'customize-token' });
  const listener = await setup.listen();
  t.after(() => setup.close());
  const request = (endpoint, body, token = listener.token) => fetch(`http://127.0.0.1:${listener.port}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-saddle-token': token },
    body: JSON.stringify(body),
  });
  const body = {
    profileRoot,
    outRoot,
    draft: {
      retainModuleIds: ['session-continuity'],
      entries: [],
      updatedAt: '2026-08-09T00:00:01.000Z',
    },
  };

  assert.equal((await request('/api/customize/preview', body, 'wrong')).status, 403);
  const first = await request('/api/customize/preview', body);
  assert.equal(first.status, 200);
  const preview = await first.json();
  assert.deepEqual(Object.keys(preview).sort(), ['digest', 'plan']);
  assert.equal(Object.hasOwn(preview, 'manifest'), false);
  assert.equal(Object.hasOwn(preview, 'files'), false);
  assert.equal(preview.plan.operations.every((operation) => typeof operation.content === 'string'), true);
  assert.match(preview.plan.operations.find((operation) => operation.target === 'saddle.profile.json').content, /"schemaVersion": "1\.0"/);
  const second = await request('/api/customize/preview', body);
  assert.deepEqual(await second.json(), preview);
  await assert.rejects(readFile(path.join(outRoot, 'saddle.profile.json')), { code: 'ENOENT' });

  const rejected = await request('/api/customize/apply', { ...body, previewDigest: 'wrong' });
  assert.equal(rejected.status, 409);
  await assert.rejects(readFile(path.join(outRoot, 'saddle.profile.json')), { code: 'ENOENT' });

  const applied = await request('/api/customize/apply', { ...body, previewDigest: preview.digest });
  assert.equal(applied.status, 200);
  assert.equal((await applied.json()).previewDigest, preview.digest);
  assert.equal(JSON.parse(await readFile(path.join(outRoot, 'saddle.profile.json'), 'utf8')).modules.length, 1);
});

test('setup server accepts sourceRoot for inventory and capture while retaining targetRoot compatibility', async (t) => {
  const setup = createSetupServer({ token: 'capture-token' });
  const listener = await setup.listen();
  t.after(() => setup.close());
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-ui-capture-'));
  await mkdir(path.join(root, '.claude'));
  await writeFile(path.join(root, '.claude', 'CLAUDE.md'), '## Dev server safety\nCap the process tree.\n## Session notes\nSave before compact and reload after resume.\n');

  const request = (endpoint, body) => fetch(`http://127.0.0.1:${listener.port}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-saddle-token': listener.token },
    body: JSON.stringify(body),
  });
  const inventoryResponse = await request('/api/inventory', { sourceRoot: root, runtimes: ['claude'] });
  assert.equal(inventoryResponse.status, 200);
  const inventory = await inventoryResponse.json();
  assert.equal(inventory.sourceRoot, root);
  assert.deepEqual(inventory.inventories[0].candidates.map((item) => item.suggestedKind), [
    'operating-policy',
    'session-continuity',
  ]);

  const outputRoot = path.join(root, 'profiles', 'my-profile');
  const captureResponse = await request('/api/capture', {
    sourceRoot: root,
    outputRoot,
    profile: { id: 'my-profile', name: 'My profile' },
    selections: inventory.inventories[0].candidates.map((candidate) => ({
      runtime: 'claude',
      id: candidate.id,
    })),
  });
  assert.equal(captureResponse.status, 200);
  const manifest = JSON.parse(await readFile(path.join(outputRoot, 'saddle.profile.json'), 'utf8'));
  assert.equal(manifest.profile.id, 'my-profile');
  assert.ok(manifest.modules.some((module) => module.kind === 'operating-policy'));
  assert.ok(manifest.modules.some((module) => module.kind === 'session-continuity'));
});

test('setup server rejects duplicate canonical capability selections without creating a profile', async (t) => {
  const setup = createSetupServer({ token: 'collision-token' });
  const listener = await setup.listen();
  t.after(() => setup.close());
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-ui-collision-'));
  for (const runtime of ['claude', 'codex']) {
    await mkdir(path.join(root, `.${runtime}`, 'skills', 'shared-skill'), { recursive: true });
    await writeFile(path.join(root, `.${runtime}`, 'skills', 'shared-skill', 'SKILL.md'), '# Shared skill\n');
  }
  const request = (endpoint, body) => fetch(`http://127.0.0.1:${listener.port}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-saddle-token': listener.token },
    body: JSON.stringify(body),
  });
  const inventoryResponse = await request('/api/inventory', { targetRoot: root, runtimes: ['claude', 'codex'] });
  const inventory = await inventoryResponse.json();
  const response = await request('/api/capture', {
    targetRoot: root,
    outputRoot: path.join(root, 'portable'),
    profile: { id: 'collision-test', name: 'Collision test' },
    selections: inventory.inventories.map((runtime) => ({ runtime: runtime.runtime, id: runtime.candidates[0].id })),
  });

  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /choose one source.*shared-skill/i);
  await assert.rejects(readFile(path.join(root, 'portable', 'saddle.profile.json')), { code: 'ENOENT' });
});

test('setup server requires destination consent before applying personal context', async (t) => {
  const setup = createSetupServer({ token: 'consent-token' });
  const listener = await setup.listen();
  t.after(() => setup.close());
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-ui-consent-'));
  const profileRoot = path.join(root, 'profile');
  const targetRoot = path.join(root, 'home');
  await mkdir(path.join(profileRoot, 'instructions'), { recursive: true });
  const personal = '# Personal context\nUse my selected preferences.\n';
  const continuity = '# Session continuity\n## Session start\nRead durable context.\n';
  await writeFile(path.join(profileRoot, 'instructions/personal.md'), personal);
  await writeFile(path.join(profileRoot, 'instructions/session.md'), continuity);
  const lifecycle = Object.fromEntries([
    ['session.start', 'session-start'], ['session.checkpoint', 'session-checkpoint'],
    ['context.before-reset', 'before-context-reset'], ['context.after-reset', 'after-context-reset'],
    ['session.end', 'session-end'],
  ].map(([event, procedure]) => [event, { module: 'continuity', procedure }]));
  await writeFile(path.join(profileRoot, 'saddle.profile.json'), `${JSON.stringify({
    schemaVersion: '1.0',
    profile: { id: 'personal-test', name: 'Personal test', version: '1.0.0', createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z' },
    modules: [
      { id: 'personal', kind: 'personal-context', source: 'instructions/personal.md', enabled: true, sensitivity: 'personal', consent: 'explicit', digest: digest(personal) },
      { id: 'continuity', kind: 'session-continuity', source: 'instructions/session.md', enabled: true, sensitivity: 'standard', consent: 'implicit', digest: digest(continuity) },
    ],
    lifecycle,
    routing: { strategy: 'minimum-cost-that-clears-gate', routes: [] },
    portability: { personalContext: 'prompt', integrations: 'declarations-only', scripts: 'copy-inert', absolutePaths: 'alias-only' },
  }, null, 2)}\n`);
  const request = (endpoint, body) => fetch(`http://127.0.0.1:${listener.port}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-saddle-token': listener.token },
    body: JSON.stringify(body),
  });
  const planResponse = await request('/api/plan', { profileRoot, targetRoot, runtimes: ['claude'] });
  assert.equal(planResponse.status, 200);
  const preview = await planResponse.json();
  assert.deepEqual(preview.requiredConsents, [{ id: 'personal', kind: 'personal-context', sensitivity: 'personal' }]);

  const denied = await request('/api/apply', { profileRoot, targetRoot, runtimes: ['claude'], stateRoot: path.join(targetRoot, '.saddle'), planDigest: preview.digest, consents: [] });
  assert.equal(denied.status, 422);
  assert.equal((await denied.json()).code, 'CONSENT_REQUIRED');

  const applied = await request('/api/apply', { profileRoot, targetRoot, runtimes: ['claude'], stateRoot: path.join(targetRoot, '.saddle'), planDigest: preview.digest, consents: ['personal'] });
  assert.equal(applied.status, 200);
  const result = await applied.json();
  assert.equal(result.verification[0].verification.status, 'exact');
});
