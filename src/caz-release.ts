// An illustrative local release transaction, with deliberately fictional generation numbers.
export type ReleasePhase = 'ready' | 'verify' | 'build' | 'backup' | 'activate' | 'health' | 'confirm' | 'rollback' | 'restore' | 'accepted' | 'recovered';
export const RELEASE_DURATION = 17;
export const RECOVERY_DURATION = 23;
export const RELEASE_STAGES = ['Verify release', 'Reproduce build', 'Archive app state', 'Activate generation', 'Check & stabilize'] as const;
export type ReleaseSnapshot = {
  phase: ReleasePhase; seconds: number; busy: boolean; progress: number;
  previous: number; candidate: number; active: number; fail: boolean;
  previousSlot: number; activeSlot: number;
  unhealthy: boolean; archived: boolean; quarantined: boolean;
};

export class CazRelease {
  private started: number | null = null;
  private previous = 1;
  private candidate = 2;
  private fail = false;
  private next = 2;
  private previousSlot = 0;

  start(clock: number, fail = false, instant = false) {
    const current = this.snapshot(clock);
    if (current.busy) return false;
    this.previous = current.active;
    this.previousSlot = current.activeSlot;
    this.candidate = this.next++;
    this.fail = fail;
    this.started = clock - (instant ? this.duration : 0);
    return true;
  }

  finish(clock: number) { if (this.started !== null) this.started = clock - this.duration; }
  private get duration() { return this.fail ? RECOVERY_DURATION : RELEASE_DURATION; }

  snapshot(clock: number): ReleaseSnapshot {
    const seconds = this.started === null ? 0 : Math.max(0, Math.min(this.duration, clock-this.started));
    const phase: ReleasePhase = this.started === null ? 'ready' : seconds < 3 ? 'verify' : seconds < 6 ? 'build' : seconds < 8 ? 'backup' : seconds < 10 ? 'activate' : seconds < 14 ? 'health' :
      !this.fail ? seconds < RELEASE_DURATION ? 'health' : 'accepted' : seconds < 17 ? 'confirm' : seconds < 20 ? 'rollback' : seconds < RECOVERY_DURATION ? 'restore' : 'recovered';
    const switched = seconds >= 8 && !(this.fail && seconds >= 20);
    return { phase, seconds, busy: !['ready','accepted','recovered'].includes(phase), progress: seconds/this.duration,
      previous: this.previous, candidate: this.candidate, active: switched ? this.candidate : this.previous,
      previousSlot: this.previousSlot, activeSlot: switched ? 1-this.previousSlot : this.previousSlot,
      fail: this.fail, unhealthy: this.fail && seconds >= 10 && seconds < 20,
      archived: seconds >= 8, quarantined: phase === 'recovered' };
  }
}

export const generation = (id: number) => `G${String(id).padStart(2,'0')}`;
