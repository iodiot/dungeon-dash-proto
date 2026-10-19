import { hash32, mulberry32 } from './rng';
import { choosePerk, createRunner, stepRunner, toRecord } from './runner';
import { threat } from './traps';
import { Action, COLS, GhostRecord, HeroId, keyOf, PerkId } from './types';
import { World } from './world';
import type { Runner } from './types';

export interface Personality {
  id: string;
  hero: HeroId;
  greed: number;
  forward: number;
  dash: number;
  patience: number;
  noise: number;
  mistake: number;
}

export const PERSONALITIES: Personality[] = [
  { id: 'steady', hero: 'kira', greed: 0.65, forward: 9, dash: 0.2, patience: 1.4, noise: 1.4, mistake: 0.015 },
  { id: 'daring', hero: 'bagel', greed: 0.45, forward: 12, dash: 1.15, patience: 0.15, noise: 2.6, mistake: 0.05 },
  { id: 'greedy', hero: 'nox', greed: 2.1, forward: 7.5, dash: 0.35, patience: 0.8, noise: 1.8, mistake: 0.03 },
  { id: 'rival', hero: 'kira', greed: 0.9, forward: 11, dash: 0.75, patience: 0.45, noise: 1.1, mistake: 0.02 },
];

const ADJ = ['Swift', 'Bold', 'Quiet', 'Rusty', 'Bright', 'Lucky', 'Nimble', 'Dusky', 'Copper', 'Brisk'];
const NOUN = ['Newt', 'Otter', 'Marten', 'Pebble', 'Lantern', 'Badger', 'Sparrow', 'Cog', 'Finch', 'Moss'];

export function ghostName(seed: number, index: number): string {
  const rng = mulberry32(hash32(seed, 900 + index));
  const a = ADJ[Math.floor(rng() * ADJ.length)];
  const n = NOUN[Math.floor(rng() * NOUN.length)];
  const num = 100 + Math.floor(rng() * 900);
  return a + ' ' + n + ' ' + num;
}

function danger(runner: Runner, world: World, x: number, z: number, tick: number): number {
  if (x < 0 || x >= COLS) return 900;
  if (z < -2) return 80;
  if (z < 0) return 30;
  const cell = world.get(x, z);
  const pit = !cell.walk || (runner.cracks.get(keyOf(x, z)) ?? Infinity) <= tick;
  if (pit) return runner.burrowArmed ? 16 : 460;
  let pen = 0;
  for (const dt of [0, 8, 16, 28]) {
    const th = threat(cell, x, z, tick + dt, runner.telegraph);
    if (th === 'hit') pen = Math.max(pen, dt === 0 ? 250 : 120 - dt);
    else if (th === 'warn') pen = Math.max(pen, 24);
    else if (th === 'push' && dt < 20) pen = Math.max(pen, 18);
  }
  if (cell.cracked) {
    const at = runner.cracks.get(keyOf(x, z));
    if (at !== undefined && tick + 10 >= at) pen = Math.max(pen, 220);
    else pen += 7;
  }
  return pen;
}

