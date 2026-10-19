import type { PortalAdapter } from '../portal/adapter';
import type { GhostRecord, HeroId } from '../sim/types';

const KEY = 'dungeon-dash-proto-v1';

export interface SaveData {
  v: 1;
  coins: number;
  unlocked: HeroId[];
  upgrades: Partial<Record<HeroId, 1>>;
  selected: HeroId;
  bestDistance: number;
  bestBySeed: Record<string, GhostRecord>;
  mute: boolean;
  failStreak: number;
  deaths: Record<string, number>;
  taught: boolean;
}

export function defaultSave(): SaveData {
  return {
    v: 1,
    coins: 0,
    unlocked: ['kira'],
    upgrades: {},
    selected: 'kira',
    bestDistance: 0,
    bestBySeed: {},
    mute: false,
    failStreak: 0,
    deaths: {},
    taught: false,
  };
}

export function loadSave(portal: PortalAdapter): SaveData {
  try {
    const raw = portal.load(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.v !== 1 || !Array.isArray(parsed.unlocked)) return defaultSave();
    return { ...defaultSave(), ...parsed, unlocked: parsed.unlocked.length ? parsed.unlocked : ['kira'] };
  } catch {
    return defaultSave();
  }
}

export function writeSave(portal: PortalAdapter, save: SaveData): void {
  const seeds = Object.keys(save.bestBySeed);
  if (seeds.length > 8) {
    for (const seed of seeds.slice(0, seeds.length - 8)) delete save.bestBySeed[seed];
  }
  portal.save(KEY, JSON.stringify(save));
}

export const PRICES = { bagel: 500, nox: 1500, upgrade: 300 } as const;
