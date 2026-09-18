import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  publicDir: command === 'build' ? '.local/build-public' : 'public',
}));
