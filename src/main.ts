import './style.css';
import { createAudio } from './audio/sfx';
import { createInput } from './input/input';
import { PERK_COPY } from './meta/catalog';
import { loadSave, PRICES, writeSave } from './meta/save';
import { createLocalPortal } from './portal/adapter';
import { createGfx, type Gfx } from './render/gfx';
import { applyPerk, revive, toRecord } from './sim/runner';
import { createSession, passedCount, raceRank, resetSession, stepSession, type Session } from './sim/session';
import { dailySeed } from './sim/types';
import { createUi, type Mode } from './ui/ui';

const canvas = document.querySelector('canvas#c') as HTMLCanvasElement;
const portal = createLocalPortal();
const audio = createAudio();
const input = createInput(document.body);
const save = loadSave(portal);
audio.muted = save.mute;

const debug = new URLSearchParams(location.search).has('debug');
let mode: Mode = 'boot';
let session: Session | null = null;
let preview: Session | null = null;
let committed = true;
let gfx: Gfx | null = null;

const ui = createUi({
  play: () => start(dailySeed()),
  random: () => start((Math.imul(Date.now() >>> 0, 0x9e3779b1) ^ 0xa5a5a5a5) >>> 0 || 1),
  title: showTitle,
  restart: () => {
    const seed = session?.seed ?? dailySeed();
    finishRun();
    void portal.midroll('restart');
    start(seed);
  },
  menu: openCouriers,
  revive: () => void onRevive(),
  pause: () => setMode('pause'),
  resume: () => setMode('play'),
  perk: (which) => uiPerk(which === 'PERK_A' ? 0 : 1),
  selectHero: (hero) => {
    if (!save.unlocked.includes(hero)) return;
    save.selected = hero;
    persist();
    ui.renderCouriers(save);
    audio.ui();
  },
  buy: (hero) => {
    if (hero === 'kira' || save.unlocked.includes(hero)) return;
    const price = PRICES[hero];
    if (save.coins < price) return;
    save.coins -= price;
    save.unlocked.push(hero);
    save.selected = hero;
    persist();
    ui.renderCouriers(save);
    audio.perk();
  },
  upgrade: (hero) => {
    if (!save.unlocked.includes(hero) || save.upgrades[hero]) return;
    if (save.coins < PRICES.upgrade) return;
    save.coins -= PRICES.upgrade;
    save.upgrades[hero] = 1;
    persist();
    ui.renderCouriers(save);
    audio.perk();
  },
  toggleMute: () => {
    save.mute = !save.mute;
    audio.muted = save.mute;
    persist();
    ui.renderTitle(save, 'Today’s hall', save.bestDistance);
  },
  hold: (action) => {
    if (mode !== 'play') return;
    input.hold(action);
  },
  release: (action) => input.release(action),
});

function persist(): void {
  writeSave(portal, save);
}

function showTitle(): void {
  if (session && !committed) finishRun();
  session = null;
  input.setEnabled(false);
  portal.gameplayStop();
  mode = 'title';
  ui.setMode('title');
  ui.renderTitle(save, 'Today’s hall', save.bestDistance);
  if (!preview) {
    preview = createSession({
      seed: dailySeed(),
      hero: save.selected,
      upgraded: !!save.upgrades[save.selected],
      assist: false,
      perkSalt: 9,
      recording: false,
    });
  }
}

function openCouriers(): void {
  if (session && !committed) finishRun();
  input.setEnabled(false);
  portal.gameplayStop();
  mode = 'couriers';
  ui.renderCouriers(save);
  ui.setMode('couriers');
}

function finishRun(): void {
  if (!session || committed) return;
  committed = true;
  const player = session.player;
  save.coins += player.coins;
  const key = String(session.seed);
  const prev = save.bestBySeed[key]?.result.distance ?? -1;
  if (!player.assist && player.bestZ >= prev && player.bestZ > 0) {
    save.bestBySeed[key] = toRecord(player, 'Your best');
  }
  if (!player.assist && player.bestZ > save.bestDistance) save.bestDistance = player.bestZ;
  if (!player.assist && player.bestZ < 60) save.failStreak += 1;
  else save.failStreak = 0;
  if (player.deathChunk) save.deaths[player.deathChunk] = (save.deaths[player.deathChunk] ?? 0) + 1;
  save.taught = true;
  persist();
  portal.track('run_end', {
    distance: player.bestZ,
    coins: player.coins,
    cause: player.cause,
    hero: player.hero,
    assist: player.assist,
  });
}

