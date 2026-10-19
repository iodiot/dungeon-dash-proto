import { Biome } from './types';

export interface ChunkTemplate {
  id: string;
  biome: Biome;
  diff: number;
  rows: string[];
}

/** Authored 5×10 corridors. Row 0 is the entrance (low z). */
export const CHUNKS: ChunkTemplate[] = [
  {
    id: 'crypt_first',
    biome: 'crypt',
    diff: 1,
    rows: ['.....', '..o..', '..X..', '.....', '.o.o.', '..X..', '.....', '..o..', '.....', '.....'],
  },
  {
    id: 'crypt_sides',
    biome: 'crypt',
    diff: 1,
    rows: ['.....', 'X...X', '..o..', '.....', 'X.o.X', '.....', '..o..', 'X...X', '.....', '.....'],
  },
  {
    id: 'crypt_stagger',
    biome: 'crypt',
    diff: 1,
    rows: ['.....', 'X....', '.o...', '...X.', '..o..', '.X...', '...o.', '....X', '..o..', '.....'],
  },
  {
    id: 'crypt_coins',
    biome: 'crypt',
    diff: 1,
    rows: ['.....', '.o.o.', '..?..', '.o.o.', '..X..', '.o.o.', '.....', '..*..', '.o.o.', '.....'],
  },
  {
    id: 'crypt_wide_crush',
    biome: 'crypt',
    diff: 1,
    rows: ['.....', 'X.o.X', '.....', '..o..', 'X.o.X', '.....', '..*..', '.o.o.', '.....', '.....'],
  },
  {
    id: 'crypt_gaps',
    biome: 'crypt',
    diff: 2,
    rows: ['.....', '##o##', '.....', '#...#', '..o..', '.....', '##.##', '..o..', '.....', '.....'],
  },
  {
    id: 'crypt_pendulum',
    biome: 'crypt',
    diff: 2,
    rows: ['.....', '.HHH.', '..o..', '.....', 'HHH..', '..o..', '..HHH', '.....', '..*..', '.....'],
  },
  {
    id: 'crypt_pendulum_b',
    biome: 'crypt',
    diff: 2,
    rows: ['.....', 'HHH..', '..o..', '..HHH', '.....', '.HHH.', '..*..', 'X...X', '..o..', '.....'],
  },
  {
    id: 'crypt_cracks',
    biome: 'crypt',
    diff: 2,
    rows: ['.....', '.k.k.', '..o..', 'k...k', '.....', '..k..', '.o.o.', '.....', 'k.o.k', '.....'],
  },
  {
    id: 'crypt_beetle',
    biome: 'crypt',
    diff: 2,
    rows: ['.....', 'eeee.', '..o..', '.....', '.eeee', '.....', '..o..', 'eeee.', '..*..', '.....'],
  },
  {
    id: 'crypt_bridge',
    biome: 'crypt',
    diff: 2,
    rows: ['.....', '#.#.#', '.o.o.', '#.#.#', '.....', '..o..', '#...#', '.o.o.', '.....', '.....'],
  },
  {
    id: 'crypt_mix',
    biome: 'crypt',
    diff: 3,
    rows: ['.....', '..X..', '.HHH.', '..o..', 'eeee.', '.....', '.k.k.', '..X..', '.o.o.', '.....'],
  },
  {
    id: 'crypt_narrow',
    biome: 'crypt',
    diff: 3,
    rows: ['.....', '##.##', '..X..', '.....', '##.##', '..o..', '.HHH.', '.....', '..o..', '.....'],
  },
  {
    id: 'crypt_beetle_press',
    biome: 'crypt',
    diff: 3,
    rows: ['.....', '..X..', 'eeee.', '..o..', 'X...X', '.eeee', '.....', '..k..', '..o..', '.....'],
  },
  {
    id: 'forge_steam',
    biome: 'forge',
    diff: 2,
    rows: ['.....', '..v..', '..o..', '.v.v.', '.....', '..v..', '.o.o.', '.....', 'v...v', '.....'],
  },
  {
    id: 'forge_belt',
    biome: 'forge',
    diff: 2,
    rows: ['.....', '>>>>.', '..o..', '.<<<<', '.....', '>>.<<', '..o..', '>>>>.', '..*..', '.....'],
  },
  {
    id: 'forge_welcome',
    biome: 'forge',
    diff: 2,
    rows: ['.....', '.o.o.', '..v..', '.o.o.', '.....', '..*..', '.....', '.o?o.', '.....', '.....'],
  },
  {
    id: 'forge_sparks',
    biome: 'forge',
    diff: 2,
    rows: ['.....', '..*..', '.o.o.', '..v..', '.....', '.o*o.', '.....', '..v..', '.o.o.', '.....'],
  },
  {
    id: 'forge_boulder',
    biome: 'forge',
    diff: 3,
    rows: ['.....', '..b..', '..b..', '..bo.', '..b..', '..b..', '..b..', '..b..', '..o..', '.....'],
  },
  {
    id: 'forge_long_rock',
    biome: 'forge',
    diff: 3,
    rows: ['.....', '.b...', '.b.o.', '.b...', '.b...', '...b.', '..ob.', '...b.', '...b.', '.....'],
  },
  {
    id: 'forge_crab',
    biome: 'forge',
    diff: 3,
    rows: ['.....', '.c...', '.c.o.', '.c...', '.c...', '...c.', '..oc.', '...c.', '...c.', '.....'],
  },
  {
    id: 'forge_belt_steam',
    biome: 'forge',
    diff: 3,
    rows: ['.....', '>>>>.', '..v..', '.<<<<', '..o..', '..v..', '>>.<<', '.....', '..o..', '.....'],
  },
  {
    id: 'forge_split',
    biome: 'forge',
    diff: 3,
    rows: ['.....', '.b.b.', '.b.b.', '.b.b.', '.b.b.', '.bob.', '.....', '..o..', '.....', '.....'],
  },
  {
    id: 'forge_gauntlet',
    biome: 'forge',
    diff: 4,
    rows: ['.....', 'bbbb.', 'bbbb.', 'bbbb.', 'bbbb.', '..o..', '.HHH.', '..X..', '..v..', '.....'],
  },
  {
    id: 'forge_mix',
    biome: 'forge',
    diff: 4,
    rows: ['.....', '>>b<<', '>>b<<', '>>b<<', '.eee.', '..X..', '.v.v.', 'k.o.k', '..*..', '.....'],
  },
  {
    id: 'forge_crab_rock',
    biome: 'forge',
    diff: 4,
    rows: ['.....', '.c.b.', '.c.b.', '.c.b.', '.c.b.', '..o..', '.HHH.', '..X..', '..o..', '.....'],
  },
];

