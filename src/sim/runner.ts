import { heroMods } from './heroes';
import { hash32, mulberry32 } from './rng';
import { CONVEYOR_EVERY, CRACK_DELAY, lethalKind, STEAM_PERIOD, threat } from './traps';
import {
  Action,
  BUFFER_TICKS,
  COLS,
  collapseSpeed,
  DASH_CELL_TICKS,
  DeathCause,
  Fx,
  GhostRecord,
  HeroId,
  HOP_TICKS,
  keyOf,
  MAX_CHARGES,
  Motion,
  multiplier,
  PERK_EVERY,
  PerkId,
  Runner,
  targetGap,
  TUTORIAL_Z,
} from './types';
import { World } from './world';

const PERK_POOL: PerkId[] = ['magnet', 'boots', 'armor', 'gold', 'compass'];

export interface RunnerOpts {
  seed: number;
  hero: HeroId;
  upgraded: boolean;
  assist: boolean;
  perkSalt: number;
}

export function createRunner(opts: RunnerOpts): Runner {
  const mods = heroMods(opts.hero, opts.upgraded);
  return {
    seed: opts.seed >>> 0,
    hero: opts.hero,
    upgraded: opts.upgraded,
    perkSalt: opts.perkSalt,
    assist: opts.assist,
    tick: 0,
    x: 2,
    z: 0,
    bestZ: 0,
    motion: null,
    motionIdx: 0,
    buffer: null,
    charges: 1,
    chargeAcc: 0,
    regenTicks: mods.regenTicks,
    maxCharges: MAX_CHARGES,
    telegraph: mods.telegraph,
    viewExtra: mods.viewExtra,
    ability: mods.ability,
    abilityCdMax: mods.abilityCd,
    abilityCd: 0,
    burrowArmed: false,
    momentum: 0,
    mult: 1,
    coins: 0,
    perks: [],
    offer: null,
    perkPending: false,
    nextPerkAt: PERK_EVERY,
    perkRng: mulberry32(hash32(opts.seed >>> 0, opts.perkSalt)),
    got: new Set(),
    cracks: new Map(),
    lastSteamCycle: -1,
    collapseZ: -12,
    collapseArmed: false,
    alive: true,
    cause: null,
    deathChunk: '',
    invuln: 0,
    armor: 0,
    compass: 0,
    revived: false,
    events: [],
    fx: [],
    hash: 0,
  };
}

export function stateHash(state: Runner): number {
  return hash32(state.bestZ, hash32(state.coins, hash32(state.tick, state.x + state.z * 8)));
}

export function toRecord(state: Runner, name: string): GhostRecord {
  return {
    v: 1,
    seed: state.seed,
    hero: state.hero,
    upgraded: state.upgraded,
    perkSalt: state.perkSalt,
    name,
    events: state.events.map((e) => ({ t: e.t, a: e.a })),
    result: {
      ticks: state.tick,
      distance: state.bestZ,
      coins: state.coins,
      cause: state.cause ?? 'time',
      hash: stateHash(state),
    },
  };
}

function pushFx(state: Runner, fx: Fx): void {
  state.fx.push(fx);
  if (state.fx.length > 24) state.fx.shift();
}

function coinValue(state: Runner): number {
  const m = multiplier(state.momentum);
  state.mult = m;
  return state.perks.includes('gold') ? Math.max(1, Math.round(m * 1.5)) : m;
}

function die(state: Runner, world: World, cause: DeathCause): void {
  if (!state.alive) return;
  state.alive = false;
  state.cause = cause;
  state.motion = null;
  const cell = state.z >= 0 ? world.get(state.x, state.z) : null;
  state.deathChunk = cell?.chunkId ?? '';
  state.hash = stateHash(state);
  pushFx(state, { kind: 'death', x: state.x, z: state.z });
}

function broken(state: Runner, x: number, z: number, tick: number): boolean {
  const at = state.cracks.get(keyOf(x, z));
  return at !== undefined && tick >= at;
}

function collectAt(state: Runner, world: World, x: number, z: number): void {
  if (z < 0 || x < 0 || x >= COLS) return;
  const cell = world.get(x, z);
  const k = keyOf(x, z);
  if (cell.coin && !state.got.has(k)) {
    state.got.add(k);
    const v = coinValue(state);
    state.coins += v;
    pushFx(state, { kind: 'coin', x, z, text: '+' + v });
  }
  if (cell.spark && !state.got.has('s' + k)) {
    state.got.add('s' + k);
    if (state.charges < state.maxCharges) state.charges += 1;
    pushFx(state, { kind: 'spark', x, z });
  }
}

