import { FOUNDATION_STAGES, DEPLOYMENT_DURATION, type DeploymentPhase } from './foundation-deployment';
import type { FoundationOutpost } from './foundation-outpost';

export const projectMarkup = `
  <dialog id="projects" aria-labelledby="projects-title">
    <div class="dialog-title"><span id="projects-title">Project outposts</span><button id="projects-close" aria-label="Close projects">×</button></div>
    <div class="dossier-body project-directory">
      <p class="eyebrow">DIFFERENT SYSTEMS. SAME SURFACE.</p>
      <p>Step outside the main factory and take a closer look at something I've built.</p>
      <a class="project outpost-card" href="#aws-foundation"><img src="/factorio/icons/processing-unit.png" alt=""/><span><strong>AWS Foundation <b>→</b></strong><small>One blueprint. A repeatable cloud foundation. Watch construction bots bring a second site online.</small><em>VISIT OUTPOST / OPENTOFU · AWS · GITHUB ACTIONS</em></span></a>
      <a class="project outpost-card" href="#auxide"><span class="speaker-icon" aria-hidden="true"></span><span><strong>Auxide <b>→</b></strong><small>Three servers, three independent music lines. Follow the signals from queue to programmable speaker.</small><em>VISIT OUTPOST / RUST · TOKIO · SONGBIRD</em></span></a>
      <a class="project outpost-card" href="#caz-nix"><img src="/factorio/icons/iron-gear-wheel.png" alt=""/><span><strong>caz.nix <b>→</b></strong><small>A whole home, expressed as code. Follow the service belts, deploy a generation, and watch a failed release roll back.</small><em>VISIT OUTPOST / NIXOS · HOME MANAGER · LINUX</em></span></a>
    </div>
  </dialog>
  <aside id="foundation-panel" class="outpost-panel" aria-labelledby="foundation-title" hidden>
    <div class="outpost-heading"><span>PROJECT OUTPOST / 01</span><button data-go="home" aria-label="Return to the main factory" title="Return home">⌂</button></div>
    <div class="outpost-intro"><span class="eyebrow">REUSABLE INFRASTRUCTURE</span><h2 id="foundation-title" tabindex="-1">AWS Foundation</h2>
      <p>A place for every workload.<br>A foundation you can repeat.</p>
      <div class="project-stack">OPENTOFU <span>·</span> AWS <span>·</span> GITHUB ACTIONS</div>
    </div>
    <div class="deployment-controls">
      <div class="deployment-state"><span id="deployment-light" class="status-light"></span><span id="deployment-label" role="status" aria-live="polite">Blueprint ready</span><span id="deployment-percent">—</span></div>
      <div id="deployment-progress" class="deployment-progress" role="progressbar" aria-label="Foundation construction" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div></div></div>
      <p id="deployment-description">A running foundation to the west. An empty site to the east. Stamp the same blueprint and watch it come together.</p>
      <button id="deploy-foundation" class="deploy-button"><span aria-hidden="true">▧</span><span>Deploy foundation</span><span aria-hidden="true">→</span></button>
      <div class="deployment-actions"><button id="finish-deployment" hidden>Show completed</button><button data-go="aws-foundation">Frame build site</button></div>
      <ol class="build-stages" aria-label="Construction stages">
        <li data-stage="governance"><span>01</span>Governance & state<b></b></li>
        <li data-stage="delivery"><span>02</span>Deployment & identity<b></b></li>
        <li data-stage="workloads"><span>03</span>Workload boundaries<b></b></li>
        <li data-stage="power"><span>04</span>Bring the foundation online<b></b></li>
      </ol>
    </div>
    <details class="project-details"><summary>The engineering behind it <span>+</span></summary>
      <div class="project-detail-copy">
        <p>I wanted a reusable starting point for personal AWS projects: organization governance, deployment identities, account baselines, and state storage in one foundation.</p>
        <h3>Boundaries before workloads</h3><p>Management, deployment, UAT, and production have distinct responsibilities. UAT and production live in separate AWS accounts. Application infrastructure stays in its own repository.</p>
        <h3>Identity without stored keys</h3><p>GitHub Actions enters through environment-specific OIDC roles in the deployment account, then assumes an exact role in the target workload account. Human access uses IAM Identity Center.</p>
        <h3>State has its own boundaries</h3><p>Foundation state stays in management. Application state is centralized in deployment and separated by application, component, and workspace, with private, versioned S3 storage and native lockfiles.</p>
        <h3>Review before apply</h3><p>Trusted pull requests get read-only plans. Organization and foundation changes use reviewed, manual applies; automatic apply is deliberately deferred.</p>
        <p class="scene-note">The factory is a visual analogy for reusable infrastructure. Construction here illustrates the design; it doesn't deploy AWS resources.</p>
      </div>
    </details>
    <a class="source-link" href="https://github.com/joshcazalas/aws-foundation" target="_blank" rel="noopener noreferrer">Explore the source <span>GitHub ↗</span></a>
  </aside>
`;

const descriptions: Record<DeploymentPhase, [string, string]> = {
  ready: ['Blueprint ready', 'A running foundation to the west. An empty site to the east. Stamp the same blueprint and watch it come together.'],
  blueprint: ['Placing the blueprint', 'The same layout, ready to repeat. Construction bots are leaving the depot.'],
  governance: ['Building governance & state', 'The management boundary comes first: organization governance, foundation state, and shared services.'],
  delivery: ['Connecting deployment & identity', 'A dedicated deployment hub brings together application state and short-lived, scoped identities.'],
  workloads: ['Building workload boundaries', 'Separate UAT and production accounts provide room for application infrastructure without sharing a security boundary.'],
  power: ['Bringing the foundation online', 'Construction is complete. Connections activate and the two sites begin running the same design.'],
  online: ['Foundation online', 'Same blueprint. Same boundaries. A repeatable place for the next project to begin.']
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
