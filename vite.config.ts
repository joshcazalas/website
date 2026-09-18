import { defineConfig } from 'vite';
import { buildIdentity } from './scripts/lib/build-identity.ts';
import { readFileSync } from 'node:fs';

export default defineConfig(({ command, isPreview }) => ({
  base: isPreview
    ? (JSON.parse(readFileSync('dist/release.json', 'utf8')) as { assetBase: string }).assetBase
    : command === 'build' ? buildIdentity().assetBase : '/',
  publicDir: command === 'build' ? '.local/build-public' : 'public',
}));
