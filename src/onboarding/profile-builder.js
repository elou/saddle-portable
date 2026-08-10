import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readCandidate } from '../capture/index.js';
import { sha256, validateManifest } from '../profile/index.js';

const DEFAULT_CONTINUITY = `# Session continuity

## Session start

Read the current project dashboard and the most recent durable session notes before acting.

## Session checkpoint

After a material change, append decisions, evidence, current state, and one next action to the active session note.

## Before context reset

Before clear, compact, branch, handoff, or session end, save chat-only artifacts, finalize the current checkpoint, and write a resume pointer.

## After context reset

Reload the dashboard, curated context, and latest session note. Continue from the recorded next action without redoing completed work.

## Session end

Verify the work, reconcile durable records, and leave one concrete next action.
`;

export async function createProfileFromCandidates({
  sources,
  outputRoot,
  profile,
  routing = { strategy: 'minimum-cost-that-clears-gate', routes: [] },
} = {}) {
  if (!Array.isArray(sources)) throw new TypeError('sources must be an array.');
  if (!path.isAbsolute(outputRoot)) throw new TypeError('outputRoot must be absolute.');
  const profileMetadata = validateProfileMetadata(profile);
  rejectCanonicalCapabilityCollisions(sources);
  await requireAbsent(outputRoot);

  const selected = [];
  for (const source of sources) {
    if (!source?.candidate?.selectable) throw new Error('Every selected candidate must be selectable.');
    const runtimeRoot = await realpath(source.runtimeRoot);
    const content = await readCandidate(source.candidate, { runtimeRoot });
    const assets = [];
    for (const asset of source.candidate.assets ?? []) {
      if (!asset.selectable) continue;
      const assetContent = await readCandidate({
        ...asset,
        source: asset.path,
        sourceType: 'capability',
        selectable: true,
      }, { runtimeRoot });
      assets.push({ ...asset, content: assetContent });
    }
    selected.push({ ...source, runtimeRoot, content, assets });
  }

  selected.sort((left, right) =>
    left.candidate.suggestedKind.localeCompare(right.candidate.suggestedKind) ||
    left.candidate.source.localeCompare(right.candidate.source) ||
    left.candidate.id.localeCompare(right.candidate.id));

  const parent = path.dirname(outputRoot);
  await mkdir(parent, { recursive: true });
  const staging = path.join(parent, `.${path.basename(outputRoot)}.saddle-build-${randomUUID()}`);
  await mkdir(staging, { mode: 0o700 });
  try {
    const modules = [];
    const grouped = new Map();
    for (const item of selected.filter((entry) => entry.candidate.sourceType === 'instruction-section')) {
      const kind = item.candidate.suggestedKind;
      if (!grouped.has(kind)) grouped.set(kind, []);
      grouped.get(kind).push(item);
    }

    const continuitySelections = grouped.get('session-continuity') ?? [];
    const continuity = continuitySelections.length
      ? `${DEFAULT_CONTINUITY}\n## Imported continuity guidance\n\n${joinCaptured(continuitySelections)}`
      : DEFAULT_CONTINUITY;
    modules.push(await writeModule(staging, {
      id: 'session-continuity',
      kind: 'session-continuity',
      source: 'instructions/session-continuity.md',
      content: continuity,
      sensitivity: 'standard',
    }));

    for (const kind of ['operating-policy', 'project-standard', 'personal-context']) {
      const entries = grouped.get(kind) ?? [];
      if (!entries.length) continue;
      const id = kind;
      modules.push(await writeModule(staging, {
        id,
        kind,
        source: `instructions/${id}.md`,
        content: `# ${title(kind)}\n\n${joinCaptured(entries)}`,
        sensitivity: entries.some((entry) => entry.candidate.suggestedSensitivity === 'personal')
          ? 'personal'
          : entries.some((entry) => entry.candidate.suggestedSensitivity === 'restricted')
            ? 'restricted'
            : 'standard',
      }));
    }

    for (const item of selected.filter((entry) => entry.candidate.sourceType === 'capability')) {
      const capabilityId = canonicalCapabilityId(item.candidate);
      const directory = `capabilities/${capabilityId}`;
      const assets = [];
      for (const asset of item.assets.sort((a, b) => a.path.localeCompare(b.path))) {
        const relative = path.posix.relative(path.posix.dirname(item.candidate.source), asset.path);
        const target = `${directory}/${relative}`;
        await writeText(staging, target, asset.content);
        assets.push({ path: target, digest: sha256(asset.content), kind: asset.kind });
      }
      const captured = normalizeNeutralCapability(item.content, capabilityId, item.candidate.runtime, item.candidate.source);
      const sensitivity = assets.some((asset) => asset.kind === 'script')
        ? 'restricted'
        : item.candidate.suggestedSensitivity;
      modules.push(await writeModule(staging, {
        id: capabilityId,
        kind: 'capability',
        source: `${directory}/CAPABILITY.md`,
        content: captured,
        sensitivity,
        assets,
      }));
    }

    const now = new Date().toISOString();
    const manifest = {
      schemaVersion: '1.0',
      profile: { ...profileMetadata, version: '1.0.0', createdAt: now, updatedAt: now },
      modules,
      lifecycle: {
        'session.start': { module: 'session-continuity', procedure: 'session-start' },
        'session.checkpoint': { module: 'session-continuity', procedure: 'session-checkpoint' },
        'context.before-reset': { module: 'session-continuity', procedure: 'before-context-reset' },
        'context.after-reset': { module: 'session-continuity', procedure: 'after-context-reset' },
        'session.end': { module: 'session-continuity', procedure: 'session-end' },
      },
      routing,
      portability: {
        personalContext: 'prompt',
        integrations: 'declarations-only',
        scripts: 'copy-inert',
        absolutePaths: 'alias-only',
      },
    };
    validateManifest(manifest);
    await writeFile(path.join(staging, 'saddle.profile.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(staging, outputRoot);
    return {
      outputRoot,
      profile: manifest.profile,
      modules: manifest.modules.map(({ id, kind, sensitivity }) => ({ id, kind, sensitivity })),
    };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function writeModule(root, { id, kind, source, content, sensitivity, assets }) {
  await writeText(root, source, content);
  return {
    id,
    kind,
    source,
    enabled: true,
    sensitivity,
    consent: sensitivity === 'standard' ? 'implicit' : 'explicit',
    digest: sha256(content),
    ...(assets?.length ? { assets } : {}),
  };
}

async function writeText(root, relative, content) {
  const destination = path.join(root, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, { flag: 'wx', mode: 0o600 });
}

function joinCaptured(entries) {
  return entries.map((entry) =>
    `<!-- Source: ${entry.candidate.runtime}:${entry.candidate.source}${entry.candidate.heading ? `#${slug(entry.candidate.heading)}` : ''} -->\n\n${entry.content.trim()}\n`)
    .join('\n');
}

function validateProfileMetadata(profile) {
  if (!profile || typeof profile !== 'object') throw new TypeError('profile metadata is required.');
  const id = slug(profile.id);
  if (typeof profile.name !== 'string' || !profile.name.trim()) throw new TypeError('profile.name is required.');
  return { id, name: profile.name.trim() };
}

function slug(value) {
  const result = String(value ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!/^[a-z][a-z0-9-]*$/.test(result)) throw new TypeError('Profile and capability ids must begin with a letter.');
  return result;
}

function canonicalCapabilityId(candidate) {
  return slug(path.basename(path.dirname(candidate.source)));
}

function rejectCanonicalCapabilityCollisions(sources) {
  const byCapabilityId = new Map();
  for (const source of sources) {
    if (source?.candidate?.sourceType !== 'capability') continue;
    const id = canonicalCapabilityId(source.candidate);
    const collisions = byCapabilityId.get(id) ?? [];
    collisions.push(source.candidate);
    byCapabilityId.set(id, collisions);
  }
  for (const [id, candidates] of byCapabilityId) {
    if (candidates.length < 2) continue;
    const sourcesList = candidates.map((candidate) => `${candidate.runtime}:${candidate.source}`).join(', ');
    throw new Error(`Choose one source for universal capability "${id}". Selected sources collide: ${sourcesList}. Saddle will project that one CAPABILITY.md to every selected runtime.`);
  }
}

function title(value) {
  return value.split('-').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}

function normalizeNeutralCapability(content, capabilityId, runtime, source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  const frontmatter = match?.[1] ?? '';
  const descriptionLine = /^description:\s*(.+?)\s*$/m.exec(frontmatter);
  let description = descriptionLine?.[1] ?? `Portable capability ${capabilityId}.`;
  if ((description.startsWith('"') && description.endsWith('"')) || (description.startsWith("'") && description.endsWith("'"))) description = description.slice(1, -1);
  const body = match ? content.slice(match[0].length) : content;
  return `---\nname: ${capabilityId}\ndescription: ${JSON.stringify(description)}\n---\n<!-- Captured from ${runtime}:${source}. Review runtime-specific wording before sharing. -->\n\n${body.trim()}\n`;
}

async function requireAbsent(outputRoot) {
  try {
    await readdir(outputRoot);
    throw new Error('Output profile directory must not already exist.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
