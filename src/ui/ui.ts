import { HERO_COPY, PERK_COPY, CAUSE_COPY } from '../meta/catalog';
import { PRICES, type SaveData } from '../meta/save';
import type { HeroId, PerkId } from '../sim/types';
import type { ScreenTag } from '../render/gfx';

export type Mode = 'boot' | 'title' | 'play' | 'perk' | 'pause' | 'dead' | 'couriers' | 'ad';

export interface UiHooks {
  play: () => void;
  title: () => void;
  random: () => void;
  restart: () => void;
  menu: () => void;
  revive: () => void;
  pause: () => void;
  resume: () => void;
  perk: (which: 'PERK_A' | 'PERK_B') => void;
  selectHero: (hero: HeroId) => void;
  buy: (hero: HeroId) => void;
  upgrade: (hero: HeroId) => void;
  toggleMute: () => void;
  hold: (action: 'F' | 'B' | 'L' | 'R' | 'DASH' | 'ABILITY') => void;
  release: (action: 'F' | 'B' | 'L' | 'R' | 'DASH' | 'ABILITY') => void;
}

export function createUi(hooks: UiHooks): {
  setMode: (mode: Mode) => void;
  renderTitle: (save: SaveData, day: string, best: number) => void;
  renderHud: (view: HudView) => void;
  renderDead: (view: DeadView) => void;
  renderPerk: (offer: [PerkId, PerkId]) => void;
  renderCouriers: (save: SaveData) => void;
  renderDebug: (text: string) => void;
  setTags: (tags: ScreenTag[]) => void;
  floater: (text: string, x: number, y: number) => void;
  flash: (kind: 'hurt' | 'pass') => void;
  setAd: (on: boolean) => void;
  hint: (text: string) => void;
} {
  const root = document.getElementById('ui')!;
  root.innerHTML = `
    <div id="tags"></div>
    <div id="floaters"></div>
    <div id="flash"></div>
    <section id="hud" class="layer" hidden>
      <header class="top">
        <div class="stat"><span id="dist">0</span><small>m</small></div>
        <div class="stat coin"><span id="runCoins">0</span></div>
        <button id="pauseBtn" type="button" aria-label="Pause">II</button>
      </header>
      <div id="mult"></div>
      <div id="race"></div>
      <div id="pips"></div>
      <p id="hint"></p>
      <div class="pad" id="pad">
        <button type="button" data-act="F" style="grid-area:f" aria-label="Forward">▲</button>
        <button type="button" data-act="L" style="grid-area:l" aria-label="Left">◀</button>
        <button type="button" data-act="R" style="grid-area:r" aria-label="Right">▶</button>
        <button type="button" data-act="B" style="grid-area:b" aria-label="Back">▼</button>
      </div>
      <button id="dashBtn" type="button" data-act="DASH">Dash</button>
      <button id="abilityBtn" type="button" data-act="ABILITY">Burrow</button>
    </section>
    <section id="title" class="panel" hidden>
      <div class="brand">
        <p class="eyebrow">The Depths · daily hall</p>
        <h1>Dungeon Dash</h1>
        <p class="tagline">Carry the parcel. Outrun the collapse. Race the echoes.</p>
      </div>
      <div class="actions">
        <button id="playBtn" type="button" class="primary">Run</button>
        <button id="randomBtn" type="button">Random hall</button>
        <button id="courierBtn" type="button">Couriers</button>
        <button id="muteBtn" type="button" aria-label="Mute">Sound</button>
      </div>
      <p id="titleMeta" class="meta"></p>
      <p class="how">Tap or arrows to step · swipe or A/D to sidestep · swipe up or Space to dash</p>
    </section>
    <section id="dead" class="panel" hidden>
      <p class="eyebrow" id="deadCause"></p>
      <h2 id="deadDist">0 m</h2>
      <ul id="deadStats"></ul>
      <div class="actions">
        <button id="restartBtn" type="button" class="primary">Restart</button>
        <button id="reviveBtn" type="button" class="ad">Revive</button>
        <button id="menuBtn" type="button">Couriers</button>
      </div>
    </section>
    <section id="perk" class="panel" hidden>
      <p class="eyebrow">Wayside shrine · pick one</p>
      <h2>A gift for the road</h2>
      <div id="perkCards" class="cards"></div>
    </section>
    <section id="couriers" class="panel" hidden>
      <p class="eyebrow">Swift Guild</p>
      <h2>Couriers</h2>
      <div id="heroCards" class="cards"></div>
      <button id="backBtn" type="button" class="primary">Back</button>
    </section>
    <section id="paused" class="panel" hidden>
      <h2>Paused</h2>
      <div class="actions">
        <button id="resumeBtn" type="button" class="primary">Resume</button>
        <button id="quitBtn" type="button">End run</button>
      </div>
    </section>
    <section id="ad" class="panel" hidden>
      <p class="eyebrow">Advertisement</p>
      <h2>A short break</h2>
      <p>The local build skips the real ad and grants the revive.</p>
    </section>
    <pre id="debug"></pre>
  `;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const layers: Record<Mode, string> = {
    boot: '',
    title: '#title',
    play: '#hud',
    perk: '#perk',
    pause: '#paused',
    dead: '#dead',
    couriers: '#couriers',
    ad: '#ad',
  };

  q<HTMLButtonElement>('#playBtn').onclick = () => hooks.play();
  q<HTMLButtonElement>('#randomBtn').onclick = () => hooks.random();
  q<HTMLButtonElement>('#courierBtn').onclick = () => hooks.menu();
  q<HTMLButtonElement>('#muteBtn').onclick = () => hooks.toggleMute();
  q<HTMLButtonElement>('#restartBtn').onclick = () => hooks.restart();
  q<HTMLButtonElement>('#reviveBtn').onclick = () => hooks.revive();
  q<HTMLButtonElement>('#menuBtn').onclick = () => hooks.menu();
  q<HTMLButtonElement>('#pauseBtn').onclick = () => hooks.pause();
  q<HTMLButtonElement>('#resumeBtn').onclick = () => hooks.resume();
  q<HTMLButtonElement>('#quitBtn').onclick = () => hooks.menu();
  q<HTMLButtonElement>('#backBtn').onclick = () => hooks.title();

  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-act]')) {
    const action = button.dataset.act as 'F' | 'B' | 'L' | 'R' | 'DASH' | 'ABILITY';
    const down = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (action === 'ABILITY') hooks.hold('ABILITY');
      else hooks.hold(action);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', (e) => {
      e.preventDefault();
      hooks.release(action);
    });
    button.addEventListener('pointercancel', () => hooks.release(action));
    button.addEventListener('pointerleave', () => hooks.release(action));
  }

  q<HTMLElement>('#title').addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    hooks.play();
  });

  function setMode(mode: Mode): void {
    for (const section of root.querySelectorAll('.panel, #hud')) {
      (section as HTMLElement).hidden = true;
    }
    const sel = layers[mode];
    if (sel) {
      const el = q<HTMLElement>(sel);
      el.hidden = false;
    }
    document.body.dataset.mode = mode;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    q<HTMLElement>('#pad').hidden = !(coarse && mode === 'play');
    q<HTMLButtonElement>('#dashBtn').hidden = !(coarse && mode === 'play');
  }

  return {
    setMode,
    renderTitle(save, day, best) {
      q('#titleMeta').textContent = day + (best ? ' · best ' + best + ' m' : '') + ' · purse ' + save.coins;
      q('#muteBtn').textContent = save.mute ? 'Muted' : 'Sound';
      q<HTMLButtonElement>('#playBtn').focus();
    },
    renderHud(view) {
      q('#dist').textContent = String(view.distance);
      q('#runCoins').textContent = String(view.coins);
      q('#mult').textContent = view.mult > 1 ? 'x' + view.mult + ' rush' : '';
      q('#race').textContent = view.race;
      q('#pips').textContent = 'Dash ' + '●'.repeat(view.charges) + '○'.repeat(Math.max(0, view.maxCharges - view.charges));
      const ability = q<HTMLButtonElement>('#abilityBtn');
      ability.hidden = !view.ability;
      ability.textContent = view.abilityLabel;
      ability.disabled = view.abilityCd > 0 && !view.armed;
    },
    renderDead(view) {
      q('#deadCause').textContent = CAUSE_COPY[view.cause] ?? 'Run over';
      q('#deadDist').textContent = view.distance + ' m';
      q('#deadStats').innerHTML = [
        '<li>' + view.coins + ' coins</li>',
        '<li>Passed ' + view.passed + '/' + view.ghosts + ' echoes</li>',
        '<li>' + ordinal(view.place) + ' of ' + view.total + '</li>',
        view.ahead ? '<li>' + view.ahead + '</li>' : '',
        view.assist ? '<li>The hall eased off this run</li>' : '',
      ].join('');
      const revive = q<HTMLButtonElement>('#reviveBtn');
      revive.hidden = !view.canRevive;
      q<HTMLButtonElement>('#restartBtn').focus();
    },
    renderPerk(offer) {
      const box = q('#perkCards');
      box.innerHTML = offer
        .map((id, i) => {
          const copy = PERK_COPY[id];
          return `<button type="button" data-perk="${i === 0 ? 'PERK_A' : 'PERK_B'}"><strong>${copy.name}</strong><span>${copy.blurb}</span></button>`;
        })
        .join('');
      for (const button of box.querySelectorAll<HTMLButtonElement>('button')) {
        button.onclick = () => hooks.perk(button.dataset.perk as 'PERK_A' | 'PERK_B');
      }
      box.querySelector('button')?.focus();
    },
    renderCouriers(save) {
      const box = q('#heroCards');
      const heroes: HeroId[] = ['kira', 'bagel', 'nox'];
      box.innerHTML = heroes
        .map((id) => {
          const copy = HERO_COPY[id];
          const unlocked = save.unlocked.includes(id);
          const selected = save.selected === id;
          const price = id === 'kira' ? 0 : PRICES[id];
          const upgraded = save.upgrades[id] === 1;
          let extra = '';
          if (!unlocked) extra = `<button type="button" data-buy="${id}">Unlock ${price}</button>`;
          else {
            extra = selected ? '<em>Selected</em>' : `<button type="button" data-pick="${id}">Select</button>`;
            if (!upgraded) extra += `<button type="button" data-up="${id}">Upgrade ${PRICES.upgrade}</button>`;
            else extra += '<em>Upgraded</em>';
          }
          return `<article class="${selected ? 'on' : ''}"><strong>${copy.name}</strong><span>${copy.role}</span><p>${copy.blurb}</p>${extra}</article>`;
        })
        .join('');
      box.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => {
        b.onclick = () => hooks.buy(b.dataset.buy as HeroId);
      });
      box.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => {
        b.onclick = () => hooks.selectHero(b.dataset.pick as HeroId);
      });
      box.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) => {
        b.onclick = () => hooks.upgrade(b.dataset.up as HeroId);
      });
    },
    renderDebug(text) {
      const el = q('#debug');
      el.hidden = !text;
      el.textContent = text;
    },
    setTags(tags) {
      const box = q('#tags');
      box.innerHTML = tags
        .map(
          (tag) =>
            `<span class="tag ${tag.kind}" style="left:${tag.x}px;top:${tag.y}px">${escapeHtml(tag.text)}</span>`,
        )
        .join('');
    },
    floater(text, x, y) {
      const el = document.createElement('span');
      el.className = 'floater';
      el.textContent = text;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      q('#floaters').appendChild(el);
      window.setTimeout(() => el.remove(), 700);
    },
    flash(kind) {
      const el = q('#flash');
      el.className = kind;
      window.setTimeout(() => {
        if (el.className === kind) el.className = '';
      }, 180);
    },
    setAd(on) {
      q('#ad').hidden = !on;
    },
    hint(text) {
      q('#hint').textContent = text;
    },
  };
}

export interface HudView {
  distance: number;
  coins: number;
  mult: number;
  charges: number;
  maxCharges: number;
  race: string;
  ability: boolean;
  abilityLabel: string;
  abilityCd: number;
  armed: boolean;
}

export interface DeadView {
  cause: string;
  distance: number;
  coins: number;
  passed: number;
  ghosts: number;
  place: number;
  total: number;
  ahead: string;
  canRevive: boolean;
  assist: boolean;
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  switch (n % 10) {
    case 1:
      return n + 'st';
    case 2:
      return n + 'nd';
    case 3:
      return n + 'rd';
    default:
      return n + 'th';
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
