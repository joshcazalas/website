import { RELEASE_STAGES, generation, type ReleaseSnapshot, type ReleasePhase } from './caz-release';

export const cazMarkup = `
  <aside id="caz-panel" class="outpost-panel caz-panel" aria-labelledby="caz-title" hidden>
    <div class="outpost-heading"><span>PROJECT OUTPOST / 03</span><button data-go="home" aria-label="Return to the main factory" title="Return home">⌂</button></div>
    <div class="outpost-intro"><span class="eyebrow">DECLARATIVE HOMELAB</span><h2 id="caz-title" tabindex="-1">caz.nix</h2>
      <div class="project-stack">NIXOS <span>·</span> HOME MANAGER <span>·</span> LINUX</div>
    </div>
    <div class="release-controls">
      <div class="generation-readout"><span>ACTIVE GENERATION</span><strong id="caz-generation">G01</strong><small id="caz-health">Services healthy</small></div>
      <div class="release-state"><span class="status-light"></span><span id="caz-status" role="status" aria-live="polite">Homelab online</span></div>
      <div id="caz-progress" class="deployment-progress" role="progressbar" aria-label="Release transaction" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div></div></div>
      <p id="caz-description">Deploy a new generation, or enable the failed health check to try a rollback.</p>
      <label class="failure-option"><input id="caz-failure" type="checkbox"><span>Fail the new media service's health check</span></label>
      <button id="caz-deploy" class="deploy-button"><span aria-hidden="true">↗</span><span>Deploy next generation</span><span aria-hidden="true">→</span></button>
      <div class="deployment-actions"><button id="caz-finish" hidden>Show outcome</button><button data-go="caz-nix">Frame homelab</button></div>
      <ol class="release-stages" aria-label="Release stages">${RELEASE_STAGES.map((name,i)=>`<li data-release-stage="${i}"><span>0${i+1}</span>${name}<b></b></li>`).join('')}</ol>
    </div>
    <details class="project-details"><summary>About this outpost <span>+</span></summary>
      <div class="project-detail-copy">
        <p>caz.nix is the Nix configuration for my home server and WSL development environment. The belts connect that configuration to the services I run. Deploy a new generation to see it update, or simulate a failed health check to see it roll back.</p>
        <p class="scene-note">This demo doesn't connect to my server. The snowflake is a tile adaptation of the <a href="https://nixos.org/branding/" target="_blank" rel="noopener noreferrer">NixOS contributors' logo</a>, under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</p>
      </div>
    </details>
    <a class="source-link" href="https://github.com/joshcazalas/caz.nix" target="_blank" rel="noopener noreferrer">See the project on GitHub <span aria-hidden="true">↗</span></a>
  </aside>
`;

const copy: Record<ReleasePhase,[string,string]> = {
  ready: ['Homelab online','Deploy a new generation, or enable the failed health check to try a rollback.'],
  verify: ['Verifying release','Checking the release checksums and provenance.'],
  build: ['Reproducing the build','Building the pinned configuration.'],
  backup: ['Backing up application data','Saving application data before switching generations.'],
  activate: ['Switching generation','Switching to the new system configuration.'],
  health: ['Checking service health','Checking that services are healthy.'],
  confirm: ['Confirming the failure','Repeating the failed media health check.'],
  rollback: ['Restoring the previous generation','Switching back to the previous system configuration.'],
  restore: ['Checking the restored services','Checking services after rollback.'],
  accepted: ['Release accepted','The new generation is running.'],
  recovered: ['Previous generation restored',"Services are healthy. The failed release won't be retried."]
};

export class CazPanel {
  readonly element = document.querySelector<HTMLElement>('#caz-panel')!;
  private label = '';
  update(state: ReleaseSnapshot, paused: boolean) {
    this.element.dataset.phase = state.phase;
    this.element.dataset.unhealthy = String(state.unhealthy);
    document.querySelector('#caz-generation')!.textContent = generation(state.active);
    document.querySelector('#caz-health')!.textContent = state.unhealthy ? 'Media health check failing' : state.phase === 'activate' ? 'Awaiting health checks' : 'Services healthy';
    const label = copy[state.phase][0] + (paused && state.busy ? ' · paused' : '');
    if(label!==this.label) {
      this.label=label;
      document.querySelector('#caz-status')!.textContent=label;
      document.querySelector('#caz-description')!.textContent=copy[state.phase][1];
    }
    const progress=document.querySelector<HTMLElement>('#caz-progress')!;
    progress.setAttribute('aria-valuenow',String(Math.round(state.progress*100)));
    progress.querySelector<HTMLElement>('div')!.style.width=`${state.progress*100}%`;
    const button=document.querySelector<HTMLButtonElement>('#caz-deploy')!;
    button.disabled=state.busy;
    button.querySelector('span:nth-child(2)')!.textContent=state.busy ? 'Release in progress' : paused ? 'Run release instantly' : 'Deploy next generation';
    document.querySelector<HTMLInputElement>('#caz-failure')!.disabled=state.busy;
    document.querySelector<HTMLButtonElement>('#caz-finish')!.hidden=!state.busy;
    const boundaries=[0,3,6,8,10,17];
    this.element.querySelectorAll<HTMLElement>('[data-release-stage]').forEach((step,i)=>{
      const done=state.phase!=='ready' && state.seconds>=boundaries[i+1] && !(i===4 && state.fail);
      step.classList.toggle('done',done);
      step.classList.toggle('current',state.busy && state.seconds>=boundaries[i] && (i===4 || state.seconds<boundaries[i+1]));
      step.querySelector('b')!.textContent=i===4 && state.quarantined ? '↶' : done ? '✓' : '';
    });
  }
}
