// An authored construction sequence, driven by the same pausable clock as the factory.
export const FOUNDATION_STAGES = [
  { key: 'governance', label: 'Governance & state', start: 1.5, end: 6.5 },
  { key: 'delivery', label: 'Deployment & identity', start: 6.5, end: 11.5 },
  { key: 'workloads', label: 'Workload boundaries', start: 11.5, end: 17.5 }
] as const;
export const POWER_ON = 18.5;
export const DEPLOYMENT_DURATION = 20.5;
export type BuildStage = 0 | 1 | 2;
export type DeploymentPhase = 'ready' | 'blueprint' | 'governance' | 'delivery' | 'workloads' | 'power' | 'online';

export function buildTime(stage: BuildStage, index: number, count: number) {
  const { start, end } = FOUNDATION_STAGES[stage];
  return start + 1.8 + index / Math.max(1, count - 1) * (end - start - 2.1);
}

export function deploymentPhase(seconds: number | null): DeploymentPhase {
  if (seconds === null) return 'ready';
  if (seconds >= DEPLOYMENT_DURATION) return 'online';
  if (seconds >= FOUNDATION_STAGES[2].end) return 'power';
  for (const stage of [...FOUNDATION_STAGES].reverse()) if (seconds >= stage.start) return stage.key;
  return 'blueprint';
}

export function flightProgress(seconds: number, landing: number, duration: number) {
  const t = (seconds - (landing - duration)) / duration;
  return { visible: t >= 0 && t < 2, returning: t >= 1, fraction: Math.max(0, Math.min(1, t <= 1 ? t : 2 - t)) };
}
