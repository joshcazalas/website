import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { INPUTS, receiptPath, requiredFiles, type ImportReceipt } from './assets.ts';
import { fileDigest, ROOT, writeJson } from './lib/artifacts.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'menu-only': { type: 'boolean' }, 'game-version': { type: 'string' } },
});
assert(positionals.length <= 1, 'Supply a single Factorio installation directory');
const candidates = positionals.length ? positionals : [
  process.env.FACTORIO_PATH,
  '/mnt/c/Program Files (x86)/Steam/steamapps/common/Factorio',
  join(homedir(), '.local/share/Steam/steamapps/common/Factorio'),
];
const installation = candidates.find(path => path && existsSync(join(path, 'data/base/graphics')));
assert(installation, 'Factorio installation missing. Pass its directory to npm run assets:import or run npm run assets:fetch.');

const lock = JSON.parse(readFileSync(new URL('../assets.lock.json', import.meta.url), 'utf8'));
const game = JSON.parse(readFileSync(join(installation, 'data/base/info.json'), 'utf8'));
const expectedVersion = values['game-version'] ?? lock.factorio_version;
assert.equal(game.version, expectedVersion,
  `Found Factorio ${game.version} at ${installation}. Install Factorio ${expectedVersion} or run npm run assets:fetch for the pinned pack.`);

const recipe = 'scripts/import-assets.ts';
if (values['menu-only']) {
  execFileSync(process.execPath, [join(ROOT, recipe), resolve(installation), '--menu-only'], { stdio: 'inherit' });
} else {
  mkdirSync(dirname(receiptPath), { recursive: true });
  const work = mkdtempSync(join(dirname(receiptPath), 'import-'));
  try {
    // The generator resolves its catalog and output relative to its script.
    // Run the exact snapshotted inputs in a clean tree so old outputs cannot enter a receipt.
    for (const name of INPUTS) {
      mkdirSync(dirname(join(work, name)), { recursive: true });
      copyFileSync(join(ROOT, name), join(work, name));
    }
    execFileSync(process.execPath, [join(work, recipe), resolve(installation)], { stdio: 'inherit' });
    const generated = join(work, 'public/factorio');
    const receipt: ImportReceipt = {
      schema: 1,
      factorio_version: game.version,
      inputs: Object.fromEntries(INPUTS.map(name => [name, fileDigest(join(work, name)).sha256])),
      files: Object.fromEntries(requiredFiles(generated, work).map(name => [name, fileDigest(join(generated, name))])),
    };
    cpSync(generated, join(ROOT, 'public/factorio'), { recursive: true });
    const stagedReceipt = join(work, 'receipt.json');
    writeJson(stagedReceipt, receipt);
    renameSync(stagedReceipt, receiptPath);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
