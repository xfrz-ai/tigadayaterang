import * as THREE from "three";
import {
  C,
  Model,
  batchStatic,
  cargo,
  fadeTexture,
  label,
  pallet,
  truckChassis,
  truckWheels,
} from "./models";

/** On the red panel, shadows are a deeper red rather than grey. */
const SHADOW = "#9e241c";
/** Panel seams on the black cargo body. */
const RIB = "#383c3d";

function flat(color: string, opacity: number, alphaMap?: THREE.Texture) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    // Exact colours, so they sit on the CSS red without a tone-mapping shift.
    toneMapped: false,
    ...(alphaMap ? { alphaMap } : {}),
  });
}
function ground(
  material: THREE.Material,
  x: number,
  z: number,
  width: number,
  depth: number,
  y = 0.012,
) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * Closed box truck in the brand's black and red, heading +x and lettered on
 * its -z side (the side the camera sees once it is turned to face the copy).
 */
function blackTruck() {
  const m = new Model();
  truckChassis(m);
  m.box([4.05, 2.3, 2.02], [-1, 2.22, 0], C.dark);
  m.box([4.08, 0.16, 2.05], [-1, 1.4, 0], C.red);
  m.box([4.09, 0.08, 2.06], [-1, 3.25, 0], C.red);
  for (let i = 0; i < 8; i++)
    m.box(
      [0.02, 1.62, 0.012],
      [-2.7 + i * 0.48, 2.3, -1.022],
      RIB,
      [0, 0, 0],
      false,
    );
  // Side exhaust between the axles; the idle puffs leave from its tip.
  m.cylinder(0.06, 0.26, [0.5, 0.62, -1.0], C.grey, [Math.PI / 2, 0, 0], 10);
  const g = m.finish();
  truckWheels(g);
  const back: number[] = [0, Math.PI, 0];
  const lettering = label(
    g,
    "3 DAYA TERANG",
    [-1, 2.45, -1.036],
    3,
    0.75,
    C.white,
    back,
  );
  const tagline = label(
    g,
    "SETIAP KILO BERARTI",
    [-1, 1.86, -1.04],
    2.3,
    0.575,
    C.red,
    back,
  );
  batchStatic(g, [lettering, tagline]);
  return { truck: g, lettering, exhaust: new THREE.Vector3(0.5, 0.62, -1.14) };
}

export type ContactModel = {
  root: THREE.Group;
  /** World-space boxes the camera frames: truck, boxes and lane lines. */
  bounds: THREE.Box3[];
  /** Main pieces, for layout checks. */
  parts: Record<"truck" | "boxes" | "lettering", THREE.Object3D>;
  animate: (time: number) => void;
};

const PUFFS = 3;
const PUFF_CYCLE = 2.1; // seconds per puff

export function createContactModel(): ContactModel {
  const root = new THREE.Group();
  const shade = flat(SHADOW, 0.3);

  // Parked facing +z, so on screen it points down-left towards the copy.
  const { truck, lettering, exhaust } = blackTruck();
  truck.rotation.y = -Math.PI / 2;
  root.add(truck);
  root.add(ground(shade, 0.15, -0.05, 2.45, 6.45));

  // Lane lines either side, fading out at both ends.
  const lines = flat(C.white, 0.5, fadeTexture());
  const LINE = { z: 0.2, length: 8.4, x: 1.8 };
  for (const x of [-LINE.x, LINE.x])
    root.add(ground(lines, x, LINE.z, 0.06, LINE.length, 0.006));

  // A few parcels waiting at the kerb: a loaded pallet and two loose boxes.
  const boxes = new THREE.Group();
  boxes.add(pallet(3.55, 0.7, 1, false));
  for (const [w, h, d, x, y, z, rot] of [
    [0.62, 0.5, 0.58, 3.5, 0.85, 0.72, 0.14],
    [0.66, 0.52, 0.6, 2.95, 0, 2.5, 0.32],
    [0.5, 0.4, 0.46, 3.85, 0, 2.3, -0.18],
  ] as const) {
    const box = cargo(w, h, d, false);
    box.position.set(x, y, z);
    box.rotation.y = rot;
    boxes.add(box);
  }
  for (const [x, z, w, d] of [
    [3.65, 0.62, 1.95, 1.8],
    [3.02, 2.45, 0.95, 0.9],
    [3.9, 2.25, 0.75, 0.7],
  ])
    boxes.add(ground(shade, x, z, w, d));
  root.add(batchStatic(boxes));

  // Idle exhaust puffs, drifting out, up and back from the pipe.
  root.updateMatrixWorld(true);
  const outlet = truck.localToWorld(exhaust.clone());
  const puffGeometry = new THREE.SphereGeometry(1, 14, 10);
  const puffs = Array.from({ length: PUFFS }, () => {
    const puff = new THREE.Mesh(puffGeometry, flat(C.white, 0));
    root.add(puff);
    return puff;
  });

  const bounds = [
    new THREE.Box3().setFromObject(truck),
    new THREE.Box3().setFromObject(boxes),
    new THREE.Box3(
      new THREE.Vector3(-LINE.x, 0, LINE.z - LINE.length / 2),
      new THREE.Vector3(LINE.x, 0, LINE.z + LINE.length / 2),
    ),
  ];

  return {
    root,
    bounds,
    parts: { truck, boxes, lettering },
    animate(time) {
      // Engine idling: a slight, quick shudder.
      truck.position.y = Math.abs(Math.sin(time * 13)) * 0.014;
      puffs.forEach((puff, i) => {
        const k = (time / PUFF_CYCLE + i / PUFFS) % 1;
        // Out from the pipe first, then rising, staying below the lettering.
        puff.position.set(
          outlet.x + 0.75 * k,
          outlet.y + 0.15 * k + 0.45 * k * k,
          outlet.z - 0.25 * k,
        );
        puff.scale.setScalar(0.08 + 0.18 * k);
        (puff.material as THREE.MeshBasicMaterial).opacity =
          0.9 * Math.sin(Math.PI * k) ** 0.7;
      });
    },
  };
}
