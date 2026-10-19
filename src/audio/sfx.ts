/** Tiny synthesized SFX. No samples, so the download stays small. */
export function createAudio() {
  let ctx: AudioContext | null = null;
  let muted = false;
  let rumble: GainNode | null = null;
  let lastCoin = 0;

  function context(): AudioContext | null {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0): void {
    const ac = context();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur: number, vol: number, freq: number): void {
    const ac = context();
    if (!ac) return;
    const count = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, count, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ac.createGain();
    const t = ac.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t);
  }

  function ensureRumble(): void {
    const ac = context();
    if (!ac || rumble) return;
    const count = ac.sampleRate * 2;
    const buffer = ac.createBuffer(1, count, ac.sampleRate);
    const data = buffer.getChannelData(0);
    let s = 0;
    for (let i = 0; i < count; i++) {
      s = s * 0.96 + (Math.random() * 2 - 1) * 0.04;
      data[i] = s * 3.2;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;
    rumble = ac.createGain();
    rumble.gain.value = 0;
    src.connect(filter).connect(rumble).connect(ac.destination);
    src.start();
  }

  return {
    get muted() {
      return muted;
    },
    set muted(v: boolean) {
      muted = v;
      if (v && rumble) rumble.gain.value = 0;
    },
    unlock() {
      context();
      ensureRumble();
    },
    hop() {
      noise(0.05, 0.05, 420);
    },
    land() {
      tone(140, 0.06, 'square', 0.03, -60);
    },
    dash() {
      tone(220, 0.12, 'sawtooth', 0.045, 280);
    },
    coin() {
      const now = performance.now();
      if (now - lastCoin < 45) return;
      lastCoin = now;
      tone(880, 0.07, 'square', 0.04, 220);
    },
    spark() {
      tone(660, 0.09, 'triangle', 0.05, 440);
    },
    death() {
      noise(0.28, 0.12, 180);
      tone(180, 0.3, 'sawtooth', 0.06, -120);
    },
    pass() {
      tone(520, 0.1, 'square', 0.05, 300);
      tone(780, 0.14, 'triangle', 0.04, 200);
    },
    perk() {
      tone(523, 0.1, 'triangle', 0.05);
      tone(659, 0.14, 'triangle', 0.04);
    },
    ui() {
      tone(440, 0.04, 'square', 0.03);
    },
    rumble(amount: number) {
      if (muted) return;
      ensureRumble();
      if (!rumble || !ctx) return;
      const target = Math.max(0, Math.min(0.22, amount));
      rumble.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    },
  };
}

export type Audio = ReturnType<typeof createAudio>;
