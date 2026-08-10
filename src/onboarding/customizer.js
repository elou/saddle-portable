import { lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadProfile, sha256, validateManifest } from '../profile/index.js';
import { classifyContent } from '../security/content-policy.js';
import { cleanupReservation, createReservationJournal, publishReservedOutput, recoverReservedOutput, reserveOutput, stagingPath } from './customizer-publish.js';

const ENTRY_KINDS = new Set(['personal-context', 'operating-policy', 'project-standard', 'capability']);
const RESERVED_IDS = new Set(['session-continuity', 'operating-policy', 'project-standard']);
const ID = /^[a-z][a-z0-9-]*$/;
const MAX_CONTENT_BYTES = 64 * 1024;
const MAX_LABEL_LENGTH = 160;

export async function previewCustomization({ profileRoot, outRoot, draft } = {}) {
  const input = await loadProfile(requiredAbsolute(profileRoot, 'profileRoot'));
  const output = requiredAbsolute(outRoot, 'outRoot');
  if (output === input.root || output.startsWith(`${input.root}${path.sep}`)) throw new TypeError('outRoot must not be inside the source profile.');
  await assertOutputOutsideSource(output, input.root);
  const normalized = normalizeDraft(draft, input.manifest);
  const files = await materialize(input, normalized);
  const manifest = buildManifest(input.manifest, normalized, files.modules);
  validateManifest(manifest);
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const plan = {
    sourceProfile: pickProfile(input.manifest.profile),
    derivedProfile: pickProfile(manifest.profile),
    outputRoot: output,
    retainedModules: input.manifest.modules.filter((module) => normalized.retainModuleIds.includes(module.id)).map(moduleSummary),
    removedModules: input.manifest.modules.filter((module) => normalized.removedModuleIds.includes(module.id)).map(moduleSummary),
    addedModules: normalized.entries.map((entry) => ({ id: entry.id, label: entry.label, kind: entry.kind, sensitivity: entry.kind === 'personal-context' ? 'personal' : 'standard', source: sourceFor(entry) })),
    requiredConsents: files.modules.filter((module) => module.sensitivity !== 'standard').map(moduleSummary),
    operations: [...files.files, { target: 'saddle.profile.json', content: manifestContent, digest: sha256(manifestContent), action: 'create-file', risk: 'low', reason: 'Writes the validated derived profile manifest.' }]
      .sort((left, right) => left.target.localeCompare(right.target))
      .map(operationForReview),
  };
  return { digest: sha256(JSON.stringify(plan)), plan, manifest, files: { ...files, sourceRoot: input.root } };
}

export async function applyCustomization({ profileRoot, outRoot, draft, expectedPreviewDigest } = {}) {
  const preview = await previewCustomization({ profileRoot, outRoot, draft });
  if (typeof expectedPreviewDigest !== 'string' || expectedPreviewDigest !== preview.digest) throw new Error('Customization preview changed or was not accepted. Create a new preview before applying.');
  const parent = path.dirname(preview.plan.outputRoot);
  await mkdir(parent, { recursive: true });
  await assertOutputOutsideSource(preview.plan.outputRoot, preview.files.sourceRoot);
  const staging = stagingPath(parent, preview.plan.outputRoot);
  await assertOutputOutsideSource(staging, preview.files.sourceRoot);
  await assertAbsent(staging);
  await mkdir(staging, { mode: 0o700 });
  let reservation;
  try {
    for (const file of preview.files.files) await writeText(staging, file.target, file.content);
    await writeText(staging, 'saddle.profile.json', `${JSON.stringify(preview.manifest, null, 2)}\n`);
    await loadProfile(staging);
    reservation = await reserveOutput(preview.plan.outputRoot, await createReservationJournal(staging, preview.plan.outputRoot));
    await publishReservedOutput(staging, reservation);
    await rm(staging, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (reservation && !(await cleanupReservation(reservation))) error.message = `${error.message} Cleanup left an incomplete reservation because destination content changed.`;
    throw error;
  }
  return { outputRoot: preview.plan.outputRoot, profile: preview.manifest.profile, modules: preview.manifest.modules.map(moduleSummary), previewDigest: preview.digest };
}

export async function recoverCustomization({ outRoot } = {}) {
  return recoverReservedOutput(requiredAbsolute(outRoot, 'outRoot'));
}

function normalizeDraft(draft, manifest) {
  if (!draft || Array.isArray(draft) || typeof draft !== 'object') throw new TypeError('draft must be an object.');
  for (const key of Object.keys(draft)) if (!['profile', 'retainModuleIds', 'entries', 'updatedAt'].includes(key)) throw new TypeError(`draft contains unknown field: ${key}`);
  const retainModuleIds = normalizeIds(draft.retainModuleIds, 'retainModuleIds');
  const existing = new Map(manifest.modules.map((module) => [module.id, module]));
  for (const id of retainModuleIds) {
    if (!existing.has(id)) throw new TypeError(`draft retains unknown module: ${id}`);
  }
  const lifecycleIds = new Set(Object.values(manifest.lifecycle).map((reference) => reference.module));
  for (const id of lifecycleIds) if (!retainModuleIds.includes(id)) throw new TypeError(`draft cannot remove lifecycle-referenced module: ${id}`);
  if (!Array.isArray(draft.entries ?? [])) throw new TypeError('draft.entries must be an array.');
  const entries = (draft.entries ?? []).map((entry) => normalizeEntry(entry));
  const ids = new Set();
  for (const entry of entries) {
    if (RESERVED_IDS.has(entry.id) || existing.has(entry.id) || ids.has(entry.id)) throw new TypeError(`draft entry id is duplicate or reserved: ${entry.id}`);
    ids.add(entry.id);
  }
  const updatedAt = draft.updatedAt === undefined ? nextTimestamp(manifest.profile.updatedAt) : validTimestamp(draft.updatedAt, 'draft.updatedAt');
  const profile = normalizeProfileDraft(draft.profile, manifest.profile);
  return { retainModuleIds, removedModuleIds: [...existing.keys()].filter((id) => !retainModuleIds.includes(id)).sort(), entries: entries.sort((left, right) => left.id.localeCompare(right.id)), addedIds: ids, updatedAt, profile };
}

function normalizeIds(value, label) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !ID.test(id))) throw new TypeError(`${label} must contain lowercase module ids.`);
  const unique = [...new Set(value)].sort();
  if (unique.length !== value.length) throw new TypeError(`${label} contains duplicate ids.`);
  return unique;
}

