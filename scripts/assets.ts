import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, realpathSync, openSync, closeSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveFiles, command, fileDigest, isMain, readJson, ROOT, unpackVerified, writeJson } from './lib/artifacts.ts';
import type { Inventory } from './lib/artifacts.ts';

export const INPUTS = ['src/asset-catalog.json', 'src/auxide-samples.json', 'scripts/import-assets.ts'] as const;
const ICONS = ['iron-plate.png', 'iron-gear-wheel.png', 'processing-unit.png', 'programmable-speaker.png'];
const FONTS = ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoMono-Regular.ttf'];
export type AssetLock = {
  schema: 1; repository: string; tag: string; archive: string; sha256: string; size: number;
  factorio_version: string; inputs: Record<string, string>; files: Inventory;
};
export function checkInputs(lock: AssetLock): void {
  assert.equal(lock.schema, 1, 'Unsupported asset lock schema');
  for (const name of INPUTS) assert.equal(lock.inputs[name], fileDigest(join(ROOT, name)).sha256, `${name} changed; regenerate and publish an asset pack`);
}
export function requiredFiles(directory: string): string[] {
  const { pages } = readJson<{ pages: number }>(join(directory, 'packed/manifest.json'));
  assert(Number.isInteger(pages) && pages >= 1 && pages <= 32, 'Invalid atlas page count');
  return [
    'packed/manifest.json',
    ...Array.from({ length: pages }, (_, i) => `packed/atlas-${i}.png`),
    ...ICONS.map(name => `icons/${name}`), ...FONTS.map(name => `fonts/${name}`),
    ...Object.values(readJson<Record<string, string>>(join(ROOT, 'src/auxide-samples.json'))).map(name => `sound/programmable-speaker/${name}`),
  ].sort();
}
export function verifyInstalled(lock: AssetLock, directory: string): void {
  checkInputs(lock);
  assert.deepEqual(requiredFiles(directory), Object.keys(lock.files).sort(), 'Asset lock does not match required runtime files');
  for (const [name, expected] of Object.entries(lock.files)) assert.deepEqual(fileDigest(join(directory, name)), expected, `Asset differs from the lock: ${name}`);
}
function pack(lockPath: string, tag: string, version: string, output: string): void {
  assert(/^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(tag), 'Invalid asset tag');
  const source = join(ROOT, 'public/factorio');
  const names = requiredFiles(source);
  mkdirSync(output, { recursive: true });
  const archive = join(output, 'factorio-runtime.tar.gz');
  archiveFiles(source, names, archive);
  const lock: AssetLock = {
    schema: 1, repository: 'joshcazalas/website-assets', tag, archive: 'factorio-runtime.tar.gz',
    ...fileDigest(archive), factorio_version: version,
    inputs: Object.fromEntries(INPUTS.map(name => [name, fileDigest(join(ROOT, name)).sha256])),
    files: Object.fromEntries(names.map(name => [name, fileDigest(join(source, name))])),
  };
  writeJson(lockPath, lock); writeJson(join(output, 'assets.lock.json'), lock);
  console.log(`Packed ${names.length} runtime files into ${archive} (${lock.size.toLocaleString()} bytes)`);
}
type AssetRelease = { draft: boolean; prerelease: boolean; immutable: boolean; assets: { id: number; name: string; size: number; digest: string }[] };
function fetchAssets(lock: AssetLock, localArchive?: string): void {
  checkInputs(lock);
  const destination = join(ROOT, 'public/factorio');
  mkdirSync(destination, { recursive: true });
  const work = mkdtempSync(join(ROOT, 'public/.factorio-stage-'));
  try {
    const archive = localArchive ? resolve(localArchive) : join(work, 'assets.tar.gz');
    if (!localArchive) {
      assert.equal(lock.repository, 'joshcazalas/website-assets', 'Unexpected asset repository');
      assert(/^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(lock.tag), 'Invalid asset tag');
      const release = JSON.parse(command('gh', 'api', `repos/${lock.repository}/releases/tags/${lock.tag}`)) as AssetRelease;
      assert(!release.draft && !release.prerelease && release.immutable, 'The asset release must be published and immutable');
      const matches = release.assets.filter(asset => asset.name === lock.archive);
      assert.equal(matches.length, 1, 'Missing asset archive');
      const asset = matches[0];
      assert.equal(asset.size, lock.size); assert.equal(asset.digest, `sha256:${lock.sha256}`);
      const fd = openSync(archive, 'wx');
      try { execFileSync('gh', ['api', '-H', 'Accept: application/octet-stream', `repos/${lock.repository}/releases/assets/${asset.id}`], { stdio: ['ignore', fd, 'inherit'] }); }
      finally { closeSync(fd); }
    }
    assert.deepEqual(fileDigest(archive), { sha256: lock.sha256, size: lock.size }, 'Asset archive checksum or size mismatch');
    const staged = join(work, 'files'); mkdirSync(staged);
    unpackVerified(archive, lock.files, staged); verifyInstalled(lock, staged);
    for (const name of Object.keys(lock.files)) {
      const target = join(destination, name); mkdirSync(dirname(target), { recursive: true });
      const parent = relative(realpathSync(destination), realpathSync(dirname(target)));
      assert(!parent.startsWith('..'), 'Asset destination escapes its root');
      renameSync(join(staged, name), target);
    }
    console.log(`Installed verified assets: ${lock.tag}`);
  } finally { rmSync(work, { recursive: true, force: true }); }
}
if (isMain(import.meta.url)) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    lock: { type: 'string', default: join(ROOT, 'assets.lock.json') },
    tag: { type: 'string' }, 'game-version': { type: 'string' }, archive: { type: 'string' },
    output: { type: 'string', default: join(ROOT, '.local/asset-packs') },
  }});
  const [action] = positionals;
  if (action === 'pack') {
    assert(values.tag && values['game-version'], 'pack requires --tag and --game-version');
    pack(values.lock, values.tag, values['game-version'], resolve(values.output));
  } else if (action === 'fetch') fetchAssets(readJson<AssetLock>(values.lock), values.archive);
  else if (action === 'verify') verifyInstalled(readJson<AssetLock>(values.lock), join(ROOT, 'public/factorio'));
  else throw new Error('Usage: node scripts/assets.ts pack|fetch|verify [options]');
}
