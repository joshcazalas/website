import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import sharp, { type OverlayOptions } from 'sharp';
type AssetSpec = { file: string; w: number; h: number; rows?: number; frames?: number; cols?: number; step?: number; train?: boolean; x?: number; y?: number };
type PackedAsset = { scale: number; frames: ({ page: number; x: number; y: number; w: number; h: number } | null)[] };
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const menuOnly = args.includes('--menu-only');
const candidates = [args.find(arg => !arg.startsWith('--')), process.env.FACTORIO_PATH,
  '/mnt/c/Program Files (x86)/Steam/steamapps/common/Factorio',
  `${process.env.HOME}/.local/share/Steam/steamapps/common/Factorio`].filter((value): value is string => !!value);
let installation;
for (const candidate of candidates) {
  try { await access(join(candidate, 'data/base/graphics')); installation = candidate; break; } catch {}
}
if (!installation) {
  console.error('Factorio not found. Run npm run assets:import -- "/path/to/Factorio"');
  process.exit(1);
}
// The in-world title logo stays alongside the other ignored game assets.
const menuDirectory = join(root, 'public/factorio/menu');
await mkdir(menuDirectory, { recursive: true });
await copyFile(join(installation, 'data/base/graphics/entity/factorio-logo/factorio-logo-22tiles.png'), join(menuDirectory, 'logo.png'));
if (menuOnly) { console.log('Imported the in-world Factorio menu logo.'); process.exit(0); }
const catalog: Record<string, AssetSpec> = JSON.parse(await readFile(join(root, 'src/asset-catalog.json'), 'utf8'));
for (const { file } of Object.values(catalog)) {
  const destination = join(root, 'public/factorio', file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(installation, 'data/base/graphics', file), destination);
}
// Pack only the frames we use, at their in-world resolution. Keeping the factory
// on a handful of textures avoids thousands of GPU texture switches per frame.
const pieces = [];
const manifest: Record<string, PackedAsset> = {};
const graphics = join(installation, 'data/base/graphics');
for (const [name, spec] of Object.entries(catalog)) {
  const scale = ['grass', 'dirt', 'concrete', 'refined'].includes(name) ? 1 : 0.5;
  manifest[name] = { scale, frames: [] };
  for (let row = 0; row < (spec.rows ?? 1); row++) {
    for (let i = 0; i < (spec.frames ?? 1); i++) {
      const columns = spec.cols ?? 1;
      const sample = i * (spec.step ?? 1);
      const train = spec.train;
      const frame = train ? sample % 32 : sample;
      const file = train ? spec.file.replace('-3.png', `-${Math.floor(sample / 32) + 1}.png`) : spec.file;
      const buffer = await sharp(join(graphics, file)).extract({
        left: (spec.x ?? 0) + (frame % columns) * spec.w,
        top: (spec.y ?? 0) + (row + Math.floor(frame / columns)) * spec.h,
        width: spec.w, height: spec.h
      }).resize(Math.round(spec.w * scale), Math.round(spec.h * scale)).png().toBuffer();
      pieces.push({ name, index: manifest[name].frames.length, buffer, w: Math.round(spec.w * scale), h: Math.round(spec.h * scale) });
      manifest[name].frames.push(null);
    }
  }
}
pieces.sort((a, b) => b.h - a.h || b.w - a.w);
const size = 2048;
let page = 0, x = 2, y = 2, rowHeight = 0;
let composite: OverlayOptions[] = [];
const destination = join(root, 'public/factorio/packed');
await mkdir(destination, { recursive: true });
async function flush() {
  if (!composite.length) return;
  await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
    .composite(composite).png().toFile(join(destination, `atlas-${page}.png`));
}
for (const piece of pieces) {
  if (x + piece.w + 2 > size) { x = 2; y += rowHeight + 4; rowHeight = 0; }
  if (y + piece.h + 2 > size) { await flush(); page++; x = 2; y = 2; rowHeight = 0; composite = []; }
  composite.push({ input: piece.buffer, left: x, top: y });
  manifest[piece.name].frames[piece.index] = { page, x, y, w: piece.w, h: piece.h };
  x += piece.w + 4; rowHeight = Math.max(rowHeight, piece.h);
}
await flush();
await writeFile(join(destination, 'manifest.json'), JSON.stringify({ pages: page + 1, assets: manifest }));
const samples: Record<string, string> = JSON.parse(await readFile(join(root, 'src/auxide-samples.json'), 'utf8'));
const soundDirectory = 'sound/programmable-speaker';
await mkdir(join(root, 'public/factorio', soundDirectory), { recursive: true });
for (const file of Object.values(samples)) {
  await copyFile(join(installation, 'data/base', soundDirectory, file), join(root, 'public/factorio', soundDirectory, file));
}
await mkdir(join(root, 'public/factorio/fonts'), { recursive: true });
for (const font of ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoMono-Regular.ttf']) {
  await copyFile(join(installation, 'data/core/fonts', font), join(root, 'public/factorio/fonts', font));
}
console.log(`Imported ${Object.keys(catalog).length} sprite definitions into ${page + 1} texture atlases, plus 3 fonts, ${Object.keys(samples).length} instrument samples, and the main-menu artwork.`);
console.log('Assets stay in the gitignored public/factorio directory. This is a local proof of concept.');