function normalizeProfileDraft(value, source) {
  if (value === undefined) return { id: source.id, name: source.name };
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new TypeError('draft.profile must be an object.');
  for (const key of Object.keys(value)) if (!['id', 'name'].includes(key)) throw new TypeError(`draft.profile contains unknown field: ${key}`);
  const id = value.id === undefined ? source.id : value.id;
  const name = value.name === undefined ? source.name : value.name;
  if (typeof id !== 'string' || !ID.test(id) || typeof name !== 'string' || !name.trim()) throw new TypeError('draft.profile has an invalid id or name.');
  const normalizedName = name.trim();
  assertSafeAuthoringText(normalizedName, 'draft.profile name', 'profile');
  return { id, name: normalizedName };
}

function normalizeEntry(entry) {
  if (!entry || Array.isArray(entry) || typeof entry !== 'object') throw new TypeError('draft entry must be an object.');
  for (const key of Object.keys(entry)) if (!['id', 'kind', 'label', 'content'].includes(key)) throw new TypeError(`draft entry contains unknown field: ${key}`);
  if (!ID.test(entry.id) || !ENTRY_KINDS.has(entry.kind)) throw new TypeError('draft entry has an invalid id or kind.');
  if (typeof entry.label !== 'string' || !entry.label.trim() || entry.label.length > MAX_LABEL_LENGTH || /[\0\r\n]/.test(entry.label)) throw new TypeError('draft entry label must be a short single-line string.');
  if (typeof entry.content !== 'string' || !entry.content.trim() || Buffer.byteLength(entry.content) > MAX_CONTENT_BYTES) throw new TypeError('draft entry content must be non-empty and within the size limit.');
  const label = entry.label.trim();
  const content = entry.content.trim();
  const tier = entry.kind === 'personal-context' ? 'personal' : 'portable';
  assertSafeAuthoringText(label, 'draft entry label', tier);
  assertSafeAuthoringText(content, 'draft entry content', tier);
  return { id: entry.id, kind: entry.kind, label, content };
}

function assertSafeAuthoringText(value, label, tier) {
  const classification = classifyContent(value, { tier });
  if (classification === 'secret-bearing') throw new TypeError(`${label} contains secret-bearing content.`);
  if (classification === 'machine-specific-path') throw new TypeError(`${label} contains a machine-specific path.`);
  if (classification === 'runtime-bound') throw new TypeError(`${label} contains runtime-bound or destination integration guidance.`);
}

