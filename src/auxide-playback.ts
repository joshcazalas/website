// Original sixteen-step phrases for the portfolio's demonstration servers.
// These are musical examples, not a reimplementation of the Discord bot.
export const TRACKS = [
  { title: 'Copper sunrise', melody: [0,-1,2,3,1,-1,4,3,2,0,-1,2,3,4,3,-1] },
  { title: 'Blue circuit', melody: [2,3,-1,5,4,-1,3,1,0,-1,1,2,3,-1,1,-1] },
  { title: 'After hours', melody: [4,-1,3,-1,2,3,1,-1,0,2,-1,3,1,-1,0,-1] }
] as const;
export const SERVERS = [
  { name: 'Workshop', color: 0xe5b26f, css: '#e5b26f', bpm: 96, order: [0,1,2] },
  { name: 'Night shift', color: 0x7fc9c2, css: '#7fc9c2', bpm: 108, order: [1,2,0] },
  { name: 'The lab', color: 0xbbafd5, css: '#bbafd5', bpm: 120, order: [2,0,1] }
] as const;
export type Sample = 'c4' | 'd4' | 'e4' | 'g4' | 'a4' | 'c5' | 'kick' | 'snare' | 'hat';
const pitches: Sample[] = ['c4','d4','e4','g4','a4','c5'];
export function notesAt(track: number, step: number): { sample: Sample; gain: number }[] {
  const note = TRACKS[track].melody[step % 16];
  const notes = note < 0 ? [] : [{ sample: pitches[note], gain: 0.7 }];
  if (step % 8 === 0) notes.push({ sample: 'kick', gain: 0.45 });
  if (step % 8 === 4) notes.push({ sample: 'snare', gain: 0.17 });
  if (step % 2 === 0) notes.push({ sample: 'hat', gain: 0.10 });
  return notes;
}

export type PlaybackSnapshot = ReturnType<AuxidePlayback['snapshot']>;
export class AuxidePlayback {
  private players = SERVERS.map(() => ({ stored: 0, anchor: 0, playing: true, generation: 0 }));

  snapshot(server: number, clock: number) {
    const config = SERVERS[server], player = this.players[server];
    const total = player.stored + (player.playing ? Math.max(0, clock - player.anchor) : 0);
    const stepDuration = 30 / config.bpm, duration = stepDuration * 64;
    // Snap exact track boundaries after a skip; float division can otherwise
    // put a 108 BPM player one epsilon before the start of its next track.
    const turns = total / duration, nearest = Math.round(turns);
    const turn = Math.floor(Math.abs(turns-nearest) < 1e-10 ? nearest : turns);
    const position = Math.max(0,total - turn*duration);
    const steps = position / stepDuration;
    const stepIndex = Math.floor(steps + 1e-9);
    const track = config.order[turn % config.order.length];
    return { server, playing: player.playing, generation: player.generation, total, turn, track,
      title: TRACKS[track].title, position, duration, stepDuration,
      absoluteStep: turn*64 + stepIndex, step: stepIndex % 16,
      fraction: Math.max(0,steps-stepIndex), progress: position / duration,
      queue: [1,2].map(n => TRACKS[config.order[(turn + n) % config.order.length]].title) };
  }

  toggle(server: number, clock: number) {
    const current = this.snapshot(server, clock), player = this.players[server];
    player.stored = current.total; player.anchor = clock; player.playing = !player.playing; player.generation++;
  }

  skip(server: number, clock: number) {
    const current = this.snapshot(server, clock), player = this.players[server];
    player.stored = (current.turn + 1) * current.duration;
    player.anchor = clock; player.generation++;
  }

  snapshots(clock: number) { return SERVERS.map((_, i) => this.snapshot(i, clock)); }
}
