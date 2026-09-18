import { SERVERS, type PlaybackSnapshot } from './auxide-playback';
import type { AuxideAudio } from './auxide-audio';

export const auxideMarkup = `
  <aside id="auxide-panel" class="outpost-panel auxide-panel" aria-labelledby="auxide-title" hidden>
    <div class="outpost-heading"><span>PROJECT OUTPOST / 02</span><button data-go="home" aria-label="Return to the main factory" title="Return home">⌂</button></div>
    <div class="outpost-intro"><span class="eyebrow">SELF-HOSTED MUSIC</span><h2 id="auxide-title" tabindex="-1">Auxide</h2>
      <p>Different servers. Different songs.<br>Everybody keeps their place.</p>
      <div class="project-stack">RUST <span>·</span> TOKIO <span>·</span> SONGBIRD</div>
    </div>
    <div class="music-controls">
      <p class="music-instruction">Pick a server. Pause or skip its track.<br>The other two keep playing.</p>
      <div class="server-selector" role="group" aria-label="Select a demo Discord server">
        ${SERVERS.map((server,i) => `<button data-server="${i}" aria-pressed="${i===0}" style="--server-color:${server.css}"><span class="server-dot"></span><span>Server 0${i+1}</span><small>${server.name}</small></button>`).join('')}
      </div>
      <div class="now-playing"><span id="auxide-playing-label" class="eyebrow">NOW PLAYING / SERVER 01</span><strong id="auxide-track">Copper sunrise</strong>
        <div class="music-position"><div id="auxide-progress"><div></div></div><span id="auxide-time">0:00 / 0:20</span></div>
      </div>
      <div class="transport"><button id="auxide-toggle" class="deploy-button" aria-pressed="false"><span aria-hidden="true">Ⅱ</span><span>Pause this server</span></button><button id="auxide-skip" class="skip-button">Skip <span aria-hidden="true">→</span></button></div>
      <div class="music-queue"><span>UP NEXT</span><ol id="auxide-queue"></ol></div>
      <div class="audio-controls"><button id="auxide-sound" aria-pressed="false">Enable sound</button><button data-go="auxide">Frame outpost</button></div>
      <p id="auxide-audio-status" class="audio-note" role="status">Sound is off. Listen to the selected server.</p>
      <p id="auxide-notice" class="sr-only" role="status" aria-live="polite"></p>
    </div>
    <details class="project-details"><summary>The engineering behind it <span>+</span></summary>
      <div class="project-detail-copy">
        <p>Auxide is my self-hosted Discord music bot, written in Rust. Ferris, Rust's crab mascot, is tiled into the outpost's nameplate. I wanted predictable playback, a manageable service, and clear boundaries between commands, player state, audio sources, and voice.</p>
        <h3>One guild, one owner</h3><p>Each server has an independent serialized actor that owns its queue and playback state. Concurrent commands pass through a bounded mailbox, so they can't mutate a shared queue out of order.</p>
        <h3>Resolve late. Stream in order.</h3><p>Source adapters are separate from Discord state. Public YouTube audio is resolved just before playback through bounded yt-dlp/Deno subprocesses, then streamed through a supervised Songbird voice worker.</p>
        <h3>Old work can't hijack new playback</h3><p>Stale-completion protection keeps an earlier asynchronous result from replacing a newer playback decision. Skipping a track stays a decision the player owns.</p>
        <h3>A service I can actually run</h3><p>Structured logs, health and readiness checks, and Prometheus metrics make failures visible. A pinned Nix build, hardened NixOS service, and unprivileged container support self-hosting.</p>
        <p class="scene-note">These are three demonstration servers with short original musical phrases, played through Factorio's piano and drum samples. The scene illustrates queue ownership; it doesn't connect to Discord or YouTube.</p>
      </div>
    </details>
    <a class="source-link" href="https://github.com/joshcazalas/auxide" target="_blank" rel="noopener noreferrer">Explore the source <span>GitHub ↗</span></a>
  </aside>
`;

const timestamp = (seconds: number) => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export class AuxidePanel {
  readonly element = document.querySelector<HTMLElement>('#auxide-panel')!;
  private title = '';
  private queue = '';
  update(snapshots: PlaybackSnapshot[], selected: number, paused: boolean, audio: AuxideAudio['state']) {
    const current = snapshots[selected];
    this.element.style.setProperty('--music-color', SERVERS[selected].css);
    this.element.querySelectorAll<HTMLButtonElement>('[data-server]').forEach((button,i) => {
      button.setAttribute('aria-pressed',String(i===selected));
      button.classList.toggle('server-paused',!snapshots[i].playing || paused);
    });
    if (this.title !== current.title) {
      this.title = current.title;
      document.querySelector('#auxide-track')!.textContent = current.title;
    }
    document.querySelector('#auxide-playing-label')!.textContent = `${paused ? 'FACTORY PAUSED' : current.playing ? 'NOW PLAYING' : 'PAUSED'} / SERVER 0${selected+1}`;
    document.querySelector<HTMLElement>('#auxide-progress > div')!.style.width = `${current.progress*100}%`;
    document.querySelector('#auxide-time')!.textContent = `${timestamp(current.position)} / ${timestamp(current.duration)}`;
    const toggle = document.querySelector<HTMLButtonElement>('#auxide-toggle')!;
    toggle.setAttribute('aria-pressed',String(!current.playing));
    toggle.querySelector('span:first-child')!.textContent = current.playing ? 'Ⅱ' : '▷';
    toggle.querySelector('span:last-child')!.textContent = current.playing ? 'Pause this server' : 'Resume this server';
    if (this.queue !== current.queue.join('|')) {
      this.queue = current.queue.join('|');
      const list = document.querySelector('#auxide-queue')!;
      list.replaceChildren(...current.queue.map(title => { const li=document.createElement('li'); li.textContent=title; return li; }));
    }
    const sound = document.querySelector<HTMLButtonElement>('#auxide-sound')!;
    sound.disabled = audio.status === 'loading';
    sound.setAttribute('aria-pressed',String(audio.enabled));
    sound.textContent = audio.status === 'loading' ? 'Loading instruments…' : audio.enabled ? 'Mute sound' : audio.status === 'error' ? 'Retry sound' : 'Enable sound';
    const note = audio.status === 'error' ? 'Audio unavailable. You can retry or keep exploring silently.' : audio.enabled ?
      (paused ? 'Factory paused. Resume to hear the selected server.' : !current.playing ? 'This server is paused. The others keep playing.' : `Listening to Server 0${selected+1} · ${SERVERS[selected].name}`) : 'Sound is off. Listen to the selected server.';
    const status = document.querySelector('#auxide-audio-status')!;
    if (status.textContent !== note) status.textContent = note;
  }
  announce(message: string) { document.querySelector('#auxide-notice')!.textContent = message; }
}
