import { assetUrl } from './asset-url';
export const mainMenuMarkup = `
  <section id="entry-screen" class="entry-screen" aria-label="Main menu" data-state="menu">
    <div id="menu-backdrop" aria-hidden="true"></div>
    <div class="entry-shade" aria-hidden="true"></div>
    <div class="entry-brand"><img src="${assetUrl('branding/josh-cazalas.png')}" alt="Josh Cazalas" width="2172" height="724" fetchpriority="high"></div>
    <div id="main-menu" class="entry-window main-menu" aria-labelledby="main-menu-title">
      <div class="entry-window-heading"><h1 id="main-menu-title">Main menu</h1><span class="entry-grip" aria-hidden="true"></span></div>
      <div class="main-menu-body">
        <button id="play-factory" class="entry-play">Play</button>
        <p class="entry-context">A portfolio inspired by my favorite game, Factorio.</p>
        <nav class="entry-links" aria-label="Find Josh online">
          <a href="https://github.com/joshcazalas" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
          <span aria-hidden="true">·</span>
          <a href="https://www.linkedin.com/in/joshcazalas/" target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </div>
    <section id="entry-loading" class="entry-window entry-loading" aria-labelledby="entry-loading-title" hidden>
      <div class="entry-window-heading"><h2 id="entry-loading-title" tabindex="-1">Loading map</h2><span class="entry-grip" aria-hidden="true"></span></div>
      <div class="entry-loading-body">
        <div class="entry-save"><img src="${assetUrl('factorio/icons/iron-gear-wheel.png')}" alt="" width="46" height="46"><span>Josh Cazalas — Portfolio<small>Three project outposts</small></span></div>
        <div id="entry-progress" class="entry-progress" role="progressbar" aria-label="Preparing the factory" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div></div></div>
        <div class="entry-load-status"><span id="entry-status" role="status" aria-live="polite">Preparing the surface…</span><span id="entry-percent" aria-hidden="true">0%</span></div>
        <p id="entry-error" hidden></p><button id="entry-retry" class="entry-play" hidden>Retry</button>
      </div>
    </section>
    <footer class="entry-footer"><span>JOSHCAZALAS.COM</span><span>Factory artwork © Wube Software</span></footer>
  </section>
`;

/** Menu and loading transition stay independent of WebGL initialization. */
export class MainMenu {
  private screen = document.querySelector<HTMLElement>('#entry-screen')!;
  private shell = document.querySelector<HTMLElement>('#factory-shell')!;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private phase: 'menu' | 'loading' | 'entered' | 'error' = 'menu';
  private loaded = false;
  private fraction = 0;
  private started = 0;
  private enterFactory: (() => void) | null = null;

  constructor() {
    const play = document.querySelector<HTMLButtonElement>('#play-factory')!;
    play.addEventListener('click', () => this.play());
    document.querySelector('#entry-retry')!.addEventListener('click', () => location.reload());
    play.focus({preventScroll:true});
  }

  get entered() { return this.phase === 'entered'; }
  get state() { return this.phase; }
  progress(fraction: number) { this.fraction = Math.max(this.fraction,Math.min(1,fraction)); }
  ready(enterFactory: () => void) { this.loaded = true; this.enterFactory = enterFactory; }

  private showLoading() {
    document.querySelector<HTMLElement>('#main-menu')!.hidden = true;
    document.querySelector<HTMLElement>('#entry-loading')!.hidden = false;
    document.querySelector<HTMLElement>('#entry-loading-title')!.focus({preventScroll:true});
  }

  private play() {
    if(this.phase !== 'menu')return;
    this.phase='loading'; this.screen.dataset.state='loading';
    this.started=performance.now();
    this.showLoading();
    requestAnimationFrame(()=>this.tick());
  }

  private tick() {
    if(this.phase !== 'loading')return;
    const elapsed=performance.now()-this.started, duration=this.reduced?250:1400;
    // The short map-opening transition can only finish after real assets and
    // scene construction are ready. Slow or failed loads never reveal an empty map.
    const available=this.loaded?1:this.fraction*.85;
    const progress=this.reduced?available:Math.min(available,elapsed/duration);
    const percent=Math.floor(progress*100);
    const bar=document.querySelector<HTMLElement>('#entry-progress')!;
    bar.setAttribute('aria-valuenow',String(percent));
    bar.querySelector<HTMLElement>('div')!.style.width=`${percent}%`;
    document.querySelector('#entry-percent')!.textContent=`${percent}%`;
    const label=this.loaded?'Opening the factory…':this.fraction>=1?'Preparing the factory…':'Preparing the surface…';
    const status=document.querySelector('#entry-status')!;
    if(status.textContent!==label)status.textContent=label;
    if(this.loaded&&elapsed>=duration) {
      this.phase='entered';this.screen.dataset.state='entered';
      this.shell.hidden=false;this.shell.inert=false;
      this.enterFactory?.();
      this.screen.inert=true;this.screen.setAttribute('aria-hidden','true');
      document.querySelector<HTMLCanvasElement>('#factory-canvas')!.focus({preventScroll:true});
      setTimeout(()=>{this.screen.hidden=true;},this.reduced?0:360);
      return;
    }
    requestAnimationFrame(()=>this.tick());
  }

  fail(error: unknown) {
    this.phase='error';this.screen.dataset.state='error';this.showLoading();
    document.querySelector('#entry-loading-title')!.textContent="The factory couldn't start";
    document.querySelector('#entry-status')!.textContent='Check the local assets and try again.';
    document.querySelector<HTMLElement>('#entry-progress')!.hidden=true;
    document.querySelector<HTMLElement>('#entry-percent')!.hidden=true;
    const detail=document.querySelector<HTMLElement>('#entry-error')!;
    detail.hidden=false;detail.textContent=error instanceof Error?error.message:String(error);
    const retry=document.querySelector<HTMLButtonElement>('#entry-retry')!;
    retry.hidden=false;retry.focus({preventScroll:true});
  }
}