function magnet(state: Runner, world: World, x: number, z: number): void {
  if (!state.perks.includes('magnet')) return;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dz === 0) continue;
      collectAt(state, world, x + dx, z + dz);
    }
  }
}

function enterCell(state: Runner, world: World, x: number, z: number, burrow: boolean): void {
  state.x = x;
  state.z = z;
  if (z > state.bestZ) state.bestZ = z;
  if (z < 0) {
    die(state, world, 'fall');
    return;
  }
  const cell = world.get(x, z);
  const pit = !cell.walk || broken(state, x, z, state.tick);
  if (pit && !burrow) {
    die(state, world, 'fall');
    return;
  }
  if (cell.cracked && !broken(state, x, z, state.tick)) {
    const k = keyOf(x, z);
    if (!state.cracks.has(k)) state.cracks.set(k, state.tick + CRACK_DELAY);
  }
  if (!burrow && state.invuln <= 0 && cell.walk) {
    const kind = lethalKind(cell, x, z, state.tick);
    if (kind) {
      if (state.armor > 0) {
        state.armor -= 1;
        state.invuln = 46;
        pushFx(state, { kind: 'armor', x, z, text: 'Plating' });
      } else {
        die(state, world, kind);
        return;
      }
    }
  }
  collectAt(state, world, x, z);
  magnet(state, world, x, z);
}

function advanceMotion(state: Runner, world: World): void {
  const motion = state.motion;
  if (!motion) return;
  const elapsed = state.tick - motion.startTick;
  const idx = Math.min(motion.cells.length - 1, Math.floor(elapsed / motion.ticksPerCell));
  while (state.motionIdx < idx) {
    state.motionIdx += 1;
    const cell = motion.cells[state.motionIdx];
    enterCell(state, world, cell.x, cell.z, cell.burrow);
    if (!state.alive) {
      state.motion = null;
      return;
    }
  }
  const total = (motion.cells.length - 1) * motion.ticksPerCell;
  if (elapsed >= total) {
    const last = motion.cells[motion.cells.length - 1];
    const first = motion.cells[0];
    state.x = last.x;
    state.z = last.z;
    if (state.z > state.bestZ) state.bestZ = state.z;
    const dz = last.z - first.z;
    if (dz > 0) state.momentum = Math.min(100, state.momentum + (motion.kind === 'dash' ? 16 : 7));
    else if (dz < 0) state.momentum = Math.max(0, state.momentum - 24);
    else state.momentum = Math.max(0, state.momentum - 4);
    state.motion = null;
    pushFx(state, { kind: 'land', x: state.x, z: state.z });
  }
}

function tryMove(state: Runner, world: World, action: Action): boolean {
  let dx = 0;
  let dz = 0;
  let count = 1;
  let kind: Motion['kind'] = 'hop';
  if (action === 'F') dz = 1;
  else if (action === 'B') dz = -1;
  else if (action === 'L') dx = -1;
  else if (action === 'R') dx = 1;
  else if (action === 'DASH') {
    dz = 1;
    if (state.charges >= 1) {
      count = state.perks.includes('boots') ? 4 : 3;
      kind = 'dash';
    }
  } else return false;

  const cells: Motion['cells'] = [{ x: state.x, z: state.z, burrow: false }];
  let x = state.x;
  let z = state.z;
  let burrowLeft = state.burrowArmed;
  let usedBurrow = false;
  for (let i = 0; i < count; i++) {
    const nx = x + dx;
    const nz = z + dz;
    // Moving beyond either edge of the lane is a real pit. Let the runner
    // enter the out-of-bounds cell so enterCell can resolve the fall.
    if (nz < -6) break;
    const pit = nz >= 0 && (!world.get(nx, nz).walk || broken(state, nx, nz, state.tick));
    if (pit && burrowLeft) {
      const fx = nx + dx;
      const fz = nz + dz;
      const farOk = fx >= 0 && fx < COLS && fz >= 0 && world.get(fx, fz).walk && !broken(state, fx, fz, state.tick);
      if (farOk) {
        cells.push({ x: fx, z: fz, burrow: true });
        x = fx;
        z = fz;
        burrowLeft = false;
        usedBurrow = true;
        continue;
      }
    }
    cells.push({ x: nx, z: nz, burrow: false });
    x = nx;
    z = nz;
    if (pit) break;
  }
  if (cells.length < 2) return false;
  if (kind === 'dash') state.charges -= 1;
  if (usedBurrow) {
    state.burrowArmed = false;
    state.abilityCd = state.abilityCdMax;
  }
  state.motion = {
    kind,
    cells,
    startTick: state.tick,
    ticksPerCell: kind === 'dash' ? DASH_CELL_TICKS : HOP_TICKS,
    forced: false,
  };
  state.motionIdx = 0;
  pushFx(state, { kind: kind === 'dash' ? 'dash' : 'hop', x: state.x, z: state.z });
  return true;
}

