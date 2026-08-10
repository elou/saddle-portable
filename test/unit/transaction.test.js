import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TransactionError,
  applyPlan,
  digestBytes,
  digestPlan,
  rollbackTransaction,
} from '../../src/transaction/index.js';

async function roots() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saddle-transaction-'));
  const targetRoot = path.join(root, 'target');
  const stateRoot = path.join(root, 'state');
  await mkdir(targetRoot);
  return { root, targetRoot, stateRoot };
}

function operation({ id, action, target, prior = 'absent', content }) {
  return {
    id,
    action,
    target,
    expectedPriorDigest: prior,
    ...(content === undefined
      ? {}
      : { content, resultingDigest: digestBytes(content) }),
    sourceModule: 'operating',
    adapter: 'test',
    reason: 'Test operation',
    risk: 'low',
  };
}

test('apply requires the exact preview digest', async () => {
  const { targetRoot, stateRoot } = await roots();
  const plan = { operations: [operation({ id: 'one', action: 'create-file', target: 'a.txt', content: 'a' })] };

  await assert.rejects(
    applyPlan(plan, { targetRoot, stateRoot, expectedPlanDigest: '0'.repeat(64) }),
    (error) => error instanceof TransactionError && error.code === 'PLAN_DIGEST_MISMATCH',
  );
});

test('apply writes a plan and an explicit rollback restores the original tree', async () => {
  const { targetRoot, stateRoot } = await roots();
  await writeFile(path.join(targetRoot, 'existing.txt'), 'before', { mode: 0o640 });
  const plan = {
    operations: [
      operation({
        id: 'replace',
        action: 'replace-file',
        target: 'existing.txt',
        prior: digestBytes('before'),
        content: 'after',
      }),
      operation({ id: 'create', action: 'create-file', target: 'nested/new.txt', content: 'new' }),
    ],
  };

  const result = await applyPlan(plan, {
    targetRoot,
    stateRoot,
    expectedPlanDigest: digestPlan(plan),
    transactionId: 'apply-and-rollback',
  });
  assert.equal(result.status, 'applied');
  assert.equal(await readFile(path.join(targetRoot, 'existing.txt'), 'utf8'), 'after');
  assert.equal(await readFile(path.join(targetRoot, 'nested/new.txt'), 'utf8'), 'new');

  const rollback = await rollbackTransaction(result.id, { targetRoot, stateRoot });
  assert.equal(rollback.status, 'rolled-back');
  assert.equal(await readFile(path.join(targetRoot, 'existing.txt'), 'utf8'), 'before');
  await assert.rejects(stat(path.join(targetRoot, 'nested/new.txt')), { code: 'ENOENT' });
  await assert.rejects(stat(path.join(targetRoot, 'nested')), { code: 'ENOENT' });
});

test('injected mid-apply failure restores replaced and newly created files', async () => {
  const { targetRoot, stateRoot } = await roots();
  await writeFile(path.join(targetRoot, 'existing.txt'), 'before');
  const plan = {
    operations: [
      operation({
        id: 'replace',
        action: 'replace-file',
        target: 'existing.txt',
        prior: digestBytes('before'),
        content: 'after',
      }),
      operation({ id: 'create', action: 'create-file', target: 'new.txt', content: 'new' }),
    ],
  };

  await assert.rejects(
    applyPlan(plan, {
      targetRoot,
      stateRoot,
      expectedPlanDigest: digestPlan(plan),
      transactionId: 'injected-failure',
      failAfterOperation: 2,
    }),
    (error) =>
      error instanceof TransactionError &&
      error.code === 'APPLY_FAILED_ROLLED_BACK' &&
      error.rollback.complete,
  );
  assert.equal(await readFile(path.join(targetRoot, 'existing.txt'), 'utf8'), 'before');
  await assert.rejects(stat(path.join(targetRoot, 'new.txt')), { code: 'ENOENT' });
});

test('target drift stops before any mutation', async () => {
  const { targetRoot, stateRoot } = await roots();
  await writeFile(path.join(targetRoot, 'existing.txt'), 'changed-after-preview');
  const plan = {
    operations: [
      operation({ id: 'new', action: 'create-file', target: 'new.txt', content: 'new' }),
      operation({
        id: 'replace',
        action: 'replace-file',
        target: 'existing.txt',
        prior: digestBytes('old-preview'),
        content: 'after',
      }),
    ],
  };

  await assert.rejects(
    applyPlan(plan, { targetRoot, stateRoot, expectedPlanDigest: digestPlan(plan) }),
    (error) => error instanceof TransactionError && error.code === 'TARGET_DRIFT',
  );
  await assert.rejects(stat(path.join(targetRoot, 'new.txt')), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(targetRoot, 'existing.txt'), 'utf8'), 'changed-after-preview');
});

test('traversal and symbolic-link targets are rejected', async (t) => {
  const { root, targetRoot, stateRoot } = await roots();
  const outside = path.join(root, 'outside');
  await mkdir(outside);

  const unsafePlan = {
    operations: [operation({ id: 'escape', action: 'create-file', target: '../outside/pwned', content: 'x' })],
  };
  await assert.rejects(
    applyPlan(unsafePlan, { targetRoot, stateRoot, expectedPlanDigest: digestPlan(unsafePlan) }),
    (error) => error instanceof TransactionError && error.code === 'INVALID_PLAN',
  );

  try {
    const { symlink } = await import('node:fs/promises');
    await symlink(outside, path.join(targetRoot, 'linked'));
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('Symbolic links are not permitted on this platform.');
      return;
    }
    throw error;
  }
  const symlinkPlan = {
    operations: [operation({ id: 'symlink', action: 'create-file', target: 'linked/pwned', content: 'x' })],
  };
  await assert.rejects(
    applyPlan(symlinkPlan, { targetRoot, stateRoot, expectedPlanDigest: digestPlan(symlinkPlan) }),
    (error) => error instanceof TransactionError && error.code === 'UNSAFE_TARGET',
  );
});

