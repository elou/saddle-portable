import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('packed package installs without scripts and exposes a working saddle executable', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'saddle-install-'));
  const pack = await exec('npm', ['pack', '--json', '--pack-destination', workspace], {
    cwd: repositoryRoot,
  });
  const [metadata] = JSON.parse(pack.stdout);
  const tarball = path.join(workspace, metadata.filename);
  const packagedPaths = metadata.files.map((file) => file.path);

  assert.ok(packagedPaths.includes('bin/saddle.js'));
  assert.ok(packagedPaths.includes('schemas/profile-manifest.schema.json'));
  assert.ok(packagedPaths.includes('src/transaction/index.js'));
  assert.ok(!packagedPaths.some((file) => file.startsWith('test/') || file.startsWith('sessions/')));

  await exec('npm', ['init', '-y'], { cwd: workspace });
  await exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: workspace,
  });
  const executable = path.join(workspace, 'node_modules', '.bin', 'saddle');
  const help = await exec(executable, ['help'], { cwd: workspace });
  assert.match(help.stdout, /Saddle Portable/);

  const profile = path.join(workspace, 'packed-profile');
  await exec(executable, ['init', profile, '--id', 'packed-profile'], { cwd: workspace });
  const manifest = JSON.parse(await readFile(path.join(profile, 'saddle.profile.json'), 'utf8'));
  assert.equal(manifest.profile.id, 'packed-profile');
});
