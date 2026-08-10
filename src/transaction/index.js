import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

const FILE_ACTIONS = new Set(['create-file', 'replace-file', 'remove-managed-file']);
const ACTIONS = new Set(['create-directory', ...FILE_ACTIONS]);

export class TransactionError extends Error {
  constructor(message, { code = 'TRANSACTION_ERROR', cause, transactionId, rollback } = {}) {
    super(message, { cause });
    this.name = 'TransactionError';
    this.code = code;
    this.transactionId = transactionId;
    this.rollback = rollback;
  }
}

export function digestBytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestPlan(plan) {
  return digestBytes(stableStringify(plan));
}

export function validatePlanShape(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new TransactionError('Plan must be an object.', { code: 'INVALID_PLAN' });
  }
  if (!Array.isArray(plan.operations)) {
    throw new TransactionError('Plan operations must be an array.', { code: 'INVALID_PLAN' });
  }

  const ids = new Set();
  const targets = new Set();
  for (const operation of plan.operations) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
      throw new TransactionError('Every operation must be an object.', { code: 'INVALID_PLAN' });
    }
    if (typeof operation.id !== 'string' || operation.id.length === 0 || ids.has(operation.id)) {
      throw new TransactionError('Every operation must have a unique non-empty id.', {
        code: 'INVALID_PLAN',
      });
    }
    ids.add(operation.id);

    if (!ACTIONS.has(operation.action)) {
      throw new TransactionError(`Unsupported action for ${operation.id}.`, { code: 'INVALID_PLAN' });
    }
    assertRelativeTarget(operation.target, operation.id);
    if (targets.has(operation.target)) {
      throw new TransactionError(`A plan may only operate on ${operation.target} once.`, {
        code: 'INVALID_PLAN',
      });
    }
    targets.add(operation.target);

    if (FILE_ACTIONS.has(operation.action)) {
      if (operation.expectedPriorDigest !== 'absent' && !isDigest(operation.expectedPriorDigest)) {
        throw new TransactionError(`Invalid expected prior digest for ${operation.id}.`, {
          code: 'INVALID_PLAN',
        });
      }
      if (operation.action !== 'remove-managed-file') {
        if (typeof operation.content !== 'string') {
          throw new TransactionError(`Missing string content for ${operation.id}.`, {
            code: 'INVALID_PLAN',
          });
        }
        if (!isDigest(operation.resultingDigest) || digestBytes(operation.content) !== operation.resultingDigest) {
          throw new TransactionError(`Resulting digest does not match content for ${operation.id}.`, {
            code: 'INVALID_PLAN',
          });
        }
      }
    }
  }
  return plan;
}

export async function applyPlan(
  plan,
  {
    targetRoot,
    stateRoot,
    expectedPlanDigest,
    transactionId = randomUUID(),
    failAfterOperation,
  } = {},
) {
  validatePlanShape(plan);
  const planDigest = digestPlan(plan);
  if (!expectedPlanDigest || expectedPlanDigest !== planDigest) {
    throw new TransactionError('Apply requires the exact digest of the previewed plan.', {
      code: 'PLAN_DIGEST_MISMATCH',
    });
  }

  const roots = await prepareRoots(targetRoot, stateRoot);
  const transactionDirectory = path.join(roots.stateRoot, 'transactions', transactionId);
  await mkdir(path.join(transactionDirectory, 'backups'), { recursive: true, mode: 0o700 });

  const records = [];
  for (const [index, operation] of plan.operations.entries()) {
    const target = await resolveSafeTarget(roots.targetRoot, operation.target);
    const prior = await inspectTarget(target);
    validateExpectedState(operation, prior);

    let backup;
    if (prior.type === 'file') {
      backup = `backups/${String(index).padStart(4, '0')}.bin`;
      await writeFile(path.join(transactionDirectory, backup), prior.content, { mode: 0o600 });
    }
    records.push({
      operation,
      target,
      prior: serializePrior(prior, backup),
      createdParents: await findMissingParents(roots.targetRoot, target),
      applied: false,
    });
  }

  const journal = {
    schemaVersion: 1,
    id: transactionId,
    status: 'prepared',
    planDigest,
    targetRoot: roots.targetRoot,
    stateRoot: roots.stateRoot,
    createdAt: new Date().toISOString(),
    records,
  };
  await writeJournal(transactionDirectory, journal);

  try {
    journal.status = 'applying';
    await writeJournal(transactionDirectory, journal);

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      await applyOperation(record.operation, record.target, transactionId, record.prior);
      record.applied = true;
      await writeJournal(transactionDirectory, journal);

      if (failAfterOperation === index + 1) {
        throw new Error(`Injected failure after operation ${index + 1}.`);
      }
    }

    journal.status = 'applied';
    journal.completedAt = new Date().toISOString();
    await writeJournal(transactionDirectory, journal);
    return publicTransaction(journal, transactionDirectory);
  } catch (cause) {
    const rollback = await restoreRecords(records, transactionDirectory, transactionId);
    journal.status = rollback.complete ? 'rolled-back-after-failure' : 'rollback-incomplete';
    journal.failure = String(cause?.message ?? cause);
    journal.rollback = rollback;
    await writeJournal(transactionDirectory, journal);
    throw new TransactionError(
      rollback.complete
        ? 'Apply failed and the original filesystem was restored.'
        : 'Apply failed and rollback could not fully restore the original filesystem.',
      {
        code: rollback.complete ? 'APPLY_FAILED_ROLLED_BACK' : 'APPLY_FAILED_ROLLBACK_INCOMPLETE',
        cause,
        transactionId,
        rollback,
      },
    );
  }
}

