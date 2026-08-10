import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KINDS = new Set(['operating-policy', 'session-continuity', 'project-standard', 'capability', 'personal-context', 'integration-declaration']);
const SENSITIVITIES = new Set(['standard', 'personal', 'restricted']);
const ID = /^[a-z][a-z0-9-]*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ASSET_KINDS = new Set(['reference', 'script', 'asset']);
const REQUIRED_EVENTS = new Set(['session.start', 'session.checkpoint', 'context.before-reset', 'context.after-reset', 'session.end']);
const OPTIONAL_EVENTS = new Set(['tool.before', 'tool.after', 'tool.error', 'subagent.start', 'subagent.end']);
const ROUTE_CAPABILITIES = new Set(['low', 'medium', 'high', 'frontier']);
const ROUTE_REASONING = new Set(['low', 'medium', 'high']);
const ANCHOR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_NAME = /(?:^|[-_.])(transcript|conversation|prompt(?:-history)?|tool[-_.]?(?:input|output|payload|error)|telemetry|credential|credentials|token|secret|private[-_.]?key|cookie|runtime[-_.]?settings?|settings|permission|allowlist|trust[-_.]?grant|mcp|plugin[-_.]?state|notification|cron)(?:$|[-_.])/i;
const SECRET_CONTENT = /(?:\b(?:api[_-]?key|access[_-]?token|auth(?:orization)?|password|secret|private[_-]?key|cookie)\b\s*[:=]|https?:\/\/[^\s/]+[^\s]*[?&](?:token|api[_-]?key|key|secret|signature|sig|password|credential)=)/i;
const ABSOLUTE_HOME_CONTENT = /(?:^|[\s"'`(])(?:\/Users\/[^/\s]+|\/home\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/;

export class ProfileError extends Error {
  constructor(message, code = 'PROFILE_INVALID') {
    super(message);
    this.name = 'ProfileError';
    this.code = code;
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactObject(value, fields, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new ProfileError(`${label} must be an object`);
  for (const key of Object.keys(value)) if (!fields.has(key)) throw new ProfileError(`${label} contains unknown field: ${key}`);
}

function iso(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new ProfileError(`${label} must be an ISO-8601 timestamp`);
}

export function validateManifest(manifest) {
  exactObject(manifest, new Set(['schemaVersion', 'profile', 'modules', 'lifecycle', 'routing', 'portability']), 'manifest');
  for (const key of ['schemaVersion', 'profile', 'modules', 'lifecycle', 'routing', 'portability']) if (!(key in manifest)) throw new ProfileError(`manifest is missing required field: ${key}`);
  if (manifest.schemaVersion !== '1.0') throw new ProfileError('unsupported schemaVersion');
  exactObject(manifest.profile, new Set(['id', 'name', 'version', 'createdAt', 'updatedAt']), 'profile');
  const profile = manifest.profile;
  if (!ID.test(profile.id)) throw new ProfileError('profile.id must be a lowercase stable id');
  if (typeof profile.name !== 'string' || !profile.name.trim()) throw new ProfileError('profile.name must be a non-empty string');
  if (!VERSION.test(profile.version)) throw new ProfileError('profile.version must be semantic version');
  iso(profile.createdAt, 'profile.createdAt'); iso(profile.updatedAt, 'profile.updatedAt');
  if (!Array.isArray(manifest.modules)) throw new ProfileError('modules must be an array');
  const seen = new Set();
  const sourcePaths = new Set();
  const assetPaths = new Set();
  for (const module of manifest.modules) {
    exactObject(module, new Set(['id', 'kind', 'source', 'enabled', 'sensitivity', 'consent', 'digest', 'assets']), 'module');
    for (const key of ['id', 'kind', 'source', 'enabled', 'sensitivity', 'consent', 'digest']) if (!(key in module)) throw new ProfileError(`module is missing required field: ${key}`);
    if (!ID.test(module.id) || seen.has(module.id)) throw new ProfileError(`module.id must be unique lowercase id: ${module.id}`);
    seen.add(module.id);
    if (!KINDS.has(module.kind)) throw new ProfileError(`invalid module kind: ${module.kind}`);
    if (typeof module.enabled !== 'boolean') throw new ProfileError('module.enabled must be boolean');
    if (!SENSITIVITIES.has(module.sensitivity)) throw new ProfileError(`invalid module sensitivity: ${module.sensitivity}`);
    if ((module.sensitivity === 'standard') !== (module.consent === 'implicit')) throw new ProfileError('standard modules require implicit consent; personal/restricted modules require explicit consent');
    if (!DIGEST.test(module.digest)) throw new ProfileError('module.digest must be a lowercase SHA-256 digest');
    const source = assertSafeRelativePath(module.source);
    if (sourcePaths.has(source) || assetPaths.has(source)) throw new ProfileError(`duplicate module source: ${source}`);
    sourcePaths.add(source);
    if (module.assets !== undefined && !Array.isArray(module.assets)) throw new ProfileError('module.assets must be an array');
    if (module.assets?.length && module.kind !== 'capability') throw new ProfileError('only capability modules may declare assets');
    const capabilityDirectory = path.posix.dirname(source);
    const moduleAssets = new Set();
    for (const asset of module.assets ?? []) {
      exactObject(asset, new Set(['path', 'digest', 'kind']), 'asset');
      for (const key of ['path', 'digest', 'kind']) if (!(key in asset)) throw new ProfileError(`asset is missing required field: ${key}`);
      const assetPath = assertSafeRelativePath(asset.path);
      if (assetPath === source || !assetPath.startsWith(`${capabilityDirectory}/`)) throw new ProfileError(`asset must remain beneath capability directory: ${asset.path}`);
      if (moduleAssets.has(assetPath) || assetPaths.has(assetPath)) throw new ProfileError(`duplicate asset path: ${assetPath}`);
      if (sourcePaths.has(assetPath)) throw new ProfileError(`asset path duplicates a module source: ${assetPath}`);
      moduleAssets.add(assetPath); assetPaths.add(assetPath);
      if (!DIGEST.test(asset.digest)) throw new ProfileError('asset.digest must be a lowercase SHA-256 digest');
      if (!ASSET_KINDS.has(asset.kind)) throw new ProfileError(`invalid asset kind: ${asset.kind}`);
      if (asset.kind === 'script' && (module.sensitivity !== 'restricted' || module.consent !== 'explicit')) throw new ProfileError('script assets require restricted sensitivity and explicit consent');
    }
  }
  validateLifecycle(manifest.lifecycle, manifest.modules);
  validateRouting(manifest.routing);
  validatePortability(manifest.portability);
  return structuredClone(manifest);
}

function validateLifecycle(lifecycle, modules) {
  exactObject(lifecycle, new Set([...REQUIRED_EVENTS, ...OPTIONAL_EVENTS]), 'lifecycle');
  for (const event of REQUIRED_EVENTS) if (!(event in lifecycle)) throw new ProfileError(`lifecycle is missing required event: ${event}`);
  const byId = new Map(modules.map((module) => [module.id, module]));
  for (const [event, reference] of Object.entries(lifecycle)) {
    exactObject(reference, new Set(['module', 'procedure']), `lifecycle.${event}`);
    if (!ID.test(reference.module) || !ANCHOR.test(reference.procedure)) throw new ProfileError(`lifecycle.${event} must contain a module id and lowercase heading anchor`);
    const module = byId.get(reference.module);
    if (!module || !module.enabled || module.kind !== 'session-continuity') throw new ProfileError(`lifecycle.${event} must reference an enabled session-continuity module`);
  }
}

function validateRouting(routing) {
  exactObject(routing, new Set(['strategy', 'routes']), 'routing');
  if (routing.strategy !== 'minimum-cost-that-clears-gate' || !Array.isArray(routing.routes)) throw new ProfileError('routing must define the documented strategy and routes array');
  const ids = new Set();
  for (const route of routing.routes) {
    exactObject(route, new Set(['id', 'taskKinds', 'capabilityLevel', 'reasoningLevel', 'escalationCondition']), 'route');
    if (!ID.test(route.id) || ids.has(route.id)) throw new ProfileError(`route.id must be unique lowercase id: ${route.id}`); ids.add(route.id);
    if (!Array.isArray(route.taskKinds) || !route.taskKinds.length || route.taskKinds.some((task) => !ID.test(task))) throw new ProfileError('route.taskKinds must contain model-neutral task ids');
    if (!ROUTE_CAPABILITIES.has(route.capabilityLevel) || !ROUTE_REASONING.has(route.reasoningLevel) || typeof route.escalationCondition !== 'string' || !route.escalationCondition.trim()) throw new ProfileError('route has invalid capability, reasoning, or escalation condition');
  }
}

function validatePortability(portability) {
  exactObject(portability, new Set(['personalContext', 'integrations', 'scripts', 'absolutePaths']), 'portability');
  if (!['exclude', 'prompt'].includes(portability.personalContext) || !['exclude', 'declarations-only'].includes(portability.integrations) || !['exclude', 'copy-inert'].includes(portability.scripts) || portability.absolutePaths !== 'alias-only') throw new ProfileError('portability contains an unsupported choice');
}

export function assertSafeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.includes('${')) throw new ProfileError('path must be a resolved relative path', 'PATH_INVALID');
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.split('/').some((part) => FORBIDDEN_NAME.test(part))) throw new ProfileError(`unsafe or denied path: ${value}`, 'PATH_INVALID');
  return normalized;
}

async function safeFile(root, relative) {
  const normalized = assertSafeRelativePath(relative);
  const rootReal = await realpath(root);
  let current = rootReal;
  for (const part of normalized.split('/')) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new ProfileError(`symlink traversal is not allowed: ${relative}`, 'PATH_SYMLINK');
  }
  const info = await stat(current);
  if (!info.isFile()) throw new ProfileError(`module source must be a regular file: ${relative}`, 'PATH_INVALID');
  const resolved = await realpath(current);
  if (resolved !== rootReal && !resolved.startsWith(`${rootReal}${path.sep}`)) throw new ProfileError(`path escapes profile root: ${relative}`, 'PATH_ESCAPE');
  return { relative: normalized, absolute: resolved };
}