function forceMove(state: Runner, world: World, dx: number, dz: number): boolean {
  const nx = state.x + dx;
  const nz = state.z + dz;
  // Forced pushes (steam and conveyors) can also carry the runner off an edge.
  if (nz < -6) return false;
  state.motion = {
    kind: 'hop',
    cells: [
      { x: state.x, z: state.z, burrow: false },
      { x: nx, z: nz, burrow: false },
    ],
    startTick: state.tick,
    ticksPerCell: 6,
    forced: true,
  };
  state.motionIdx = 0;
  void world;
  return true;
}

function trySteam(state: Runner, world: World): boolean {
  if (state.z < 0) return false;
  const cell = world.get(state.x, state.z);
  if (!cell.steam) return false;
  if (threat(cell, state.x, state.z, state.tick, state.telegraph) !== 'push') return false;
  const cycle = Math.floor((state.tick + cell.steam.phase) / STEAM_PERIOD);
  if (cycle === state.lastSteamCycle) return false;
  state.lastSteamCycle = cycle;
  return forceMove(state, world, 0, -1);
}

function tryConveyor(state: Runner, world: World): boolean {
  if (state.z < TUTORIAL_Z) return false;
  const cell = world.get(state.x, state.z);
  if (!cell.conveyor) return false;
  const phase = hash32(state.z, state.x) % CONVEYOR_EVERY;
  if ((state.tick + phase) % CONVEYOR_EVERY !== 0) return false;
  return forceMove(state, world, cell.conveyor, 0);
}

function openPerk(state: Runner): void {
  const pool = PERK_POOL.filter((p) => !state.perks.includes(p));
  if (pool.length < 2) {
    state.nextPerkAt += PERK_EVERY;
    return;
  }
  const i = Math.floor(state.perkRng() * pool.length);
  const a = pool.splice(i, 1)[0];
  const j = Math.floor(state.perkRng() * pool.length);
  const b = pool[j];
  state.offer = [a, b];
  state.perkPending = true;
}

export function applyPerk(state: Runner, perk: PerkId): void {
  if (!state.perks.includes(perk)) state.perks.push(perk);
  if (perk === 'armor') state.armor = Math.max(state.armor, 1);
  if (perk === 'compass') state.compass = 180;
  state.offer = null;
  state.perkPending = false;
  state.nextPerkAt += PERK_EVERY;
  pushFx(state, { kind: 'perk', x: state.x, z: state.z, text: perk });
}

export function choosePerk(state: Runner, which: 'PERK_A' | 'PERK_B'): PerkId | null {
  if (!state.perkPending || !state.offer) return null;
  const perk = which === 'PERK_A' ? state.offer[0] : state.offer[1];
  state.events.push({ t: state.tick, a: which });
  applyPerk(state, perk);
  return perk;
}

function arm(state: Runner): void {
  if (state.ability !== 'burrow') return;
  if (state.abilityCd > 0 || state.burrowArmed) return;
  state.burrowArmed = true;
  pushFx(state, { kind: 'burrow', x: state.x, z: state.z, text: 'Burrow' });
}

function advanceCollapse(state: Runner): void {
  if (state.bestZ < TUTORIAL_Z) {
    state.collapseZ = -14;
    return;
  }
  if (!state.collapseArmed) {
    state.collapseArmed = true;
    state.collapseZ = state.z - targetGap(state.bestZ) - 2.4;
  }
  const speed = collapseSpeed(state.bestZ, state.assist);
  const gap = state.z - state.collapseZ;
  const target = targetGap(state.bestZ);
  let v = speed;
  if (gap > target + 0.4) v = Math.max(speed, speed + (gap - target) * 3.1);
  state.collapseZ += v / 60;
}

