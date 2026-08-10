import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inventoryRuntimeSources } from '../capture/index.js';
import { assertImportConsents, createImportPlan, parseRuntimeSelection, scanRuntimes, verifyImport } from '../domain/index.js';
import { applyCustomization, previewCustomization } from '../onboarding/customizer.js';
import { createProfileFromCandidates } from '../onboarding/profile-builder.js';
import { loadProfile } from '../profile/index.js';
import { applyPlan, rollbackTransaction } from '../transaction/index.js';

const assetRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

export function createSetupServer({
  token = randomBytes(24).toString('base64url'),
  initialState,
  config = { mode: 'setup' },
  pickDirectory = pickDirectoryOnMac,
} = {}) {
  const setupConfig = normalizeSetupConfig(config, initialState);
  let listener;
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      setSecurityHeaders(response);

      if (request.method === 'GET' && assets.has(url.pathname)) {
        const [filename, contentType] = assets.get(url.pathname);
        const content = await readFile(path.join(assetRoot, filename));
        response.writeHead(200, { 'content-type': contentType });
        response.end(content);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/status') {
        if (!authorized(request, url, token)) return forbidden(response);
        return json(response, 200, {
          product: 'Saddle Portable',
          localOnly: true,
          runtimes: ['claude', 'codex'],
          writesRequirePreviewDigest: true,
        });
      }

      if (request.method === 'GET' && url.pathname === '/api/config') {
        if (!authorized(request, url, token)) return forbidden(response);
        return json(response, 200, await publicSetupConfig(setupConfig));
      }

      if (request.method !== 'POST' || !url.pathname.startsWith('/api/')) {
        return json(response, 404, { error: 'Not found.' });
      }
      if (!authorized(request, url, token)) return forbidden(response);
      const body = await readJson(request);

      if (url.pathname === '/api/pick-directory') {
        const requestData = directoryPickerRequest(body);
        const selected = await pickDirectory(requestData);
        return json(response, 200, { path: requiredAbsolute(selected, 'selected folder') });
      }
      if (url.pathname === '/api/scan') {
        const targetRoot = requiredAbsolute(body.targetRoot, 'targetRoot');
        const runtimes = parseRuntimeSelection(body.runtimes?.join?.(',') ?? body.runtimes);
        return json(response, 200, { targetRoot, results: await scanRuntimes({ targetRoot, runtimes }) });
      }
      if (url.pathname === '/api/inventory') {
        const sourceRoot = sourceRootRequest(body);
        const runtimes = parseRuntimeSelection(body.runtimes?.join?.(',') ?? body.runtimes);
        const inventories = [];
        for (const runtime of runtimes) {
          try {
            inventories.push({
              runtime,
              runtimeRoot: path.join(sourceRoot, `.${runtime}`),
              ...await inventoryRuntimeSources({ runtime, runtimeRoot: path.join(sourceRoot, `.${runtime}`) }),
            });
          } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
            inventories.push({ runtime, runtimeRoot: path.join(sourceRoot, `.${runtime}`), candidates: [], warnings: [] });
          }
        }
        return json(response, 200, { sourceRoot, inventories });
      }
      if (url.pathname === '/api/capture') {
        const sourceRoot = sourceRootRequest(body);
        const outputRoot = requiredAbsolute(body.outputRoot, 'outputRoot');
        const selections = Array.isArray(body.selections) ? body.selections : [];
        const requestedRuntimes = parseRuntimeSelection(selections.map((item) => item.runtime).join(','));
        const sources = [];
        for (const runtime of requestedRuntimes) {
          const runtimeRoot = path.join(sourceRoot, `.${runtime}`);
          const inventory = await inventoryRuntimeSources({ runtime, runtimeRoot });
          const byId = new Map(inventory.candidates.map((candidate) => [candidate.id, candidate]));
          for (const selection of selections.filter((item) => item.runtime === runtime)) {
            const candidate = byId.get(selection.id);
            if (!candidate?.selectable) throw new RequestError(`Candidate ${selection.id} is unavailable or not selectable.`);
            sources.push({ runtimeRoot, candidate });
          }
        }
        const result = await createProfileFromCandidates({
          sources,
          outputRoot,
          profile: body.profile,
        });
        return json(response, 200, result);
      }
      if (url.pathname === '/api/customize/preview') {
        const requestData = customizationRequest(body);
        const { digest, plan } = await previewCustomization(requestData);
        return json(response, 200, { digest, plan });
      }
      if (url.pathname === '/api/customize/apply') {
        const requestData = customizationRequest(body);
        if (typeof body.previewDigest !== 'string' || !body.previewDigest) {
          throw new RequestError('previewDigest is required.');
        }
        const preview = await previewCustomization(requestData);
        if (body.previewDigest !== preview.digest) {
          return json(response, 409, {
            error: 'The profile or draft changed after preview. Review a new preview before applying.',
            currentPreviewDigest: preview.digest,
          });
        }
        const result = await applyCustomization({
          ...requestData,
          expectedPreviewDigest: body.previewDigest,
        });
        return json(response, 200, {
          ...result,
          previewDigest: result.previewDigest ?? result.digest,
        });
      }
      if (url.pathname === '/api/plan') {
        const requestData = importRequest(body);
        const preview = await createImportPlan(requestData);
        return json(response, 200, { digest: preview.digest, requiredConsents: preview.requiredConsents, plan: preview.plan });
      }
      if (url.pathname === '/api/apply') {
        const requestData = importRequest(body);
        const preview = await createImportPlan(requestData);
        if (body.planDigest !== preview.digest) {
          return json(response, 409, {
            error: 'The target or profile changed after preview. Review a new plan before applying.',
            currentPlanDigest: preview.digest,
          });
        }
        const consent = Object.fromEntries((Array.isArray(body.consents) ? body.consents : []).map((id) => [id, true]));
        assertImportConsents(preview.requiredConsents, consent);
        const stateRoot = requiredAbsolute(body.stateRoot, 'stateRoot');
        const transaction = await applyPlan(preview.plan, {
          targetRoot: requestData.targetRoot,
          stateRoot,
          expectedPlanDigest: body.planDigest,
        });
        try {
          const verification = await verifyImport(requestData);
          return json(response, 200, { transaction, verification });
        } catch (error) {
          return json(response, 200, { transaction, verification: [], verificationError: error.message });
        }
      }
      if (url.pathname === '/api/doctor') {
        const requestData = importRequest(body);
        return json(response, 200, { results: await verifyImport(requestData) });
      }
      if (url.pathname === '/api/rollback') {
        const targetRoot = requiredAbsolute(body.targetRoot, 'targetRoot');
        const stateRoot = requiredAbsolute(body.stateRoot, 'stateRoot');
        if (typeof body.transactionId !== 'string') throw new RequestError('transactionId is required.');
        return json(response, 200, {
          transaction: await rollbackTransaction(body.transactionId, { targetRoot, stateRoot }),
        });
      }
      return json(response, 404, { error: 'Not found.' });
    } catch (error) {
      const status = error instanceof RequestError ? 400 : 422;
      return json(response, status, { error: error.message, code: error.code });
    }
  });

  return {
    token,
    async listen({ host = '127.0.0.1', port = 0 } = {}) {
      if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
        throw new Error('Saddle setup only binds to loopback.');
      }
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
      });
      listener = server.address();
      const hostname = listener.family === 'IPv6' ? '[::1]' : '127.0.0.1';
      return { url: `http://${hostname}:${listener.port}/?token=${token}`, port: listener.port, token };
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

