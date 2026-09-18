import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { PAYLOADS, validateBundle, type BuildManifest } from './build-artifact.ts';
import { digest, inventory, writeJson } from './lib/artifacts.ts';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'website-build-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of PAYLOADS) writeFileSync(join(root, name), name);
  const commit = 'a'.repeat(40), lock = digest('dependency lock');
  const manifest: BuildManifest = { schema: 1, commit, lockfile_sha256: lock,
    toolchain: { node: 'v24.19.0', npm: '11.17.0' }, files: {}, payloads: inventory(root) };
  writeJson(join(root, 'build-manifest.json'), manifest);
  return { root, commit, lock };
}

test('shared builds must match the source commit and dependency lock', t => {
  const { root, commit, lock } = fixture(t);
  validateBundle(root, commit, lock);
  assert.throws(() => validateBundle(root, 'b'.repeat(40), lock), /source commit/);
  assert.throws(() => validateBundle(root, commit, digest('other lock')), /source commit/);
});

test('shared builds reject modified payloads', t => {
  const { root, commit, lock } = fixture(t);
  writeFileSync(join(root, 'dist.tar.gz'), 'modified build');
  assert.throws(() => validateBundle(root, commit, lock), /checksum mismatch/);
});

test('shared builds reject unexpected files and symlinks', t => {
  const { root, commit, lock } = fixture(t);
  writeFileSync(join(root, 'extra'), '');
  assert.throws(() => validateBundle(root, commit, lock), /Unexpected files/);
  unlinkSync(join(root, 'extra'));
  unlinkSync(join(root, 'dist.tar.gz'));
  symlinkSync(join(root, 'sbom-runtime.cdx.json'), join(root, 'dist.tar.gz'));
  assert.throws(() => validateBundle(root, commit, lock), /regular file/);
});
