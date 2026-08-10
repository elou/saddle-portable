import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createSetupServer } from '../../src/ui/server.js';

test('setup server is loopback-only, token protected, and serves the onboarding shell', async (t) => {
  const setup = createSetupServer({ token: 'test-token' });
  const listener = await setup.listen();
  t.after(() => setup.close());

  const page = await fetch(listener.url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Bring your working methods with you/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);

  const denied = await fetch(`http://127.0.0.1:${listener.port}/api/status`);
  assert.equal(denied.status, 403);
  const status = await fetch(`http://127.0.0.1:${listener.port}/api/status`, {
    headers: { 'x-saddle-token': listener.token },
  });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).localOnly, true);

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

test('setup server inventories trusted candidates and creates a neutral profile from selected ids', async (t) => {
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
  const inventoryResponse = await request('/api/inventory', { targetRoot: root, runtimes: ['claude'] });
  assert.equal(inventoryResponse.status, 200);
  const inventory = await inventoryResponse.json();
  assert.deepEqual(inventory.inventories[0].candidates.map((item) => item.suggestedKind), [
    'operating-policy',
    'session-continuity',
  ]);

  const outputRoot = path.join(root, 'profiles', 'my-terra');
  const captureResponse = await request('/api/capture', {
    targetRoot: root,
    outputRoot,
    profile: { id: 'my-terra', name: 'My Terra' },
    selections: inventory.inventories[0].candidates.map((candidate) => ({
      runtime: 'claude',
      id: candidate.id,
    })),
  });
  assert.equal(captureResponse.status, 200);
  const manifest = JSON.parse(await readFile(path.join(outputRoot, 'saddle.profile.json'), 'utf8'));
  assert.equal(manifest.profile.id, 'my-terra');
  assert.ok(manifest.modules.some((module) => module.kind === 'operating-policy'));
  assert.ok(manifest.modules.some((module) => module.kind === 'session-continuity'));
});
