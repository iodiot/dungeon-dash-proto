export const HZ = 60;
export const COLS = 5;
export const HOP_TICKS = 8;
export const DASH_CELL_TICKS = 4;
export const BUFFER_TICKS = 9;
export const TUTORIAL_Z = 20;
export const PERK_EVERY = 250;
export const MAX_CHARGES = 3;

export const DAILY_SEEDS = [
  0x51a7c0de, 0x0d0e5eed, 0xa11ce001, 0xc0ffee42, 0xbada5515, 0xdecaf123, 0xf00dca7e,
] as const;

export type Biome = 'crypt' | 'forge';
export type HeroId = 'kira' | 'bagel' | 'nox';
export type PerkId = 'magnet' | 'boots' | 'armor' | 'gold' | 'compass';
export type Action = 'F' | 'L' | 'R' | 'B' | 'DASH' | 'ABILITY' | 'PERK_A' | 'PERK_B';
export type DeathCause = 'trap' | 'collapse' | 'fall' | 'enemy' | 'time';
export type Threat = 'ok' | 'warn' | 'hit' | 'push';

export interface Swing {
  phase: number;
  min: number;
  max: number;
}

export interface BoulderSpec {
  phase: number;
  z0: number;
  z1: number;
}

export interface Cell {
  walk: boolean;
  coin: boolean;
  spark: boolean;
  shrine: boolean;
  cracked: boolean;
  conveyor: -1 | 0 | 1;
  crusher: { phase: number } | null;
  steam: { phase: number } | null;
  pendulum: Swing | null;
  beetle: Swing | null;
  crab: Swing | null;
  boulder: BoulderSpec | null;
  chunkId: string;
  biome: Biome;
}

export interface Fx {
  kind: 'coin' | 'spark' | 'hop' | 'dash' | 'armor' | 'pass' | 'death' | 'land' | 'burrow' | 'perk';
  x: number;
  z: number;
  text?: string;
}

export interface MotionCell {
  x: number;
  z: number;
  /** Landing here ignores the next pit or hit (Bagel's burrow). */
  burrow: boolean;
}

export interface Motion {
  kind: 'hop' | 'dash';
  cells: MotionCell[];
  startTick: number;
  ticksPerCell: number;
  forced: boolean;
}

export interface Runner {
  seed: number;
  hero: HeroId;
  upgraded: boolean;
  perkSalt: number;
  assist: boolean;
  tick: number;
  x: number;
  z: number;
  bestZ: number;
  motion: Motion | null;
  motionIdx: number;
  buffer: { a: Action; tick: number; fromAir: boolean } | null;
  charges: number;
  chargeAcc: number;
  regenTicks: number;
  maxCharges: number;
  telegraph: number;
  viewExtra: number;
  ability: 'burrow' | null;
  abilityCdMax: number;
  abilityCd: number;
  burrowArmed: boolean;
  momentum: number;
  mult: number;
  coins: number;
  perks: PerkId[];
  offer: [PerkId, PerkId] | null;
  perkPending: boolean;
  nextPerkAt: number;
  perkRng: () => number;
  got: Set<string>;
  cracks: Map<string, number>;
  lastSteamCycle: number;
  collapseZ: number;
  collapseArmed: boolean;
  alive: boolean;
  cause: DeathCause | null;
  deathChunk: string;
  invuln: number;
  armor: number;
  compass: number;
  revived: boolean;
  events: { t: number; a: Action }[];
  fx: Fx[];
  hash: number;
}

export interface GhostRecord {
  v: 1;
  seed: number;
  hero: HeroId;
  upgraded: boolean;
  perkSalt: number;
  name: string;
  events: { t: number; a: Action }[];
  result: {
    ticks: number;
    distance: number;
    coins: number;
    cause: string;
    hash: number;
  };
}

export function dailySeed(now = Date.now()): number {
  const day = Math.floor(now / 86_400_000);
  return DAILY_SEEDS[((day % 7) + 7) % 7];
}

export function dailyIndex(now = Date.now()): number {
  const day = Math.floor(now / 86_400_000);
  return ((day % 7) + 7) % 7;
}

export function keyOf(x: number, z: number): string {
  return x + ',' + z;
}

export function multiplier(momentum: number): number {
  if (momentum >= 78) return 4;
  if (momentum >= 52) return 3;
  if (momentum >= 26) return 2;
  return 1;
}

export function collapseSpeed(distance: number, assist: boolean): number {
  const d = Math.max(0, distance - TUTORIAL_Z);
  const speed = Math.min(4.5, 2 + 0.15 * Math.floor(d / 100));
  return assist ? speed * 0.9 : speed;
}

/** Rows of slack the collapse tries to keep. Tight enough to stay in frame. */
export function targetGap(distance: number): number {
  const speed = collapseSpeed(distance, false);
  return Math.max(3.4, Math.min(6.2, speed * 2.15));
}