export function normalizePortablePath(value, approvedRoots) {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.includes('${')) throw new ProfileError('path contains unresolved variable', 'PATH_INVALID');
  const roots = Object.entries(approvedRoots ?? {}).filter(([alias, root]) => ['home', 'workspace', 'profile'].includes(alias) && typeof root === 'string' && path.isAbsolute(root));
  if (!path.isAbsolute(value)) return assertSafeRelativePath(value);
  const candidate = path.resolve(value);
  const matches = roots.filter(([, root]) => candidate === path.resolve(root) || candidate.startsWith(`${path.resolve(root)}${path.sep}`));
  if (matches.length !== 1) throw new ProfileError(matches.length ? 'path is ambiguous across approved roots' : 'absolute path has no approved alias', 'PATH_ALIAS');
  const [alias, root] = matches[0];
  const relative = path.relative(path.resolve(root), candidate).split(path.sep).join('/');
  return relative ? `\${${alias}}/${assertSafeRelativePath(relative)}` : `\${${alias}}`;
}

export async function loadProfile(profileRoot) {
  const manifestPath = path.join(profileRoot, 'saddle.profile.json');
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { throw new ProfileError(`cannot read saddle.profile.json: ${error.message}`, 'MANIFEST_READ'); }
  validateManifest(manifest);
  const root = await realpath(profileRoot);
  const modules = [];
  for (const descriptor of manifest.modules) {
    const source = await safeFile(root, descriptor.source);
    const content = await readFile(source.absolute);
    const text = content.toString('utf8');
    if (SECRET_CONTENT.test(text) || ABSOLUTE_HOME_CONTENT.test(text)) throw new ProfileError(`module contains secret-bearing content or machine-specific path: ${descriptor.source}`, 'CONTENT_DENIED');
    if (sha256(content) !== descriptor.digest) throw new ProfileError(`module digest mismatch: ${descriptor.id}`, 'DIGEST_MISMATCH');
    const assets = [];
    for (const declaredAsset of descriptor.assets ?? []) {
      const asset = await safeFile(root, declaredAsset.path);
      const assetContent = await readFile(asset.absolute);
      const assetText = assetContent.toString('utf8');
      if (SECRET_CONTENT.test(assetText) || ABSOLUTE_HOME_CONTENT.test(assetText)) throw new ProfileError(`asset contains secret-bearing content or machine-specific path: ${declaredAsset.path}`, 'CONTENT_DENIED');
      if (sha256(assetContent) !== declaredAsset.digest) throw new ProfileError(`asset digest mismatch: ${descriptor.id}/${declaredAsset.path}`, 'DIGEST_MISMATCH');
      assets.push({ path: asset.relative, digest: declaredAsset.digest, kind: declaredAsset.kind, absolutePath: asset.absolute });
    }
    modules.push({ ...descriptor, source: source.relative, absoluteSource: source.absolute, assets });
  }
  return { root, manifest, modules };
}

