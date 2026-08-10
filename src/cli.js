import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { createImportPlan, parseRuntimeSelection, scanRuntimes, verifyImport } from './domain/index.js';
import { exportProfile, sha256 } from './profile/index.js';
import {
  TransactionError,
  applyPlan,
  rollbackTransaction,
} from './transaction/index.js';
import { createSetupServer } from './ui/server.js';

export async function runCli(argv, io = defaultIo()) {
  const [command, ...args] = argv;
  try {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      io.out(helpText());
      return 0;
    }
    const parsed = parseArgs(args);
    switch (command) {
      case 'init':
        return await initCommand(parsed, io);
      case 'scan':
        return await scanCommand(parsed, io);
      case 'export':
        return await exportCommand(parsed, io);
      case 'import':
        return await importCommand(parsed, io);
      case 'doctor':
        return await doctorCommand(parsed, io);
      case 'rollback':
        return await rollbackCommand(parsed, io);
      case 'setup':
        return await setupCommand(parsed, io);
      default:
        throw new CliError(`Unknown command: ${command}`);
    }
  } catch (error) {
    io.err(error.message);
    if (error instanceof TransactionError) {
      if (error.code === 'APPLY_FAILED_ROLLED_BACK') return 2;
      if (error.code === 'APPLY_FAILED_ROLLBACK_INCOMPLETE' || error.code === 'ROLLBACK_INCOMPLETE') return 3;
    }
    return 1;
  }
}

async function initCommand(parsed, io) {
  const directory = path.resolve(parsed.positionals[0] ?? 'saddle-profile');
  const name = stringOption(parsed, 'name') ?? path.basename(directory).replaceAll('-', ' ');
  const id = slug(stringOption(parsed, 'id') ?? path.basename(directory));
  const now = new Date().toISOString();
  const instructions = {
    'instructions/operating.md': `# Operating policy\n\n## Safe local servers\n\nBefore starting a local development server, verify that the complete process tree has a total RSS cap. Do not treat a JavaScript heap limit as a process-tree memory cap. If the project has no compliant wrapper, stop and offer to install one before starting the server.\n`,
    'instructions/session-continuity.md': `# Session continuity\n\n## Session start\n\nRead the project dashboard and the most recent durable session notes before acting.\n\n## Session checkpoint\n\nAfter a material change, append the decision, evidence, current state, and one next action to the active session note.\n\n## Before context reset\n\nBefore clear, compact, branch, handoff, or session end, save chat-only artifacts, finalize the checkpoint, and write a resume pointer.\n\n## After context reset\n\nReload the dashboard, curated context, and latest session note. Continue from the recorded next action without redoing completed work.\n\n## Session end\n\nVerify the work, reconcile durable records, and leave one concrete next action.\n`,
    'instructions/project-standards.md': `# Project standards\n\nKeep current work, decisions, and verification evidence in durable project files. Treat generated runtime projections as outputs of the neutral profile, never as competing sources of truth.\n`,
  };

  for (const [relative, content] of Object.entries(instructions)) {
    const filename = path.join(directory, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, content, { flag: 'wx', mode: 0o600 });
  }

  const module = (moduleId, kind, source) => ({
    id: moduleId,
    kind,
    source,
    enabled: true,
    sensitivity: 'standard',
    consent: 'implicit',
    digest: sha256(instructions[source]),
  });
  const manifest = {
    schemaVersion: '1.0',
    profile: { id, name, version: '1.0.0', createdAt: now, updatedAt: now },
    modules: [
      module('operating-policy', 'operating-policy', 'instructions/operating.md'),
      module('session-continuity', 'session-continuity', 'instructions/session-continuity.md'),
      module('project-standards', 'project-standard', 'instructions/project-standards.md'),
    ],
    lifecycle: {
      'session.start': { module: 'session-continuity', procedure: 'session-start' },
      'session.checkpoint': { module: 'session-continuity', procedure: 'session-checkpoint' },
      'context.before-reset': { module: 'session-continuity', procedure: 'before-context-reset' },
      'context.after-reset': { module: 'session-continuity', procedure: 'after-context-reset' },
      'session.end': { module: 'session-continuity', procedure: 'session-end' },
    },
    routing: { strategy: 'minimum-cost-that-clears-gate', routes: [] },
    portability: {
      personalContext: 'prompt',
      integrations: 'declarations-only',
      scripts: 'copy-inert',
      absolutePaths: 'alias-only',
    },
  };
  await writeFile(
    path.join(directory, 'saddle.profile.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  output(io, parsed, { profile: directory, id, modules: manifest.modules.map((item) => item.id) },
    `Created neutral profile ${id} at ${directory}.`);
  return 0;
}

async function scanCommand(parsed, io) {
  const targetRoot = path.resolve(stringOption(parsed, 'target') ?? os.homedir());
  const runtimes = parseRuntimeSelection(stringOption(parsed, 'runtime'));
  const results = await scanRuntimes({ targetRoot, runtimes });
  output(io, parsed, { targetRoot, runtimes: results }, results
    .map((result) => `${result.displayName ?? result.id}: ${result.detected ? 'detected' : 'not detected'}`)
    .join('\n'));
  return 0;
}

async function exportCommand(parsed, io) {
  const profileRoot = requiredPath(parsed, 'profile');
  const outputRoot = requiredPath(parsed, 'out');
  const consent = Object.fromEntries((stringOption(parsed, 'consent') ?? '').split(',').filter(Boolean)
    .map((id) => [id, true]));
  const result = await exportProfile(profileRoot, outputRoot, { consent });
  output(io, parsed, result, `Exported ${result.modules.length} modules to ${result.output}.`);
  return 0;
}

async function importCommand(parsed, io) {
  const profileRoot = path.resolve(requiredPositional(parsed, 'import requires a bundle directory.'));
  const targetRoot = requiredPath(parsed, 'target');
  const runtimes = parseRuntimeSelection(stringOption(parsed, 'runtime'));
  const preview = await createImportPlan({ profileRoot, targetRoot, runtimes });

  if (!booleanOption(parsed, 'apply')) {
    output(io, parsed, { digest: preview.digest, plan: preview.plan }, formatPlan(preview.plan, preview.digest));
    return 0;
  }

  const accepted = stringOption(parsed, 'accept-plan');
  if (accepted !== preview.digest) {
    throw new CliError(`Apply stopped. Re-run the dry-run and pass --accept-plan ${preview.digest}`);
  }
  const stateRoot = path.resolve(stringOption(parsed, 'state') ?? path.join(targetRoot, '.saddle'));
  const result = await applyPlan(preview.plan, {
    targetRoot,
    stateRoot,
    expectedPlanDigest: accepted,
  });
  const verification = await verifyImport({ profileRoot, targetRoot, runtimes });
  if (!verification.every((item) => item.verification.status === 'exact')) {
    throw new CliError(`Apply completed as transaction ${result.id}, but verification did not pass. Run saddle rollback ${result.id}.`);
  }
  output(io, parsed, { transaction: result, verification },
    `Applied and verified transaction ${result.id}. Roll back with: saddle rollback ${result.id} --target ${targetRoot} --state ${stateRoot}`);
  return 0;
}

async function doctorCommand(parsed, io) {
  const profileRoot = requiredPath(parsed, 'profile');
  const targetRoot = requiredPath(parsed, 'target');
  const runtimes = parseRuntimeSelection(stringOption(parsed, 'runtime'));
  const results = await verifyImport({ profileRoot, targetRoot, runtimes });
  output(io, parsed, { targetRoot, results }, results.map((item) => {
    const lifecycle = Object.entries(item.capabilities.lifecycle)
      .map(([event, support]) => `${event}=${support}`).join(', ');
    return `${item.runtime}: ${item.verification.status}\n  ${lifecycle}`;
  }).join('\n'));
  return results.every((item) => item.verification.status === 'exact') ? 0 : 1;
}

async function rollbackCommand(parsed, io) {
  const transactionId = requiredPositional(parsed, 'rollback requires a transaction id.');
  const targetRoot = requiredPath(parsed, 'target');
  const stateRoot = requiredPath(parsed, 'state');
  const result = await rollbackTransaction(transactionId, { targetRoot, stateRoot });
  output(io, parsed, result, `Rolled back transaction ${transactionId}.`);
  return 0;
}

async function setupCommand(parsed, io) {
  const rawPort = stringOption(parsed, 'port');
  const port = rawPort === undefined ? 0 : Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new CliError('--port must be a valid port number.');
  }
  const setup = createSetupServer();
  const listener = await setup.listen({ port });
  io.out(`Saddle setup is available only on this computer:\n${listener.url}\nPress Ctrl+C to stop.`);
  if (!booleanOption(parsed, 'no-open')) openLocalUrl(listener.url);
  return 0;
}

