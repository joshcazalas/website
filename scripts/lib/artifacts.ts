import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tar from 'tar';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export type FileDigest = { sha256: string; size: number };
export type Inventory = Record<string, FileDigest>;
export type Toolchain = { node: string; npm: string };
export type CycloneDx = {
  bomFormat: 'CycloneDX'; specVersion: string; serialNumber?: string;
  metadata: { timestamp?: string; properties?: { name: string; value: string }[] };
};
export const digest = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
export const fileDigest = (path: string): FileDigest => {
  assert(lstatSync(path).isFile(), `Expected a regular file: ${path}`);
  const data = readFileSync(path);
  return { sha256: digest(data), size: data.length };
};
export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}
export const command = (...args: string[]): string => execFileSync(args[0], args.slice(1), { cwd: ROOT, encoding: 'utf8' }).trim();
export const isMain = (url: string): boolean => !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);

export function inventory(directory: string): Inventory {
  const result: Inventory = {};
  function walk(current: string): void {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      const stat = lstatSync(path);
      assert(!stat.isSymbolicLink(), `Symlinks are not allowed: ${path}`);
      if (stat.isDirectory()) walk(path);
      else {
        assert(stat.isFile(), `Expected a regular file: ${path}`);
        result[relative(directory, path).split('\\').join('/')] = fileDigest(path);
      }
    }
  }
  walk(directory);
  return result;
}

export function safePath(name: string): boolean {
  return !!name && !isAbsolute(name) && !name.includes('\\') && !name.split('/').includes('..') && posix.normalize(name) === name;
}

export function archiveFiles(directory: string, names: string[], output: string): void {
  const staging = mkdtempSync(join(tmpdir(), 'website-pack-'));
  try {
    for (const name of names) {
      assert(safePath(name), `Unsafe archive path: ${name}`);
      fileDigest(join(directory, name));
      const target = join(staging, name);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(directory, name), target);
      chmodSync(target, 0o644);
    }
    mkdirSync(dirname(output), { recursive: true });
    tar.create({ cwd: staging, file: output, sync: true, gzip: true, portable: true, mtime: new Date(0), noPax: true }, [...names].sort());
  } finally { rmSync(staging, { recursive: true, force: true }); }
}

/** Read entries ourselves so archive paths, links, and modes never control extraction. */
export function unpackVerified(archive: string, expected: Inventory, destination: string): void {
  const seen = new Set<string>();
  const completed = new Set<string>();
  tar.list({ file: archive, sync: true, strict: true, onReadEntry(entry) {
    const name = entry.path;
    assert(entry.type === 'File' && safePath(name) && Object.hasOwn(expected, name) && !seen.has(name), `Unexpected archive member: ${name}`);
    assert.equal(entry.size, expected[name].size, `Incorrect file size: ${name}`);
    seen.add(name);
    const chunks: Buffer[] = [];
    entry.on('data', (chunk: Buffer) => chunks.push(chunk));
    entry.on('end', () => {
      const data = Buffer.concat(chunks);
      assert.deepEqual({ sha256: digest(data), size: data.length }, expected[name], `Incorrect file checksum: ${name}`);
      const target = join(destination, name);
      mkdirSync(dirname(target), { recursive: true });
      // Callers supply a freshly-created staging directory.
      writeFileSync(target, data, { flag: 'wx', mode: 0o644 });
      completed.add(name);
    });
  }});
  assert.deepEqual([...completed].sort(), Object.keys(expected).sort(), 'Missing archive members');
}