test('a plan cannot target the same path more than once', async () => {
  const { targetRoot, stateRoot } = await roots();
  const plan = {
    operations: [
      operation({ id: 'first', action: 'create-file', target: 'same.txt', content: 'one' }),
      operation({ id: 'second', action: 'create-file', target: 'same.txt', content: 'two' }),
    ],
  };
  await assert.rejects(
    applyPlan(plan, { targetRoot, stateRoot, expectedPlanDigest: digestPlan(plan) }),
    (error) => error instanceof TransactionError && error.code === 'INVALID_PLAN',
  );
});

test('explicit rollback stops before mutation when an applied target has new user edits', async () => {
  const { targetRoot, stateRoot } = await roots();
  await writeFile(path.join(targetRoot, 'first.txt'), 'first-before');
  await writeFile(path.join(targetRoot, 'second.txt'), 'second-before');
  const plan = {
    operations: [
      operation({ id: 'first', action: 'replace-file', target: 'first.txt', prior: digestBytes('first-before'), content: 'first-applied' }),
      operation({ id: 'second', action: 'replace-file', target: 'second.txt', prior: digestBytes('second-before'), content: 'second-applied' }),
    ],
  };
  const applied = await applyPlan(plan, {
    targetRoot,
    stateRoot,
    expectedPlanDigest: digestPlan(plan),
    transactionId: 'rollback-drift',
  });
  await writeFile(path.join(targetRoot, 'second.txt'), 'user-edited-after-apply');

  await assert.rejects(
    rollbackTransaction(applied.id, { targetRoot, stateRoot }),
    (error) => error instanceof TransactionError && error.code === 'ROLLBACK_TARGET_DRIFT',
  );
  assert.equal(await readFile(path.join(targetRoot, 'first.txt'), 'utf8'), 'first-applied');
  assert.equal(await readFile(path.join(targetRoot, 'second.txt'), 'utf8'), 'user-edited-after-apply');
});

test('replace-file preserves the existing file mode', async () => {
  const { targetRoot, stateRoot } = await roots();
  const target = path.join(targetRoot, 'mode.txt');
  await writeFile(target, 'before', { mode: 0o644 });
  const plan = {
    operations: [operation({ id: 'mode', action: 'replace-file', target: 'mode.txt', prior: digestBytes('before'), content: 'after' })],
  };
  await applyPlan(plan, { targetRoot, stateRoot, expectedPlanDigest: digestPlan(plan) });
  assert.equal((await stat(target)).mode & 0o777, 0o644);
});

test('create-directory creates missing parents and rollback removes only those parents', async () => {
  const { targetRoot, stateRoot } = await roots();
  const plan = {
    operations: [operation({ id: 'nested', action: 'create-directory', target: 'skills/saddle-demo' })],
  };
  const applied = await applyPlan(plan, {
    targetRoot,
    stateRoot,
    expectedPlanDigest: digestPlan(plan),
    transactionId: 'nested-directory',
  });
  assert.equal((await stat(path.join(targetRoot, 'skills/saddle-demo'))).isDirectory(), true);
  await rollbackTransaction(applied.id, { targetRoot, stateRoot });
  await assert.rejects(stat(path.join(targetRoot, 'skills')), { code: 'ENOENT' });
});

test('rollback removes nested directories created for managed capability files', async () => {
  const { targetRoot, stateRoot } = await roots();
  const plan = {
    operations: [
      operation({ id: 'capability-dir', action: 'create-directory', target: 'skills/saddle-demo' }),
      operation({ id: 'nested-file', action: 'create-file', target: 'skills/saddle-demo/scripts/check.js', content: 'inert' }),
    ],
  };
  const applied = await applyPlan(plan, { targetRoot, stateRoot, expectedPlanDigest: digestPlan(plan) });
  const rolledBack = await rollbackTransaction(applied.id, { targetRoot, stateRoot });
  assert.equal(rolledBack.status, 'rolled-back');
  await assert.rejects(stat(path.join(targetRoot, 'skills')), { code: 'ENOENT' });
});

test('rollback detects an unrecognized descendant before restoring any file', async () => {
  const { targetRoot, stateRoot } = await roots();
  await writeFile(path.join(targetRoot, 'outside.txt'), 'before');
  const plan = {
    operations: [
      operation({ id: 'outside', action: 'replace-file', target: 'outside.txt', prior: digestBytes('before'), content: 'applied' }),
      operation({ id: 'capability-dir', action: 'create-directory', target: 'skills/saddle-demo' }),
      operation({ id: 'managed', action: 'create-file', target: 'skills/saddle-demo/SKILL.md', content: 'managed' }),
    ],
  };
  const applied = await applyPlan(plan, { targetRoot, stateRoot, expectedPlanDigest: digestPlan(plan) });
  await writeFile(path.join(targetRoot, 'skills/saddle-demo/user-note.md'), 'keep me');
  await assert.rejects(
    rollbackTransaction(applied.id, { targetRoot, stateRoot }),
    (error) => error instanceof TransactionError && error.code === 'ROLLBACK_TARGET_DRIFT',
  );
  assert.equal(await readFile(path.join(targetRoot, 'outside.txt'), 'utf8'), 'applied');
  assert.equal(await readFile(path.join(targetRoot, 'skills/saddle-demo/user-note.md'), 'utf8'), 'keep me');
});