export async function rollbackTransaction(transactionId, { targetRoot, stateRoot } = {}) {
  const roots = await prepareRoots(targetRoot, stateRoot);
  assertTransactionId(transactionId);
  const transactionDirectory = path.join(roots.stateRoot, 'transactions', transactionId);
  const journal = JSON.parse(await readFile(path.join(transactionDirectory, 'journal.json'), 'utf8'));

  if (journal.targetRoot !== roots.targetRoot || journal.stateRoot !== roots.stateRoot) {
    throw new TransactionError('Transaction roots do not match the requested rollback roots.', {
      code: 'TRANSACTION_ROOT_MISMATCH',
      transactionId,
    });
  }
  if (journal.status !== 'applied') {
    throw new TransactionError(`Transaction ${transactionId} is not in an applied state.`, {
      code: 'TRANSACTION_NOT_APPLIED',
      transactionId,
    });
  }

  const rollback = await restoreRecords(journal.records, transactionDirectory, transactionId);
  journal.status = rollback.complete ? 'rolled-back' : 'rollback-incomplete';
  journal.rollback = rollback;
  journal.rolledBackAt = new Date().toISOString();
  await writeJournal(transactionDirectory, journal);

  if (!rollback.complete) {
    throw new TransactionError('Rollback could not fully restore the original filesystem.', {
      code: 'ROLLBACK_INCOMPLETE',
      transactionId,
      rollback,
    });
  }
  return publicTransaction(journal, transactionDirectory);
}

async function prepareRoots(targetRoot, stateRoot) {
  if (!targetRoot || !stateRoot) {
    throw new TransactionError('Both targetRoot and stateRoot are required.', { code: 'ROOT_REQUIRED' });
  }
  await mkdir(targetRoot, { recursive: true });
  await mkdir(stateRoot, { recursive: true, mode: 0o700 });
  return {
    targetRoot: await realpath(targetRoot),
    stateRoot: await realpath(stateRoot),
  };
}

async function resolveSafeTarget(root, relativeTarget) {
  assertRelativeTarget(relativeTarget);
  const segments = relativeTarget.split('/');
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    cursor = path.join(cursor, segments[index]);
    const info = await lstatOrNull(cursor);
    if (info?.isSymbolicLink()) {
      throw new TransactionError(`Target crosses a symbolic link: ${relativeTarget}`, {
        code: 'UNSAFE_TARGET',
      });
    }
    if (info && !info.isDirectory()) {
      throw new TransactionError(`Target parent is not a directory: ${relativeTarget}`, {
        code: 'UNSAFE_TARGET',
      });
    }
  }
  const resolved = path.resolve(root, ...segments);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new TransactionError(`Target escapes the target root: ${relativeTarget}`, {
      code: 'UNSAFE_TARGET',
    });
  }
  const targetInfo = await lstatOrNull(resolved);
  if (targetInfo?.isSymbolicLink()) {
    throw new TransactionError(`Target is a symbolic link: ${relativeTarget}`, {
      code: 'UNSAFE_TARGET',
    });
  }
  return resolved;
}

async function inspectTarget(target) {
  const info = await lstatOrNull(target);
  if (!info) return { type: 'absent' };
  if (info.isSymbolicLink()) {
    throw new TransactionError(`Refusing to inspect symbolic-link target: ${target}`, {
      code: 'UNSAFE_TARGET',
    });
  }
  if (info.isDirectory()) return { type: 'directory', mode: info.mode & 0o777 };
  if (!info.isFile()) {
    throw new TransactionError(`Unsupported target type: ${target}`, { code: 'UNSAFE_TARGET' });
  }
  const content = await readFile(target);
  return {
    type: 'file',
    content,
    digest: digestBytes(content),
    mode: info.mode & 0o777,
  };
}