function authorized(request, url, token) {
  return request.headers['x-saddle-token'] === token || url.searchParams.get('token') === token;
}

function forbidden(response) {
  return json(response, 403, { error: 'Missing or invalid local setup token.' });
}

function importRequest(body) {
  return {
    profileRoot: requiredAbsolute(body.profileRoot, 'profileRoot'),
    targetRoot: requiredAbsolute(body.targetRoot, 'targetRoot'),
    runtimes: parseRuntimeSelection(body.runtimes?.join?.(',') ?? body.runtimes),
  };
}

function customizationRequest(body) {
  return {
    profileRoot: requiredAbsolute(body.profileRoot, 'profileRoot'),
    outRoot: requiredAbsolute(body.outRoot, 'outRoot'),
    draft: body.draft,
  };
}

function sourceRootRequest(body) {
  return requiredAbsolute(body.sourceRoot ?? body.targetRoot, body.sourceRoot === undefined ? 'targetRoot' : 'sourceRoot');
}

function directoryPickerRequest(body) {
  const purpose = body?.purpose;
  if (!['mac-account', 'existing-setup', 'new-setup'].includes(purpose)) {
    throw new RequestError('Choose a valid folder purpose.');
  }
  return { purpose, defaultPath: requiredAbsolute(body.defaultPath, 'defaultPath') };
}