function consumeBuffer(state: Runner, world: World): void {
  const buf = state.buffer;
  if (!buf) return;
  const age = state.tick - buf.tick;
  if (buf.fromAir || age <= BUFFER_TICKS) {
    tryMove(state, world, buf.a);
    state.buffer = null;
    return;
  }
  if (age > BUFFER_TICKS) state.buffer = null;
}

/**
 * One fixed 60 Hz tick. `action` is the command for this tick.
 * When `record` is set, non-null actions are stored at the post-increment tick.
 * Perk picks are recorded by `choosePerk`, not here.
 */
export function stepRunner(state: Runner, world: World, action: Action | null, record = false): void {
  if (!state.alive || state.perkPending) return;
  state.tick += 1;
  if (record && action) state.events.push({ t: state.tick, a: action });

  if (action === 'ABILITY') {
    arm(state);
    action = null;
  }
  if (action) state.buffer = { a: action, tick: state.tick, fromAir: !!state.motion };

  if (state.charges < state.maxCharges) {
    state.chargeAcc += 1;
    if (state.chargeAcc >= state.regenTicks) {
      state.chargeAcc -= state.regenTicks;
      state.charges += 1;
    }
  }
  if (state.abilityCd > 0) state.abilityCd -= 1;
  if (state.invuln > 0) state.invuln -= 1;
  if (state.compass > 0) state.compass -= 1;

  advanceCollapse(state);

  if (state.motion) {
    advanceMotion(state, world);
    if (!state.alive) return;
  }

  if (!state.motion) {
    if (!trySteam(state, world) && !tryConveyor(state, world)) consumeBuffer(state, world);
  }

  if (state.motion || !state.alive) {
    state.mult = multiplier(state.momentum);
    return;
  }

  if (state.z >= 0 && broken(state, state.x, state.z, state.tick)) {
    die(state, world, 'fall');
    return;
  }

  if (state.invuln <= 0 && state.z >= 0) {
    const cell = world.get(state.x, state.z);
    const kind = cell.walk ? lethalKind(cell, state.x, state.z, state.tick) : null;
    if (kind) {
      if (state.armor > 0) {
        state.armor -= 1;
        state.invuln = 46;
        pushFx(state, { kind: 'armor', x: state.x, z: state.z, text: 'Plating' });
      } else {
        die(state, world, kind);
        return;
      }
    }
  }

  if (state.collapseArmed && state.collapseZ >= state.z) {
    die(state, world, 'collapse');
    return;
  }

  state.momentum = Math.max(0, state.momentum - 0.42);
  state.mult = multiplier(state.momentum);

  if (state.bestZ >= state.nextPerkAt && state.z >= state.nextPerkAt - 1) openPerk(state);
}

export function samplePose(state: Runner, tickFloat: number): { x: number; z: number; arc: number; kind: Motion['kind'] | null } {
  const motion = state.motion;
  if (!motion || !state.alive) return { x: state.x, z: state.z, arc: 0, kind: null };
  const elapsed = Math.max(0, tickFloat - motion.startTick);
  const segs = motion.cells.length - 1;
  const total = segs * motion.ticksPerCell;
  const u = total <= 0 ? 1 : Math.min(1, elapsed / total);
  const f = u * segs;
  const i = Math.min(segs - 1, Math.floor(f));
  const local = f - i;
  const ease = local * local * (3 - 2 * local);
  const a = motion.cells[i];
  const b = motion.cells[i + 1];
  return {
    x: a.x + (b.x - a.x) * ease,
    z: a.z + (b.z - a.z) * ease,
    arc: Math.sin(Math.PI * local),
    kind: motion.kind,
  };
}

export function revive(state: Runner, world: World): boolean {
  if (state.alive || state.revived) return false;
  state.revived = true;
  state.alive = true;
  state.cause = null;
  state.motion = null;
  state.invuln = 70;
  state.collapseZ = state.z - 5;
  state.collapseArmed = state.bestZ >= TUTORIAL_Z;
  if (state.z >= 0) {
    const cell = world.get(state.x, state.z);
    const bad = !cell.walk || broken(state, state.x, state.z, state.tick);
    if (bad) {
      const spots = [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
        [-1, -1],
        [1, -1],
      ];
      for (const [dx, dz] of spots) {
        const nx = state.x + dx;
        const nz = state.z + dz;
        if (nx < 0 || nx >= COLS || nz < 0) continue;
        const n = world.get(nx, nz);
        if (n.walk && !broken(state, nx, nz, state.tick)) {
          state.x = nx;
          state.z = nz;
          break;
        }
      }
    }
  }
  return true;
}
