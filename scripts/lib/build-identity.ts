import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export function buildIdentity() {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert(/^[0-9a-f]{40}$/.test(commit), 'A production build requires a source commit');
  return { schema: 1, commit, assetBase: `/releases/${commit}/` };
}
