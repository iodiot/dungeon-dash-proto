import type { HeroId } from '../sim/types';

type T = typeof import('three');

function lambert(THREE: T, color: number): import('three').MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function basic(THREE: T, color: number): import('three').MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

function addBox(
  THREE: T,
  group: import('three').Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  glow = false,
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glow ? basic(THREE, color) : lambert(THREE, color));
  mesh.position.set(x, y, z);
  group.add(mesh);
}

/** Low-poly couriers built from boxes. Origin is at the feet, facing +z. */
export function buildCourier(THREE: T, hero: HeroId): import('three').Group {
  const group = new THREE.Group();
  if (hero === 'bagel') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 6), lambert(THREE, 0x8a5536));
    body.scale.set(1.05, 0.82, 1.15);
    body.position.set(0, 0.34, 0);
    group.add(body);
    addBox(THREE, group, 0.22, 0.14, 0.2, 0xe0b08a, 0, 0.3, 0.22);
    addBox(THREE, group, 0.08, 0.08, 0.08, 0x2c221c, -0.08, 0.4, 0.3);
    addBox(THREE, group, 0.08, 0.08, 0.08, 0x2c221c, 0.08, 0.4, 0.3);
    addBox(THREE, group, 0.16, 0.06, 0.08, 0x9fd7ff, 0, 0.42, 0.28, true);
    addBox(THREE, group, 0.12, 0.08, 0.16, 0x3a2c28, -0.22, 0.16, 0.12);
    addBox(THREE, group, 0.12, 0.08, 0.16, 0x3a2c28, 0.22, 0.16, 0.12);
    addBox(THREE, group, 0.18, 0.16, 0.12, 0xc4512e, 0, 0.4, -0.22);
    return group;
  }
  if (hero === 'nox') {
    addBox(THREE, group, 0.16, 0.16, 0.16, 0x3a2e28, -0.1, 0.08, 0);
    addBox(THREE, group, 0.16, 0.16, 0.16, 0x3a2e28, 0.1, 0.08, 0);
    addBox(THREE, group, 0.36, 0.32, 0.28, 0xe07a32, 0, 0.36, 0);
    addBox(THREE, group, 0.2, 0.16, 0.08, 0xf3d7b0, 0, 0.34, 0.14);
    addBox(THREE, group, 0.26, 0.22, 0.24, 0xd86a28, 0, 0.64, 0.02);
    addBox(THREE, group, 0.1, 0.16, 0.06, 0xc45520, -0.12, 0.82, 0);
    addBox(THREE, group, 0.1, 0.16, 0.06, 0xc45520, 0.12, 0.82, 0);
    addBox(THREE, group, 0.08, 0.08, 0.06, 0x241c18, -0.07, 0.66, 0.12);
    addBox(THREE, group, 0.08, 0.08, 0.06, 0x241c18, 0.07, 0.66, 0.12);
    addBox(THREE, group, 0.12, 0.1, 0.22, 0xc45a22, 0, 0.28, -0.24);
    addBox(THREE, group, 0.04, 0.28, 0.04, 0x5c4636, 0.28, 0.46, 0.08);
    addBox(THREE, group, 0.14, 0.16, 0.14, 0xffe08a, 0.28, 0.66, 0.1, true);
    addBox(THREE, group, 0.16, 0.14, 0.1, 0xc4512e, 0, 0.42, -0.16);
    return group;
  }
  addBox(THREE, group, 0.12, 0.18, 0.12, 0x243038, -0.08, 0.09, 0);
  addBox(THREE, group, 0.12, 0.18, 0.12, 0x243038, 0.08, 0.09, 0);
  addBox(THREE, group, 0.34, 0.36, 0.2, 0x2bb8a8, 0, 0.38, 0);
  addBox(THREE, group, 0.16, 0.1, 0.08, 0xf2d36a, 0, 0.46, 0.1, true);
  addBox(THREE, group, 0.24, 0.22, 0.22, 0xf0c9a0, 0, 0.68, 0.02);
  addBox(THREE, group, 0.26, 0.08, 0.26, 0x1f6f68, 0, 0.8, 0.02);
  addBox(THREE, group, 0.06, 0.06, 0.04, 0x2a211c, -0.06, 0.7, 0.12);
  addBox(THREE, group, 0.06, 0.06, 0.04, 0x2a211c, 0.06, 0.7, 0.12);
  addBox(THREE, group, 0.2, 0.22, 0.12, 0xc44932, 0, 0.4, -0.14);
  addBox(THREE, group, 0.12, 0.1, 0.1, 0xf0d36a, 0.02, 0.46, -0.2, true);
  return group;
}

export function ghostify(THREE: T, source: import('three').Group, tint: number): import('three').Group {
  const group = source.clone(true);
  const tintColor = new THREE.Color(tint);
  group.traverse((obj) => {
    const mesh = obj as import('three').Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as import('three').MeshLambertMaterial).clone();
    mat.transparent = true;
    mat.opacity = 0.4;
    mat.depthWrite = false;
    mat.color.lerp(tintColor, 0.75);
    mesh.material = mat;
  });
  return group;
}