function start(seed: number): void {
  audio.unlock();
  const assist = save.failStreak >= 3;
  if (assist) {
    save.failStreak = 0;
    persist();
  }
  const best = save.bestBySeed[String(seed)];
  session = createSession({
    seed,
    hero: save.selected,
    upgraded: !!save.upgrades[save.selected],
    assist,
    perkSalt: 3,
    recording: true,
    extraGhosts: best ? [best] : [],
  });
  committed = false;
  input.clear();
  portal.track('run_start', { seed, hero: save.selected, assist });
  setMode('play');
  ui.hint(assist ? 'The hall eased off. Keep moving.' : save.taught ? '' : 'Tap forward. Swipe to sidestep. Swipe up to dash.');
  if (!save.taught) window.setTimeout(() => ui.hint(''), 9000);
}

function setMode(next: Mode): void {
  mode = next;
  const playing = next === 'play';
  input.setEnabled(playing);
  if (playing) portal.gameplayStart();
  else if (next === 'pause' || next === 'dead' || next === 'perk') portal.gameplayStop();
  ui.setMode(next);
  if (next === 'dead' && session) {
    const rank = raceRank(session);
    ui.renderDead({
      cause: session.player.cause ?? 'trap',
      distance: session.player.bestZ,
      coins: session.player.coins,
      passed: passedCount(session),
      ghosts: session.ghosts.length,
      place: rank.place,
      total: rank.total,
      ahead: rank.ahead ? rank.ahead.gap + ' m behind ' + rank.ahead.name : 'You led the echoes',
      canRevive: !session.player.revived,
      assist: session.player.assist,
    });
  }
}

async function onRevive(): Promise<void> {
  if (!session || session.player.alive || session.player.revived) return;
  setMode('ad');
  const ok = await portal.rewarded('revive');
  if (!session) return;
  if (ok && revive(session.player, session.world)) {
    audio.perk();
    setMode('play');
  } else setMode('dead');
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (mode === 'play') setMode('pause');
    else if (mode === 'pause') setMode('play');
    return;
  }
  if (mode === 'play') input.onKeyDown(e);
  else if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    start(dailySeed());
  } else if (mode === 'dead' && (e.code === 'Enter' || e.code === 'KeyR')) {
    e.preventDefault();
    const seed = session?.seed ?? dailySeed();
    finishRun();
    start(seed);
  } else if (mode === 'dead' && e.code === 'KeyV') void onRevive();
  else if (mode === 'perk' && (e.code === 'Digit1' || e.code === 'ArrowLeft')) uiPerk(0);
  else if (mode === 'perk' && (e.code === 'Digit2' || e.code === 'ArrowRight' || e.code === 'Enter')) uiPerk(1);
  else if (mode === 'couriers' && e.code === 'Escape') showTitle();
});
window.addEventListener('keyup', (e) => input.onKeyUp(e));

function uiPerk(index: number): void {
  if (!session?.player.offer) return;
  const which = index === 0 ? 'PERK_A' : 'PERK_B';
  const perk = session.player.offer[index];
  session.player.events.push({ t: session.player.tick, a: which });
  applyPerk(session.player, perk);
  audio.perk();
  setMode('play');
}