async function materialize(input, draft) {
  const files = [];
  const modules = [];
  const retained = new Set(draft.retainModuleIds);
  for (const module of [...input.modules].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!retained.has(module.id)) continue;
    const { absoluteSource, assets, ...descriptor } = module;
    const content = await readValidatedBytes(absoluteSource, descriptor.digest, `module ${descriptor.id}`);
    files.push({ target: descriptor.source, content, digest: sha256(content), action: 'create-file', moduleId: descriptor.id, risk: riskFor(descriptor.sensitivity), reason: 'Retains an existing validated profile module.' });
    const copiedAssets = [];
    for (const asset of [...assets].sort((left, right) => left.path.localeCompare(right.path))) {
      const content = await readValidatedBytes(asset.absolutePath, asset.digest, `asset ${asset.path}`);
      files.push({ target: asset.path, content, digest: sha256(content), action: 'create-file', moduleId: descriptor.id, risk: riskFor(descriptor.sensitivity), reason: 'Retains an existing validated capability asset.' });
      copiedAssets.push({ path: asset.path, digest: asset.digest, kind: asset.kind });
    }
    modules.push({ ...descriptor, ...(copiedAssets.length ? { assets: copiedAssets } : {}) });
  }
  for (const entry of draft.entries) {
    const source = sourceFor(entry);
    const content = renderEntry(entry);
    const sensitivity = entry.kind === 'personal-context' ? 'personal' : 'standard';
    files.push({ target: source, content, digest: sha256(content), action: 'create-file', moduleId: entry.id, risk: riskFor(sensitivity), reason: 'Adds a user-authored customization entry.' });
    modules.push({ id: entry.id, kind: entry.kind, source, enabled: true, sensitivity, consent: sensitivity === 'personal' ? 'explicit' : 'implicit', digest: sha256(content) });
  }
  modules.sort((left, right) => left.id.localeCompare(right.id));
  return { files, modules };
}

function sourceFor(entry) {
  if (entry.kind === 'personal-context') return `instructions/personal/${entry.id}.md`;
  if (entry.kind === 'operating-policy') return `instructions/operating/${entry.id}.md`;
  if (entry.kind === 'project-standard') return `instructions/project/${entry.id}.md`;
  return `capabilities/${entry.id}/CAPABILITY.md`;
}

function renderEntry(entry) {
  if (entry.kind === 'capability') return `---\nname: ${entry.id}\ndescription: ${JSON.stringify(entry.label)}\n---\n\n${entry.content}\n`;
  return `# ${entry.label}\n\n${entry.content}\n`;
}

function buildManifest(source, draft, modules) {
  const profile = { ...source.profile, ...draft.profile, version: bumpPatch(source.profile.version), updatedAt: draft.updatedAt };
  return { schemaVersion: '1.0', profile, modules, lifecycle: structuredClone(source.lifecycle), routing: structuredClone(source.routing), portability: structuredClone(source.portability) };
}

function pickProfile(profile) {
  return { id: profile.id, name: profile.name, version: profile.version };
}

function moduleSummary(module) {
  return { id: module.id, kind: module.kind, sensitivity: module.sensitivity };
}

function operationForReview(operation) {
  const { content, ...metadata } = operation;
  if (typeof content === 'string') return { ...metadata, content, contentEncoding: 'utf8' };
  try { return { ...metadata, content: new TextDecoder('utf-8', { fatal: true }).decode(content), contentEncoding: 'utf8' }; }
  catch { return { ...metadata, content: Buffer.from(content).toString('base64'), contentEncoding: 'base64' }; }
}

function riskFor(sensitivity) {
  return sensitivity === 'personal' || sensitivity === 'restricted' ? sensitivity : 'low';
}

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) throw new TypeError('source profile version is not semantic version.');
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function nextTimestamp(value) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new TypeError('source profile timestamp is invalid.');
  return new Date(timestamp + 1).toISOString();
}

function validTimestamp(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new TypeError(`${label} must be an ISO-8601 timestamp.`);
  return value;
}

function requiredAbsolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new TypeError(`${label} must be an absolute path.`);
  return path.resolve(value);
}

async function assertAbsent(target) {
  try { await lstat(target); throw new Error('Customization output directory must be absent.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function assertOutputOutsideSource(output, sourceRoot) {
  const resolvedOutput = await resolveThroughExistingParent(output);
  const relative = path.relative(sourceRoot, resolvedOutput);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new TypeError('outRoot must not resolve to the source profile or a path within it.');
  }
}

async function resolveThroughExistingParent(target) {
  let current = target;
  const missing = [];
  while (true) {
    try {
      const parent = await realpath(current);
      return path.resolve(parent, ...missing);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

async function writeText(root, relative, content) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, { flag: 'wx', mode: 0o600 });
}


async function readValidatedBytes(filename, expectedDigest, label) {
  const info = await lstat(filename);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} changed after customization preview.`);
  const bytes = await readFile(filename);
  if (sha256(bytes) !== expectedDigest) throw new Error(`${label} digest mismatch; source changed after customization preview.`);
  return bytes;
}