function openLocalUrl(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

function parseArgs(args) {
  const options = new Map();
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith('--')) {
      positionals.push(item);
      continue;
    }
    const [rawKey, inline] = item.slice(2).split('=', 2);
    if (inline !== undefined) {
      options.set(rawKey, inline);
    } else if (args[index + 1] && !args[index + 1].startsWith('--')) {
      options.set(rawKey, args[index + 1]);
      index += 1;
    } else {
      options.set(rawKey, true);
    }
  }
  return { options, positionals };
}

function stringOption(parsed, name) {
  const value = parsed.options.get(name);
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new CliError(`--${name} requires a value.`);
  return value;
}

function booleanOption(parsed, name) {
  return parsed.options.get(name) === true;
}

function requiredPath(parsed, name) {
  const value = stringOption(parsed, name);
  if (!value) throw new CliError(`--${name} is required.`);
  return path.resolve(value);
}

function requiredPositional(parsed, message) {
  if (!parsed.positionals[0]) throw new CliError(message);
  return parsed.positionals[0];
}

function slug(value) {
  const result = String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!/^[a-z][a-z0-9-]*$/.test(result)) throw new CliError('Profile id must begin with a letter.');
  return result;
}

function output(io, parsed, json, human) {
  io.out(parsed.options.has('json') ? JSON.stringify(json, null, 2) : human);
}

function formatPlan(plan, digest) {
  const operations = plan.operations.map((item) => `- ${item.action} ${item.target}: ${item.reason}`).join('\n');
  return `Plan ${digest}\nProfile: ${plan.profile.id}@${plan.profile.version}\nTarget: ${plan.targetRoot}\n${operations}\n\nNo files changed. Apply this exact preview with --apply --accept-plan ${digest}`;
}

function helpText() {
  return `Saddle Portable\n\nCommands:\n  saddle setup [--port <number>] [--no-open]\n  saddle init [directory]\n  saddle scan [--target <home>] [--runtime claude,codex]\n  saddle export --profile <directory> --out <directory> [--consent id,id]\n  saddle import <bundle> --target <home> [--runtime claude,codex] [--apply --accept-plan <digest>]\n  saddle doctor --profile <directory> --target <home> [--runtime claude,codex]\n  saddle rollback <transaction-id> --target <home> --state <directory>\n\nAdd --json for machine-readable output.`;
}

function defaultIo() {
  return {
    out: (value) => process.stdout.write(`${value}\n`),
    err: (value) => process.stderr.write(`${value}\n`),
  };
}

class CliError extends Error {}
