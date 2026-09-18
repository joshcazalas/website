import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, readJson, writeJson } from './lib/artifacts.ts';
import { buildIdentity } from './lib/build-identity.ts';
import { verifyInstalled } from './assets.ts';
import type { AssetLock } from './assets.ts';

const lock = readJson<AssetLock>(join(ROOT, 'assets.lock.json'));
verifyInstalled(lock, join(ROOT, 'public/factorio'));
const output = join(ROOT, '.local/build-public');
rmSync(output, { recursive: true, force: true });
for (const name of Object.keys(lock.files)) {
  const destination = join(output, 'factorio', name);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(ROOT, 'public/factorio', name), destination);
}
mkdirSync(join(output, 'branding'), { recursive: true });
copyFileSync(join(ROOT, 'public/branding/josh-cazalas.png'), join(output, 'branding/josh-cazalas.png'));
writeJson(join(output, 'release.json'), buildIdentity());
console.log(`Staged ${Object.keys(lock.files).length} runtime assets and the nameplate`);
