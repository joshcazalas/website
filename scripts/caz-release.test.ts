import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CazRelease, RELEASE_DURATION, RECOVERY_DURATION } from '../src/caz-release.ts';

test('a release cannot switch before verification, reproduction, and app-state archival',()=>{
  const release=new CazRelease();
  assert.equal(release.snapshot(10).phase,'ready');
  release.start(10);
  for(let t=0;t<8;t+=.125) {
    const s=release.snapshot(10+t);
    assert.equal(s.active,1);assert(!s.archived);
  }
  const activated=release.snapshot(18);
  assert(activated.archived);assert.equal(activated.active,2);
  assert.equal(activated.phase,'activate');assert(activated.busy);
  const accepted=release.snapshot(10+RELEASE_DURATION);
  assert.equal(accepted.phase,'accepted');assert.equal(accepted.active,2);
  assert(!accepted.busy);assert(!accepted.quarantined);
});

test('confirmed health failure reactivates and verifies the previous generation',()=>{
  const release=new CazRelease();release.start(100,true);
  const check=release.snapshot(110);assert(check.unhealthy);assert.equal(check.active,2);
  assert.equal(release.snapshot(114).phase,'confirm');
  assert.equal(release.snapshot(117).phase,'rollback');
  const restored=release.snapshot(120);
  assert.equal(restored.active,1);assert(!restored.unhealthy);assert.equal(restored.phase,'restore');
  const recovered=release.snapshot(100+RECOVERY_DURATION);
  assert.equal(recovered.phase,'recovered');assert(recovered.quarantined);assert(recovered.archived);
  assert.equal(recovered.active,1);assert.equal(recovered.activeSlot,0);
});

test('repeated successes and failures preserve the last healthy generation and physical slot',()=>{
  const release=new CazRelease();let clock=0,active=1,slot=0;
  for(let i=0;i<50;i++) {
    const fail=i%3!==0;assert(release.start(clock,fail));
    const start=release.snapshot(clock);
    assert.equal(start.previous,active);assert.equal(start.previousSlot,slot);
    assert.equal(start.candidate,i+2);
    clock+=30;
    const end=release.snapshot(clock);
    if(!fail){active=i+2;slot=1-slot;}
    assert.equal(end.active,active);assert.equal(end.activeSlot,slot);
  }
});

test('in-flight release cannot be overwritten; the same clock freezes every stage',()=>{
  const release=new CazRelease();release.start(0,true);
  const before=release.snapshot(12);
  assert.equal(release.start(12,false),false);
  for(let i=0;i<10;i++)assert.deepEqual(release.snapshot(12),before);
  assert.equal(release.snapshot(30).phase,'recovered');
});

test('skip and reduced-motion completion have the same outcome as the full sequence',()=>{
  for(const fail of [false,true]) {
    const normal=new CazRelease(),skip=new CazRelease(),instant=new CazRelease();
    normal.start(0,fail);skip.start(0,fail);instant.start(5,fail,true);skip.finish(5);
    assert.deepEqual(skip.snapshot(5),normal.snapshot(30));
    assert.deepEqual(instant.snapshot(5),normal.snapshot(30));
  }
});