export const TUTORIAL: ChunkTemplate[] = [
  {
    id: 'lift_01',
    biome: 'crypt',
    diff: 0,
    rows: ['.....', '..o..', '..o..', '.o.o.', '..o..', '.....', '..*..', '.....', '.o.o.', '.....'],
  },
  {
    id: 'lift_02',
    biome: 'crypt',
    diff: 0,
    rows: ['.....', '.o...', '.o...', '..o..', '...o.', '...o.', '..o..', '.o...', '..*..', '.....'],
  },
];

export const SHRINE_ROWS = ['.....', '.o.o.', '..S..', '.o.o.', '.....'];

export function validateTemplates(): void {
  const all = [...TUTORIAL, ...CHUNKS];
  for (const chunk of all) {
    if (chunk.rows.length !== 10) throw new Error(chunk.id + ' row count');
    for (const row of chunk.rows) {
      if (row.length !== 5) throw new Error(chunk.id + ' width ' + row);
      if ([...row].some((ch) => !'.#o*Xv k><HbecS?'.includes(ch) && ch !== 'k')) {
        // checked below
      }
      for (const ch of row) {
        if (!'.#o*Xvk><HbecS?'.includes(ch)) throw new Error(chunk.id + ' bad glyph ' + ch);
      }
    }
    if (!solvableGlyphs(chunk.rows)) throw new Error(chunk.id + ' has no static path');
  }
  if (!solvableGlyphs(SHRINE_ROWS)) throw new Error('shrine blocked');
}

function walkableGlyph(ch: string): boolean {
  return ch !== '#';
}

export function solvableGlyphs(rows: string[]): boolean {
  const h = rows.length;
  const seen = new Set<string>();
  const q: [number, number][] = [];
  for (let x = 0; x < 5; x++) if (walkableGlyph(rows[0][x])) q.push([x, 0]);
  while (q.length) {
    const [x, z] = q.pop()!;
    if (z === h - 1) return true;
    const k = x + ',' + z;
    if (seen.has(k)) continue;
    seen.add(k);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx > 4 || nz < 0 || nz >= h) continue;
      if (!walkableGlyph(rows[nz][nx])) continue;
      q.push([nx, nz]);
    }
  }
  return false;
}
