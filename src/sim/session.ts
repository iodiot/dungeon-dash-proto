import { bakeGhosts } from './bot';
import { applyPerk, createRunner, RunnerOpts, samplePose, stepRunner } from './runner';
import { Action, DeathCause, GhostRecord, Runner } from './types';
import { World } from './world';

export interface GhostState {
  name: string;
  record: GhostRecord;
  runner: Runner;
  cursor: number;
  passed: boolean;
  wasAhead: boolean;
}

export interface Session {
  seed: number;
  world: World;
  player: Runner;
  ghosts: GhostState[];
  records: GhostRecord[];
  opts: RunnerOpts;
  recording: boolean;
  clock: number;
}

export interface SessionOpts extends RunnerOpts {
  extraGhosts?: GhostRecord[];
  recording?: boolean;
  withGhosts?: boolean;
}

function isPerk(a: Action): boolean {
  return a === 'PERK_A' || a === 'PERK_B';
}

export function makeGhost(record: GhostRecord): GhostState {
  const runner = createRunner({
    seed: record.seed,
    hero: record.hero,
    upgraded: record.upgraded,
    assist: false,
    perkSalt: record.perkSalt,
  });
  return {
    name: record.name,
    record,
    runner,
    cursor: 0,
    passed: false,
    wasAhead: false,
  };
}

export function createSession(opts: SessionOpts): Session {
  const seed = opts.seed >>> 0;
  const runnerOpts: RunnerOpts = {
    seed,
    hero: opts.hero,
    upgraded: opts.upgraded,
    assist: opts.assist,
    perkSalt: opts.perkSalt,
  };
  const baked = opts.withGhosts === false ? [] : bakeGhosts(seed);
  const records = [...baked, ...(opts.extraGhosts ?? [])];
  return {
    seed,
    world: new World(seed),
    player: createRunner(runnerOpts),
    ghosts: records.map(makeGhost),
    records,
    opts: runnerOpts,
    recording: opts.recording !== false,
    clock: 0,
  };
}

function stepReplay(ghost: GhostState, world: World): void {
  const events = ghost.record.events;
  const runner = ghost.runner;
  const next = runner.tick + 1;
  let action: Action | null = null;
  if (ghost.cursor < events.length && events[ghost.cursor].t === next && !isPerk(events[ghost.cursor].a)) {
    action = events[ghost.cursor].a;
    ghost.cursor += 1;
  }
  stepRunner(runner, world, action, false);
  while (
    ghost.cursor < events.length &&
    events[ghost.cursor].t === runner.tick &&
    isPerk(events[ghost.cursor].a) &&
    runner.perkPending &&
    runner.offer
  ) {
    const which = events[ghost.cursor].a;
    applyPerk(runner, which === 'PERK_A' ? runner.offer[0] : runner.offer[1]);
    ghost.cursor += 1;
  }
}

export function stepGhost(ghost: GhostState, world: World): void {
  if (!ghost.runner.alive) return;
  if (ghost.runner.tick < ghost.record.result.ticks) stepReplay(ghost, world);
  if (ghost.runner.tick >= ghost.record.result.ticks && ghost.runner.alive) {
    ghost.runner.alive = false;
    ghost.runner.cause = (ghost.record.result.cause as DeathCause) || 'time';
  }
}

export function stepSession(session: Session, action: Action | null): void {
  const player = session.player;
  if (!player.alive || player.perkPending) return;
  stepRunner(player, session.world, action, session.recording);
  for (const ghost of session.ghosts) {
    stepGhost(ghost, session.world);
    if (!ghost.passed && player.alive && player.z > ghost.runner.z && ghost.wasAhead) {
      ghost.passed = true;
      player.coins += 25;
      player.fx.push({ kind: 'pass', x: player.x, z: player.z, text: ghost.name });
    }
    if (ghost.runner.z > player.z) ghost.wasAhead = true;
  }
  session.clock += 1;
}

export function passedCount(session: Session): number {
  return session.ghosts.filter((g) => g.passed).length;
}

export function raceRank(session: Session): { place: number; total: number; ahead: { name: string; gap: number } | null } {
  const mine = session.player.bestZ;
  let better = 0;
  let ahead: { name: string; gap: number } | null = null;
  for (const ghost of session.ghosts) {
    const d = ghost.runner.bestZ;
    if (d > mine) {
      better += 1;
      const gap = d - mine;
      if (!ahead || gap < ahead.gap) ahead = { name: ghost.name, gap };
    }
  }
  return { place: better + 1, total: session.ghosts.length + 1, ahead };
}

export function resetSession(session: Session): void {
  session.player = createRunner(session.opts);
  session.ghosts = session.records.map(makeGhost);
  session.clock = 0;
}

export { samplePose };
