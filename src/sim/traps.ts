import { mod } from './rng';
import { BoulderSpec, Cell, Swing, Threat } from './types';

export const CRUSHER_PERIOD = 96;
export const CRUSHER_HIT = 10;
export const CRUSHER_WARN = 36;

export const STEAM_PERIOD = 120;
export const STEAM_PUSH = 16;
export const STEAM_WARN = 24;

export const SWING_PERIOD = 84;
export const CRAB_PERIOD = 112;
export const BOULDER_PERIOD = 156;
export const BOULDER_TRAVEL = 112;
export const CONVEYOR_EVERY = 30;
export const CRACK_DELAY = 30;

export function sweep(min: number, max: number, tick: number, phase: number, period: number): { pos: number; dir: number } {
  const span = Math.max(0, max - min);
  const t = mod(tick + phase, period);
  const half = period / 2;
  if (span === 0) return { pos: min, dir: 1 };
  if (t < half) {
    return { pos: min + Math.round((t / half) * span), dir: 1 };
  }
  return { pos: min + Math.round((1 - (t - half) / half) * span), dir: -1 };
}

function approaching(pos: number, dir: number, target: number, min: number, max: number, period: number, withinTicks: number): boolean {
  const span = Math.max(1, max - min);
  const ticksPerCell = period / 2 / span;
  const dist = Math.abs(pos - target);
  if (dist === 0) return false;
  const toward = (dir > 0 && target > pos) || (dir < 0 && target < pos);
  return toward && dist * ticksPerCell <= withinTicks;
}

export function boulderZ(spec: BoulderSpec, tick: number): number | null {
  const span = Math.max(1, spec.z1 - spec.z0);
  const t = mod(tick + spec.phase, BOULDER_PERIOD);
  if (t >= BOULDER_TRAVEL) return null;
  return spec.z1 - Math.floor((t / BOULDER_TRAVEL) * span);
}

export function threat(cell: Cell, x: number, z: number, tick: number, scale: number): Threat {
  let hit = false;
  let warn = false;
  let push = false;

  if (cell.crusher) {
    const t = mod(tick + cell.crusher.phase, CRUSHER_PERIOD);
    const hitStart = CRUSHER_PERIOD - CRUSHER_HIT;
    const warnStart = hitStart - Math.round(CRUSHER_WARN * scale);
    if (t >= hitStart) hit = true;
    else if (t >= Math.max(0, warnStart)) warn = true;
  }

  if (cell.steam) {
    const t = mod(tick + cell.steam.phase, STEAM_PERIOD);
    const pushStart = STEAM_PERIOD - STEAM_PUSH;
    const warnStart = pushStart - Math.round(STEAM_WARN * scale);
    if (t >= pushStart) push = true;
    else if (t >= Math.max(0, warnStart)) warn = true;
  }

  if (cell.pendulum) {
    const s = sweep(cell.pendulum.min, cell.pendulum.max, tick, cell.pendulum.phase, SWING_PERIOD);
    if (s.pos === x) hit = true;
    else if (approaching(s.pos, s.dir, x, cell.pendulum.min, cell.pendulum.max, SWING_PERIOD, Math.round(20 * scale))) warn = true;
  }

  if (cell.beetle) {
    const s = sweep(cell.beetle.min, cell.beetle.max, tick, cell.beetle.phase, SWING_PERIOD);
    if (s.pos === x) hit = true;
    else if (approaching(s.pos, s.dir, x, cell.beetle.min, cell.beetle.max, SWING_PERIOD, Math.round(16 * scale))) warn = true;
  }

  if (cell.crab) {
    const s = sweep(cell.crab.min, cell.crab.max, tick, cell.crab.phase, CRAB_PERIOD);
    if (s.pos === z) hit = true;
    else if (approaching(s.pos, s.dir, z, cell.crab.min, cell.crab.max, CRAB_PERIOD, Math.round(18 * scale))) warn = true;
  }

  if (cell.boulder) {
    const bz = boulderZ(cell.boulder, tick);
    if (bz === z) hit = true;
    else if (bz !== null && bz > z && bz - z <= Math.round(3 * scale)) warn = true;
  }

  if (hit) return 'hit';
  if (push) return 'push';
  if (warn) return 'warn';
  return 'ok';
}

export function lethalKind(cell: Cell, x: number, z: number, tick: number): 'enemy' | 'trap' | null {
  if (cell.beetle) {
    const s = sweep(cell.beetle.min, cell.beetle.max, tick, cell.beetle.phase, SWING_PERIOD);
    if (s.pos === x) return 'enemy';
  }
  if (cell.crab) {
    const s = sweep(cell.crab.min, cell.crab.max, tick, cell.crab.phase, CRAB_PERIOD);
    if (s.pos === z) return 'enemy';
  }
  if (threat(cell, x, z, tick, 1) === 'hit') return 'trap';
  return null;
}

/** 0..1 telegraph strength for visuals. Hit reads as 1. */
export function telegraphAmount(cell: Cell, x: number, z: number, tick: number, scale: number): number {
  const th = threat(cell, x, z, tick, scale);
  if (th === 'hit' || th === 'push') return 1;
  if (th === 'warn') return 0.65;
  return 0;
}

export function crusherDrop(phase: number, tick: number, scale: number): number {
  const t = mod(tick + phase, CRUSHER_PERIOD);
  const hitStart = CRUSHER_PERIOD - CRUSHER_HIT;
  const warnStart = hitStart - Math.round(CRUSHER_WARN * scale);
  if (t >= hitStart) return 1;
  if (t >= warnStart) return (t - warnStart) / Math.max(1, hitStart - warnStart);
  return 0;
}

export function emptySwing(): Swing {
  return { phase: 0, min: 0, max: 0 };
}
