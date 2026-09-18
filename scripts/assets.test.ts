import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { gzipSync } from 'node:zlib';
import { Header, type HeaderData } from 'tar';
import { archiveFiles, inventory, unpackVerified } from './lib/artifacts.ts';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'website-archive-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  mkdirSync(source);
  writeFileSync(join(source, 'sprite.png'), 'test sprite');
  return { root, source, expected: inventory(source) };
}

// Encode raw headers so even invalid paths reach the extraction validator unchanged.
function archive(path: string, members: (HeaderData & { data?: string })[]) {
  const blocks: Buffer[] = [];
  for (const { data = 'test sprite', ...member } of members) {
    const bytes = Buffer.from(member.type && member.type !== 'File' ? '' : data);
    const header = new Header({ mode: 0o644, type: 'File', size: bytes.length, ...member });
    header.encode();
    assert(header.block);
    blocks.push(header.block, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  writeFileSync(path, gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)])));
  return path;
}

test('archives are reproducible and round-trip with identical bytes', t => {
  const { root, source, expected } = fixture(t);
  const first = join(root, 'one.tar.gz'), second = join(root, 'two.tar.gz');
  archiveFiles(source, Object.keys(expected), first);
  utimesSync(join(source, 'sprite.png'), new Date(), new Date());
  archiveFiles(source, Object.keys(expected), second);
  assert.deepEqual(readFileSync(first), readFileSync(second));
  unpackVerified(first, expected, join(root, 'restored'));
  assert.deepEqual(inventory(join(root, 'restored')), expected);
});

test('archives reject traversal, absolute paths, and unlisted files', t => {
  const { root, expected } = fixture(t);
  for (const path of ['../sprite.png', '/sprite.png', 'extra.png', 'a/../sprite.png']) {
    assert.throws(() => unpackVerified(archive(join(root, 'bad.tar.gz'), [{ path }]), expected, join(root, 'out')), /Unexpected/);
  }
  assert(!existsSync(join(root, 'sprite.png')));
});

test('archives reject symbolic and hard links', t => {
  const { root, expected } = fixture(t);
  for (const type of ['SymbolicLink', 'Link'] as const) {
    assert.throws(() => unpackVerified(archive(join(root, 'bad.tar.gz'), [{ path: 'sprite.png', type, linkpath: '../outside' }]), expected, join(root, 'out')), /Unexpected/);
  }
});

test('archives reject corrupt or missing files', t => {
  const { root, expected } = fixture(t);
  assert.throws(() => unpackVerified(archive(join(root, 'bad.tar.gz'), [{ path: 'sprite.png', data: 'bad! sprite' }]), expected, join(root, 'out')), /checksum/);
  const incomplete = archive(join(root, 'incomplete.tar.gz'), [{ path: 'sprite.png' }]);
  assert.throws(() => unpackVerified(incomplete, { ...expected, 'missing.png': expected['sprite.png'] }, join(root, 'incomplete')), /Missing/);
  assert.throws(() => unpackVerified(archive(join(root, 'empty.tar.gz'), []), expected, join(root, 'out')));
});

test('archives reject duplicate members', t => {
  const { root, expected } = fixture(t);
  assert.throws(() => unpackVerified(archive(join(root, 'duplicates.tar.gz'), [{ path: 'sprite.png' }, { path: 'sprite.png' }]), expected, join(root, 'out')), /Unexpected/);
});
