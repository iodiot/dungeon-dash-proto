import { buildCourier, ghostify } from './actors';
import { hash32 } from '../sim/rng';
import { samplePose } from '../sim/runner';
import type { Session } from '../sim/session';
import { boulderZ, crusherDrop, sweep } from '../sim/traps';
import { CRAB_PERIOD, SWING_PERIOD } from '../sim/traps';
import type { Cell, HeroId } from '../sim/types';
import { collapseSpeed } from '../sim/types';

type T = typeof import('three');

export interface ScreenTag {
  text: string;
  x: number;
  y: number;
  kind: 'ghost' | 'mark';
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: number;
}

class Batch {
  n = 0;
  readonly dummy: import('three').Object3D;
  readonly color: import('three').Color;
  constructor(
    readonly mesh: import('three').InstancedMesh,
    readonly cap: number,
    THREE: T,
  ) {
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    mesh.count = 1;
    mesh.setColorAt(0, this.color);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.visible = false;
  }

  begin(): void {
    this.n = 0;
  }

  push(x: number, y: number, z: number, sx: number, sy: number, sz: number, rx: number, ry: number, rz: number, col: number): void {
    if (this.n >= this.cap) return;
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(rx, ry, rz);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.n, this.dummy.matrix);
    this.color.setHex(col);
    this.mesh.setColorAt(this.n, this.color);
    this.n += 1;
  }

  end(): void {
    if (this.n <= 0) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

function tileHeight(x: number, z: number): number {
  const h = hash32(z * 5 + 2, x + 13) % 19;
  if (h === 0) return 0.14;
  if (h === 1) return 0.26;
  return 0;
}

export interface Gfx {
  backend: 'webgpu' | 'webgl2';
  tags: ScreenTag[];
  draw(session: Session, alpha: number, dt: number, mode: string): void;
  resize(): void;
  project(x: number, y: number, z: number): { x: number; y: number } | null;
  burst(x: number, y: number, z: number, color: number, n: number): void;
  stress(): void;
}

export async function createGfx(canvas: HTMLCanvasElement): Promise<Gfx> {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dprCap = Math.min(window.devicePixelRatio || 1, coarse ? 1.35 : 1.6);
  const forceWebGL = new URLSearchParams(location.search).has('webgl');

  let THREE: T;
  let renderer: import('three').WebGLRenderer;
  let backend: 'webgpu' | 'webgl2' = 'webgl2';

  if (!forceWebGL && navigator.gpu) {
    try {
      const webgpu = (await import('three/webgpu')) as unknown as T & {
        WebGPURenderer: new (params?: object) => import('three').WebGLRenderer & {
          init: () => Promise<void>;
          backend?: { isWebGPUBackend?: boolean };
        };
      };
      const gpuRenderer = new webgpu.WebGPURenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
      });
      await gpuRenderer.init();
      THREE = webgpu as unknown as T;
      renderer = gpuRenderer;
      backend = gpuRenderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';
    } catch (err) {
      console.warn('WebGPU path failed, using WebGL2', err);
      THREE = await import('three');
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !coarse,
        alpha: false,
        powerPreference: 'high-performance',
      });
    }
  } else {
    THREE = await import('three');
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !coarse,
      alpha: false,
      powerPreference: 'high-performance',
    });
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(dprCap);

  const scene = new THREE.Scene();
  // The camera sits behind the runner (-z) looking down +z, so screen-right is
  // world -x. Mirror the rendered world on x so sim +x ('R') shows as screen-right.
  // Sim, ghosts and chunk layouts stay untouched; only the lane-to-screen mapping flips.
  scene.scale.x = -1;
  scene.background = new THREE.Color(0x243044);
  scene.fog = new THREE.Fog(0x243044, 16, 42);
  const hemi = new THREE.HemisphereLight(0xe7f1ff, 0x4a382c, 1.45);
  const dir = new THREE.DirectionalLight(0xfff4e4, 2.1);
  dir.position.set(3, 12, 4); // mirrored with the scene: keeps the light on screen-right
  scene.add(hemi, dir);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(24, 80), new THREE.MeshBasicMaterial({ color: 0x07080d }));
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.y = -2.6;
  scene.add(abyss);

  const lambert = new THREE.MeshLambertMaterial({ flatShading: true });
  const basicMat = new THREE.MeshBasicMaterial();
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.45, depthWrite: false });

  const tiles = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.22, 0.92), lambert, 240), 240, THREE);
  const coins = new Batch(new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.16, 0), basicMat, 80), 80, THREE);
  const sparks = new Batch(new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.11, 0), basicMat.clone(), 40), 40, THREE);
  const blocks = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.78, 0.56, 0.78), basicMat.clone(), 40), 40, THREE);
  const shadows = new Batch(new THREE.InstancedMesh(new THREE.PlaneGeometry(0.8, 0.8), shadowMat, 40), 40, THREE);
  const hammers = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.72, 0.42, 0.72), basicMat.clone(), 24), 24, THREE);
  const bars = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), lambert.clone(), 24), 24, THREE);
  const rocks = new Batch(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.36, 0), lambert.clone(), 16), 16, THREE);
  const bugs = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.28, 0.42), lambert.clone(), 16), 16, THREE);
  const crabs = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.22, 0.48), lambert.clone(), 12), 12, THREE);
  const arrows = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.06, 0.34), basicMat.clone(), 40), 40, THREE);
  const pillars = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 1.8, 0.34), lambert.clone(), 80), 80, THREE);
  const cracks = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.04, 0.08), basicMat.clone(), 40), 40, THREE);
  const marks = new Batch(new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.18, 0.28), lambert.clone(), 12), 12, THREE);
  for (const batch of [tiles, coins, sparks, blocks, shadows, hammers, bars, rocks, bugs, crabs, arrows, pillars, cracks, marks]) {
    scene.add(batch.mesh);
  }
  void shadows;

  const pCount = 140;
  const positions = new Float32Array(pCount * 3);
  const pColors = new Float32Array(pCount * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  points.frustumCulled = false;
  scene.add(points);
  const particles: Particle[] = [];
  const color = new THREE.Color();

  const couriers = new Map<HeroId, import('three').Group>();
  const ghostMeshes: import('three').Group[] = [];
  const ghostTints = [0x9fd4ff, 0x7ee0c5, 0xf0c27a, 0xd7c4ff, 0xffb4a2];
  let playerMesh = new THREE.Group();
  let playerHero: HeroId | null = null;
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), shadowMat.clone());
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);

  const look = new THREE.Vector3(2, 0.2, 4);
  const proj = new THREE.Vector3();
  const tags: ScreenTag[] = [];
  let shake = 0;
  let land = 0;
  let face = 0;
  let faceNow = 0;
  let prevX = 2;
  let prevZ = 0;
  let spin = 0;
  let portrait = true;
  let deathClock = -1;

  function burst(x: number, y: number, z: number, col: number, n: number): void {
    for (let i = 0; i < n && particles.length < pCount; i++) {
      particles.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 0.8 + Math.random() * 1.6,
        vz: (Math.random() - 0.5) * 1.4,
        life: 0.35 + Math.random() * 0.25,
        max: 0.6,
        color: col,
      });
    }
  }

  function resize(): void {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    portrait = h >= w * 0.92;
    renderer.setPixelRatio(dprCap);
    renderer.setSize(w, h, false);
    camera.aspect = Math.max(0.3, w / Math.max(1, h));
    camera.fov = portrait ? 50 : 40;
    camera.updateProjectionMatrix();
  }

  function project(x: number, y: number, z: number): { x: number; y: number } | null {
    proj.set(-x, y, z).project(camera); // world -> mirrored scene space
    if (proj.z > 1) return null;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    return { x: (proj.x * 0.5 + 0.5) * w, y: (-proj.y * 0.5 + 0.5) * h };
  }

  function broken(session: Session, x: number, z: number): boolean {
    const at = session.player.cracks.get(x + ',' + z);
    return at !== undefined && session.player.tick >= at;
  }

  function draw(session: Session, alpha: number, dt: number, mode: string): void {
    const player = session.player;
    const tickFloat = player.tick + alpha;
    const pose = samplePose(player, player.alive ? tickFloat : player.tick);
    spin += dt;
    if (player.hero !== playerHero) {
      scene.remove(playerMesh);
      playerMesh = buildCourier(THREE, player.hero);
      scene.add(playerMesh);
      playerMesh.add(blob);
      blob.position.set(0, 0.03, 0);
      playerHero = player.hero;
      couriers.set(player.hero, playerMesh);
    }
    while (ghostMeshes.length < session.ghosts.length) {
      const i = ghostMeshes.length;
      const tint = ghostTints[i % ghostTints.length];
      const mesh = ghostify(THREE, buildCourier(THREE, session.ghosts[i].runner.hero), tint);
      scene.add(mesh);
      ghostMeshes.push(mesh);
    }

    const forge = player.bestZ >= 248;
    const fogHex = forge ? 0x3a241c : 0x243044;
    (scene.background as import('three').Color).setHex(fogHex);
    (scene.fog as import('three').Fog).color.setHex(fogHex);
    const ahead = (portrait ? 2.7 : 1.55) + player.viewExtra * 0.45;
    const back = portrait ? 6.5 : 9.4;
    const up = portrait ? 8.7 : 11.6;
    const followX = pose.x * 0.72 + 2 * 0.28;
    const damp = 1 - Math.exp(-dt * (mode === 'title' ? 1.4 : 7));
    look.x += (followX - look.x) * damp;
    look.z += (pose.z + ahead - look.z) * damp;
    look.y = 0.15;
    const gap = player.collapseArmed ? pose.z - player.collapseZ : 99;
    if (!reduced && player.collapseArmed && gap < 4.2 && mode === 'play') {
      shake = Math.max(shake, ((4.2 - gap) / 4.2) * 0.18);
    }
    shake *= Math.exp(-dt * (reduced ? 10 : 5));
    const sx = Math.sin(spin * 28) * shake;
    const sy = Math.cos(spin * 23) * shake * 0.6;
    // Camera lives outside the mirrored scene, so place it in mirrored space (-x).
    camera.position.set(-(look.x + sx), up + sy, look.z - back);
    camera.lookAt(-look.x, 0.2, look.z);
    camera.fov += ((portrait ? 50 : 40) + (pose.kind === 'dash' ? 4 : 0) - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();

    const ground = tileHeight(Math.round(pose.x), Math.round(pose.z));
    const arcH = pose.kind === 'dash' ? 0.46 : 0.78;
    const air = pose.arc;
    if (air < 0.08 && land < 0.2) land = Math.min(1, land + 0.2);
    if (air > 0.4) land = 0;
    land *= Math.exp(-dt * 10);
    const feet = ground + 0.22 + air * arcH;
    const dx = pose.x - prevX;
    const dz = pose.z - prevZ;
    if (dx * dx + dz * dz > 0.00001) face = Math.atan2(dx, dz);
    faceNow += (face - faceNow) * Math.min(1, dt * 14);
    prevX = pose.x;
    prevZ = pose.z;
    if (player.alive) deathClock = -1;
    else if (deathClock < 0) deathClock = 0;
    else deathClock += dt;
    playerMesh.visible = true;
    const fall = player.alive ? 0 : Math.min(1.6, deathClock * 2.2);
    playerMesh.position.set(pose.x, (player.alive ? feet : 0.25) - fall, pose.z);
    playerMesh.rotation.set(player.alive ? 0 : deathClock * 2, faceNow, player.alive ? 0 : deathClock * 1.4);
    const squash = land * 0.22;
    const stretch = air * 0.18;
    playerMesh.scale.set(1 + squash - stretch, 1 - squash + stretch, 1 + squash - stretch * 0.4);

    const speed = player.collapseArmed ? collapseSpeed(player.bestZ, player.assist) : 0;
    const collapse = player.collapseArmed ? player.collapseZ + (alpha * speed) / 60 : -20;
    const z0 = Math.max(0, Math.floor(Math.min(pose.z, collapse) - 5));
    const z1 = Math.floor(pose.z) + (portrait ? 15 : 11) + Math.round(player.viewExtra);
    const seenRock = new Set<string>();
    const seenSwing = new Set<string>();

    tiles.begin();
    coins.begin();
    sparks.begin();
    blocks.begin();
    shadows.begin();
    hammers.begin();
    bars.begin();
    rocks.begin();
    bugs.begin();
    crabs.begin();
    arrows.begin();
    pillars.begin();
    cracks.begin();
    marks.begin();

    for (let z = z0; z <= z1; z++) {
      if (z % 2 === 0) {
        const py = 0.9;
        const pc = forge ? 0x6a4634 : 0x5c7088;
        pillars.push(-0.78, py, z, 1, 1, 1, 0, 0, 0, pc);
        pillars.push(4.78, py, z, 1, 1, 1, 0, 0, 0, pc);
        if (z % 6 === 0) {
          blocks.push(-0.78, 1.9, z, 0.28, 0.28, 0.28, 0, 0, 0, 0xff8a3a);
        }
      }
      for (let x = 0; x < 5; x++) {
        const cell = session.world.get(x, z);
        if (!cell.walk || broken(session, x, z)) continue;
        const h = cell.cracked || cell.conveyor ? 0 : tileHeight(x, z);
        const sink = collapse - z;
        if (sink > 2.5) continue;
        let y = h + 0.11;
        let rx = 0;
        let rz = 0;
        let ox = 0;
        if (sink > 0.22) {
          const t = sink - 0.22;
          y = h - t * t * 2.4;
          rx = t * (x % 2 ? 1.4 : -1.2);
          rz = t * 0.8;
          if (Math.random() < dt * 8 && y > -1.5) burst(x, Math.max(0, y), z, forge ? 0xc47a45 : 0x8aa0b8, 1);
        } else if (sink > 0) {
          ox = Math.sin(spin * 36 + z) * sink * 0.12;
        }
        tiles.push(x + ox, y, z, 1, 1, 1, rx, 0, rz, tileCol(cell, x, z, player.compass > 0, session, forge));
        if (cell.cracked && sink <= 0.22) cracks.push(x, h + 0.24, z, 1, 1, 1, 0, 0.4, 0, 0xff6a3c);
        if (cell.coin && !player.got.has(x + ',' + z)) {
          coins.push(x, h + 0.55 + Math.sin(spin * 3 + x) * 0.06, z, 1, 1, 1, 0, spin * 2, 0, 0xffd24a);
        }
        if (cell.spark && !player.got.has('s' + x + ',' + z)) {
          sparks.push(x, h + 0.62, z, 1, 1, 1, spin * 3, spin * 2, 0, 0x8af6ff);
        }
        if (cell.conveyor) {
          const dir = cell.conveyor;
          arrows.push(x + dir * 0.12, h + 0.24, z, 1, 1, 1, 0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0xffb15a);
        }
        if (cell.crusher) {
          const drop = crusherDrop(cell.crusher.phase, player.tick, player.telegraph);
          const by = 0.5 + (1 - drop) * 2.5;
          blocks.push(x, by, z, 1, 1, 1, 0, 0, 0, 0xff5a3c);
          const sc = 0.35 + drop * 0.9;
          shadows.push(x, h + 0.24, z, sc, sc, 1, -Math.PI / 2, 0, 0, 0x12080a);
        }
        if (cell.pendulum && !seenSwing.has('p' + z + ':' + cell.pendulum.min)) {
          seenSwing.add('p' + z + ':' + cell.pendulum.min);
          const s = sweep(cell.pendulum.min, cell.pendulum.max, player.tick, cell.pendulum.phase, SWING_PERIOD);
          hammers.push(s.pos, 0.85, z, 1, 1, 1, 0, 0, 0, 0xffb14a);
          bars.push(s.pos, 2.1, z, 1, 1, 1, 0, 0, 0, 0x6a5848);
        }
        if (cell.boulder) {
          const id = cell.boulder.z0 + ':' + x;
          if (!seenRock.has(id)) {
            seenRock.add(id);
            const bz = boulderZ(cell.boulder, player.tick);
            if (bz !== null && bz >= z0 - 1 && bz <= z1 + 1) {
              rocks.push(x, 0.48, bz, 1, 1, 1, spin, spin * 0.6, 0, 0x6e5648);
            }
          }
        }
        if (cell.beetle && !seenSwing.has('b' + z + ':' + cell.beetle.min)) {
          seenSwing.add('b' + z + ':' + cell.beetle.min);
          const s = sweep(cell.beetle.min, cell.beetle.max, player.tick, cell.beetle.phase, SWING_PERIOD);
          bugs.push(s.pos, 0.36, z, 1, 1, 1, 0, 0, 0, 0xd24b4b);
        }
        if (cell.crab && !seenSwing.has('c' + x + ':' + cell.crab.min)) {
          seenSwing.add('c' + x + ':' + cell.crab.min);
          const s = sweep(cell.crab.min, cell.crab.max, player.tick, cell.crab.phase, CRAB_PERIOD);
          if (s.pos >= z0 && s.pos <= z1) crabs.push(x, 0.32, s.pos, 1, 1, 1, 0, Math.PI / 2, 0, 0xe07a3d);
        }
        if (cell.shrine) {
          bars.push(x, 1.1, z, 1.2, 0.7, 1.2, 0, spin * 0.4, 0, 0xffd36a);
        }
      }
    }

    tags.length = 0;
    session.ghosts.forEach((ghost, i) => {
      const mesh = ghostMeshes[i];
      const gpose = samplePose(ghost.runner, ghost.runner.alive ? ghost.runner.tick + alpha : ghost.runner.tick);
      const near = Math.abs(gpose.z - pose.z) < (portrait ? 16 : 12) && Math.abs(gpose.x - pose.x) < 8;
      mesh.visible = ghost.runner.alive && near && ghost.runner.tick > 5;
      if (mesh.visible) {
        const gh = tileHeight(Math.round(gpose.x), Math.round(gpose.z));
        mesh.position.set(gpose.x, gh + 0.22 + gpose.arc * 0.7, gpose.z);
        mesh.rotation.y = Math.atan2(gpose.x - ghost.runner.x, gpose.z - ghost.runner.z || 1);
        mesh.scale.setScalar(1);
        const p = project(gpose.x, mesh.position.y + 1.15, gpose.z);
        if (p) tags.push({ text: ghost.name, x: p.x, y: p.y, kind: 'ghost' });
      } else if (!ghost.runner.alive && Math.abs(ghost.runner.z - pose.z) < 14) {
        marks.push(ghost.runner.x, 0.2, ghost.runner.z, 1, 1, 1, 0, 0.4, 0, 0x9ecfff);
        const p = project(ghost.runner.x, 0.7, ghost.runner.z);
        if (p) tags.push({ text: ghost.name, x: p.x, y: p.y, kind: 'mark' });
      }
    });
    for (let i = session.ghosts.length; i < ghostMeshes.length; i++) ghostMeshes[i].visible = false;

    tiles.end();
    coins.end();
    sparks.end();
    blocks.end();
    shadows.end();
    hammers.end();
    bars.end();
    rocks.end();
    bugs.end();
    crabs.end();
    arrows.end();
    pillars.end();
    cracks.end();
    marks.end();

    if (player.collapseArmed && gap < 8) {
      for (let x = 0; x < 5; x++) {
        if (Math.random() < dt * 10) burst(x, 0.2, collapse, forge ? 0xff8a4a : 0xb7c6d6, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy -= dt * 4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    const attr = pGeo.getAttribute('position') as import('three').BufferAttribute;
    const cAttr = pGeo.getAttribute('color') as import('three').BufferAttribute;
    for (let i = 0; i < pCount; i++) {
      const p = particles[i];
      if (!p) {
        positions[i * 3 + 1] = -99;
        continue;
      }
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      color.setHex(p.color);
      pColors[i * 3] = color.r;
      pColors[i * 3 + 1] = color.g;
      pColors[i * 3 + 2] = color.b;
    }
    attr.needsUpdate = true;
    cAttr.needsUpdate = true;

    abyss.position.set(2, -2.5, pose.z + 6);
    renderer.render(scene, camera);
  }

  resize();
  return {
    backend,
    tags,
    draw,
    resize,
    project,
    burst,
    stress() {
      dprCap = Math.max(0.75, dprCap - 0.12);
      resize();
    },
  };
}

function tileCol(cell: Cell, x: number, z: number, compass: boolean, session: Session, forge: boolean): number {
  let col = forge ? ((x + z) % 2 === 0 ? 0x7a5240 : 0x684434) : (x + z) % 2 === 0 ? 0x6d88a8 : 0x5c7490;
  if (cell.cracked) col = 0x6b4a38;
  if (cell.conveyor) col = forge ? 0x5c4032 : 0x3d4c46;
  if (cell.shrine) col = 0x7a6238;
  if (cell.steam) col = 0x4e5964;
  if (compass && z > session.player.z && z < session.player.z + 6 && cell.walk) col = 0xc6a15a;
  return col;
}
