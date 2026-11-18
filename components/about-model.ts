import * as THREE from "three";
import {
  C,
  Model,
  batchStatic,
  cargo,
  fadeTexture,
  footprint,
  label,
  pallet,
  person,
  truckChassis,
  truckWheels,
} from "./models";

/** Dark lining seen through the open side of the cargo body. */
const INTERIOR = "#3d4241";

/**
 * Box truck heading +x with its near (+z) side open, showing two loaded
 * pallets inside, in the same toon-and-ink style as the rest of the site.
 */
function openTruck() {
  const m = new Model();
  truckChassis(m);
  // Cargo body: back wall, roof and end walls; the +z side stays open.
  m.box([4.05, 2.3, 0.07], [-1, 2.22, -1], C.red);
  m.box([4.1, 0.17, 2.08], [-1, 3.3, 0], C.red);
  m.box([0.1, 2.3, 2], [-3, 2.22, 0], C.red);
  m.box([0.1, 2.3, 2], [1, 2.22, 0], C.red);
  m.box([3.86, 2.1, 0.02], [-1, 2.2, -0.955], INTERIOR, [0, 0, 0], false);
  m.box([0.02, 2.1, 1.9], [-2.94, 2.2, 0], INTERIOR, [0, 0, 0], false);
  // Frame around the opening: header with the brand, sill and corner posts.
  m.box([4.1, 0.3, 0.08], [-1, 3.07, 0.99], C.red);
  m.box([4.1, 0.2, 0.08], [-1, 1.2, 1.02], C.white);
  for (const x of [-2.97, 0.97])
    m.box([0.12, 2.3, 0.1], [x, 2.22, 0.98], C.red);
  const g = m.finish();
  for (const [x, red] of [
    [-2, true],
    [-0.05, false],
  ] as const) {
    const p = pallet(x, -0.15, 2, red);
    p.position.y = 1.1;
    g.add(p);
  }
  const wheels = truckWheels(g);
  label(g, "3 DAYA TERANG", [-1, 3.07, 1.035], 2.2, 0.27, C.white);
  footprint(g, 0, 0.1, 6.3, 2.25);
  batchStatic(g, wheels);
  return g;
}

// The worker's loading round: pick up at the stack (A), carry the box to the
// open side of the truck (B), set it inside, walk back empty.
const STACK = new THREE.Vector3(0.35, 0, 2.85);
const PICKUP = new THREE.Vector3(-0.75, 0, 2.95);
const DROP = new THREE.Vector3(-2.45, 0, 1.75);
const ROUND = 8; // seconds
const WALK = { out: [0.9, 3.4], back: [4.4, 6.9] } as const;

const ease = (v: number) => v * v * (3 - 2 * v);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const heading = (from: THREE.Vector3, to: THREE.Vector3) =>
  Math.atan2(to.x - from.x, to.z - from.z);
/** Interpolates angles the short way round. */
function turn(a: number, b: number, k: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * ease(clamp01(k));
}

export type AboutModel = {
  root: THREE.Group;
  /** World-space boxes the camera frames: truck, stack and the worker's path. */
  bounds: THREE.Box3[];
  /** Roof corners of the truck body, for layout checks. */
  roof: THREE.Vector3[];
  /** Main pieces, for layout checks. */
  parts: Record<"truck" | "stack" | "worker", THREE.Object3D>;
  animate: (time: number) => void;
  state: () => { workerX: number; carrying: boolean };
};

