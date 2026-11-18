import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

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

const recipe = fileURLToPath(new URL('./import-assets.ts', import.meta.url));
execFileSync(process.execPath, [recipe, resolve(installation), ...(values['menu-only'] ? ['--menu-only'] : [])], { stdio: 'inherit' });