export async function inventoryProfile(profileRoot) {
  const profile = await loadProfile(profileRoot);
  return profile.modules.map(({ absoluteSource, assets, ...module }) => ({ ...module, assets: assets.map(({ absolutePath, ...asset }) => asset), requiresExplicitConsent: module.sensitivity !== 'standard' }));
}

export async function exportProfile(profileRoot, outputRoot, { consent = {} } = {}) {
  const profile = await loadProfile(profileRoot);
  const selected = profile.modules.filter((module) => module.enabled).filter((module) => {
    if (module.sensitivity === 'standard') return true;
    if (consent[module.id] === true) return true;
    throw new ProfileError(`explicit consent is required for module: ${module.id}`, 'CONSENT_REQUIRED');
  });
  const output = path.resolve(outputRoot);
  if (output === profile.root || output.startsWith(`${profile.root}${path.sep}`)) throw new ProfileError('export output must not be inside the profile root', 'EXPORT_INVALID');
  try {
    if ((await readdir(output)).length) throw new ProfileError('export output must be empty', 'EXPORT_INVALID');
  } catch (error) {
    if (error.code === 'ENOENT') await mkdir(output, { recursive: true });
    else throw error;
  }
  const manifest = structuredClone(profile.manifest);
  manifest.modules = selected.map(({ absoluteSource, assets, ...module }) => ({ ...module, assets: assets.map(({ absolutePath, ...asset }) => asset) }));
  await writeFile(path.join(output, 'saddle.profile.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  for (const module of selected) {
    const destination = path.join(output, module.source);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(module.absoluteSource, destination, { dereference: false, errorOnExist: true });
    for (const asset of module.assets) {
      const assetDestination = path.join(output, asset.path);
      await mkdir(path.dirname(assetDestination), { recursive: true });
      await cp(asset.absolutePath, assetDestination, { dereference: false, errorOnExist: true });
    }
  }
  return { output, modules: selected.map((module) => module.id) };
}
