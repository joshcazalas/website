import test from 'node:test';
import assert from 'node:assert/strict';
import { type Point, beltCells, beltPosition, beltRow, railway, createRailLoop, railPosition, nearestRailDistance } from '../src/paths.ts';
import { trainMotion, trainSchedule } from '../src/train-motion.ts';
import { railNetwork } from '../src/rail-network.ts';

test('conveyor paths retain both lanes through every turn and reversal', () => {
  const routes: Point[][] = [
    [[0,0],[96,0],[96,96],[0,96],[0,192]],
    [[0,0],[0,-96],[-96,-96],[-96,96],[96,96],[96,0]],
  ];
  const rows = new Set();
  for(const route of routes)for(const points of [route,[...route].reverse()]) {
    const cells=beltCells(points);
    for(let i=0;i<cells.length;i++) {
      rows.add(beltRow(cells[i]));
      for(const lane of [-6,6]) {
        if(i===cells.length-1)continue;
        const end=beltPosition(cells[i],1,lane), start=beltPosition(cells[i+1],0,lane);
        assert(Math.hypot(end[0]-start[0],end[1]-start[1])<0.001,'Items must not jump at tile boundaries');
      }
      for(const t of [0,.25,.5,.75,1]) {
        const a=beltPosition(cells[i],t,-6), b=beltPosition(cells[i],t,6);
        assert(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-12)<0.001,'The two lanes must stay separated');
      }
    }
  }
  assert.equal(rows.size,12,'Exercise all four straights and eight turns');
});

test('conveyor corners appear once and invalid routes fail before rendering', () => {
  assert.equal(beltCells([[0,0],[64,0],[64,64]]).length,5);
  assert.throws(()=>beltCells([[0,0],[32,32]]),/tile grid/);
  assert.throws(()=>beltCells([[0,0],[48,0]]),/tile grid/);
});

test('railway distance samples keep trains together through bends', () => {
  const points=railway([[0,0],[1024,0],[1536,512],[1536,1536]],224);
  assert.deepEqual(points[0],[0,0]);
  assert(Math.hypot(points.at(-1)![0]-1536,points.at(-1)![1]-1536)<8);
  let previousAngle=0;
  for(let i=1;i<points.length;i++) {
    const dx=points[i][0]-points[i-1][0],dy=points[i][1]-points[i-1][1];
    assert(Math.hypot(dx,dy)>7.95&&Math.hypot(dx,dy)<=8.001);
    const angle=Math.atan2(dy,dx);
    assert(Math.abs(angle-previousAngle)<.12,'Curved rails must not kink between samples');
    previousAngle=angle;
  }
});

test('every production rail circuit closes smoothly and stays inside the map', () => {
  for(const circuit of railNetwork) {
    const loop=createRailLoop(circuit.points,circuit.radius);
    assert.deepEqual(loop.points[0],loop.points.at(-1),circuit.id);
    const before=railPosition(loop,-.1),after=railPosition(loop,.1);
    assert(Math.hypot(before.x-after.x,before.y-after.y)<.201,`${circuit.id}: no position jump at closure`);
    assert(Math.abs(Math.atan2(Math.sin(before.angle-after.angle),Math.cos(before.angle-after.angle)))<.12,`${circuit.id}: no heading snap at closure`);
    for(const [x,y] of loop.points)assert(x>=0&&x<=10496&&y>=0&&y<=7424,`${circuit.id}: whole circuit is explorable`);
  }
});

test('all carriages remain continuous across the lap seam and after many laps', () => {
  for(const circuit of railNetwork) {
    const loop=createRailLoop(circuit.points,circuit.radius);
    for(const train of circuit.trains)for(let car=0;car<train.cars;car++) {
      // Each carriage crosses the seam at a different moment.
      const headAtSeam=car*196;
      const before=railPosition(loop,headAtSeam-.01-car*196),after=railPosition(loop,headAtSeam+.01-car*196);
      assert(Math.hypot(before.x-after.x,before.y-after.y)<.021);
      const a=railPosition(loop,-car*196+123),b=railPosition(loop,loop.length*500-car*196+123);
      assert(Math.hypot(a.x-b.x,a.y-b.y)<.0001);
    }
  }
});

test('depot trains stop on the loading track and accelerate and brake continuously', () => {
  for(const circuit of railNetwork)for(const train of circuit.trains) {
    if(!train.stop)continue;
    const loop=createRailLoop(circuit.points,circuit.radius),stop=nearestRailDistance(loop,train.stop);
    const location=railPosition(loop,stop);
    assert(Math.hypot(location.x-train.stop[0],location.y-train.stop[1])<1);
    const schedule=trainSchedule(loop.length,train.speed,stop,train.dwell);
    const parked=trainMotion(schedule.dwell/2,schedule);
    assert.equal(parked.speed,0);assert.equal(parked.distance,stop);
    assert(trainMotion(schedule.dwell+.5,schedule).speed>0);
    for(const boundary of [schedule.dwell,schedule.dwell+schedule.rampUp,schedule.dwell+schedule.rampUp+schedule.cruiseTime,schedule.period]) {
      const a=trainMotion(boundary-.0001,schedule),b=trainMotion(boundary+.0001,schedule);
      const pa=railPosition(loop,a.distance),pb=railPosition(loop,b.distance);
      assert(Math.hypot(pa.x-pb.x,pa.y-pb.y)<.5,'No teleport at a schedule transition');
      assert(Math.abs(a.speed-b.speed)<1,'No instantaneous starts or stops');
    }
  }
});

test('mainline trains maintain cruising speed and safe spacing across repeated laps', () => {
  for(const circuit of railNetwork.filter(c=>c.trains.length>1)) {
    const loop=createRailLoop(circuit.points,circuit.radius),[first,second]=circuit.trains;
    assert(first.speed>=1600&&first.speed<=2304,'Cruise near the installed game locomotive speed');
    assert.equal(first.speed,second.speed,'Following trains must not catch one another');
    const schedule=trainSchedule(loop.length,first.speed);
    const a=trainMotion(0,schedule),b=trainMotion(.5,schedule);
    assert(Math.abs(b.distance-a.distance-first.speed*.5)<.0001);
    const separation=Math.abs(first.phase-second.phase)*loop.length;
    assert(Math.min(separation,loop.length-separation)>Math.max(first.cars,second.cars)*196+256);
    const c=trainMotion(schedule.period*100+.5,schedule);
    assert(Math.abs(c.distance-b.distance)<.0001);
  }
});
