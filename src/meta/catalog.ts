import type { HeroId, PerkId } from '../sim/types';

export const HERO_COPY: Record<HeroId, { name: string; role: string; blurb: string }> = {
  kira: {
    name: 'Kira',
    role: 'Apprentice courier',
    blurb: 'A clean dash and a satchel. Upgrade recharges the dash sooner.',
  },
  bagel: {
    name: 'Bagel',
    role: 'Mole digger',
    blurb: 'Burrow through one pit or trap. Upgrade shortens the cooldown.',
  },
  nox: {
    name: 'Nox',
    role: 'Fox lantern',
    blurb: 'Traps telegraph earlier and you see farther down the hall.',
  },
};

export const PERK_COPY: Record<PerkId, { name: string; blurb: string }> = {
  magnet: { name: 'Magnet', blurb: 'Pull coins from two tiles away.' },
  boots: { name: 'Long Dash', blurb: 'Dash covers four tiles.' },
  armor: { name: 'Plating', blurb: 'Survive one hit this run.' },
  gold: { name: 'Gold Rush', blurb: 'Coins pay half again as much.' },
  compass: { name: 'Compass', blurb: 'Safe tiles glow for three seconds.' },
};

export const CAUSE_COPY: Record<string, string> = {
  trap: 'Caught in the mechanism',
  enemy: 'A guardian caught you',
  fall: 'The floor gave way',
  collapse: 'The collapse caught you',
  time: 'The hall went on',
};
