import { validateTemplates } from '../src/sim/chunks';
import { bakeGhosts, PERSONALITIES } from '../src/sim/bot';
import { createRunner, samplePose, stepRunner } from '../src/sim/runner';
import { makeGhost, stepGhost } from '../src/sim/session';
import { DAILY_SEEDS } from '../src/sim/types';
import { World } from '../src/sim/world';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

validateTemplates();

const seed = DAILY_SEEDS[0];
const a = new World(seed);
const b = new World(seed);
a.ensure(600);
b.ensure(600);
for (let z = 0; z < 600; z++) {
  for (let x = 0; x < 5; x++) {
    const ca = a.get(x, z);
    const cb = b.get(x, z);
    assert(ca.chunkId === cb.chunkId && ca.walk === cb.walk && ca.coin === cb.coin, 'world diverged at ' + z);
    assert(!!ca.crusher === !!cb.crusher && !!ca.boulder === !!cb.boulder, 'traps diverged');
  }
}
assert(a.get(2, 250).shrine, 'missing shrine at 250, chunk ' + a.get(2, 250).chunkId + ' z cell shrine=' + a.get(2, 250).shrine);
assert(a.get(2, 500).shrine, 'missing shrine at 500');

const runner = createRunner({ seed, hero: 'kira', upgraded: false, assist: false, perkSalt: 3 });
const world = new World(seed);
for (let i = 0; i < 160; i++) stepRunner(runner, world, 'F', false);
assert(runner.alive, 'tutorial death ' + runner.cause + ' at ' + runner.z);
assert(runner.bestZ >= 15, 'tutorial distance ' + runner.bestZ);

const idle = createRunner({ seed, hero: 'kira', upgraded: false, assist: false, perkSalt: 3 });
const idleWorld = new World(seed);
idle.z = 10;
idle.x = 2;
idle.bestZ = 25;
for (let i = 0; i < 60 * 20 && idle.alive; i++) stepRunner(idle, idleWorld, null, false);
assert(!idle.alive && idle.cause === 'collapse', 'expected collapse, got ' + idle.cause);

const t0 = performance.now();
const records = bakeGhosts(seed);
const bakeMs = performance.now() - t0;
console.log('bake', bakeMs.toFixed(1), 'ms');
for (let i = 0; i < records.length; i++) {
  const record = records[i];
  const ghost = makeGhost(record);
  const ghostWorld = new World(seed);
  let guard = 0;
  while (ghost.runner.tick < record.result.ticks && ghost.runner.alive && guard++ < 20000) {
    stepGhost(ghost, ghostWorld);
  }
  const g = ghost.runner;
  if (g.bestZ !== record.result.distance || g.coins !== record.result.coins || g.tick !== record.result.ticks) {
    console.error('replay mismatch', PERSONALITIES[i].id, {
      best: g.bestZ,
      coins: g.coins,
      tick: g.tick,
      x: g.x,
      z: g.z,
      cause: g.cause,
      want: record.result,
    });
    throw new Error('replay mismatch ' + PERSONALITIES[i].id);
  }
  console.log(
    PERSONALITIES[i].id.padEnd(8),
    'dist',
    String(record.result.distance).padStart(4),
    'coins',
    String(record.result.coins).padStart(4),
    'ticks',
    record.result.ticks,
    'cause',
    record.result.cause,
    'events',
    record.events.length,
    'replay-ok',
  );
}

const steady = records[0].result.distance;
assert(steady >= 80, 'steady bot only reached ' + steady);

const pose = samplePose(runner, runner.tick);
assert(Number.isFinite(pose.x) && Number.isFinite(pose.z), 'pose');

const seed2 = DAILY_SEEDS[3];
const more = bakeGhosts(seed2);
console.log('seed', seed2.toString(16), more.map((r) => r.result.distance).join(', '));
console.log('playout ok');
