import type { Point } from './paths';

// Virtual travel distance spent carrying a stack. The remaining interval is the
// empty return swing. Both belt particles and inserter hands use this clock.
export const TRANSFER_DISTANCE = 16;

export function storageCycle(cellCount: number) {
  const travel = (cellCount - 5) * 32;
  const length = travel + TRANSFER_DISTANCE * 2;
  const stacks = Math.max(1, Math.floor(length / 40));
  return { travel, length, stacks, spacing: length / stacks };
}

export function transferProgress(distance: number, spacing: number) {
  const phase = ((distance % spacing) + spacing) % spacing;
  return phase < TRANSFER_DISTANCE ? phase / TRANSFER_DISTANCE : 1 - (phase - TRANSFER_DISTANCE) / (spacing - TRANSFER_DISTANCE);
}

/** Chest -> inserter swing -> belt, or the exact reverse at an output chest. */
export function transferPosition(x: number, y: number, dx: number, dy: number, source: boolean, progress: number, lane = 0): Point {
  const angle = Math.atan2(dy,dx) + Math.PI * (source ? 1 - progress : progress);
  const spread = lane * (source ? progress : progress - 1);
  return [x + Math.cos(angle) * 32 - dy * spread, y + Math.sin(angle) * 32 + dx * spread];
}
