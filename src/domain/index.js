import path from 'node:path';

import * as claude from '../adapters/claude.js';
import * as codex from '../adapters/codex.js';
import { loadProfile, sha256 } from '../profile/index.js';
import { digestPlan } from '../transaction/index.js';

export const runtimeAdapters = Object.freeze({ claude, codex });

export function parseRuntimeSelection(value = 'claude,codex') {
  const ids = [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))];
  if (ids.length === 0) throw new TypeError('Select at least one runtime.');
  for (const id of ids) {
    if (!runtimeAdapters[id]) throw new TypeError(`Unsupported runtime: ${id}`);
  }
  return ids;
}

export function runtimeRoot(targetRoot, runtimeId) {
  if (!path.isAbsolute(targetRoot)) throw new TypeError('Target root must be absolute.');
  return path.join(path.resolve(targetRoot), `.${runtimeId}`);
}

export async function scanRuntimes({ targetRoot, runtimes = ['claude', 'codex'] }) {
  const selected = normalizeRuntimes(runtimes);
  const results = [];
  for (const runtimeId of selected) {
    results.push(await runtimeAdapters[runtimeId].detect({
      targetRoot: runtimeRoot(targetRoot, runtimeId),
    }));
  }
  return results;
}

export async function createImportPlan({ profileRoot, targetRoot, runtimes = ['claude', 'codex'] }) {
  const selected = normalizeRuntimes(runtimes);
  const loaded = await loadProfile(profileRoot);
  const portableDigest = sha256(JSON.stringify(loaded.manifest));
  const profile = { ...loaded, digest: portableDigest };
  const projections = [];
  const operations = [];

  for (const runtimeId of selected) {
    const adapterRoot = runtimeRoot(targetRoot, runtimeId);
    const projection = await runtimeAdapters[runtimeId].plan(profile, { targetRoot: adapterRoot });
    projections.push({
      adapter: projection.adapter,
      targetRoot: adapterRoot,
      capabilities: projection.capabilities,
      operationIds: projection.operations.map((operation) => operation.id),
    });
    for (const operation of projection.operations) {
      operations.push(Object.freeze({
        ...operation,
        target: path.posix.join(`.${runtimeId}`, operation.target),
      }));
    }
  }

  const plan = Object.freeze({
    schemaVersion: 1,
    profile: {
      id: loaded.manifest.profile.id,
      version: loaded.manifest.profile.version,
      digest: portableDigest,
    },
    targetRoot: path.resolve(targetRoot),
    runtimes: selected,
    projections,
    operations: Object.freeze(operations),
  });
  return { profile, plan, digest: digestPlan(plan) };
}

export async function verifyImport({ profileRoot, targetRoot, runtimes = ['claude', 'codex'] }) {
  const selected = normalizeRuntimes(runtimes);
  const loaded = await loadProfile(profileRoot);
  const profile = { ...loaded, digest: sha256(JSON.stringify(loaded.manifest)) };
  const results = [];
  for (const runtimeId of selected) {
    const adapter = runtimeAdapters[runtimeId];
    results.push({
      runtime: runtimeId,
      capabilities: adapter.capabilities(),
      verification: await adapter.verify(profile, {
        targetRoot: runtimeRoot(targetRoot, runtimeId),
      }),
    });
  }
  return results;
}

function normalizeRuntimes(runtimes) {
  if (typeof runtimes === 'string') return parseRuntimeSelection(runtimes);
  return parseRuntimeSelection(runtimes.join(','));
}