function chooseAction(runner: Runner, world: World, p: Personality, rng: () => number): Action | null {
  if (runner.motion || runner.perkPending || !runner.alive) return null;
  if (runner.ability === 'burrow' && !runner.burrowArmed && runner.abilityCd <= 0) {
    if (danger(runner, world, runner.x, runner.z + 1, runner.tick + 10) > 180) return 'ABILITY';
  }

  const fatigue = runner.tick / 10000;
  if (rng() < p.mistake + fatigue * 0.12) {
    const nx = runner.x;
    const nz = runner.z + 1;
    if (nx >= 0 && nx < COLS && nz >= 0 && world.get(nx, nz).walk) return 'F';
  }

  const options: (Action | null)[] = ['F', 'L', 'R', 'B', 'DASH', null];
  let best: Action | null = null;
  let bestScore = -Infinity;
  const gap = runner.collapseArmed ? runner.z - runner.collapseZ : 99;
  for (const action of options) {
    const score = scoreAction(runner, world, p, rng, action, gap);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

function scoreAction(
  runner: Runner,
  world: World,
  p: Personality,
  rng: () => number,
  action: Action | null,
  gap: number,
): number {
  if (action === null) {
    let s = 1 + p.patience * 4;
    s -= danger(runner, world, runner.x, runner.z, runner.tick + 8) * 0.35;
    if (runner.collapseArmed) s -= Math.max(0, 8 - gap) * 5;
    s += (rng() - 0.5) * p.noise;
    return s;
  }
  if (action === 'DASH' && runner.charges < 1) return -80;
  const dash = action === 'DASH';
  const count = dash ? (runner.perks.includes('boots') ? 4 : 3) : 1;
  const tpc = dash ? 4 : 8;
  let dx = 0;
  let dz = 0;
  if (action === 'F' || action === 'DASH') dz = 1;
  else if (action === 'B') dz = -1;
  else if (action === 'L') dx = -1;
  else dx = 1;

  let s = 0;
  let x = runner.x;
  let z = runner.z;
  for (let i = 0; i < count; i++) {
    x += dx;
    z += dz;
    if (x < 0 || x >= COLS) {
      s -= 40;
      break;
    }
    const eta = runner.tick + 1 + (i + 1) * tpc;
    s -= danger(runner, world, x, z, eta);
    if (z >= 0 && x >= 0 && x < COLS) {
      const cell = world.get(x, z);
      const k = keyOf(x, z);
      if (cell.coin && !runner.got.has(k)) s += 8 * p.greed;
      if (cell.spark && !runner.got.has('s' + k) && runner.charges < runner.maxCharges) s += 7;
    }
  }
  s += (z - runner.z) * p.forward;
  if (action === 'B') s -= 6;
  if (dash) s += p.dash * 14;
  if (runner.collapseArmed && z > runner.z && gap < 8) s += (8 - gap) * 6;
  s += (rng() - 0.5) * p.noise;
  return s;
}

function pickWhich(runner: Runner, p: Personality): 'PERK_A' | 'PERK_B' {
  const offer = runner.offer;
  if (!offer) return 'PERK_A';
  const order: PerkId[] =
    p.greed > 1.5
      ? ['gold', 'magnet', 'boots', 'armor', 'compass']
      : p.dash > 0.7
        ? ['boots', 'armor', 'magnet', 'compass', 'gold']
        : ['armor', 'magnet', 'boots', 'compass', 'gold'];
  for (const id of order) {
    if (offer[1] === id && offer[0] !== id) return 'PERK_B';
    if (offer[0] === id) return 'PERK_A';
  }
  return 'PERK_A';
}

export function runBot(runner: Runner, world: World, p: Personality, rng: () => number): void {
  let guard = 0;
  while (runner.alive && runner.tick < 9000 && runner.bestZ < 1400 && guard++ < 20000) {
    if (runner.perkPending && runner.offer) {
      choosePerk(runner, pickWhich(runner, p));
      continue;
    }
    const action = chooseAction(runner, world, p, rng);
    stepRunner(runner, world, action, true);
  }
  if (runner.alive) {
    runner.alive = false;
    runner.cause = 'time';
  }
  runner.hash = hash32(runner.bestZ, hash32(runner.coins, hash32(runner.tick, runner.x + runner.z * 8)));
}

const cache = new Map<number, GhostRecord[]>();

export function bakeGhosts(seed: number): GhostRecord[] {
  const key = seed >>> 0;
  const hit = cache.get(key);
  if (hit) return hit.map(cloneRecord);
  const world = new World(key);
  const records = PERSONALITIES.map((p, i) => {
    const runner = createRunner({
      seed: key,
      hero: p.hero,
      upgraded: false,
      assist: false,
      perkSalt: 100 + i,
    });
    runBot(runner, world, p, mulberry32(hash32(key, 400 + i)));
    return toRecord(runner, ghostName(key, i));
  });
  cache.set(key, records);
  return records.map(cloneRecord);
}

function cloneRecord(record: GhostRecord): GhostRecord {
  return {
    ...record,
    events: record.events.map((e) => ({ t: e.t, a: e.a })),
    result: { ...record.result },
  };
}
