import test from 'node:test';
import assert from 'node:assert/strict';
import { beltCells, beltPosition, type Point } from '../src/paths.ts';
import { intersectsMachine, planBelts, tileKey, type BeltPlan } from '../src/belt-network.ts';
import { storageCycle, transferPosition, transferProgress, TRANSFER_DISTANCE } from '../src/belt-transfers.ts';

const request = (points: Point[]) => ({ cells: beltCells(points), items: 'iron', speed: 44, phase: 0 });
const near = (a: Point,b: Point) => assert(Math.hypot(a[0]-b[0],a[1]-b[1]) < .001, `${a} must meet ${b}`);

function audit(plans: BeltPlan[]) {
  const tiles = new Set<string>();
  for (const plan of plans) {
    for (const c of plan.cells.filter(c => !c.hidden)) {
      assert(!tiles.has(tileKey(c)), 'Belts, chests, and inserters need their own tiles');
      tiles.add(tileKey(c));
    }
    assert.equal(plan.portals.length % 2,0,'Every underground entrance needs an exit');
    for (let i = 0; i < plan.portals.length; i += 2) {
      const start=plan.portals[i],end=plan.portals[i+1];
      assert(start.input && !end.input);
      const a=plan.cells.indexOf(start.cell),b=plan.cells.indexOf(end.cell);
      assert(b-a > 1 && b-a <= 9,'Underground spans must fit express belt reach');
      assert(plan.cells.slice(a+1,b).every(c => c.hidden),'Items stay underground between the mouths');
      assert.equal(start.cell.dx,end.cell.dx);assert.equal(start.cell.dy,end.cell.dy);
    }
    if (plan.closed) {
      for (const lane of [-6,6]) near(beltPosition(plan.cells.at(-1)!,1,lane),beltPosition(plan.cells[0],0,lane));
    } else {
      assert(plan.cells.length>=8);
      for (const end of [plan.cells.slice(0,4),plan.cells.slice(-4)]) {
        for (const c of end) {
          assert(!c.hidden && !plan.portals.some(p=>p.cell===c),'Storage terminals stay clear of tunnel mouths');
          assert.equal(c.dx,end[0].dx);assert.equal(c.dy,end[0].dy);
          assert.equal(c.ix,c.dx);assert.equal(c.iy,c.dy);
        }
      }
    }
  }
}

test('open belts reserve separate chest, inserter, and belt tiles at both ends', () => {
  for (const points of [[[0,0],[640,0]],[[0,0],[0,-640]],[[640,0],[0,0]],[[0,-640],[0,0]]] as Point[][]) {
    const plans=planBelts([request(points)],()=>false);
    assert.equal(plans.length,1);assert(!plans[0].closed);audit(plans);
  }
});

test('closed sushi belts keep both lanes continuous across the lap seam', () => {
  const loop: Point[]=[[0,0],[640,0],[640,192],[0,192],[0,0]];
  for (const points of [loop,[...loop].reverse()]) {
    const plans=planBelts([request(points)],()=>false);
    assert.equal(plans.length,1);assert(plans[0].closed);
    assert.equal(plans[0].cells.length,52,'The first tile must not be rendered twice');
    audit(plans);
  }
});

test('off-grid accumulators and machines at endpoints never share visible belt or storage tiles', () => {
  const machines=[{x:0,y:0,half:32},{x:320,y:16,half:32},{x:1024,y:0,half:48}];
  const plans=planBelts([request([[0,0],[1024,0]])],c=>intersectsMachine(c,machines));
  assert(plans.length>0);audit(plans);
  for (const plan of plans) for (const c of plan.cells) if (!c.hidden) assert(!intersectsMachine(c,machines));
  assert(plans[0].cells[0].x>=64,'The source must move out of the occupied footprint');
});

test('crossing and overlapping authored routes do not draw duplicate surface tiles', () => {
  const plans=planBelts([
    request([[0,0],[1024,0]]),request([[512,-512],[512,512]]),
    request([[128,0],[800,0]]),request([[256,-256],[256,0],[1280,0],[1280,512]]),
  ],()=>false);
  assert(plans.some(p=>p.portals.length===2));audit(plans);
});

test('long obstacles and blocked corners split into storage runs instead of impossible tunnels', () => {
  const plans=planBelts([request([[0,0],[1024,0],[1024,768]])],c=>(c.x>=384&&c.x<=704&&c.y===0)||(c.x===1024&&c.y===0));
  assert(plans.length>=2);audit(plans);
  assert.equal(plans.flatMap(p=>p.portals).length,0);
});

test('short crossing mouths remain paired even when adjacent routes force trimming', () => {
  for (let offset=0;offset<30;offset++) {
    const blocked=new Set([offset*32,(offset+5)*32,(offset+8)*32]);
    const plans=planBelts([request([[0,0],[1024,0]])],c=>blocked.has(c.x));
    audit(plans);
  }
});

test('storage transfers meet both belt lanes exactly in every direction and recycle inside the chest', () => {
  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const cells=beltCells([[0,0],[dx*640,dy*640]]),n=cells.length;
    const cycle=storageCycle(n);
    assert(cycle.spacing>TRANSFER_DISTANCE*2,'Allow time for the empty return swing');
    for (const lane of [-6,6]) {
      near(transferPosition(cells[1].x,cells[1].y,dx,dy,true,0,lane),[cells[0].x,cells[0].y]);
      near(transferPosition(cells[1].x,cells[1].y,dx,dy,true,1,lane),beltPosition(cells[2],.5,lane));
      near(transferPosition(cells[n-2].x,cells[n-2].y,-dx,-dy,false,0,lane),beltPosition(cells[n-3],.5,lane));
      near(transferPosition(cells[n-2].x,cells[n-2].y,-dx,-dy,false,1,lane),[cells[n-1].x,cells[n-1].y]);
    }
    for (let stack=0;stack<cycle.stacks;stack++) for (const d of [0,4,8,12,15.99]) {
      const t=transferProgress(d+stack*cycle.spacing,cycle.spacing);
      assert(Math.abs(t-d/TRANSFER_DISTANCE)<.0001,'Each carried stack follows the hand clock');
    }
    assert.equal(transferProgress(TRANSFER_DISTANCE,cycle.spacing),1);
    assert.equal(transferProgress(cycle.spacing,cycle.spacing),0);
  }
});
