import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { ROOT, writeJson } from './lib/artifacts.ts';
import type { AssetLock } from './assets.ts';

test('only the game version, recipe and bytes from a completed import can be packed', async t => {
  const root = mkdtempSync(join(tmpdir(), 'website-import-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
  writeJson(join(root, 'package.json'), { type: 'module' });
  for (const file of ['scripts/import-local.ts', 'scripts/import-assets.ts', 'scripts/assets.ts', 'scripts/lib/artifacts.ts']) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(ROOT, file), join(root, file));
  }

  const game = join(root, 'game');
  const version = '2.0.77';
  writeJson(join(root, 'assets.lock.json'), { factorio_version: version });
  writeJson(join(game, 'data/base/info.json'), { version });
  const graphics = join(game, 'data/base/graphics');
  const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: 'blue' } }).png().toBuffer();
  const icons = ['iron-plate', 'iron-gear-wheel', 'processing-unit', 'programmable-speaker'];
  mkdirSync(join(graphics, 'icons'), { recursive: true });
  for (const icon of icons) writeFileSync(join(graphics, 'icons', icon + '.png'), png);
  const logo = join(graphics, 'entity/factorio-logo/factorio-logo-22tiles.png');
  mkdirSync(dirname(logo), { recursive: true });
  writeFileSync(logo, png);
  const fonts = join(game, 'data/core/fonts');
  mkdirSync(fonts, { recursive: true });
  for (const font of ['NotoSans-Regular', 'NotoSans-Bold', 'NotoMono-Regular']) writeFileSync(join(fonts, font + '.ttf'), font);

  const catalog = join(root, 'src/asset-catalog.json');
  writeJson(catalog, Object.fromEntries(icons.map(icon => [icon, { file: 'icons/' + icon + '.png', w: 4, h: 4 }])));
  writeJson(join(root, 'src/auxide-samples.json'), {});
  const pack = ['scripts/assets.ts', 'pack', '--tag', 'test-pack', '--game-version'];
  const rejectPack = (expectedVersion: string, reason: RegExp) => {
    const result = spawnSync(process.execPath, [...pack, expectedVersion], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, reason);
  };

  execFileSync(process.execPath, ['scripts/import-local.ts', '--menu-only', game], { cwd: root });
  rejectPack(version, /full npm run assets:import/);
  execFileSync(process.execPath, ['scripts/import-local.ts', game], { cwd: root });
  rejectPack('1.0.0', /version differs/);
  execFileSync(process.execPath, [...pack, version], { cwd: root });
  const lock = JSON.parse(readFileSync(join(root, 'assets.lock.json'), 'utf8')) as AssetLock;
  assert.equal(lock.factorio_version, version);
  assert(Object.hasOwn(lock.files, 'packed/atlas-0.png'));

  writeFileSync(join(root, 'public/factorio/icons/iron-plate.png'), 'stale');
  rejectPack(version, /Asset differs from the lock/);
  writeFileSync(catalog, '\n', { flag: 'a' });
  rejectPack(version, /asset-catalog.json changed/);
});
