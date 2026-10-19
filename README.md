# Dungeon Dash

Playable prototype of a 3D dungeon runner. You are a courier of the Swift Guild, carrying a parcel through **the Depths** while the floor collapses behind you. Other couriers’ runs are replayed as translucent echoes. Outrun the collapse, grab coins, and pick a perk every 250 meters.

“Dungeon Dash” is a working title. The fantasy, couriers, and mechanisms here are original.

Live build: [https://iodiot.github.io/dungeon-dash-proto/](https://iodiot.github.io/dungeon-dash-proto/)

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints. The app is served under `/dungeon-dash-proto/` (same base path as GitHub Pages).

```bash
npm run build    # typecheck, deterministic sim check, production bundle
npm run size     # gzip total of dist/; fails above 3 MB
npm run preview  # serve dist/
npm run sim      # headless bot playouts (no browser)
```

Add `?debug=1` for fps, seed, and collapse gap. Add `?webgl=1` to skip the WebGPU attempt and use the classic WebGL2 renderer.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Step forward | Tap, or swipe up a short way | W / Up (hold to chain) |
| Sidestep | Swipe left or right | A D / Left Right |
| Dash | Swipe up | Space or Shift |
| Step back | Swipe down | S / Down |
| Burrow (Bagel) | Burrow button | Q or E |
| Pause | Pause button | Esc or P |
| Start / restart | Run | Enter or Space on the title, R or Enter after death |
| Revive | Revive (ad) | V after death |
| Pick a perk | Tap a card | 1 or 2 |

On a phone the d-pad and Dash button appear. Swipes fire as soon as they are clear, so you do not have to lift your finger. The page does not scroll or zoom. Layout uses safe-area insets in portrait and landscape.

## Architecture

```
src/sim/        pure TypeScript rules (no three.js, no DOM)
src/render/     Three.js view: instanced tiles, procedural couriers
src/input/      pointer + keyboard → the same action stream
src/ui/         DOM screens
src/audio/      WebAudio synth (no samples)
src/meta/       save shape and copy
src/portal/     platform stubs (ads, storage, analytics)
```

The simulation steps at a fixed 60 Hz with a seeded mulberry32 RNG. Layout, pickups, player perks, and each ghost’s perks use separate streams, so a replay of recorded actions reproduces the same distance and coins. That split is what a later score server or a Capacitor shell can share: the sim module has no renderer imports.

Rendering tries `three/webgpu` when `navigator.gpu` exists, and falls back to WebGL2 (Three’s own backend, or the classic `WebGLRenderer` if init throws or `?webgl=1` is set). Scene objects are created from the same module as the renderer so the two Three builds are never mixed. Floors, coins, and hazards are instanced. Art is boxes and spheres, no textures, no external assets.

Echoes are four deterministic bot personalities baked when a seed is first seen, then replayed from their action list. Your best run on that seed is stored in `localStorage` and joins the race as a fifth echo. Passing an echo that was ahead of you pays 25 coins.

`src/portal/adapter.ts` is the only place that talks to storage, ads, and analytics. The local adapter uses `localStorage`, resolves a rewarded “ad” immediately, and no-ops midrolls. A Poki, CrazyGames, or Capacitor adapter can replace it without touching the sim.

## Mobile (Capacitor)

The web build is the app. A later native shell:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Dungeon Dash" app.dungeondash.proto --web-dir dist
npm run build
npx cap add ios
npx cap add android
npx cap copy
```

Point the iOS and Android web view at `dist/` (base path `/dungeon-dash-proto/` is already in the built asset URLs; for a store build set Vite `base` to `./` so the shell can load files locally). Implement `PortalAdapter` with Capacitor Preferences for the save and a rewarded-ad plugin for revive. The sim stays in TypeScript and does not need a rewrite.

## What this prototype includes

- One-screen loop: title, run HUD (distance, coins, dash charges, echo race), perk choice, death, instant restart, stub revive, courier select.
- Three couriers: Kira (start), Bagel the mole (burrow, 500 coins), Nox the fox lantern (earlier trap warnings, 1500). One upgrade each for 300 coins.
- Chunked 5-lane halls, two biomes (crypt, then forge), traps (crusher, pendulum, steam knockback, cracked tiles, boulder, conveyor), beetle and crab, collapsing floor as the pursuer.
- Coins and dash sparks, perks every 250 m (Magnet, Long Dash, Plating, Gold Rush, Compass).
- Tutorial stretch with no lethal traps, and a gentler collapse after three very short deaths.
- Procedural low-poly look, screen shake, squash on landing, synth SFX, PWA manifest.

## Cut from the full design

Gameplay height changes (tiles only look stepped), later biomes, extra traps and enemies, more couriers and upgrade ranks, cosmetics, daily chest, online ghosts, music loops, real dynamic lights and shadows, and live portal SDKs. Ghost names are generated, not typed by the player. There is no service worker.

## Known issues

- The first load still fetches the WebGPU module when the browser advertises `navigator.gpu`, even if it then falls back to WebGL2. `?webgl=1` skips that download.
- A cautious bot dies around a couple of minutes; a greedy one can run much farther, so the race line sometimes names an echo far ahead.
- Revive is a local stub: it always grants the extra life and does not show a real ad.
- Quitting a living run stores that distance as your echo for the seed.
