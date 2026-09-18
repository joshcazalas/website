import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { archiveFiles, command, fileDigest, inventory, readJson, ROOT, unpackVerified, writeJson } from './lib/artifacts.ts';
import type { CycloneDx } from './lib/artifacts.ts';
import type { AssetLock } from './assets.ts';
import { validateBundle } from './build-artifact.ts';

// UUIDv5 with the standard URL namespace gives each commit/scope a stable SBOM ID.
function sbomId(value: string): string {
  const id = createHash('sha1').update(Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex')).update(value).digest().subarray(0, 16);
  id[6] = (id[6] & 0x0f) | 0x50; id[8] = (id[8] & 0x3f) | 0x80;
  const hex = id.toString('hex');
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const { values } = parseArgs({ options: { 'build-artifact': { type: 'string' } } });
const commit = command('git', 'rev-parse', 'HEAD');
assert(/^[0-9a-f]{40}$/.test(commit), 'Invalid source commit');
assert.equal(command('git', 'status', '--porcelain', '--untracked-files=no'), '', 'Commit the build inputs before packaging a release');
const timestamp = new Date(command('git', 'show', '-s', '--format=%cI', commit)).toISOString();
const tag = `website-${timestamp.slice(0, 10).replaceAll('-', '.')}-g${commit.slice(0, 12)}`;
const directory = join(ROOT, '.local/releases', tag);
mkdirSync(directory, { recursive: true });
assert.equal(readdirSync(directory).length, 0, 'Release directory must be empty');
const lock = readJson<AssetLock>(join(ROOT, 'assets.lock.json'));
const files = inventory(join(ROOT, 'dist'));
const lockDigest = fileDigest(join(ROOT, 'package-lock.json')).sha256;
const buildDirectory = values['build-artifact'] ? resolve(values['build-artifact']) : undefined;
const buildManifest = buildDirectory ? validateBundle(buildDirectory, commit, lockDigest) : undefined;
if (buildManifest) assert.deepEqual(files, buildManifest.files, 'Release files differ from the build tested in CI');
assert('index.html' in files && Object.keys(files).some(name => name.startsWith('assets/') && name.endsWith('.js')), 'Missing production build');
const expectedAssets = Object.fromEntries(Object.entries(lock.files).map(([name, info]) => [`factorio/${name}`, info]));
assert.deepEqual(Object.fromEntries(Object.entries(files).filter(([name]) => name.startsWith('factorio/'))), expectedAssets, 'Production assets differ from the pinned pack');
for (const name of Object.keys(files)) assert(name === 'index.html' || name === 'branding/josh-cazalas.png' || name in expectedAssets || /^assets\/[^/]+\.(js|css)$/.test(name), `Unexpected deployable file: ${name}`);
const site = join(directory, 'website.tar.gz');
archiveFiles(join(ROOT, 'dist'), Object.keys(files), site);
const staging = mkdtempSync(join(tmpdir(), 'website-release-'));
try { unpackVerified(site, files, staging); assert.deepEqual(inventory(staging), files, 'Packaged site differs from tested build'); }
finally { rmSync(staging, { recursive: true, force: true }); }
writeJson(join(directory, 'site-inventory.json'), files);
writeJson(join(directory, 'asset-inventory.json'), lock);
for (const scope of ['runtime', 'build'] as const) {
  const sbom = buildDirectory ? readJson<CycloneDx>(join(buildDirectory, `sbom-${scope}.cdx.json`))
    : JSON.parse(command('npm', 'sbom', '--sbom-format', 'cyclonedx', ...(scope === 'runtime' ? ['--omit', 'dev'] : []))) as CycloneDx;
  assert.equal(sbom.bomFormat, 'CycloneDX');
  sbom.serialNumber = sbomId(`https://github.com/joshcazalas/website/${commit}/${scope}`);
  sbom.metadata.timestamp = timestamp;
  (sbom.metadata.properties ??= []).push({ name: 'website:inventory-scope', value: `${scope} npm dependency graph; media listed separately in asset-inventory.json` });
  writeJson(join(directory, `sbom-${scope}.cdx.json`), sbom);
}
writeJson(join(directory, 'manifest.json'), {
  schema: 1, repository: 'joshcazalas/website', tag, commit,
  source_ref: process.env.GITHUB_REF || command('git', 'symbolic-ref', 'HEAD'), source_date: timestamp,
  asset_pack: { repository: lock.repository, tag: lock.tag, sha256: lock.sha256, factorio_version: lock.factorio_version },
  toolchain: buildManifest?.toolchain ?? { node: command('node', '--version'), npm: command('npm', '--version') },
  lockfile_sha256: lockDigest, files: inventory(directory),
});
writeFileSync(join(directory, 'SHA256SUMS'), Object.entries(inventory(directory)).map(([name, info]) => `${info.sha256}  ${name}\n`).join(''));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\ndirectory=${relative(ROOT, directory)}\n`);
console.log(`Packaged ${tag}: ${fileDigest(site).size.toLocaleString()} bytes`);
