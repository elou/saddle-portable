import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadProfile, sha256 } from '../profile/index.js';

const MARKER_PREFIX = '.saddle-customize-reservation-';

export function stagingPath(parent, outputRoot) { return path.join(parent, `.${path.basename(outputRoot)}.saddle-customize-${randomUUID()}`); }

export async function createReservationJournal(staging, outputRoot) {
  const files = []; const directories = [];
  await collect(staging, '', files, directories);
  return { version: 1, token: randomUUID(), outputRoot: path.resolve(outputRoot), files, directories };
}

export async function reserveOutput(outputRoot, journal) {
  if (!journal || journal.version !== 1 || journal.outputRoot !== path.resolve(outputRoot)) throw new TypeError('Customization reservation journal is invalid.');
  try { await mkdir(outputRoot, { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') throw new Error('Customization output directory must be absent.'); throw error; }
  const marker = path.join(outputRoot, `${MARKER_PREFIX}${randomUUID()}`);
  try { await writeFile(marker, `${JSON.stringify(journal)}\n`, { flag: 'wx', mode: 0o600 }); }
  catch (error) { try { await rmdir(outputRoot); } catch {} throw error; }
  return { outputRoot, marker, journal };
}

export async function publishReservedOutput(staging, reservation) {
  await journalFor(reservation);
  for (const name of (await readdir(staging)).filter((name) => name !== 'saddle.profile.json').sort()) await publishEntry(staging, reservation.outputRoot, name, reservation);
  await journalFor(reservation);
  await publishFile(path.join(staging, 'saddle.profile.json'), path.join(reservation.outputRoot, 'saddle.profile.json'), reservation);
  await rm(reservation.marker, { force: true });
}

export async function cleanupReservation(reservation) {
  try {
    const journal = await journalFor(reservation); let complete = true;
    for (const file of [...journal.files].reverse()) {
      const target = await safeTarget(reservation.outputRoot, file.path);
      try { if (sha256(await readFile(target)) === file.digest) await rm(target); else complete = false; } catch (error) { if (error.code !== 'ENOENT') complete = false; }
    }
    for (const directory of [...journal.directories].sort((a, b) => b.length - a.length)) {
      try { await rmdir(await safeTarget(reservation.outputRoot, directory)); } catch (error) { if (error.code !== 'ENOENT') complete = false; }
    }
    const remaining = await readdir(reservation.outputRoot);
    if (!complete || remaining.some((name) => name !== path.basename(reservation.marker))) return false;
    await rm(reservation.marker); await rmdir(reservation.outputRoot); return true;
  } catch { return false; }
}

export async function recoverReservedOutput(outputRoot) {
  const root = path.resolve(outputRoot); await assertRealDirectory(root); const markers = (await readdir(root)).filter((name) => name.startsWith(MARKER_PREFIX));
  if (markers.length !== 1) throw new Error(markers.length ? 'Customization recovery found multiple reservation markers.' : 'No recognizable customization reservation was found.');
  const reservation = { outputRoot: root, marker: path.join(root, markers[0]) };
  const journal = await journalFor(reservation); const manifest = journal.files.find((file) => file.path === 'saddle.profile.json');
  if (manifest) {
    let present = false; try { await lstat(await safeTarget(root, manifest.path)); present = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (present) {
      try { if (sha256(await readFile(await safeTarget(root, manifest.path))) === manifest.digest) { await loadProfile(root); await rm(reservation.marker); return { status: 'committed', outputRoot: root, message: 'A validated manifest is present; recovery left the committed profile unchanged.' }; } } catch {}
      return { status: 'incomplete', outputRoot: root, message: 'The manifest is foreign or invalid and was preserved for manual review.' };
    }
  }
  return (await cleanupReservation(reservation))
    ? { status: 'recovered', outputRoot: root, message: 'Removed the incomplete customization reservation.' }
    : { status: 'incomplete', outputRoot: root, message: 'Unknown or changed destination content was preserved; resolve it manually before removing the reservation.' };
}

async function journalFor(reservation) {
  await assertRealDirectory(reservation.outputRoot); let journal; try { const markerInfo = await lstat(reservation.marker); if (markerInfo.isSymbolicLink() || !markerInfo.isFile()) throw new Error('marker'); journal = JSON.parse(await readFile(reservation.marker, 'utf8')); } catch { throw new Error('Customization reservation changed before publishing.'); }
  if (!exact(journal, ['version', 'token', 'outputRoot', 'files', 'directories']) || journal.version !== 1 || journal.outputRoot !== path.resolve(reservation.outputRoot) || !UUID.test(journal.token) || !Array.isArray(journal.files) || !Array.isArray(journal.directories)) throw new Error('Customization reservation changed before publishing.');
  const seen = new Set(); for (const file of journal.files) { if (!exact(file, ['path', 'digest']) || !safeRelative(file.path) || !DIGEST.test(file.digest) || seen.has(file.path)) throw new Error('Customization reservation changed before publishing.'); seen.add(file.path); } for (const dir of journal.directories) { if (!safeRelative(dir) || seen.has(dir)) throw new Error('Customization reservation changed before publishing.'); seen.add(dir); }
  return journal;
}

async function publishEntry(sourceRoot, outputRoot, relative, reservation) {
  const source = path.join(sourceRoot, relative); const target = path.join(outputRoot, relative); const info = await lstat(source);
  if (info.isDirectory()) {
    try { await mkdir(target, { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') throw new Error(`Customization destination entry already exists: ${relative}`); throw error; }
    for (const name of (await readdir(source)).sort()) await publishEntry(source, target, name, reservation);
  } else await publishFile(source, target, reservation);
}

async function publishFile(source, target, reservation) {
  await journalFor(reservation); const content = await readFile(source);
  try { await writeFile(target, content, { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code === 'EEXIST') throw new Error(`Customization destination entry already exists: ${path.basename(target)}`); throw error; }
}

async function collect(root, relative, files, directories) {
  for (const name of (await readdir(path.join(root, relative))).sort()) {
    const child = path.posix.join(relative, name); const info = await lstat(path.join(root, child));
    if (info.isDirectory()) { directories.push(child); await collect(root, child, files, directories); }
    else if (info.isFile()) files.push({ path: child, digest: sha256(await readFile(path.join(root, child))) });
    else throw new Error(`Customization staging contains an unsupported entry: ${child}`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;
function exact(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function safeRelative(value) { const n = typeof value === 'string' && path.posix.normalize(value.replaceAll('\\', '/')); return n && n !== '.' && n === value && n !== '..' && !n.startsWith('../') && !path.posix.isAbsolute(n) && !n.split('/').some((part) => part.startsWith(MARKER_PREFIX)); }
async function assertRealDirectory(root) { const info = await lstat(root); if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Customization recovery output must be a real directory.'); }
async function safeTarget(root, relative) { if (!safeRelative(relative)) throw new Error('Customization reservation contains an unsafe path.'); let current = root; for (const part of relative.split('/')) { current = path.join(current, part); try { if ((await lstat(current)).isSymbolicLink()) throw new Error('Customization reservation path contains a symlink.'); } catch (error) { if (error.code === 'ENOENT') return current; throw error; } } return current; }
