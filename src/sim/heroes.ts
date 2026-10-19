import { HeroId } from './types';

export interface HeroMods {
  regenTicks: number;
  telegraph: number;
  viewExtra: number;
  ability: 'burrow' | null;
  abilityCd: number;
}

export function heroMods(hero: HeroId, upgraded: boolean): HeroMods {
  if (hero === 'kira') {
    return {
      regenTicks: upgraded ? 360 : 480,
      telegraph: 1,
      viewExtra: 0,
      ability: null,
      abilityCd: 0,
    };
  }
  if (hero === 'bagel') {
    return {
      regenTicks: 480,
      telegraph: 1,
      viewExtra: 0,
      ability: 'burrow',
      abilityCd: (upgraded ? 14 : 20) * 60,
    };
  }
  return {
    regenTicks: 480,
    telegraph: upgraded ? 1.85 : 1.5,
    viewExtra: upgraded ? 3.2 : 2.4,
    ability: null,
    abilityCd: 0,
  };
}
