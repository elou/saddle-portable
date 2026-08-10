import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ABSENT = 'absent';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function profileProvenance(profile) {
  const metadata = profile?.profile ?? profile?.manifest?.profile ?? {};
  return {
    version: metadata.version ?? profile?.version ?? 'unknown',
    digest: profile?.digest ?? profile?.contentDigest ?? sha256(stableJson(profile)),
  };
}

export function routingInstructions(profile) {
  const routing = profile?.manifest?.routing ?? profile?.routing;
  if (!routing?.routes?.length) return '';
  const routes = [...routing.routes].sort((left, right) => left.id.localeCompare(right.id));
  const lines = [
    '## model-routing',
    '',
    'Use the minimum-cost available model that satisfies the required capability and reasoning level. Escalate only under the stated condition.',
    '',
  ];
  for (const route of routes) {
    lines.push(`- ${route.id}: tasks ${route.taskKinds.join(', ')}; capability ${route.capabilityLevel}; reasoning ${route.reasoningLevel}; escalate when ${route.escalationCondition.trim()}`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderRuntimeCapability(adapter, provenance, capability, sourceContent) {
  const parsed = parseCapabilityDocument(sourceContent);
  const description = parsed.description || `Portable capability ${capability.id}.`;
  return `---\nname: saddle-${capability.id}\ndescription: ${JSON.stringify(description)}\n---\n${managedHeader(adapter, provenance)}${parsed.body.trim()}\n`;
}

function parseCapabilityDocument(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!match) return { description: '', body: content };
  const descriptionLine = /^description:\s*(.+?)\s*$/m.exec(match[1]);
  const rawDescription = descriptionLine?.[1] ?? '';
  let description = rawDescription;
  if ((description.startsWith('"') && description.endsWith('"')) || (description.startsWith("'") && description.endsWith("'"))) {
    description = description.slice(1, -1);
  }
  return { description, body: content.slice(match[0].length) };
}

export function assertTargetRoot(context) {
  const targetRoot = context?.targetRoot;
  if (typeof targetRoot !== 'string' || !path.isAbsolute(targetRoot)) {
    throw new TypeError('Adapter context.targetRoot must be an absolute caller-supplied path.');
  }
  return path.resolve(targetRoot);
}

export function validateRelativeTarget(target) {
  if (typeof target !== 'string' || target.length === 0 || path.isAbsolute(target)) {
    throw new TypeError('Adapter target must be a non-empty relative path.');
  }
  const normalized = path.posix.normalize(target.replaceAll(path.sep, '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new TypeError(`Adapter target escapes its root: ${target}`);
  }
  return normalized;
}

export function targetPath(targetRoot, target) {
  const relative = validateRelativeTarget(target);
  const resolved = path.resolve(targetRoot, relative);
  if (resolved !== targetRoot && !resolved.startsWith(`${targetRoot}${path.sep}`)) {
    throw new TypeError(`Adapter target escapes its root: ${target}`);
  }
  return resolved;
}

export async function fileDigest(filename) {
  try {
    const entry = await stat(filename);
    if (!entry.isFile()) return null;
    return sha256(await readFile(filename));
  } catch (error) {
    if (error?.code === 'ENOENT') return ABSENT;
    throw error;
  }
}

export async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function moduleContent(profile, module) {
  if (typeof module.content === 'string') return module.content;
  const source = module.source;
  if (typeof source !== 'string') throw new TypeError(`Module ${module.id ?? '(unnamed)'} has no readable source.`);
  const normalizedSource = validateRelativeTarget(source);
  const maps = [profile?.contents, profile?.files, profile?.contentBySource];
  for (const map of maps) {
    if (map && typeof map[normalizedSource] === 'string') return map[normalizedSource];
  }
  const root = profile?.root ?? profile?.sourceRoot;
  if (typeof root !== 'string' || !path.isAbsolute(root)) {
    throw new TypeError(`Module ${module.id ?? '(unnamed)'} needs content or a caller-supplied profile root.`);
  }
  return readFile(targetPath(path.resolve(root), normalizedSource), 'utf8');
}

export async function capabilityAssets(profile, capability) {
  const source = validateRelativeTarget(capability.source);
  const directory = path.posix.dirname(source);
  const assets = [...(capability.assets ?? [])].sort((a, b) => a.path.localeCompare(b.path));
  return Promise.all(assets.map(async (asset) => {
    const assetPath = validateRelativeTarget(asset.path);
    if (!assetPath.startsWith(`${directory}/`)) throw new TypeError(`Asset ${asset.path} escapes capability ${capability.id}.`);
    let absolute;
    if (typeof asset.absolutePath === 'string') {
      absolute = path.resolve(asset.absolutePath);
      const capabilityAbsolute = capability.absoluteSource ? path.dirname(path.resolve(capability.absoluteSource)) : null;
      if (capabilityAbsolute && !absolute.startsWith(`${capabilityAbsolute}${path.sep}`)) throw new TypeError(`Asset ${asset.path} escapes capability ${capability.id}.`);
    } else {
      const root = profile?.root ?? profile?.sourceRoot;
      if (typeof root !== 'string' || !path.isAbsolute(root)) throw new TypeError(`Asset ${asset.path} needs absolutePath or a caller-supplied profile root.`);
      absolute = targetPath(path.resolve(root), assetPath);
    }
    const bytes = await readFile(absolute);
    const content = bytes.toString('utf8');
    if (!Buffer.from(content, 'utf8').equals(bytes)) throw new TypeError(`Asset ${asset.path} is not valid UTF-8 text; binary assets are unsupported in version 1.`);
    return Object.freeze({ ...asset, relative: assetPath.slice(directory.length + 1), content });
  }));
}

export function managedHeader(adapter, provenance) {
  return `<!-- Saddle managed projection; adapter: ${adapter}; source profile version: ${provenance.version}; source profile digest: ${provenance.digest}; do not edit this generated file. -->\n\n`;
}

export class SaddleProjectionConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SaddleProjectionConflictError';
    this.code = 'SADDLE_PROJECTION_CONFLICT';
  }
}

export function managedMarkers(adapter) {
  return Object.freeze({ start: `<!-- saddle:managed:start adapter=${adapter} -->`, end: `<!-- saddle:managed:end adapter=${adapter} -->` });
}

export function managedBlock(adapter, provenance, body) {
  const { start, end } = managedMarkers(adapter);
  return `${start}\n${managedHeader(adapter, provenance)}${body.trim()}\n${end}\n`;
}

export function mergeManagedBlock(existing, adapter, block) {
  if (existing === ABSENT) return block;
  const { start, end } = managedMarkers(adapter);
  const starts = existing.split(start).length - 1;
  const ends = existing.split(end).length - 1;
  if (starts !== ends || starts > 1) {
    throw new SaddleProjectionConflictError(`Malformed or duplicate Saddle managed markers for ${adapter}.`);
  }
  if (starts === 0) return `${existing}${existing.endsWith('\n') ? '\n' : '\n\n'}${block}`;
  const from = existing.indexOf(start);
  const through = existing.indexOf(end, from);
  if (through < from) throw new SaddleProjectionConflictError(`Malformed Saddle managed markers for ${adapter}.`);
  return `${existing.slice(0, from)}${block}${existing.slice(through + end.length + (existing[through + end.length] === '\n' ? 1 : 0))}`;
}

export function hasManagedProvenance(content, adapter) {
  if (typeof content !== 'string') return false;
  const header = `<!-- Saddle managed projection; adapter: ${adapter};`;
  if (content.startsWith(header)) return true;
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(content);
  return Boolean(frontmatter && content.slice(frontmatter[0].length).startsWith(header));
}

export function extractManagedBlock(content, adapter) {
  if (typeof content !== 'string') return null;
  const { start, end } = managedMarkers(adapter);
  const starts = content.split(start).length - 1;
  const ends = content.split(end).length - 1;
  if (starts !== 1 || ends !== 1) return null;
  const from = content.indexOf(start);
  const through = content.indexOf(end, from);
  if (through < from) return null;
  return content.slice(from, through + end.length + (content[through + end.length] === '\n' ? 1 : 0));
}

export async function existingFile(filename) {
  try {
    const entry = await stat(filename);
    if (!entry.isFile()) return null;
    return readFile(filename, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return ABSENT;
    throw error;
  }
}

export function operation({ id, action, target, expectedPriorDigest, resultingDigest, content, managedDigest, sourceModule, sourceModules, adapter, reason, risk }) {
  const relativeTarget = validateRelativeTarget(target);
  return Object.freeze({
    id,
    action,
    target: relativeTarget,
    targetRelative: relativeTarget,
    expectedPriorDigest,
    resultingDigest,
    ...(content === undefined ? {} : { content }),
    ...(managedDigest === undefined ? {} : { managedDigest }),
    sourceModule,
    sourceModules: sourceModules ?? [sourceModule],
    adapter,
    reason,
    risk,
  });
}

export { ABSENT };
