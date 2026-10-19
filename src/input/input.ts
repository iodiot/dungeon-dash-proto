import type { Action } from '../sim/types';

const KEY: Record<string, Action> = {
  KeyW: 'F',
  ArrowUp: 'F',
  KeyS: 'B',
  ArrowDown: 'B',
  KeyA: 'L',
  ArrowLeft: 'L',
  KeyD: 'R',
  ArrowRight: 'R',
  Space: 'DASH',
  ShiftLeft: 'DASH',
  ShiftRight: 'DASH',
  KeyE: 'ABILITY',
  KeyQ: 'ABILITY',
};

export interface Input {
  take(): Action | null;
  hold(action: Action): void;
  release(action: Action): void;
  clear(): void;
  onKeyDown(e: KeyboardEvent): void;
  onKeyUp(e: KeyboardEvent): void;
  setEnabled(on: boolean): void;
}

export function createInput(target: HTMLElement): Input {
  const held = new Map<Action, number>();
  const queue: Action[] = [];
  let enabled = false;
  let seq = 0;
  let track: { id: number; x: number; y: number; t: number; fired: boolean } | null = null;

  function push(action: Action): void {
    if (!enabled) return;
    if (queue.length > 3) queue.shift();
    queue.push(action);
  }

  function hold(action: Action): void {
    held.set(action, ++seq);
  }

  function release(action: Action): void {
    held.delete(action);
  }

  function pointing(e: Event): boolean {
    const node = e.target as HTMLElement | null;
    return !!node?.closest?.('button, a, input, label');
  }

  target.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener(
    'touchmove',
    (e) => {
      if (enabled) e.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener('pointerdown', (e) => {
    if (!enabled || pointing(e)) return;
    track = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), fired: false };
  });

  window.addEventListener('pointermove', (e) => {
    if (!track || track.id !== e.pointerId || track.fired || !enabled) return;
    const dx = e.clientX - track.x;
    const dy = e.clientY - track.y;
    const dist = Math.hypot(dx, dy);
    const limit = 22;
    if (dist < limit) return;
    if (performance.now() - track.t > 260) return;
    track.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) push(dx < 0 ? 'L' : 'R');
    else push(dy < 0 ? 'DASH' : 'B');
  });

  function endPointer(e: PointerEvent): void {
    if (!track || track.id !== e.pointerId) return;
    const dx = e.clientX - track.x;
    const dy = e.clientY - track.y;
    const dt = performance.now() - track.t;
    if (!track.fired && Math.hypot(dx, dy) < 12 && dt < 220 && enabled && !pointing(e)) push('F');
    track = null;
  }

  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);

  return {
    hold,
    release,
    clear() {
      queue.length = 0;
      held.clear();
      track = null;
    },
    setEnabled(on: boolean) {
      enabled = on;
      if (!on) {
        queue.length = 0;
        held.clear();
        track = null;
      }
    },
    onKeyDown(e: KeyboardEvent) {
      const action = KEY[e.code];
      if (!action) return;
      e.preventDefault();
      if (e.repeat) return;
      if (action === 'ABILITY') {
        push('ABILITY');
        return;
      }
      hold(action);
    },
    onKeyUp(e: KeyboardEvent) {
      const action = KEY[e.code];
      if (!action || action === 'ABILITY') return;
      release(action);
    },
    take(): Action | null {
      if (queue.length) return queue.shift() ?? null;
      let best: Action | null = null;
      let t = -1;
      for (const [action, time] of held) {
        if (time > t) {
          t = time;
          best = action;
        }
      }
      if (best === 'ABILITY') held.delete('ABILITY');
      return best;
    },
  };
}