async function pickDirectoryOnMac({ defaultPath, purpose }) {
  if (os.platform() !== 'darwin') {
    throw new RequestError('Folder choosing is available on macOS. Enter the folder path instead.');
  }
  const prompt = ({
    'mac-account': 'Choose the Mac account folder to set up',
    'existing-setup': 'Choose the Saddle setup from another computer',
    'new-setup': 'Choose where to save the new Saddle setup',
  })[purpose];
  const script = 'on run argv\nset chosenFolder to choose folder with prompt (item 2 of argv) default location (POSIX file (item 1 of argv))\nreturn POSIX path of chosenFolder\nend run';
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn('/usr/bin/osascript', ['-e', script, defaultPath, prompt], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      let error = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { error += chunk; });
      child.once('error', () => reject(new RequestError('Saddle could not open the folder chooser. Enter the folder path instead.')));
      child.once('close', (code) => {
        if (code === 0) return resolve(output.trim());
        reject(new RequestError(error.includes('User canceled') ? 'Folder selection was cancelled. Enter the folder path instead.' : 'Saddle could not open the folder chooser. Enter the folder path instead.'));
      });
    });
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('Saddle could not open the folder chooser. Enter the folder path instead.');
  }
}

function normalizeSetupConfig(config, initialState) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('config must be an object.');
  const mode = config.mode ?? 'setup';
  if (mode !== 'setup' && mode !== 'customize') throw new TypeError('config.mode must be setup or customize.');
  const normalized = { mode };
  if (mode === 'customize') {
    normalized.profileRoot = requiredAbsolute(config.profileRoot, 'config.profileRoot');
    normalized.outRoot = requiredAbsolute(config.outRoot, 'config.outRoot');
  }
  if (initialState !== undefined) normalized.initialState = structuredClone(initialState);
  return normalized;
}

async function publicSetupConfig(config) {
  if (config.mode !== 'customize') return config;
  const loaded = await loadProfile(config.profileRoot);
  const required = new Set(Object.values(loaded.manifest.lifecycle).map((entry) => entry.module));
  return {
    mode: config.mode,
    profileRoot: config.profileRoot,
    outRoot: config.outRoot,
    profile: {
      id: loaded.manifest.profile.id,
      name: loaded.manifest.profile.name,
      version: loaded.manifest.profile.version,
      modules: loaded.manifest.modules.map(({ id, kind, sensitivity, enabled }) => ({
        id, kind, sensitivity, enabled, required: required.has(id),
      })),
    },
    ...(config.initialState === undefined ? {} : { initialState: config.initialState }),
  };
}

function requiredAbsolute(value, name) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new RequestError(`${name} must be an absolute path.`);
  }
  return path.resolve(value);
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 1_000_000) throw new RequestError('Request body is too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new RequestError('Request body must be valid JSON.');
  }
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(body)}\n`);
}

function setSecurityHeaders(response) {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  response.setHeader('cross-origin-resource-policy', 'same-origin');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
}

class RequestError extends Error {}
