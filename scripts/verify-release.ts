// This runs in the publisher without installing or executing npm dependencies.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type ReleaseManifest = {
  repository: string; source_ref: string; commit: string; tag: string;
  files: Record<string, { size: number; sha256: string }>;
};
const root = 'release';
const expected = ['website.tar.gz', 'manifest.json', 'site-inventory.json', 'asset-inventory.json', 'sbom-runtime.cdx.json', 'sbom-build.cdx.json', 'SHA256SUMS'].sort();
assert.deepEqual(readdirSync(root).sort(), expected, 'Unexpected release files');
for (const name of expected) assert(lstatSync(join(root, name)).isFile(), `Expected regular release file: ${name}`);
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as ReleaseManifest;
assert.equal(manifest.repository, 'joshcazalas/website');
assert.equal(manifest.source_ref, 'refs/heads/main');
assert.equal(manifest.commit, process.env.EXPECTED_COMMIT);
assert.equal(manifest.tag, process.env.EXPECTED_TAG);
assert.deepEqual(Object.keys(manifest.files).sort(), expected.filter(name => name !== 'manifest.json' && name !== 'SHA256SUMS'));
const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex');
for (const [name, info] of Object.entries(manifest.files)) {
  const data = readFileSync(join(root, name));
  assert.equal(data.length, info.size, `Incorrect size: ${name}`);
  assert.equal(sha256(data), info.sha256, `Incorrect checksum: ${name}`);
}
const lines = readFileSync(join(root, 'SHA256SUMS'), 'utf8').trimEnd().split('\n');
assert.equal(lines.length, expected.length - 1);
const checksums = new Map(lines.map(line => {
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
  assert(match, 'Invalid SHA256SUMS entry');
  return [match[2], match[1]];
}));
assert.deepEqual([...checksums.keys()].sort(), expected.filter(name => name !== 'SHA256SUMS'));
for (const [name, checksum] of checksums) assert.equal(sha256(readFileSync(join(root, name))), checksum, `Incorrect checksum: ${name}`);
console.log(`Verified release ${manifest.tag} for ${manifest.commit}`);
