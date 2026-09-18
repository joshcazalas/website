import { Application } from 'pixi.js';
import { Camera } from './camera';
import { Factory, WORLD, PLAZA, type Destination } from './factory';
import { FoundationOutpost } from './foundation-outpost';
import { ProjectPanel, projectMarkup } from './project-panel';
import { AuxideOutpost } from './auxide-outpost';
import { AuxidePlayback, SERVERS } from './auxide-playback';
import { AuxideAudio } from './auxide-audio';
import { AuxidePanel, auxideMarkup } from './auxide-panel';
import { CazOutpost } from './caz-outpost';
import { CazPanel, cazMarkup } from './caz-panel';
import { CazRelease } from './caz-release';
import './style.css';

const appElement = document.querySelector<HTMLDivElement>('#app')!;
appElement.innerHTML = `
  <main id="map" aria-label="Josh Cazalas's factory"><h1 class="sr-only">Josh Cazalas — platform engineer and systems builder in Austin, Texas.</h1></main>
  <div id="world-links" aria-label="Contact Josh"></div>
  <header class="topbar">
    <button class="identity" data-go="home" aria-label="Return to Josh's nameplate"><span class="status-light"></span><span>JOSH CAZALAS<small>PERSONAL FACTORY</small></span></button>
    <div class="view-label"><span class="crosshair">⌖</span> REMOTE VIEW <span class="tag">NAUVIS</span></div>
    <nav aria-label="Portfolio"><button id="projects-open" class="panel-button" aria-haspopup="dialog">Projects <span>→</span></button><button id="about-open" class="panel-button">About <span>↗</span></button></nav>
  </header>
  <aside class="map-panel" aria-label="Factory overview">
    <div class="panel-heading"><span>Surface map</span><button class="mini-reset" data-go="overview" aria-label="Show entire factory">⛶</button></div>
    <canvas id="minimap" width="224" height="174" aria-label="Click to navigate the factory" role="img"></canvas>
    <div class="map-coordinates"><span id="coordinates">120, 50</span><span id="zoom-readout">40%</span></div>
  </aside>
  <div class="zoom-controls" aria-label="Camera controls">
    <button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button><button data-go="home" aria-label="Return home" title="Return home (H)">⌂</button>
  </div>
  <footer class="bottom-hud">
    <div class="hint"><span class="mouse-icon"></span><span>Drag to explore<span class="hint-divider"> / </span>Scroll to zoom</span><span class="keyboard-hint"><kbd>W A S D</kbd> move <kbd>M</kbd> map</span></div>
    <div class="quickbar" role="navigation" aria-label="Factory locations">
      <button class="slot active" data-go="home" title="Home (H)"><span class="slot-key">1</span><img src="/factorio/icons/iron-plate.png" alt=""/><span>Home</span></button>
      <button class="slot" data-go="factory" title="Production"><span class="slot-key">2</span><img src="/factorio/icons/electronic-circuit.png" alt=""/><span>Production</span></button>
      <button class="slot" data-go="power" title="Power grid"><span class="slot-key">3</span><img src="/factorio/icons/processing-unit.png" alt=""/><span>Power</span></button>
      <button class="slot" data-go="research" title="Research"><span class="slot-key">4</span><img src="/factorio/icons/chemical-science-pack.png" alt=""/><span>Research</span></button>
      <button class="slot outpost-only" data-go="aws-foundation" title="Frame the AWS Foundation outpost"><img src="/factorio/icons/processing-unit.png" alt=""/><span>Build site</span></button>
      <button class="slot outpost-only" data-go="auxide" title="Frame the Auxide outpost"><span class="speaker-icon" aria-hidden="true"></span><span>Auxide</span></button>
      <button class="slot outpost-only" data-go="caz-nix" title="Frame the caz.nix homelab"><img src="/factorio/icons/iron-gear-wheel.png" alt=""/><span>caz.nix</span></button>
      <span class="slot-separator"></span>
      <button class="slot action" id="pause" aria-label="Pause factory animation" aria-pressed="false"><span class="pause-icon">Ⅱ</span><span>Pause</span></button>
    </div>
    <div class="factory-status"><span class="status-light"></span><span id="factory-status">Factory running</span><span class="status-secondary">There is always more to build.</span></div>
  </footer>
  <section id="loading" role="status" aria-live="polite"><div class="loading-box"><span class="eyebrow">JOSHCAZALAS.COM</span><h1>Bringing the factory online.</h1><p>Connecting belts, machines, and a few things about me.</p><div class="progress"><div id="progress-fill"></div></div><span id="load-percent">0%</span></div></section>
  <dialog id="dossier" aria-labelledby="dossier-title">
    <div class="dialog-title"><span>Engineer dossier</span><button id="about-close" aria-label="Close about and projects">×</button></div>
    <div class="dossier-body"><div class="eyebrow">AUSTIN, TEXAS / PLATFORM ENGINEERING</div><h1 id="dossier-title">Hi, I'm Josh.</h1>
      <p class="intro">I build systems that help people build things.</p>
      <p>I'm a platform engineer specializing in data infrastructure. I like making complicated systems understandable, repeatable, and easier for other people to work with. Outside work, that usually means my homelab, a side project, or a very large Factorio factory.</p>
      <h2>A few things I've built</h2>
      <a class="project" href="#aws-foundation"><img src="/factorio/icons/processing-unit.png" alt=""/><span><strong>AWS Foundation <b>→</b></strong><small>A personal multi-account AWS foundation. Identity, delivery, policy, and isolated state. Visit its construction outpost.</small><em>OPENTOFU / AWS / GITHUB ACTIONS</em></span></a>
      <a class="project" href="#auxide"><span class="speaker-icon" aria-hidden="true"></span><span><strong>Auxide <b>→</b></strong><small>A self-hosted Discord music bot with independent playback actors, bounded queues, and operational visibility. Visit its music outpost.</small><em>RUST / TOKIO / NIX</em></span></a>
      <a class="project" href="#caz-nix"><img src="/factorio/icons/iron-gear-wheel.png" alt=""/><span><strong>caz.nix <b>→</b></strong><small>My home server and development environment, with reproducible configuration, monitoring, backups, and rollback. Visit its homelab outpost.</small><em>NIXOS / LINUX / OBSERVABILITY</em></span></a>
      <div class="dossier-contact"><a href="mailto:joshuacazalas@gmail.com">Email me ↗</a><a href="https://github.com/joshcazalas" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href="https://www.linkedin.com/in/joshcazalas/" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></div>
      <p class="colophon">A personal experiment inspired by my favorite game. Factory artwork © Wube Software. Local proof of concept.</p>
    </div>
  </dialog>
  ${projectMarkup}
  ${auxideMarkup}
  ${cazMarkup}
  <noscript>This factory needs JavaScript. Josh Cazalas — platform engineer in Austin. Email: joshuacazalas@gmail.com.</noscript>
`;

