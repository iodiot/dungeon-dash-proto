import { CHUNKS, ChunkTemplate, SHRINE_ROWS, TUTORIAL } from './chunks';
import { hash32, mulberry32 } from './rng';
import { Biome, BoulderSpec, Cell, COLS, Swing } from './types';

const BACK: Cell = blank('back', 'crypt', false);

function blank(chunkId: string, biome: Biome, walk: boolean): Cell {
  return {
    walk,
    coin: false,
    spark: false,
    shrine: false,
    cracked: false,
    conveyor: 0,
    crusher: null,
    steam: null,
    pendulum: null,
    beetle: null,
    crab: null,
    boulder: null,
    chunkId,
    biome,
  };
}

function targetDiff(z: number, biome: Biome): { min: number; max: number } {
  if (biome === 'crypt') {
    if (z < 40) return { min: 1, max: 1 };
    if (z < 160) return { min: 1, max: 2 };
    return { min: 2, max: 3 };
  }
  if (z < 380) return { min: 2, max: 2 };
  if (z < 560) return { min: 2, max: 3 };
  return { min: 3, max: 4 };
}

function pick(pool: ChunkTemplate[], rng: () => number, target: number): ChunkTemplate {
  let total = 0;
  const weights = pool.map((c) => {
    const w = 1 + Math.max(0, 4 - Math.abs(c.diff - target));
    total += w;
    return w;
  });
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export class World {
  readonly seed: number;
  readonly cells: Cell[] = [];
  private endZ = 0;
  private readonly layoutRng: () => number;
  private readonly pickupRng: () => number;
  private lastId = '';
  private readonly shrines = new Set<number>();

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.layoutRng = mulberry32(hash32(this.seed, 1));
    this.pickupRng = mulberry32(hash32(this.seed, 2));
    for (const chunk of TUTORIAL) this.append(chunk.rows, chunk.id, 'crypt', false);
  }

  get end(): number {
    return this.endZ;
  }

  ensure(z: number): void {
    let guard = 0;
    while (this.endZ <= z && guard++ < 500) this.placeNext();
  }

  get(x: number, z: number): Cell {
    if (x < 0 || x >= COLS || z < 0) return BACK;
    this.ensure(z);
    return this.cells[z * COLS + x];
  }

  private placeNext(): void {
    const start = this.endZ;
    const milestone = Math.ceil(Math.max(this.endZ, 1) / 250) * 250;
    if (
      milestone >= 250 &&
      milestone <= 3000 &&
      !this.shrines.has(milestone) &&
      this.endZ <= milestone &&
      this.endZ + 10 > milestone - 2
    ) {
      this.placeShrine(milestone);
    } else {
      this.placeRandom();
    }
    if (this.endZ === start) this.append(Array.from({ length: 8 }, () => '.....'), 'span', this.endZ >= 250 ? 'forge' : 'crypt', false);
  }

  private placeShrine(m: number): void {
    const z0 = m - 2;
    while (this.endZ < z0) {
      this.append(['.....'], 'span', this.endZ >= 250 ? 'forge' : 'crypt', false);
    }
    this.shrines.add(m);
    if (this.endZ > z0) {
      this.append(Array.from({ length: 5 }, () => '.....'), 'shrine', 'forge', false);
      return;
    }
    this.append(SHRINE_ROWS, 'shrine', m >= 250 ? 'forge' : 'crypt', false);
  }

  private placeRandom(): void {
    const biome: Biome = this.endZ >= 250 ? 'forge' : 'crypt';
    const band = targetDiff(this.endZ, biome);
    let pool = CHUNKS.filter((c) => c.biome === biome && c.diff >= band.min && c.diff <= band.max);
    if (!pool.length) pool = CHUNKS.filter((c) => c.biome === biome);
    let choice = pick(pool, this.layoutRng, band.max);
    let guard = 0;
    while (choice.id === this.lastId && pool.length > 1 && guard++ < 5) {
      choice = pick(pool, this.layoutRng, band.max);
    }
    this.append(choice.rows, choice.id, choice.biome, true);
  }

  private append(rows: string[], chunkId: string, biome: Biome, sockets: boolean): void {
    const z0 = this.endZ;
    const grid: Cell[][] = rows.map((row, iz) => {
      const z = z0 + iz;
      const rowBiome: Biome = z >= 250 ? 'forge' : biome;
      return [...row].map((ch, x) => this.makeCell(ch, chunkId, rowBiome, z, x, sockets));
    });
    this.stampGroups(rows, grid, z0);
    for (const row of grid) for (const cell of row) this.cells.push(cell);
    this.endZ += rows.length;
    if (chunkId !== 'span' && chunkId !== 'shrine') this.lastId = chunkId;
  }

  private makeCell(ch: string, chunkId: string, biome: Biome, z: number, x: number, sockets: boolean): Cell {
    const cell = blank(chunkId, biome, ch !== '#');
    if (ch === 'o') cell.coin = true;
    if (ch === '*') cell.spark = true;
    if (ch === 'S') {
      cell.shrine = true;
      cell.coin = false;
    }
    if (ch === 'k') cell.cracked = true;
    if (ch === '>') cell.conveyor = 1;
    if (ch === '<') cell.conveyor = -1;
    if (ch === '?' && sockets) {
      const r = this.pickupRng();
      if (r < 0.12) cell.spark = true;
      else if (r < 0.6) cell.coin = true;
    }
    if (ch === 'X') cell.crusher = { phase: hash32(hash32(this.seed, z), x + 3) % 96 };
    if (ch === 'v') cell.steam = { phase: hash32(hash32(this.seed, z + 19), x + 5) % 120 };
    return cell;
  }

  private stampGroups(glyphs: string[], grid: Cell[][], z0: number): void {
    const h = glyphs.length;
    for (let iz = 0; iz < h; iz++) {
      const row = glyphs[iz];
      let x = 0;
      while (x < COLS) {
        const ch = row[x];
        if (ch === 'H' || ch === 'e') {
          let x2 = x;
          while (x2 + 1 < COLS && row[x2 + 1] === ch) x2++;
          if (x2 > x) {
            const swing: Swing = {
              phase: hash32(hash32(this.seed, z0 + iz + (ch === 'H' ? 40 : 70)), x + 11) % 84,
              min: x,
              max: x2,
            };
            for (let i = x; i <= x2; i++) {
              if (ch === 'H') grid[iz][i].pendulum = swing;
              else grid[iz][i].beetle = swing;
            }
          }
          x = x2 + 1;
        } else x++;
      }
    }
    for (let x = 0; x < COLS; x++) {
      let iz = 0;
      while (iz < h) {
        const ch = glyphs[iz][x];
        if (ch === 'b' || ch === 'c') {
          let iz2 = iz;
          while (iz2 + 1 < h && glyphs[iz2 + 1][x] === ch) iz2++;
          if (iz2 > iz) {
            if (ch === 'b') {
              const spec: BoulderSpec = {
                phase: hash32(hash32(this.seed, z0 + iz + 90), x + 13) % 156,
                z0: z0 + iz,
                z1: z0 + iz2,
              };
              for (let i = iz; i <= iz2; i++) grid[i][x].boulder = spec;
            } else {
              const swing: Swing = {
                phase: hash32(hash32(this.seed, z0 + iz + 120), x + 17) % 112,
                min: z0 + iz,
                max: z0 + iz2,
              };
              for (let i = iz; i <= iz2; i++) grid[i][x].crab = swing;
            }
          }
          iz = iz2 + 1;
        } else iz++;
      }
    }
  }
}
