import { RELEASE_STAGES, generation, type ReleaseSnapshot, type ReleasePhase } from './caz-release';

export const cazMarkup = `
  <aside id="caz-panel" class="outpost-panel caz-panel" aria-labelledby="caz-title" hidden>
    <div class="outpost-heading"><span>PROJECT OUTPOST / 03</span><button data-go="home" aria-label="Return to the main factory" title="Return home">⌂</button></div>
    <div class="outpost-intro"><span class="eyebrow">DECLARATIVE HOMELAB</span><h2 id="caz-title" tabindex="-1">caz.nix</h2>
      <p>One configuration. A whole home.<br>A way back when something breaks.</p>
      <div class="project-stack">NIXOS <span>·</span> HOME MANAGER <span>·</span> LINUX</div>
    </div>
    <div class="release-controls">
      <div class="generation-readout"><span>ACTIVE GENERATION</span><strong id="caz-generation">G01</strong><small id="caz-health">Services healthy</small></div>
      <div class="release-state"><span class="status-light"></span><span id="caz-status" role="status" aria-live="polite">Homelab online</span></div>
      <div id="caz-progress" class="deployment-progress" role="progressbar" aria-label="Release transaction" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div></div></div>
      <p id="caz-description">Follow a release from its pinned inputs to the running services. Then try a failed health check.</p>
      <label class="failure-option"><input id="caz-failure" type="checkbox"><span>Fail the new media service's health check</span></label>
      <button id="caz-deploy" class="deploy-button"><span aria-hidden="true">↗</span><span>Deploy next generation</span><span aria-hidden="true">→</span></button>
      <div class="deployment-actions"><button id="caz-finish" hidden>Show outcome</button><button data-go="caz-nix">Frame homelab</button></div>
      <ol class="release-stages" aria-label="Release stages">${RELEASE_STAGES.map((name,i)=>`<li data-release-stage="${i}"><span>0${i+1}</span>${name}<b></b></li>`).join('')}</ol>
    </div>
    <details class="project-details"><summary>The engineering behind it <span>+</span></summary>
      <div class="project-detail-copy">
        <p>caz.nix defines my NixOS homeserver and my WSL development environment in one flake. The interwoven belts map configuration into the services I use at home.</p>
        <h3>One flake, separate outputs</h3><p>Pinned inputs feed a complete NixOS system and a separate Home Manager environment. Shared configuration stays reusable; each machine keeps its own responsibilities. Project toolchains live in their own development shells.</p>
        <h3>A home, expressed as services</h3><p>AdGuard Home and role-filtered WireGuard access sit alongside Samba storage, Jellyfin media, Home Assistant, Minecraft with BlueMap, and Auxide. Prometheus, Alertmanager, and Grafana provide operational visibility. Each service keeps its own access boundary.</p>
        <h3>Review, reproduce, then activate</h3><p>Dependency pull requests go through CI and human review. Releases carry checksums, SBOMs, and provenance. The server independently verifies a release, rebuilds its exact commit, and compares its store paths with the signed manifest before deployment.</p>
        <h3>Keep a way back</h3><p>The maintenance transaction checks storage and current health, archives mutable application state, activates the new generation, and waits for service health to stabilize. A confirmed failure restores and health-checks the previous generation, then quarantines the failed release.</p>
        <p>Generation rollback restores the system configuration. Recovering incompatible application-data changes requires explicit restoration from the separate local archives. Local backups also don't protect against losing the disk, and the updater does not reboot automatically.</p>
        <p class="scene-note">This is a condensed local demonstration with fictional generation numbers and an optional simulated media failure. It does not connect to my server. The snowflake is a tile adaptation of the <a href="https://nixos.org/branding/" target="_blank" rel="noopener noreferrer">NixOS contributors' logo</a>, under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</p>
      </div>
    </details>
    <a class="source-link" href="https://github.com/joshcazalas/caz.nix" target="_blank" rel="noopener noreferrer">Explore the source <span>GitHub ↗</span></a>
  </aside>
`;

const copy: Record<ReleasePhase,[string,string]> = {
  ready: ['Homelab online','Follow a release from its pinned inputs to the running services. Then try a failed health check.'],
  verify: ['Verifying release','Verify the release identity, checksums, and provenance before trusting a new build.'],
  build: ['Reproducing the build','Build the exact pinned commit and compare its output with the signed release manifest.'],
  backup: ['Protecting application state','Check current health and storage. Archive mutable app state before changing the running system.'],
  activate: ['Switching generation','The new generation becomes active. Acceptance still depends on the service health gate.'],
  health: ['Checking service health','Probe the active services, then require a stable healthy window before accepting the release.'],
  confirm: ['Confirming the failure','The media check failed. Recheck the failure before rolling back the active generation.'],
  rollback: ['Restoring the previous generation','The failure is confirmed. Switch the system profile back and reactivate the previous configuration.'],
  restore: ['Checking the restored services','Verify the restored generation is healthy. Application archives remain available separately.'],
  accepted: ['Release accepted','The new generation passed its health gate. The previous generation remains a recovery option.'],
  recovered: ['Previous generation restored','Services are healthy again. The failed release is quarantined so the timer will not keep retrying it.']
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
