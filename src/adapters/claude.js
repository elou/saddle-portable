import path from 'node:path';
import {
  ABSENT, assertTargetRoot, capabilityAssets, existingFile, exists, extractManagedBlock, fileDigest, hasManagedProvenance,
  managedBlock, managedHeader, mergeManagedBlock, moduleContent, operation, profileProvenance, SaddleProjectionConflictError,
  sha256, targetPath,
} from './shared.js';

const LIFECYCLE = Object.freeze({
  'session.start': 'fallback', 'session.checkpoint': 'fallback', 'context.before-reset': 'fallback',
  'context.after-reset': 'fallback', 'session.end': 'fallback', 'tool.before': 'unsupported',
  'tool.after': 'fallback', 'tool.error': 'fallback', 'subagent.start': 'fallback', 'subagent.end': 'fallback',
});

function enabled(profile, kind) {
  return (profile?.modules ?? []).filter((module) => module.enabled !== false && module.kind === kind)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function capabilityEntrypoint(capability) {
  if (typeof capability.source !== 'string' || !capability.source.endsWith('/CAPABILITY.md')) {
    throw new TypeError(`Capability ${capability.id ?? '(unnamed)'} must use CAPABILITY.md as its neutral entrypoint.`);
  }
}

async function instructionContent(profile) {
  const modules = (profile?.modules ?? []).filter((module) => module.enabled !== false &&
    ['operating-policy', 'session-continuity', 'project-standard', 'personal-context'].includes(module.kind))
    .sort((a, b) => a.id.localeCompare(b.id));
  const chunks = await Promise.all(modules.map(async (module) => `## ${module.id}\n\n${(await moduleContent(profile, module)).trim()}\n`));
  return { modules, body: chunks.join('\n') };
}

async function makeFileOperation(root, id, target, content, sourceModule, reason, managedDigest, risk = 'low') {
  const prior = await fileDigest(targetPath(root, target));
  if (prior === null) throw new SaddleProjectionConflictError(`Cannot replace non-file managed target ${target}.`);
  return operation({ id, action: prior === ABSENT ? 'create-file' : 'replace-file', target,
    expectedPriorDigest: prior, resultingDigest: sha256(content), content, managedDigest, sourceModule, adapter: 'claude', reason, risk });
}

function managedAssets(content, capability) {
  if (content === ABSENT) return new Set();
  try {
    const manifest = JSON.parse(content);
    if (manifest.saddleManagedProjection !== 1 || manifest.adapter !== id || manifest.capability !== capability.id || !Array.isArray(manifest.assets)) throw new Error('invalid');
    return new Set(manifest.assets.map((asset) => asset.path));
  } catch {
    throw new SaddleProjectionConflictError(`Refusing to replace an unmanaged asset manifest for capability ${capability.id}.`);
  }
}

export const id = 'claude';
export const displayName = 'Claude';

export async function detect(context) {
  const root = assertTargetRoot(context);
  return Object.freeze({ id, detected: await exists(root), targetRoot: root, evidence: [{ path: root, exists: await exists(root) }], version: 'unverifiable' });
}

export function capabilities() {
  return Object.freeze({ lifecycle: LIFECYCLE, limits: ['Lifecycle procedures are durable instruction fallbacks, not automatic hooks.', 'Runtime configuration and permission settings are not modified.'] });
}

export async function plan(profile, context) {
  const root = assertTargetRoot(context);
  const provenance = profileProvenance(profile);
  const operations = [];
  const instructions = await instructionContent(profile);
  const block = managedBlock(id, provenance, `# Saddle operating profile\n\n${instructions.body}`);
  const global = mergeManagedBlock(await existingFile(targetPath(root, 'CLAUDE.md')), id, block);
  operations.push(await makeFileOperation(root, 'claude:global-instructions', 'CLAUDE.md', global,
    'profile', 'Projects the enabled operating instructions for Claude without replacing unmanaged instructions.', sha256(block)));
  for (const capability of enabled(profile, 'capability')) {
    capabilityEntrypoint(capability);
    const dir = `skills/saddle-${capability.id}`;
    if (!await exists(targetPath(root, dir))) operations.push(operation({ id: `claude:capability-directory:${capability.id}`, action: 'create-directory', target: dir, expectedPriorDigest: ABSENT, resultingDigest: sha256(`directory:${dir}`), sourceModule: capability.id, adapter: id, reason: `Creates the managed directory for capability ${capability.id}.`, risk: 'low' }));
    const target = `${dir}/SKILL.md`;
    const priorContent = await existingFile(targetPath(root, target));
    if (priorContent !== ABSENT && (priorContent === null || !hasManagedProvenance(priorContent, id))) {
      throw new SaddleProjectionConflictError(`Refusing to replace unmanaged capability target ${target}.`);
    }
    const content = `${managedHeader(id, provenance)}${(await moduleContent(profile, capability)).trim()}\n`;
    operations.push(await makeFileOperation(root, `claude:capability:${capability.id}`, target, content, capability.id,
      `Projects neutral capability ${capability.id} as Claude's SKILL.md entrypoint.`));
    const manifestTarget = `${dir}/.saddle-assets.json`;
    const previouslyManaged = managedAssets(await existingFile(targetPath(root, manifestTarget)), capability);
    const assets = await capabilityAssets(profile, capability);
    for (const asset of assets) {
      const assetTarget = `${dir}/${asset.relative}`;
      const assetExisting = await existingFile(targetPath(root, assetTarget));
      if (assetExisting !== ABSENT && (assetExisting === null || !previouslyManaged.has(asset.relative))) throw new SaddleProjectionConflictError(`Refusing to replace unmanaged capability asset ${assetTarget}.`);
      const isScript = asset.kind === 'script';
      operations.push(await makeFileOperation(root, `claude:capability-asset:${capability.id}:${asset.relative}`, assetTarget, asset.content, capability.id,
        isScript ? `Copies script asset ${asset.relative} as inert content; it is not executed.` : `Copies inert capability asset ${asset.relative}.`, undefined, isScript ? 'restricted' : 'low'));
    }
    if (assets.length) {
      const manifest = `${JSON.stringify({ saddleManagedProjection: 1, adapter: id, capability: capability.id, assets: assets.map((asset) => ({ path: asset.relative, digest: sha256(asset.content), kind: asset.kind })) }, null, 2)}\n`;
      operations.push(await makeFileOperation(root, `claude:capability-assets-manifest:${capability.id}`, manifestTarget, manifest, capability.id,
        `Records Saddle provenance for inert capability assets in ${capability.id}.`));
    }
  }
  return Object.freeze({ adapter: id, targetRoot: root, provenance, capabilities: capabilities().lifecycle, operations: Object.freeze(operations) });
}

export async function verify(profile, context) {
  let projection;
  try {
    projection = await plan(profile, context);
  } catch (error) {
    if (error instanceof SaddleProjectionConflictError) return Object.freeze({ adapter: id, artifacts: [], status: 'unverifiable', reason: error.message });
    throw error;
  }
  const artifacts = await Promise.all(projection.operations.filter((item) => item.action !== 'create-directory').map(async (item) => {
    const actualContent = await existingFile(targetPath(projection.targetRoot, item.target));
    const actualDigest = actualContent === ABSENT || actualContent === null ? actualContent : sha256(actualContent);
    const expectedManaged = item.managedDigest;
    const actualManaged = expectedManaged ? extractManagedBlock(actualContent, id) : actualContent;
    const actualManagedDigest = actualManaged === null || actualManaged === ABSENT ? actualManaged : sha256(actualManaged);
    return Object.freeze({ target: item.target, expectedDigest: item.resultingDigest, actualDigest,
      status: actualDigest === ABSENT ? 'missing' : actualDigest === null ? 'unverifiable' : actualManaged === null ? 'drifted' : expectedManaged ? actualManagedDigest === expectedManaged ? 'exact' : 'drifted' : actualDigest === item.resultingDigest ? 'exact' : 'drifted' });
  }));
  return Object.freeze({ adapter: id, artifacts, status: artifacts.every((artifact) => artifact.status === 'exact') ? 'exact' : artifacts.some((artifact) => artifact.status === 'drifted') ? 'drifted' : artifacts.some((artifact) => artifact.status === 'missing') ? 'missing' : 'unverifiable' });
}

export default { id, displayName, detect, capabilities, plan, verify };
