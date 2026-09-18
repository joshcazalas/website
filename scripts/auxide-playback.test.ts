import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AuxidePlayback, SERVERS, TRACKS, notesAt } from '../src/auxide-playback.ts';
const samples = JSON.parse(await readFile(new URL('../src/auxide-samples.json',import.meta.url),'utf8'));

test('pausing a guild freezes its whole clock while the other actors advance', () => {
  const playback = new AuxidePlayback();
  playback.toggle(0,10);
  assert.equal(playback.snapshot(0,20).total,10);
  assert.equal(playback.snapshot(1,20).total,20);
  assert.equal(playback.snapshot(2,20).total,20);
  playback.toggle(0,25);
  assert.equal(playback.snapshot(0,30).total,15,'Resume must continue from the same position');
});

test('skip changes only the selected guild and preserves its paused state', () => {
  const playback = new AuxidePlayback();
  playback.toggle(1,5);
  const before = playback.snapshots(10);
  playback.skip(1,10);
  const after = playback.snapshots(10);
  assert.deepEqual(after[0],before[0]); assert.deepEqual(after[2],before[2]);
  assert.notEqual(after[1].track,before[1].track);
  assert.equal(after[1].position,0);
  assert.equal(after[1].playing,false);
  assert.equal(after[1].generation,before[1].generation+1);
});

test('repeated skips and fractional-tempo boundaries always enter the next track', () => {
  const playback = new AuxidePlayback();
  for(let server=0;server<SERVERS.length;server++) for(let i=0;i<500;i++) {
    const before = playback.snapshot(server,0);
    playback.skip(server,0);
    const after = playback.snapshot(server,0);
    assert.equal(after.turn,before.turn+1);
    assert.equal(after.track,SERVERS[server].order[after.turn%3]);
    assert.equal(after.position,0);
    assert.equal(after.step,0);
    assert(after.fraction>=0&&after.fraction<1);
  }
});

test('slow frames can cross multiple tracks without losing the playback position', () => {
  const playback = new AuxidePlayback();
  for(let server=0;server<SERVERS.length;server++) {
    const duration=playback.snapshot(server,0).duration;
    const current=playback.snapshot(server,duration*7+0.125);
    assert.equal(current.turn,7);
    assert.equal(current.track,SERVERS[server].order[1]);
    assert(Math.abs(current.position-0.125)<1e-10);
  }
});

test('every musical event has an imported sample and a bounded gain', () => {
  for(let track=0;track<TRACKS.length;track++) for(let step=0;step<64;step++) {
    const events=notesAt(track,step);
    assert(events.length<=3);
    for(const note of events) { assert(note.sample in samples); assert(note.gain>0&&note.gain<=1); }
  }
});
