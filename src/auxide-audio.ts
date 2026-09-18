import { assetUrl } from './asset-url';
import samples from './auxide-samples.json';
import { notesAt, SERVERS, type PlaybackSnapshot, type Sample } from './auxide-playback';

/** Opt-in sample playback. A short lookahead keeps timing independent of render FPS. */
export class AuxideAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private buffers = new Map<Sample, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private timer?: number;
  private request = 0;
  private channel = '';
  private lastStep = -1;
  private notes = 0;
  enabled = false;
  status: 'off' | 'loading' | 'on' | 'error' = 'off';

  private readonly read: () => PlaybackSnapshot | null;
  constructor(read: () => PlaybackSnapshot | null) { this.read = read; }

  async enable() {
    if (this.status === 'loading' || this.enabled) return;
    const request = ++this.request;
    this.enabled = true; this.status = 'loading';
    try {
      this.context ??= new AudioContext();
      if (!this.master) {
        this.master = this.context.createGain(); this.master.gain.value = 0.16;
        this.master.connect(this.context.destination);
      }
      // Resume inside the user's click before waiting for any asset requests.
      await this.context.resume();
      await Promise.all(Object.entries(samples).map(async ([name, file]) => {
        if (this.buffers.has(name as Sample)) return;
        const response = await fetch(assetUrl(`factorio/sound/programmable-speaker/${file}`));
        if (!response.ok) throw new Error('Instrument sample unavailable');
        const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(name as Sample, buffer);
      }));
      if (request !== this.request || !this.enabled) return;
      this.status = 'on';
      this.timer = window.setInterval(() => this.tick(), 25);
      this.tick();
    } catch {
      if (request !== this.request) return;
      this.disable(); this.status = 'error';
    }
  }

  silence() {
    for (const source of this.sources) source.stop();
    this.sources.clear(); this.channel = ''; this.lastStep = -1;
  }

  disable() {
    ++this.request;
    this.enabled = false; this.status = 'off';
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    this.silence();
    void this.context?.suspend().catch(() => {});
  }

  private tick() {
    const current = this.read(), context = this.context;
    if (!this.enabled || this.status !== 'on' || !context) return;
    if (!current?.playing) { this.silence(); return; }
    const channel = `${current.server}:${current.generation}`;
    if (channel !== this.channel) { this.silence(); this.channel = channel; }
    for (let offset = 0; offset < 2; offset++) {
      const step = current.absoluteStep + offset;
      const until = step * current.stepDuration - current.total;
      if (step <= this.lastStep || until < -0.035 || until > 0.14) continue;
      this.lastStep = step;
      const track = SERVERS[current.server].order[Math.floor(step / 64) % 3];
      for (const note of notesAt(track, step)) {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = this.buffers.get(note.sample)!;
        gain.gain.value = note.gain;
        source.connect(gain); gain.connect(this.master!);
        this.sources.add(source);
        source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(context.currentTime + Math.max(0.005, until));
        this.notes++;
      }
    }
  }

  get state() {
    return { enabled: this.enabled, status: this.status, scheduledNotes: this.notes,
      activeSources: this.sources.size, context: this.context?.state ?? 'uninitialized', samples: this.buffers.size };
  }
}
