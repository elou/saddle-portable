import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inventoryRuntimeSources } from '../capture/index.js';
import { createImportPlan, parseRuntimeSelection, scanRuntimes, verifyImport } from '../domain/index.js';
import { createProfileFromCandidates } from '../onboarding/profile-builder.js';
import { applyPlan, rollbackTransaction } from '../transaction/index.js';

const assetRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

export function createSetupServer({ token = randomBytes(24).toString('base64url') } = {}) {
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

      if (request.method !== 'POST' || !url.pathname.startsWith('/api/')) {
        return json(response, 404, { error: 'Not found.' });
      }
      if (!authorized(request, url, token)) return forbidden(response);
      const body = await readJson(request);

      if (url.pathname === '/api/scan') {
        const targetRoot = requiredAbsolute(body.targetRoot, 'targetRoot');
        const runtimes = parseRuntimeSelection(body.runtimes?.join?.(',') ?? body.runtimes);
        return json(response, 200, { targetRoot, results: await scanRuntimes({ targetRoot, runtimes }) });
      }
      if (url.pathname === '/api/inventory') {
        const targetRoot = requiredAbsolute(body.targetRoot, 'targetRoot');
        const runtimes = parseRuntimeSelection(body.runtimes?.join?.(',') ?? body.runtimes);
        const inventories = [];
        for (const runtime of runtimes) {
          try {
            inventories.push({
              runtime,
              runtimeRoot: path.join(targetRoot, `.${runtime}`),
              ...await inventoryRuntimeSources({ runtime, runtimeRoot: path.join(targetRoot, `.${runtime}`) }),
            });
          } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
            inventories.push({ runtime, runtimeRoot: path.join(targetRoot, `.${runtime}`), candidates: [], warnings: [] });
          }
        }
        return json(response, 200, { targetRoot, inventories });
      }
      if (url.pathname === '/api/capture') {
        const targetRoot = requiredAbsolute(body.targetRoot, 'targetRoot');
        const outputRoot = requiredAbsolute(body.outputRoot, 'outputRoot');
        const selections = Array.isArray(body.selections) ? body.selections : [];
        const requestedRuntimes = parseRuntimeSelection(selections.map((item) => item.runtime).join(','));
        const sources = [];
        for (const runtime of requestedRuntimes) {
          const runtimeRoot = path.join(targetRoot, `.${runtime}`);
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
      if (url.pathname === '/api/plan') {
        const requestData = importRequest(body);
        const preview = await createImportPlan(requestData);
        return json(response, 200, { digest: preview.digest, plan: preview.plan });
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
        const stateRoot = requiredAbsolute(body.stateRoot, 'stateRoot');
        const transaction = await applyPlan(preview.plan, {
          targetRoot: requestData.targetRoot,
          stateRoot,
          expectedPlanDigest: body.planDigest,
        });
        const verification = await verifyImport(requestData);
        return json(response, 200, { transaction, verification });
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