export function createAboutModel(): AboutModel {
  const root = new THREE.Group();
  const truck = openTruck();
  root.add(truck);

  // Parcels waiting to be loaded.
  const stack = new THREE.Group();
  for (const [w, h, d, x, y, z, rot, red] of [
    [0.8, 0.6, 0.75, 0, 0, 0, 0, true],
    [0.8, 0.6, 0.75, 0.02, 0.6, 0.01, 0.07, true],
    [0.5, 0.42, 0.5, -0.02, 1.2, 0.03, -0.18, false],
    [0.62, 0.5, 0.6, 0.78, 0, -0.18, 0.12, false],
    [0.56, 0.44, 0.52, 0.72, 0, 0.55, -0.1, false],
  ] as const) {
    const box = cargo(w, h, d, red);
    box.position.set(x, y, z);
    box.rotation.y = rot;
    stack.add(box);
  }
  stack.position.copy(STACK);
  footprint(stack, 0.35, 0.15, 1.9, 1.6);
  root.add(batchStatic(stack));

  // Parking-bay lines, fading out at both ends.
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: "#dcdfd7",
    transparent: true,
    alphaMap: fadeTexture(),
    depthWrite: false,
  });
  for (const [x, z, length] of [
    [-4.4, 0.6, 9],
    [4.3, 0.2, 9.5],
    [2.4, 3.7, 4],
  ]) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, length),
      lineMaterial,
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.006, z);
    root.add(line);
  }

  const worker = person(false);
  const carried = cargo(0.55, 0.43, 0.43, true);
  carried.position.set(0, 0.84, 0.43);
  worker.add(carried);
  const legs: THREE.Group[] = worker.userData.legs;
  batchStatic(worker, [...legs, carried]);
  root.add(worker);

  const toTruck = heading(PICKUP, DROP),
    toStack = heading(DROP, PICKUP),
    faceStack = heading(PICKUP, STACK),
    faceTruck = Math.PI;

  const bounds = [
    new THREE.Box3().setFromObject(truck),
    new THREE.Box3().setFromObject(stack),
    ...[PICKUP, DROP].map(
      (p) =>
        new THREE.Box3(
          p.clone().add(new THREE.Vector3(-0.35, 0, -0.35)),
          p.clone().add(new THREE.Vector3(0.35, 1.8, 0.35)),
        ),
    ),
  ];
  const roof = [
    [-3.05, -1.04],
    [1.05, -1.04],
    [1.05, 1.04],
    [-3.05, 1.04],
  ].map(([x, z]) => new THREE.Vector3(x, 3.385, z));

  let carrying = false;
  return {
    root,
    bounds,
    roof,
    parts: { truck, stack, worker },
    animate(time) {
      const t = time % ROUND;
      let pos: THREE.Vector3,
        angle: number,
        walking = 0;
      if (t < WALK.out[0]) {
        pos = PICKUP;
        angle = turn(faceStack, toTruck, (t - 0.6) / 0.3);
      } else if (t < WALK.out[1]) {
        const k = ease((t - WALK.out[0]) / (WALK.out[1] - WALK.out[0]));
        pos = PICKUP.clone().lerp(DROP, k);
        angle = toTruck;
        walking = 1;
      } else if (t < WALK.back[0]) {
        pos = DROP;
        angle =
          t < 3.9
            ? turn(toTruck, faceTruck, (t - WALK.out[1]) / 0.3)
            : turn(faceTruck, toStack, (t - 4.1) / 0.3);
      } else if (t < WALK.back[1]) {
        const k = ease((t - WALK.back[0]) / (WALK.back[1] - WALK.back[0]));
        pos = DROP.clone().lerp(PICKUP, k);
        angle = toStack;
        walking = 1;
      } else {
        pos = PICKUP;
        angle = turn(toStack, faceStack, (t - WALK.back[1]) / 0.3);
      }
      // Box in hand from the pick-up at the stack until it is set in the truck.
      carrying = t >= 0.45 && t < 3.8;
      carried.visible = carrying;
      const stride = Math.sin(time * 9);
      worker.position.set(pos.x, Math.abs(stride) * 0.02 * walking, pos.z);
      worker.rotation.y = angle;
      legs.forEach(
        (leg, i) => (leg.rotation.x = stride * 0.45 * walking * (i ? -1 : 1)),
      );
      truck.position.y = Math.sin(time * 6) * 0.006;
    },
    state: () => ({ workerX: worker.position.x, carrying }),
  };
}
