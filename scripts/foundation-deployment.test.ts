import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDATION_STAGES, POWER_ON, DEPLOYMENT_DURATION, buildTime, deploymentPhase, flightProgress } from '../src/foundation-deployment.ts';

test('construction moves from an empty site through blueprint, boundaries, power, and online', () => {
  assert.equal(deploymentPhase(null), 'ready');
  assert.equal(deploymentPhase(0), 'blueprint');
  for (const stage of FOUNDATION_STAGES) assert.equal(deploymentPhase(stage.start), stage.key);
  assert.equal(deploymentPhase(FOUNDATION_STAGES.at(-1)!.end), 'power');
  assert.equal(deploymentPhase(DEPLOYMENT_DURATION), 'online');
  assert.equal(deploymentPhase(100000), 'online');
});

test('every build lands within its stage, before power activates, with time to return', () => {
  for (const stage of [0, 1, 2] as const) for (const count of [1, 7, 120]) {
    let previous = 0;
    for (let i = 0; i < count; i++) {
      const at = buildTime(stage, i, count);
      assert(at > previous);
      assert(at >= FOUNDATION_STAGES[stage].start + 1.8);
      assert(at < FOUNDATION_STAGES[stage].end);
      assert(at < POWER_ON);
      assert(at + 1.6 < DEPLOYMENT_DURATION);
      previous = at;
    }
  }
});

test('bots leave the depot, reach the build exactly when it appears, and return continuously', () => {
  const at = 5, duration = 1.5;
  assert.equal(flightProgress(3.4, at, duration).visible, false);
  assert.equal(flightProgress(3.5, at, duration).fraction, 0);
  assert.equal(flightProgress(4.25, at, duration).fraction, 0.5);
  assert.deepEqual(flightProgress(at, at, duration), { visible: true, returning: true, fraction: 1 });
  assert.equal(flightProgress(5.75, at, duration).fraction, 0.5);
  assert.equal(flightProgress(6.5, at, duration).visible, false);
  assert.equal(flightProgress(6.5, at, duration).fraction, 0);
});
