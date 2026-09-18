import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import { digest, ROOT } from './lib/artifacts.ts';

const tools = {
  gitleaks: {
    url: 'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz',
    sha256: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
  },
  actionlint: {
    url: 'https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz',
    sha256: '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
  },
};
const destination = join(ROOT, '.local/tools'); mkdirSync(destination, { recursive: true });
for (const [name, tool] of Object.entries(tools)) {
  const response = await fetch(tool.url, { signal: AbortSignal.timeout(60_000) });
  assert(response.ok, `Unable to download ${name}: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal(digest(data), tool.sha256, `${name} archive checksum mismatch`);
  const staging = mkdtempSync(join(tmpdir(), 'website-tools-'));
  try {
    const archive = join(staging, 'tool.tar.gz'); writeFileSync(archive, data);
    let count = 0;
    tar.list({ file: archive, sync: true, strict: true, onReadEntry(entry) {
      if (entry.path !== name) return;
      assert.equal(entry.type, 'File'); assert.equal(++count, 1, `Duplicate ${name} entry`);
      const chunks: Buffer[] = [];
      entry.on('data', (chunk: Buffer) => chunks.push(chunk));
      entry.on('end', () => { writeFileSync(join(destination, name), Buffer.concat(chunks)); chmodSync(join(destination, name), 0o755); });
    }});
    assert.equal(count, 1, `Missing ${name} binary`);
  } finally { rmSync(staging, { recursive: true, force: true }); }
  console.log(`Installed verified ${name}`);
}