function drainFx(current: Session): void {
  for (const fx of current.player.fx) {
    if (fx.kind === 'coin') audio.coin();
    else if (fx.kind === 'spark') audio.spark();
    else if (fx.kind === 'dash') audio.dash();
    else if (fx.kind === 'hop') audio.hop();
    else if (fx.kind === 'land') audio.land();
    else if (fx.kind === 'death') {
      audio.death();
      ui.flash('hurt');
      navigator.vibrate?.(28);
    } else if (fx.kind === 'pass') {
      audio.pass();
      ui.flash('pass');
    } else if (fx.kind === 'perk' || fx.kind === 'burrow' || fx.kind === 'armor') audio.perk();
    if (fx.text && gfx) {
      const p = gfx.project(fx.x, 1.1, fx.z);
      const named = fx.kind === 'perk' && fx.text in PERK_COPY ? PERK_COPY[fx.text as keyof typeof PERK_COPY].name : fx.text;
      if (p) ui.floater(fx.kind === 'pass' ? 'Passed ' + named : named, p.x, p.y);
    }
  }
  current.player.fx.length = 0;
  for (const ghost of current.ghosts) ghost.runner.fx.length = 0;
}

async function boot(): Promise<void> {
  await portal.init();
  try {
    gfx = await createGfx(canvas);
  } catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML('beforeend', '<p class="how">This browser could not start the renderer.</p>');
    return;
  }
  portal.loadingFinished();
  portal.track('renderer', { backend: gfx.backend });
  showTitle();
  window.addEventListener('resize', () => gfx?.resize());
  let last = performance.now();
  let acc = 0;
  let frames = 0;
  let fpsMark = last;
  let fps = 60;
  let stressed = 0;
  const step = 1000 / 60;

  const frame = (now: number) => {
    const dt = Math.min(50, now - last);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= step && steps < 4) {
      acc -= step;
      steps += 1;
      if (mode === 'play' && session) {
        stepSession(session, input.take());
        drainFx(session);
        if (session.player.perkPending) {
          ui.renderPerk(session.player.offer!);
          setMode('perk');
          break;
        }
        if (!session.player.alive) {
          audio.rumble(0);
          setMode('dead');
          break;
        }
      } else if (mode === 'title' && preview) {
        stepSession(preview, null);
        for (const ghost of preview.ghosts) ghost.runner.fx.length = 0;
        preview.player.fx.length = 0;
        if (preview.clock > 60 * 16) resetSession(preview);
      }
    }
    if (steps === 4) acc = 0;
    const view = mode === 'title' || !session ? preview : session;
    if (gfx && view) {
      gfx.draw(view, acc / step, dt / 1000, mode);
      if (mode === 'play') ui.setTags(gfx.tags);
      else ui.setTags([]);
    }
    if (mode === 'play' && session) {
      const player = session.player;
      const rank = raceRank(session);
      ui.renderHud({
        distance: player.bestZ,
        coins: player.coins,
        mult: player.mult,
        charges: player.charges,
        maxCharges: player.maxCharges,
        race: rank.ahead ? rank.ahead.gap + ' m behind ' + rank.ahead.name : 'Passed ' + passedCount(session) + '/' + session.ghosts.length,
        ability: player.ability === 'burrow',
        abilityLabel: player.burrowArmed ? 'Burrow ready' : player.abilityCd > 0 ? 'Burrow ' + Math.ceil(player.abilityCd / 60) : 'Burrow',
        abilityCd: player.abilityCd,
        armed: player.burrowArmed,
      });
      const gap = player.collapseArmed ? player.z - player.collapseZ : 99;
      audio.rumble(gap < 6.5 ? (6.5 - gap) / 14 : 0);
      if (debug && gfx) {
        const cell = session.world.get(player.x, Math.max(0, player.z));
        ui.renderDebug(
          [
            fps.toFixed(0) + ' fps  ' + gfx.backend,
            'seed ' + session.seed.toString(16),
            'z ' + player.z + '  ' + cell.chunkId,
            'collapse ' + (player.collapseArmed ? gap.toFixed(1) : 'off'),
            'tick ' + player.tick,
          ].join('\n'),
        );
      }
    } else if (!debug) ui.renderDebug('');
    frames += 1;
    if (now - fpsMark > 500) {
      fps = (frames * 1000) / (now - fpsMark);
      frames = 0;
      fpsMark = now;
      if (fps < 45 && stressed < 3 && gfx) {
        stressed += 1;
        gfx.stress();
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void boot();
