/** Thin portal seam. Poki / CrazyGames / Capacitor can replace this later. */
export interface PortalAdapter {
  name: 'local';
  init(): Promise<void>;
  loadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  midroll(placement: string): Promise<void>;
  rewarded(placement: string): Promise<boolean>;
  save(key: string, value: string): void;
  load(key: string): string | null;
  track(event: string, data?: Record<string, unknown>): void;
}

export function createLocalPortal(): PortalAdapter {
  const log: { event: string; data?: Record<string, unknown>; t: number }[] = [];
  let playing = false;

  function track(event: string, data?: Record<string, unknown>): void {
    log.push({ event, data, t: performance.now() });
    if (log.length > 40) log.shift();
    if (new URLSearchParams(location.search).has('debug')) console.info('[portal]', event, data ?? '');
  }

  return {
    name: 'local',
    async init() {
      track('init');
    },
    loadingFinished() {
      track('loadingFinished');
    },
    gameplayStart() {
      playing = true;
      track('gameplayStart');
    },
    gameplayStop() {
      playing = false;
      track('gameplayStop');
    },
    async midroll(placement: string) {
      track('midroll', { placement, playing });
    },
    async rewarded(placement: string) {
      track('rewarded', { placement });
      return true;
    },
    save(key: string, value: string) {
      localStorage.setItem(key, value);
    },
    load(key: string) {
      return localStorage.getItem(key);
    },
    track,
  };
}