function validateExpectedState(operation, prior) {
  if (operation.action === 'create-directory') {
    if (prior.type !== 'absent' && prior.type !== 'directory') {
      throw new TransactionError(`Directory target conflicts for ${operation.id}.`, {
        code: 'TARGET_DRIFT',
      });
    }
    return;
  }

  if (operation.expectedPriorDigest === 'absent' && prior.type !== 'absent') {
    throw new TransactionError(`Expected ${operation.target} to be absent.`, { code: 'TARGET_DRIFT' });
  }
  if (operation.expectedPriorDigest !== 'absent') {
    if (prior.type !== 'file' || prior.digest !== operation.expectedPriorDigest) {
      throw new TransactionError(`Target changed after preview: ${operation.target}`, {
        code: 'TARGET_DRIFT',
      });
    }
  }
}

async function applyOperation(operation, target, transactionId, prior) {
  if (operation.action === 'create-directory') {
    if (prior.type === 'directory') return;
    await mkdir(target, { recursive: false });
    return;
  }
  if (operation.action === 'remove-managed-file') {
    await rm(target);
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await atomicWrite(target, Buffer.from(operation.content), transactionId, operation.mode);
}

async function atomicWrite(target, content, transactionId, mode = 0o600) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.saddle-${transactionId}.tmp`);
  await writeFile(temporary, content, { flag: 'wx', mode });
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function restoreRecords(records, transactionDirectory, transactionId) {
  const errors = [];
  for (const record of [...records].reverse()) {
    if (!record.applied) continue;
    try {
      if (record.prior.type === 'absent') {
        if (record.operation.action === 'create-directory') {
          await rmdir(record.target);
        } else {
          await rm(record.target, { force: true });
        }
      } else if (record.prior.type === 'file') {
        const content = await readFile(path.join(transactionDirectory, record.prior.backup));
        await mkdir(path.dirname(record.target), { recursive: true });
        await atomicWrite(record.target, content, `${transactionId}-rollback`, record.prior.mode);
        await chmod(record.target, record.prior.mode);
      }
      const restored = await inspectTarget(record.target);
      if (!samePrior(restored, record.prior)) {
        throw new Error(`Restored state did not match for ${record.operation.target}.`);
      }
      record.applied = false;
    } catch (error) {
      errors.push({ operationId: record.operation.id, message: String(error?.message ?? error) });
    }
  }
  const createdParents = [...new Set(records.flatMap((record) => record.createdParents ?? []))]
    .sort((left, right) => right.length - left.length);
  for (const directory of createdParents) {
    try {
      await rmdir(directory);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') {
        errors.push({ operationId: 'implicit-directory', message: String(error?.message ?? error) });
      }
    }
  }
  return { complete: errors.length === 0, errors };
}

async function findMissingParents(root, target) {
  const missing = [];
  let cursor = path.dirname(target);
  while (cursor !== root && cursor.startsWith(`${root}${path.sep}`)) {
    if (await lstatOrNull(cursor)) break;
    missing.push(cursor);
    cursor = path.dirname(cursor);
  }
  return missing;
}

function serializePrior(prior, backup) {
  if (prior.type === 'file') {
    return { type: 'file', digest: prior.digest, mode: prior.mode, backup };
  }
  return { type: prior.type, mode: prior.mode };
}

function samePrior(actual, expected) {
  if (actual.type !== expected.type) return false;
  if (expected.type === 'file') return actual.digest === expected.digest;
  return true;
}

async function writeJournal(transactionDirectory, journal) {
  await writeFile(
    path.join(transactionDirectory, 'journal.json'),
    `${JSON.stringify(journal, null, 2)}\n`,
    { mode: 0o600 },
  );
}

function publicTransaction(journal, transactionDirectory) {
  return {
    id: journal.id,
    status: journal.status,
    planDigest: journal.planDigest,
    transactionDirectory,
    rollback: journal.rollback,
  };
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function assertRelativeTarget(value, operationId = 'operation') {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value === '.' ||
    value.split('/').some((segment) => segment === '' || segment === '..' || segment === '.')
  ) {
    throw new TransactionError(`Unsafe relative target for ${operationId}.`, { code: 'INVALID_PLAN' });
  }
}

function assertTransactionId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]+$/.test(value)) {
    throw new TransactionError('Invalid transaction id.', { code: 'INVALID_TRANSACTION_ID' });
  }
}

async function lstatOrNull(target) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}
