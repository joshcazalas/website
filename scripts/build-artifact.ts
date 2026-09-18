import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { archiveFiles, command, fileDigest, inventory, isMain, readJson, ROOT, unpackVerified, writeJson } from './lib/artifacts.ts';
import type { CycloneDx, Inventory, Toolchain } from './lib/artifacts.ts';

export const PAYLOADS = ['dist.tar.gz', 'sbom-runtime.cdx.json', 'sbom-build.cdx.json'];
export type BuildManifest = { schema: 1; commit: string; lockfile_sha256: string; toolchain: Toolchain; files: Inventory; payloads: Inventory };
export function validateBundle(directory: string, commit: string, lockDigest: string): BuildManifest {
  const manifest = readJson<BuildManifest>(join(directory, 'build-manifest.json'));
  assert(manifest.schema === 1 && manifest.commit === commit && manifest.lockfile_sha256 === lockDigest, 'Build artifact does not match this source commit and dependency lock');
  assert.deepEqual(Object.keys(manifest.payloads).sort(), [...PAYLOADS].sort(), 'Unexpected build artifact payloads');
  assert.deepEqual(readdirSync(directory).sort(), [...PAYLOADS, 'build-manifest.json'].sort(), 'Unexpected files in the build artifact');
  for (const [name, expected] of Object.entries(manifest.payloads)) assert.deepEqual(fileDigest(join(directory, name)), expected, `Build artifact checksum mismatch: ${name}`);
  return manifest;
}
function create(directory: string): void {
  mkdirSync(directory, { recursive: true });
  assert.equal(readdirSync(directory).length, 0, 'Build artifact directory must be empty');
  const files = inventory(join(ROOT, 'dist'));
  assert('index.html' in files, 'Missing production build');
  archiveFiles(join(ROOT, 'dist'), Object.keys(files), join(directory, 'dist.tar.gz'));
  for (const scope of ['runtime', 'build'] as const) {
    const flags = scope === 'runtime' ? ['--omit', 'dev'] : [];
    const sbom = JSON.parse(command('npm', 'sbom', '--sbom-format', 'cyclonedx', ...flags)) as CycloneDx;
    writeJson(join(directory, `sbom-${scope}.cdx.json`), sbom);
  }
  const manifest: BuildManifest = {
    schema: 1, commit: command('git', 'rev-parse', 'HEAD'),
    lockfile_sha256: fileDigest(join(ROOT, 'package-lock.json')).sha256,
    toolchain: { node: command('node', '--version'), npm: command('npm', '--version') },
    files, payloads: inventory(directory),
  };
  writeJson(join(directory, 'build-manifest.json'), manifest);
  console.log(`Created shared production build with ${Object.keys(files).length} files`);
}
if (isMain(import.meta.url)) {
  const { values, positionals: [action] } = parseArgs({ allowPositionals: true, options: {
    directory: { type: 'string', default: join(ROOT, '.local/ci-build') },
  }});
  const directory = resolve(values.directory);
  if (action === 'create') create(directory);
  else {
    assert(action === 'restore' || action === 'verify', 'Usage: node scripts/build-artifact.ts create|restore|verify');
    const manifest = validateBundle(directory, command('git', 'rev-parse', 'HEAD'), fileDigest(join(ROOT, 'package-lock.json')).sha256);
    if (action === 'restore') {
      const staging = mkdtempSync(join(tmpdir(), 'website-build-'));
      try {
        unpackVerified(join(directory, 'dist.tar.gz'), manifest.files, staging);
        rmSync(join(ROOT, 'dist'), { recursive: true, force: true });
        cpSync(staging, join(ROOT, 'dist'), { recursive: true });
      } finally { rmSync(staging, { recursive: true, force: true }); }
    }
    assert.deepEqual(inventory(join(ROOT, 'dist')), manifest.files, 'Production files differ from the shared build');
    console.log(`Verified shared build for ${manifest.commit}`);
  }
}
