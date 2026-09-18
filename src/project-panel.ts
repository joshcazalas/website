import { FOUNDATION_STAGES, DEPLOYMENT_DURATION, type DeploymentPhase } from './foundation-deployment';
import type { FoundationOutpost } from './foundation-outpost';

export const projectMarkup = `
  <aside id="foundation-panel" class="outpost-panel" aria-labelledby="foundation-title" hidden>
    <div class="outpost-heading"><span>PROJECT OUTPOST / 01</span><button data-go="home" aria-label="Return to the main factory" title="Return home">⌂</button></div>
    <div class="outpost-intro"><span class="eyebrow">REUSABLE INFRASTRUCTURE</span><h2 id="foundation-title" tabindex="-1">AWS Foundation</h2>
      <div class="project-stack">OPENTOFU <span>·</span> AWS <span>·</span> GITHUB ACTIONS</div>
    </div>
    <div class="deployment-controls">
      <div class="deployment-state"><span id="deployment-light" class="status-light"></span><span id="deployment-label" role="status" aria-live="polite">Blueprint ready</span><span id="deployment-percent">—</span></div>
      <div id="deployment-progress" class="deployment-progress" role="progressbar" aria-label="Foundation construction" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div></div></div>
      <p id="deployment-description">Build a copy of the existing factory at the empty site.</p>
      <button id="deploy-foundation" class="deploy-button"><span aria-hidden="true">▧</span><span>Deploy foundation</span><span aria-hidden="true">→</span></button>
      <div class="deployment-actions"><button id="finish-deployment" hidden>Show completed</button><button data-go="aws-foundation">Frame build site</button></div>
      <ol class="build-stages" aria-label="Construction stages">
        <li data-stage="governance"><span>01</span>Governance & state<b></b></li>
        <li data-stage="delivery"><span>02</span>Deployment & identity<b></b></li>
        <li data-stage="workloads"><span>03</span>Workload boundaries<b></b></li>
        <li data-stage="power"><span>04</span>Bring the foundation online<b></b></li>
      </ol>
    </div>
    <details class="project-details"><summary>About this outpost <span>+</span></summary>
      <div class="project-detail-copy">
        <p>Blueprints are a good analogy for infrastructure as code, and construction bots for CI/CD. Reuse the same configuration, point it at a new environment, and rebuild on demand.</p>
        <p class="scene-note">This is a visual demonstration; it doesn't deploy AWS resources.</p>
      </div>
    </details>
    <a class="source-link" href="https://github.com/joshcazalas/aws-foundation" target="_blank" rel="noopener noreferrer">See the project on GitHub <span aria-hidden="true">↗</span></a>
  </aside>
`;

const descriptions: Record<DeploymentPhase, [string, string]> = {
  ready: ['Blueprint ready', 'Build a copy of the existing factory at the empty site.'],
  blueprint: ['Placing the blueprint', 'Construction bots are leaving the depot.'],
  governance: ['Building governance & state', 'Bots are building the management section.'],
  delivery: ['Connecting deployment & identity', 'Bots are building the deployment section.'],
  workloads: ['Building workload boundaries', 'Bots are building the UAT and production sections.'],
  power: ['Bringing the foundation online', 'All structures are built. Power and conveyors are starting.'],
  online: ['Foundation online', 'The new factory is running.']
};

export class ProjectPanel {
  readonly element = document.querySelector<HTMLElement>('#foundation-panel')!;
  private previousLabel = '';

  update(state: FoundationOutpost['state'], paused: boolean) {
    const { phase, seconds, progress } = state;
    const active = phase !== 'ready' && phase !== 'online';
    const label = descriptions[phase][0] + (paused && active ? ' · paused' : '');
    if (label !== this.previousLabel) {
      this.previousLabel = label;
      document.querySelector('#deployment-label')!.textContent = label;
      document.querySelector('#deployment-description')!.textContent = descriptions[phase][1];
    }
    this.element.dataset.phase = phase;
    const percent = Math.round(progress * 100);
    document.querySelector('#deployment-percent')!.textContent = phase === 'ready' ? '—' : `${percent}%`;
    const bar = document.querySelector<HTMLElement>('#deployment-progress')!;
    bar.setAttribute('aria-valuenow', String(percent));
    bar.querySelector<HTMLElement>('div')!.style.width = `${percent}%`;
    const button = document.querySelector<HTMLButtonElement>('#deploy-foundation')!;
    button.disabled = active;
    button.querySelector('span:nth-child(2)')!.textContent = active ? 'Construction in progress' : paused ? (phase === 'online' ? 'Rebuild instantly' : 'Build instantly') : phase === 'online' ? 'Replay deployment' : 'Deploy foundation';
    document.querySelector<HTMLButtonElement>('#finish-deployment')!.hidden = !active;
    document.querySelectorAll<HTMLElement>('.build-stages li').forEach((step, i) => {
      const start = i < 3 ? FOUNDATION_STAGES[i].start : FOUNDATION_STAGES[2].end;
      const end = i < 3 ? FOUNDATION_STAGES[i].end : DEPLOYMENT_DURATION;
      const done = seconds !== null && seconds >= end;
      step.classList.toggle('done', done);
      step.classList.toggle('current', seconds !== null && seconds >= start && seconds < end);
      step.querySelector('b')!.textContent = done ? '✓' : '';
    });
  }
}
