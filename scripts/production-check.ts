import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const suites: Record<string, string> = {
  home: 'browser-check.ts',
  menu: 'menu-check.ts',
  foundation: 'outpost-check.ts',
  auxide: 'auxide-check.ts',
  caz: 'caz-check.ts',
};
const requested = process.argv.slice(2);
const selected = requested.length ? requested : Object.keys(suites);
if (selected.some(name => !suites[name])) throw new Error('Unknown browser suite');
const port = process.env.TEST_PORT || '4173';
const url = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
let serverExited = false;
server.once('exit', () => { serverExited = true; });
server.stdout.pipe(process.stdout);
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverExited) throw new Error('Production preview failed to start');
    try { ready = (await fetch(url)).ok; } catch { /* wait for listener */ }
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw new Error('Production preview did not become ready');
  for (const name of selected) {
    console.log(`Running production browser suite: ${name}`);
    const env: NodeJS.ProcessEnv = { ...process.env, TEST_URL: url };
    // Local screenshot-only options must never weaken the CI gate.
    delete env.VISUAL_ONLY;
    delete env.MOBILE_ONLY;
    const child = spawn(process.execPath, [`scripts/${suites[name]}`], { stdio: 'inherit', env });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 8 * 60 * 1000);
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    }).finally(() => clearTimeout(timeout));
    if (code !== 0) throw new Error(`${name} browser suite failed (${code})`);
  }
} finally {
  if (!serverExited) {
    const stopped = new Promise(resolve => server.once('exit', resolve));
    server.kill('SIGTERM');
    await stopped;
  }
}
