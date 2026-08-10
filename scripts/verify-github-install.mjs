import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const packageSpec = process.argv[2];

if (!packageSpec) {
  process.stderr.write('Usage: node scripts/verify-github-install.mjs <github-or-git-package-spec>\n');
  process.exitCode = 1;
} else {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'saddle-git-install-'));
  try {
    await exec('npm', ['init', '-y'], { cwd: workspace });
    await exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', packageSpec], {
      cwd: workspace,
      timeout: 120_000,
    });

    const executable = path.join(workspace, 'node_modules', '.bin', process.platform === 'win32' ? 'saddle.cmd' : 'saddle');
    const help = await exec(executable, ['help'], { cwd: workspace });
    assert.match(help.stdout, /Saddle Portable/);

    await exec(process.execPath, [
      '--input-type=module',
      '--eval',
      'const api = await import("saddle-portable"); if (typeof api.loadProfile !== "function") process.exit(1);',
    ], { cwd: workspace });

    const profile = path.join(workspace, 'git-profile');
    await exec(executable, ['init', profile, '--id', 'git-profile'], { cwd: workspace });
    const manifest = JSON.parse(await readFile(path.join(profile, 'saddle.profile.json'), 'utf8'));
    assert.equal(manifest.profile.id, 'git-profile');

    process.stdout.write(`${JSON.stringify({ packageSpec, executable: true, publicApi: true, profileCreated: true })}\n`);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