const dossier = document.querySelector<HTMLDialogElement>('#dossier')!;
document.querySelector('#about-open')!.addEventListener('click', () => dossier.showModal());
document.querySelector('#about-close')!.addEventListener('click', () => dossier.close());
dossier.addEventListener('click', (event) => { if (event.target === dossier) { const r = dossier.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dossier.close(); } });
const projects = document.querySelector<HTMLDialogElement>('#projects')!;
document.querySelector('#projects-open')!.addEventListener('click', () => projects.showModal());
document.querySelector('#projects-close')!.addEventListener('click', () => projects.close());
projects.addEventListener('click', event => {
  if (event.target !== projects) return;
  const r = projects.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) projects.close();
});

async function start() {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x3e4733, resolution: Math.min(devicePixelRatio, 2), autoDensity: true, antialias: false, preference: 'webgl' });
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.id = 'factory-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Factory map. Drag to pan, scroll to zoom, use arrow keys or WASD to move, H for home, M for overview.');
  document.querySelector('#map')!.appendChild(canvas);
  const factory = new Factory();
  await factory.load((fraction) => {
    document.querySelector<HTMLElement>('#progress-fill')!.style.width = `${Math.round(fraction * 100)}%`;
    document.querySelector('#load-percent')!.textContent = `${Math.round(fraction * 100)}%`;
  });
  app.stage.addChild(factory.root);
  const outpost = new FoundationOutpost();
  outpost.useAssets(factory);
  app.stage.addChild(outpost.root);
  const projectPanel = new ProjectPanel();
  const auxide = new AuxideOutpost();
  auxide.useAssets(factory);
  app.stage.addChild(auxide.root);
  const playback = new AuxidePlayback();
  const auxidePanel = new AuxidePanel();
  const caz = new CazOutpost();
  caz.useAssets(factory);
  app.stage.addChild(caz.root);
  const release = new CazRelease();
  const cazPanel = new CazPanel();
  let selectedServer = 0;
  const camera = new Camera(canvas);
  let destination: Destination = 'home';
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let elapsed = 9;
  let animationClock = performance.now();
  const currentClock = () => elapsed + (!paused && !document.hidden ? (performance.now()-animationClock)/1000 : 0);
  const audio = new AuxideAudio(() => destination === 'auxide' && !paused && !document.hidden ? playback.snapshot(selectedServer,currentClock()) : null);
  const updateMusicPanel = () => auxidePanel.update(playback.snapshots(currentClock()),selectedServer,paused,audio.state);
  const isProject = (target: Destination) => target === 'aws-foundation' || target === 'auxide' || target === 'caz-nix';
  const fromHash = (): Destination => location.hash === '#caz-nix' ? 'caz-nix' : location.hash === '#auxide' ? 'auxide' : location.hash === '#aws-foundation' ? 'aws-foundation' : 'home';
  camera.onDestination = target => {
    destination = target;
    const project = isProject(target);
    document.body.classList.toggle('project-view', project);
    document.body.dataset.project = project ? target : '';
    projectPanel.element.hidden = target !== 'aws-foundation';
    auxidePanel.element.hidden = target !== 'auxide';
    cazPanel.element.hidden = target !== 'caz-nix';
    if (target === 'caz-nix') cazPanel.update(release.snapshot(currentClock()),paused);
    if (target !== 'auxide') audio.disable();
    else updateMusicPanel();
    for (const panel of [projectPanel.element,auxidePanel.element,cazPanel.element]) if (panel.hidden && panel.contains(document.activeElement)) canvas.focus({ preventScroll: true });
    document.title = target === 'caz-nix' ? 'caz.nix — Josh Cazalas' : target === 'auxide' ? 'Auxide — Josh Cazalas' : project ? 'AWS Foundation — Josh Cazalas' : 'Josh Cazalas — Personal Factory';
    document.querySelector('.view-label .tag')!.textContent = target === 'caz-nix' ? 'OUTPOST 03' : target === 'auxide' ? 'OUTPOST 02' : project ? 'OUTPOST 01' : 'NAUVIS';
    document.querySelectorAll('.slot[data-go]').forEach(slot => slot.classList.toggle('active', (slot as HTMLElement).dataset.go === target));
    if (project && location.hash !== `#${target}`) history.pushState(null, '', `#${target}`);
    else if (!project && isProject(fromHash())) history.pushState(null, '', location.pathname + location.search);
  };
  window.addEventListener('hashchange', () => camera.go(fromHash()));
  document.querySelectorAll<HTMLAnchorElement>('a[href="#aws-foundation"],a[href="#auxide"],a[href="#caz-nix"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    dossier.close(); projects.close();
    const target = link.hash.slice(1) as 'auxide' | 'aws-foundation' | 'caz-nix';
    camera.go(target);
    document.querySelector<HTMLElement>(target === 'caz-nix' ? '#caz-title' : target === 'auxide' ? '#auxide-title' : '#foundation-title')!.focus({ preventScroll: true });
  }));
  camera.go(fromHash(), true);
  window.addEventListener('resize', () => {
    if (!isProject(destination)) return;
    camera.width = innerWidth; camera.height = innerHeight;
    camera.go(destination, true);
  });
  // Hidden tabs resume where they left off; visible slow frames retain real time.
  document.addEventListener('visibilitychange', () => { animationClock = performance.now(); if (document.hidden) audio.disable(); });
  window.addEventListener('pagehide', () => audio.disable());
  const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
  const setPause = () => {
    animationClock = performance.now();
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? 'Resume factory animation' : 'Pause factory animation');
    pauseButton.querySelector('.pause-icon')!.textContent = paused ? '▷' : 'Ⅱ';
    pauseButton.querySelector('span:last-child')!.textContent = paused ? 'Resume' : 'Pause';
    document.querySelector('#factory-status')!.textContent = paused ? 'Factory paused' : 'Factory running';
  };
  setPause();
  const togglePause = () => { elapsed = currentClock(); paused = !paused; setPause(); if (paused) audio.silence(); };
  pauseButton.addEventListener('click', togglePause);
  auxidePanel.element.querySelectorAll<HTMLButtonElement>('[data-server]').forEach(button => button.addEventListener('click', () => {
    selectedServer = Number(button.dataset.server); audio.silence(); updateMusicPanel();
    auxidePanel.announce(`Selected Server 0${selectedServer+1}, ${SERVERS[selectedServer].name}.`);
  }));
  document.querySelector('#auxide-toggle')!.addEventListener('click', () => {
    playback.toggle(selectedServer,currentClock()); audio.silence(); updateMusicPanel();
    auxidePanel.announce(`Server 0${selectedServer+1} ${playback.snapshot(selectedServer,currentClock()).playing ? 'resumed' : 'paused'}. The other servers keep their own playback state.`);
  });
  document.querySelector('#auxide-skip')!.addEventListener('click', () => {
    playback.skip(selectedServer,currentClock()); audio.silence(); updateMusicPanel();
    auxidePanel.announce(`Server 0${selectedServer+1}: ${playback.snapshot(selectedServer,currentClock()).title}.`);
  });
  document.querySelector('#auxide-sound')!.addEventListener('click', async () => {
    if (audio.enabled) audio.disable(); else { const enabling = audio.enable(); updateMusicPanel(); await enabling; }
    updateMusicPanel();
  });
  document.querySelector('#deploy-foundation')!.addEventListener('click', () => {
    outpost.deploy(elapsed, paused);
    projectPanel.update(outpost.state, paused);
  });
  document.querySelector('#finish-deployment')!.addEventListener('click', () => {
    outpost.finish(elapsed);
    projectPanel.update(outpost.state, paused);
    document.querySelector<HTMLButtonElement>('#deploy-foundation')!.focus();
  });
  document.querySelector('#caz-deploy')!.addEventListener('click', () => {
    release.start(currentClock(),document.querySelector<HTMLInputElement>('#caz-failure')!.checked,paused);
    cazPanel.update(release.snapshot(currentClock()),paused);
  });
  document.querySelector('#caz-finish')!.addEventListener('click', () => {
    release.finish(currentClock());
    cazPanel.update(release.snapshot(currentClock()),paused);
    document.querySelector<HTMLButtonElement>('#caz-deploy')!.focus();
  });
  document.querySelector('#zoom-in')!.addEventListener('click', () => camera.zoomAt(1.4));
  document.querySelector('#zoom-out')!.addEventListener('click', () => camera.zoomAt(1 / 1.4));
  document.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(button => button.addEventListener('click', () => {
    camera.go(button.dataset.go as Destination);
    document.querySelectorAll('.slot[data-go]').forEach(slot => slot.classList.toggle('active', (slot as HTMLElement).dataset.go === button.dataset.go));
  }));
  window.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || event.target instanceof HTMLElement && event.target.closest('button,a,input,summary')) return;
    const destination = ['home', 'factory', 'power', 'research'][Number(event.key) - 1];
    if (destination) document.querySelector<HTMLButtonElement>(`.slot[data-go="${destination}"]`)?.click();
    if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  });
  const links = factory.contacts.map(contact => {
    const link = document.createElement('a');
    link.className = 'world-link';
    link.href = contact.href;
    link.setAttribute('aria-label', contact.label);
    link.title = contact.label;
    if (!contact.href.startsWith('mailto:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    link.addEventListener('focus', () => { if (link.matches(':focus-visible')) camera.go('home'); });
    document.querySelector('#world-links')!.appendChild(link);
    return { element: link, ...contact };
  });
  const mini = document.querySelector<HTMLCanvasElement>('#minimap')!;
  const ctx = mini.getContext('2d')!;
  const sx = mini.width / WORLD.width, sy = mini.height / WORLD.height;
  const miniBase = document.createElement('canvas');
  miniBase.width = mini.width; miniBase.height = mini.height;
  const m = miniBase.getContext('2d')!;
  m.fillStyle = '#374032'; m.fillRect(0, 0, mini.width, mini.height);
  m.strokeStyle = '#414837'; m.lineWidth = 0.5;
  for (let i = 0; i < mini.width; i += 12) { m.beginPath(); m.moveTo(i, 0); m.lineTo(i, mini.height); m.stroke(); }
  for (let i = 0; i < mini.height; i += 12) { m.beginPath(); m.moveTo(0, i); m.lineTo(mini.width, i); m.stroke(); }
  for (const block of factory.blocks) {
    m.fillStyle = block.color || '#a89662';
    m.fillRect(block.x * sx, block.y * sy, block.w * sx, block.h * sy);
  }
  m.strokeStyle = '#92a09b'; m.lineWidth = 0.55;
  for(const route of factory.mapBelts) {
    m.beginPath(); route.forEach(([x,y],i)=>i?m.lineTo(x*sx,y*sy):m.moveTo(x*sx,y*sy)); m.stroke();
  }
  m.strokeStyle = '#cbbfa0'; m.lineWidth = 1;
  for(const route of factory.railRoutes) {
    m.beginPath(); route.forEach(([x,y],i)=>i?m.lineTo(x*sx,y*sy):m.moveTo(x*sx,y*sy)); m.stroke();
  }
  m.fillStyle = '#bebfa8'; m.fillRect(PLAZA.x * sx, PLAZA.y * sy, PLAZA.width * sx, PLAZA.height * sy);
  m.fillStyle = '#363e30'; m.fillRect(PLAZA.x * sx + 8, PLAZA.y * sy + 8, PLAZA.width * sx - 16, 5);
  mini.addEventListener('pointerdown', event => {
    const rect = mini.getBoundingClientRect();
    camera.tx = (event.clientX - rect.left) / rect.width * WORLD.width;
    camera.ty = (event.clientY - rect.top) / rect.height * WORLD.height;
  });
  document.querySelector('#loading')!.classList.add('loaded');
  setTimeout(() => document.querySelector('#loading')?.remove(), 650);
  let lastHud = 0;
  app.ticker.add(ticker => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.06);
    const now=performance.now(), animationDt=(now-animationClock)/1000;
    animationClock=now;
    camera.width = app.screen.width; camera.height = app.screen.height;
    camera.update(dt);
    if (!paused && !document.hidden) elapsed += animationDt;
    factory.root.scale.set(camera.zoom);
    factory.root.position.set(camera.width / 2 - camera.x * camera.zoom, camera.height / 2 - camera.y * camera.zoom);
    outpost.root.scale.copyFrom(factory.root.scale);
    outpost.root.position.copyFrom(factory.root.position);
    auxide.root.scale.copyFrom(factory.root.scale);
    auxide.root.position.copyFrom(factory.root.position);
    caz.root.scale.copyFrom(factory.root.scale);
    caz.root.position.copyFrom(factory.root.position);
    const view = camera.view();
    factory.root.visible = view.left < 10752;
    if (factory.root.visible) factory.update(elapsed, view, camera.zoom);
    outpost.update(elapsed, view, camera.zoom);
    auxide.render(elapsed,view,camera.zoom,playback.snapshots(elapsed),selectedServer);
    caz.render(elapsed,view,camera.zoom,release.snapshot(elapsed));
    for (const link of links) {
      const x = (link.x - view.left) * camera.zoom, y = (link.y - view.top) * camera.zoom;
      link.element.style.transform = `translate(${x}px,${y}px)`;
      link.element.style.width = `${link.width * camera.zoom}px`;
      link.element.style.height = `${link.height * camera.zoom}px`;
      link.element.style.visibility = x + link.width * camera.zoom < 0 || x > camera.width || y < 54 || y > camera.height - 115 ? 'hidden' : 'visible';
    }
    if (ticker.lastTime - lastHud > 100) {
      lastHud = ticker.lastTime;
      ctx.drawImage(miniBase, 0, 0);
      ctx.fillStyle = '#edd29418'; ctx.fillRect(view.left * sx, view.top * sy, (view.right - view.left) * sx, (view.bottom - view.top) * sy);
      ctx.strokeStyle = '#edd294'; ctx.lineWidth = 1.25;
      ctx.strokeRect(view.left * sx, view.top * sy, (view.right - view.left) * sx, (view.bottom - view.top) * sy);
      document.querySelector('#coordinates')!.textContent = `${Math.round(camera.x / 32)}, ${Math.round(camera.y / 32)}`;
      document.querySelector('#zoom-readout')!.textContent = `${Math.round(camera.zoom * 100)}%`;
      if (destination === 'aws-foundation') projectPanel.update(outpost.state, paused);
      if (destination === 'auxide') updateMusicPanel();
      if (destination === 'caz-nix') cazPanel.update(release.snapshot(elapsed),paused);
    }
  });
  // Read-only instrumentation for checking rendering and navigation locally.
  Object.defineProperty(window, '__factory', { configurable: true, get: () => ({ ready: true, machines: factory.machineCount, belts: factory.beltCount, crossings: factory.crossingCount, railRoutes: factory.railRoutes.length,
    camera: { x: camera.x, y: camera.y, zoom: camera.zoom }, paused, time: elapsed, fps: app.ticker.FPS, trains:factory.trainState,
    destination, outpost: outpost.state, caz: { ...release.snapshot(elapsed), machines: caz.machineCount, belts: caz.beltCount, crossings: caz.crossingCount }, auxide: { selected: selectedServer, players: playback.snapshots(elapsed), audio: audio.state } }) });
}

start().catch(error => {
  console.error(error);
  const loading = document.querySelector('#loading .loading-box');
  if (loading) loading.innerHTML = `<span class="eyebrow">LOCAL FACTORY</span><h1>The factory needs its assets.</h1><p>Import sprites from your installed copy of Factorio, then reload this page.</p><code>npm run assets:import</code><p class="error-detail"></p>`;
  document.querySelector('.error-detail')!.textContent = error instanceof Error ? error.message : String(error);
});
