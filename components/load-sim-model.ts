import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  C,
  Model,
  fadeTexture,
  footprint,
  label,
  plan as slab,
  smooth,
  truckChassis,
  truckWheels,
  wheel,
} from "./models";
import {
  CELL,
  ITEMS,
  ITEM_LIST,
  MAX_ITEMS,
  pack,
  type Item,
  type ItemKind,
  type LoadPlan,
  type Packing,
  type Slot,
  type VehicleKind,
} from "./load-sim-data";
import { worldPoints } from "./scene-frame";

/** Dark lining and floor seen inside once the side is lifted. */
const INTERIOR = "#3d4241";
const FLOOR = "#4b504f";

/**
 * A vehicle heading +x whose near (+z) side swings open as one wing (the
 * truck's side and roof, the plane's cargo door, the ship's drop side) so the
 * whole cargo space can be seen.
 */
type Rig = {
  group: THREE.Group;
  wing: THREE.Group;
  wheels: THREE.Group[];
  radius: number;
  /** Wing angle when fully open, in radians. */
  lift: number;
  /** Lowest corner of the cargo space, in vehicle coordinates. */
  hold: THREE.Vector3;
  /** Just outside the open side (world z): boxes pass here on the way in and out. */
  doorway: number;
  /** How far boxes rise above their slot as they pass the doorway. */
  clearance: number;
  /** Index of the camera framing made for this vehicle. */
  frame: number;
  /** Propellers, turned as the vehicle rolls. */
  props: THREE.Object3D[];
  /**
   * What the lane turns into for it: road, sea (it floats and bobs at the
   * quay) or runway.
   */
  ground: Ground;
  /** Wake material, faded in with speed. */
  wake?: THREE.MeshBasicMaterial;
};

function truckRig(): Rig {
  const HINGE = -0.5,
    TOP = 3.37;
  const m = new Model();
  truckChassis(m);
  // Fixed body: bulkhead, rear doors, far side, and the roof up to the hinge.
  m.box([0.1, 2.3, 2.02], [0.97, 2.22, 0], C.red);
  m.box([0.1, 2.3, 2.02], [-2.97, 2.22, 0], C.red);
  m.box([4.05, 2.3, 0.07], [-1, 2.22, -0.975], C.red);
  m.box([4.1, 0.12, HINGE + 1.03], [-1, TOP - 0.06, (HINGE - 1.03) / 2], C.red);
  m.box([3.84, 2.1, 0.02], [-1, 2.2, -0.93], INTERIOR, [0, 0, 0], false);
  m.box([0.02, 2.1, 1.86], [-2.91, 2.2, 0], INTERIOR, [0, 0, 0], false);
  m.box([0.02, 2.1, 1.86], [0.91, 2.2, 0], INTERIOR, [0, 0, 0], false);
  m.box([3.84, 0.02, 1.9], [-1, 1.115, 0], FLOOR, [0, 0, 0], false);
  // Sill along the open side.
  m.box([4.1, 0.2, 0.08], [-1, 1.2, 1.0], C.white);
  const g = m.finish();

  const w = new Model();
  const span = 1.03 - HINGE;
  w.box([4.1, 0.12, span], [-1, -0.06, span / 2], C.red);
  w.box([4.05, 2.01, 0.07], [-1, 2.305 - TOP, 0.975 - HINGE], C.red);
  for (let i = 0; i < 8; i++)
    w.box(
      [0.02, 1.62, 0.012],
      [-2.7 + i * 0.48, 2.3 - TOP, 1.016 - HINGE],
      C.deepRed,
      [0, 0, 0],
      false,
    );
  const wing = w.finish();
  label(wing, "3 Daya Terang →", [-1, 2.35 - TOP, 1.028 - HINGE], 2.8, 0.7, C.white);
  label(
    wing,
    "SETIAP KILO BERARTI",
    [-1, 1.83 - TOP, 1.032 - HINGE],
    2.4,
    0.23,
    C.white,
  );
  wing.position.set(0, TOP, HINGE);
  g.add(wing);
  const wheels = truckWheels(g);
  footprint(g, 0, 0.1, 6.3, 2.25);
  return {
    group: g,
    wing,
    wheels,
    radius: 0.46,
    lift: 2.05,
    hold: new THREE.Vector3(-2.9, 1.125, -0.92),
    doorway: 1.55,
    clearance: 0.45,
    frame: 1,
    props: [],
    ground: "road",
  };
}

/** Sea level when the yard is flooded for the ship. */
const WATER = 0.12;

/** Straight round bar from a to b. */
function rod(m: Model, a: number[], b: number[], radius: number, color = C.dark) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b),
    along = end.clone().sub(start);
  const geo = new THREE.CylinderGeometry(radius, radius, along.length(), 8);
  geo.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.normalize()),
  );
  m.add(geo, color, start.add(end).multiplyScalar(0.5).toArray(), [0, 0, 0], false);
}

/**
 * A small inter-island freighter heading +x: bridge aft, raised forecastle,
 * and an open cargo deck between. The near bulwark of the deck drops down
 * like a truck's dropside so the cargo can be seen. It floats alongside the
 * quay, a little further back than the road vehicles park.
 */
function shipRig(): Rig {
  const Z = -0.15,
    DECK = 0.97;
  const hull = [
    [-4.1, -1.22],
    [-4.1, 1.22],
    [-3.85, 1.35],
    [2.5, 1.35],
    [3.7, 0.95],
    [4.5, 0],
    [3.7, -0.95],
    [2.5, -1.35],
    [-3.85, -1.35],
  ];
  const scaled = (sx: number, sz: number) => hull.map(([x, z]) => [x * sx, z * sz]);
  const m = new Model();
  // Foam at the waterline, red boot-top, dark hull with a white sheer line.
  slab(m, scaled(1.03, 1.1), 0.01, WATER + 0.012, C.white);
  slab(m, scaled(0.97, 0.92), 0.3, 0, C.red);
  slab(m, hull, DECK - 0.3, 0.3, C.dark);
  slab(m, scaled(1.004, 1.012), 0.07, DECK - 0.07, C.white);
  slab(m, scaled(0.99, 0.96), 0.01, DECK, C.grey);
  // Deck seams and lashing rails under the cargo.
  for (let x = -2.1; x < 2.4; x += 0.6)
    m.box([0.02, 0.004, 2.3], [x, DECK + 0.012, 0], "#aeb2b0", [0, 0, 0], false);
  for (const z of [-1.16, 1.16])
    m.box([4.8, 0.02, 0.04], [0.02, DECK + 0.02, z], C.dark, [0, 0, 0], false);

  // Raised forecastle with bollards, a windlass and the bow mast.
  slab(
    m,
    [
      [2.45, -1.33],
      [3.7, -0.94],
      [4.47, 0],
      [3.7, 0.94],
      [2.45, 1.33],
    ],
    0.48,
    DECK,
    C.white,
  );
  for (const z of [-0.55, 0.55]) {
    m.cylinder(0.08, 0.16, [3.25, DECK + 0.56, z], C.dark);
    m.cylinder(0.11, 0.03, [3.25, DECK + 0.65, z], C.grey);
  }
  m.box([0.34, 0.2, 0.5], [2.8, DECK + 0.58, 0], C.dark);
  rod(m, [3.95, DECK + 0.48, 0], [3.95, DECK + 1.5, 0], 0.035);
  m.sphere(0.07, [3.95, DECK + 1.52, 0], C.red);

  // Far bulwark of the cargo deck; the near one is the drop side below.
  m.box([4.95, 0.45, 0.09], [0, DECK + 0.225, -1.29], C.white);

  // Deckhouse and wheelhouse aft, with funnel and mast.
  m.box([1.6, 1.15, 2.5], [-3.3, DECK + 0.575, 0], C.white);
  m.box([1.25, 0.7, 2.2], [-3.4, DECK + 1.5, 0], C.white);
  m.box([1.45, 0.08, 2.45], [-3.4, DECK + 1.89, 0], C.white);
  for (let i = 0; i < 4; i++)
    m.box([0.015, 0.3, 0.4], [-2.768, DECK + 1.56, -0.75 + i * 0.5], C.glass);
  for (let i = 0; i < 3; i++) {
    m.box([0.28, 0.3, 0.015], [-3.82 + i * 0.36, DECK + 1.56, 1.104], C.glass);
    m.box([0.18, 0.18, 0.015], [-3.85 + i * 0.42, DECK + 0.62, 1.254], C.glass);
  }
  m.box([0.015, 0.72, 0.42], [-2.494, DECK + 0.4, 0.55], C.dark);
  m.box([0.5, 0.8, 0.55], [-3.78, DECK + 2.33, -0.5], C.red);
  m.box([0.54, 0.12, 0.59], [-3.78, DECK + 2.79, -0.5], C.dark);
  rod(m, [-2.95, DECK + 1.93, 0.35], [-2.95, DECK + 2.85, 0.35], 0.03);
  rod(m, [-2.95, DECK + 2.6, -0.1], [-2.95, DECK + 2.6, 0.8], 0.022);

  // Fenders hung clear of the drop side.
  for (const x of [-3.55, -2.85, 2.85])
    m.cylinder(0.09, 0.34, [x, 0.62, x > 0 ? 1.24 : 1.43], C.dark);
  const g = m.finish();
  label(g, "3 DAYA TERANG", [-0.3, 0.64, 1.356], 2.4, 0.6, C.white);

  // Drop side: hinged at its outer foot, it swings out and down the hull.
  const d = new Model();
  d.box([4.95, 0.45, 0.09], [0, 0.225, -0.045], C.white);
  d.box([4.95, 0.07, 0.006], [0, 0.34, 0.003], C.red, [0, 0, 0], false);
  const wing = d.finish();
  wing.position.set(0, DECK, 1.335);
  g.add(wing);

  // Wake lines astern and a bow wave, shown while it is under way.
  const wake = new THREE.MeshBasicMaterial({
    color: C.white,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  for (const side of [-1, 1]) {
    for (const [x, z, length, turn] of [
      [-5.5, 1.75, 3, 0.3],
      [4.05, 1.15, 1.3, -0.62],
    ]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.09), wake);
      strip.rotation.set(-Math.PI / 2, 0, side * turn);
      strip.position.set(x, WATER + 0.02, side * z);
      g.add(strip);
    }
  }

  g.position.z = Z;
  return {
    group: g,
    wing,
    wheels: [],
    radius: 1,
    lift: -2.55,
    hold: new THREE.Vector3(-2.4, DECK + 0.01, -1.1),
    doorway: Z + 1.8,
    clearance: 0.7,
    frame: 0,
    props: [],
    ground: "sea",
    wake,
  };
}

/** [radius, x] points along a body of revolution, front to back in x order. */
type Profile = readonly (readonly [number, number])[];

function radiusAt(profile: Profile, x: number) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, x0] = profile[i - 1],
      [r1, x1] = profile[i];
    if (x <= x1) return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0);
  }
  return profile[profile.length - 1][0];
}
/** The part of a profile between x0 and x1, resampled. */
function section(profile: Profile, x0: number, x1: number, steps = 8): Profile {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / steps;
    return [radiusAt(profile, x), x] as const;
  });
}
/**
 * Body of revolution around the x axis. Angles run from +z (0) down under
 * the body (π/2) and up over the top (-π/2); `grow` thickens it, `bend`
 * lifts the centre line along x.
 */
function lathe(
  profile: Profile,
  bend: (x: number) => number,
  from = 0,
  to = Math.PI * 2,
  grow = 0,
) {
  const geo = new THREE.LatheGeometry(
    profile.map(([r, x]) => new THREE.Vector2(Math.max(0, r + grow), x)),
    Math.max(6, Math.round(((to - from) / (Math.PI * 2)) * 44)),
    from,
    to - from,
  );
  geo.rotateZ(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + bend(pos.getX(i)));
  return geo;
}
/** The same surface facing inwards, for linings seen through an opening. */
function inward(source: THREE.BufferGeometry) {
  const geo = source.index ? source.toNonIndexed() : source;
  for (const attr of Object.values(geo.attributes)) {
    const a = attr as THREE.BufferAttribute,
      n = a.itemSize;
    for (let i = 0; i < a.count; i += 3)
      for (let k = 0; k < n; k++) {
        const v = a.array[(i + 1) * n + k];
        a.array[(i + 1) * n + k] = a.array[(i + 2) * n + k];
        a.array[(i + 2) * n + k] = v;
      }
  }
  const normal = geo.attributes.normal;
  for (let i = 0; i < normal.array.length; i++) normal.array[i] *= -1;
  return geo;
}

/**
 * A small twin-turboprop freighter heading +x, parked further back than the
 * road vehicles so its near wing clears the loading pad. The upper near side
 * of the fuselage over the hold is one big cargo door, hinged just past the
 * crown, that swings up like the truck's side.
 */
function planeRig(): Rig {
  const R = 1.45,
    Y = 2.05,
    Z = -2.9;
  // Cargo door section, its lower edge and hinge as angles round the body.
  const XA = -1,
    XB = 3,
    SILL = 0.52,
    HINGE = -2.07;
  const tail: Profile = [
    [0, -6.45],
    [0.2, -6.42],
    [0.4, -6.2],
    [0.74, -5.7],
    [1.08, -5.0],
    [1.32, -4.2],
    [1.43, -3.4],
    [R, -2.8],
    [R, XA],
  ];
  const mid: Profile = [
    [R, XA],
    [R, XB],
  ];
  const nose: Profile = [
    [R, XB],
    [1.44, 3.5],
    [1.37, 3.95],
    [1.22, 4.4],
    [0.98, 4.78],
    [0.66, 5.06],
    [0.32, 5.24],
    [0, 5.3],
  ];
  // Upswept tail and a slightly dropped nose.
  const bend = (x: number) =>
    x < -2.8
      ? 1.05 * ((-2.8 - x) / 3.65) ** 1.5
      : x > 3.4
        ? -0.24 * ((x - 3.4) / 1.9) ** 2
        : 0;
  const at = [0, Y, 0];
  // Edges give the seams and the door cut; the hull gives the silhouette.
  const body = (m: Model, geo: THREE.BufferGeometry) =>
    smooth(m, geo, C.white, at, [0, 0, 0], true);
  const stripe = (m: Model, profile: Profile, x0: number, x1: number) =>
    m.add(lathe(section(profile, x0, x1), bend, 0.28, 0.42, 0.022), C.red, at, [0, 0, 0], false);

  const m = new Model();
  body(m, lathe(tail, bend));
  body(m, lathe(nose, bend));
  body(m, lathe(mid, bend, SILL, HINGE + Math.PI * 2));
  stripe(m, tail, -6.1, XA);
  stripe(m, nose, XB, 4.7);
  // Wrap-round cockpit glass following the nose.
  m.add(
    lathe(section(nose, 4.22, 4.74, 5), bend, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05, 0.022),
    C.glass,
    at,
  );
  // Hold: lining, end bulkheads, floor with roller tracks, and the sill.
  m.add(inward(lathe(mid, bend, SILL, HINGE + Math.PI * 2, -0.05)), INTERIOR, at, [0, 0, 0], false);
  for (const [x, turn] of [
    [XA + 0.01, Math.PI / 2],
    [XB - 0.01, -Math.PI / 2],
  ])
    m.add(new THREE.CircleGeometry(R - 0.03, 40), INTERIOR, [x, Y, 0], [0, turn, 0], false);
  m.box([XB - XA - 0.04, 0.04, 2.44], [(XA + XB) / 2, Y - 0.77, 0], FLOOR, [0, 0, 0], false);
  for (const z of [-0.95, -0.5, 0.5, 0.95])
    m.box([XB - XA - 0.1, 0.012, 0.05], [(XA + XB) / 2, Y - 0.744, z], C.grey, [0, 0, 0], false);
  m.box(
    [XB - XA, 0.08, 0.08],
    [(XA + XB) / 2, Y - R * Math.sin(SILL), R * Math.cos(SILL)],
    C.grey,
  );

  // High wing with red tips, and the two engines under it.
  const WING = Y + R - 0.12;
  slab(
    m,
    [
      [-2, -0.7],
      [-2.3, -4.4],
      [-3.25, -4.4],
      [-3.6, -0.7],
      [-3.6, 0.7],
      [-3.25, 4.4],
      [-2.3, 4.4],
      [-2, 0.7],
    ],
    0.16,
    WING,
    C.wall,
  );
  const props: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    slab(
      m,
      [
        [-2.27, side * 4.05],
        [-2.3, side * 4.4],
        [-3.25, side * 4.4],
        [-3.22, side * 4.05],
      ],
      0.18,
      WING - 0.01,
      C.red,
    );
    const z = side * 2.35;
    smooth(
      m,
      lathe(
        [
          [0.06, -3.95],
          [0.2, -3.7],
          [0.3, -3.2],
          [0.36, -2.4],
          [0.37, -1.75],
          [0.33, -1.5],
        ],
        () => 0,
      ),
      C.red,
      [0, WING - 0.16, z],
    );
    const spinner = new THREE.ConeGeometry(0.21, 0.42, 20);
    spinner.rotateZ(-Math.PI / 2);
    smooth(m, spinner, C.white, [-1.29, WING - 0.16, z]);
    const blades = new Model();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      blades.box(
        [0.04, 0.98, 0.15],
        [0, Math.cos(a) * 0.62, Math.sin(a) * 0.62],
        C.dark,
        [a, 0.5, 0],
      );
    }
    const prop = blades.finish();
    prop.position.set(-1.4, WING - 0.16, z);
    props.push(prop);
  }

  // Tail: fin with the brand "3", and the tailplane.
  const fin = new THREE.Shape();
  fin.moveTo(-6.32, 3.0);
  fin.lineTo(-5.95, 5.25);
  fin.lineTo(-5.3, 5.3);
  fin.lineTo(-4.1, 3.2);
  fin.closePath();
  m.add(new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false }), C.red, [0, 0, -0.07]);
  slab(
    m,
    [
      [-5.35, -0.25],
      [-5.85, -2.1],
      [-6.3, -2.1],
      [-6.4, -0.25],
      [-6.4, 0.25],
      [-6.3, 2.1],
      [-5.85, 2.1],
      [-5.35, 0.25],
    ],
    0.08,
    2.92,
    C.wall,
  );

  // Main gear in pods along the belly, nose gear up front.
  for (const side of [-1, 1])
    smooth(
      m,
      lathe(
        [
          [0, -3.75],
          [0.2, -3.6],
          [0.3, -3.3],
          [0.32, -2.4],
          [0.28, -1.75],
          [0, -1.55],
        ],
        () => 0,
      ),
      C.white,
      [0, 0.78, side * 1.1],
    );
  m.box([0.09, 0.55, 0.09], [4.25, 0.55, 0], C.grey);
  const g = m.finish();
  label(g, "3", [-5.25, 4.25, 0.075], 3.2, 0.8, C.white);
  for (const p of props) g.add(p);

  // The door, built in place and hung from its hinge.
  const hy = Y - R * Math.sin(HINGE),
    hz = R * Math.cos(HINGE);
  const d = new Model();
  body(d, lathe(mid, bend, HINGE, SILL));
  d.add(inward(lathe(mid, bend, HINGE, SILL, -0.04)), C.wall, at, [0, 0, 0], false);
  d.add(lathe(mid, bend, 0.28, 0.42, 0.022), C.red, at, [0, 0, 0], false);
  const panel = d.finish();
  const name = label(panel, "3 DAYA TERANG", [1, Y + 0.17, R + 0.03], 2.6, 0.65, C.red);
  name.rotation.x = -0.12;
  panel.position.set(0, -hy, -hz);
  const wing = new THREE.Group();
  wing.position.set(0, hy, hz);
  wing.add(panel);
  g.add(wing);

  const wheels: THREE.Group[] = [];
  const gear: [number, number, number, number][] = [
    [-3.05, 0.36, -1.3, 0.36],
    [-2.25, 0.36, -1.3, 0.36],
    [-3.05, 0.36, 1.3, 0.36],
    [-2.25, 0.36, 1.3, 0.36],
    [4.25, 0.26, -0.17, 0.26],
    [4.25, 0.26, 0.17, 0.26],
  ];
  for (const [x, y, z, r] of gear) {
    const w = wheel(r);
    w.position.set(x, y, z);
    g.add(w);
    wheels.push(w);
  }
  // Its shadow on the asphalt: fuselage, wings and tailplane in one outline.
  const half = [
    [5.3, 0],
    [5.05, 0.6],
    [4.55, 1.05],
    [3.8, 1.3],
    [-2, 1.3],
    [-2.3, 4.4],
    [-3.25, 4.4],
    [-3.6, 1.3],
    [-4.6, 1.1],
    [-5.35, 0.75],
    [-5.85, 2.1],
    [-6.3, 2.1],
    [-6.35, 0.35],
    [-6.45, 0],
  ];
  const outline = [...half, ...half.slice(1, -1).reverse().map(([x, z]) => [x, -z])];
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const silhouette = new THREE.ShapeGeometry(shape);
  silhouette.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    silhouette,
    new THREE.MeshBasicMaterial({
      color: "#1f2423",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  shadow.position.y = 0.014;
  g.add(shadow);
  g.position.z = Z;
  return {
    group: g,
    wing,
    wheels,
    radius: 0.36,
    lift: 1.95,
    hold: new THREE.Vector3(-0.8, Y - 0.75, -1),
    doorway: Z + 1.95,
    clearance: 0.6,
    frame: 2,
    props,
    ground: "runway",
  };
}

/** Loading pad in front of the parked vehicle, for waiting and left-over boxes. */
const PAD = {
  min: new THREE.Vector3(-3, 0, 1.9),
  cells: [58, 14, 17] as const,
};
const CONES = [
  [-3.85, 1.5],
  [3.95, 1.5],
] as const;
const padMax = () =>
  PAD.min.clone().add(new THREE.Vector3(PAD.cells[0], 0, PAD.cells[2]).multiplyScalar(CELL));

function flat(color: string, opacity: number, alphaMap?: THREE.Texture) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    ...(alphaMap ? { alphaMap } : {}),
  });
}
function decal(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  z: number,
  width: number,
  depth: number,
  y = 0.006,
) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Water shades, shown exactly as written (not tone mapped).
const WATER_COLOR = "#cfe5ea";
const WATER_DEEP = "#b9d7de";

export type Ground = "road" | "sea" | "runway";
/** The runway: centred on the parked plane, from its near to its far edge. */
const RUNWAY = { z: -2.9, near: 1.6, far: -7.4 };
const ASPHALT = "#858b89";
/** Windsock [x, z], off the near edge of the runway. */
const WINDSOCK = [5.7, 2.4] as const;

/** Flat strips on the water, merged into one mesh per shade. */
function ripples(strips: number[][], color: string) {
  const geos = strips.map(([x, z, length]) => {
    const geo = new THREE.PlaneGeometry(length, 0.05);
    geo.rotateX(-Math.PI / 2);
    geo.translate(x, 0, z);
    return geo;
  });
  const material = flat(color, 0);
  material.toneMapped = false;
  return { mesh: new THREE.Mesh(mergeGeometries(geos), material), material };
}

/**
 * Lane lines, the loading pad with dashed edges and its ground lettering, and
 * cones marking the bay. For the ship the lane floods: water comes up to a
 * quay edge, ripples drift on it, the cones give way to bollards and mooring
 * lines are made fast once it is alongside.
 */
function yard() {
  const g = new THREE.Group();
  const lines = flat("#d6d9d1", 1, fadeTexture());
  for (const z of [-1.75, 1.5]) {
    const line = decal(g, lines, 0, z, 0.06, 14);
    line.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  }
  const max = padMax(),
    mid = PAD.min.clone().add(max).multiplyScalar(0.5),
    size = max.clone().sub(PAD.min);
  decal(g, flat("#ecebe4", 0.75), mid.x, mid.z, size.x + 0.3, size.z + 0.3, 0.004);
  const m = new Model();
  const dash = 0.26,
    gapped = 0.44;
  for (const z of [PAD.min.z - 0.15, max.z + 0.15])
    for (let x = PAD.min.x - 0.15; x < max.x + 0.15 - dash / 2; x += gapped)
      m.box([dash, 0.01, 0.04], [x + dash / 2, 0.008, z], C.grey, [0, 0, 0], false);
  for (const x of [PAD.min.x - 0.15, max.x + 0.15])
    for (let z = PAD.min.z - 0.15; z < max.z + 0.15 - dash / 2; z += gapped)
      m.box([0.04, 0.01, dash], [x, 0.008, z + dash / 2], C.grey, [0, 0, 0], false);
  // Red corner brackets.
  for (const [x, z, sx, sz] of [
    [PAD.min.x - 0.15, PAD.min.z - 0.15, 1, 1],
    [max.x + 0.15, PAD.min.z - 0.15, -1, 1],
    [PAD.min.x - 0.15, max.z + 0.15, 1, -1],
    [max.x + 0.15, max.z + 0.15, -1, -1],
  ]) {
    m.box([0.4, 0.012, 0.06], [x + sx * 0.2, 0.01, z], C.red, [0, 0, 0], false);
    m.box([0.06, 0.012, 0.4], [x, 0.01, z + sz * 0.2], C.red, [0, 0, 0], false);
  }
  g.add(m.finish());
  // Cones marking either end of the parking bay.
  // Enough sides that only the silhouette gets an ink line at this size.
  const c = new Model();
  for (const [x, z] of CONES) {
    c.box([0.38, 0.06, 0.38], [x, 0.03, z], C.dark);
    c.add(new THREE.ConeGeometry(0.15, 0.5, 20), C.red, [x, 0.31, z]);
    c.cylinder(0.096, 0.09, [x, 0.34, z], C.white, [0, 0, 0], 20);
  }
  const cones = c.finish();
  g.add(cones);
  const ground: number[] = [-Math.PI / 2, 0, 0];
  const at = [mid.x - 1.3, 0.012, max.z + 0.48];
  const ready = label(g, "AREA MUAT", at, 2.2, 0.55, "#a9aea8", ground);
  const full = label(g, "TIDAK MUAT", at, 2.2, 0.55, C.red, ground);
  full.visible = false;

  // The flooded lane: water up to the quay edge, and ripples on it.
  const QUAY = 1.5;
  const waterMaterial = flat(WATER_COLOR, 0);
  // Writes depth so the hull below the waterline stays hidden.
  waterMaterial.depthWrite = true;
  waterMaterial.toneMapped = false;
  const water = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(48, 30), waterMaterial);
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.z = QUAY - 15;
  water.add(sheet);
  // The quay wall's shadow on the water.
  const shadeMaterial = flat(WATER_DEEP, 0);
  shadeMaterial.toneMapped = false;
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(48, 0.32), shadeMaterial);
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(0, 0.003, QUAY - 0.16);
  water.add(shade);
  water.visible = false;
  g.add(water);
  const light = ripples(
    [
      [-6.2, -2.6, 1.4],
      [-2.4, -3.9, 1.9],
      [2.6, -2.9, 1.2],
      [6.4, -4.2, 1.6],
      [-8.6, -0.4, 1.1],
      [7.8, -1.2, 1.3],
      [-4.6, 0.95, 0.9],
      [5.6, 1.05, 1.0],
      [0.4, -5.6, 1.5],
      [-7.4, -5.2, 1.2],
    ],
    C.white,
  );
  const dark = ripples(
    [
      [-4.2, -3.2, 1.0],
      [0.9, -4.4, 1.3],
      [4.6, -3.4, 0.9],
      [-9.2, -2.2, 1.2],
      [8.8, -2.9, 1.1],
      [-1.6, 1.05, 0.8],
      [3.1, -6.3, 1.0],
    ],
    WATER_DEEP,
  );
  const waves = new THREE.Group();
  waves.add(light.mesh, dark.mesh);
  waves.position.y = WATER + 0.006;
  waves.visible = false;
  g.add(waves);

  // Quay edge and bollards rise out of the ground; lines come aboard later.
  const q = new Model();
  q.box([40, 0.14, 0.14], [0, 0.07, QUAY + 0.07], C.wall);
  q.box([40, 0.012, 0.03], [0, 0.146, QUAY + 0.02], C.grey, [0, 0, 0], false);
  const BOLLARDS = CONES.map(([x]) => [x, QUAY + 0.38] as const);
  for (const [x, z] of BOLLARDS) {
    q.box([0.34, 0.05, 0.34], [x, 0.025, z], C.grey);
    q.cylinder(0.1, 0.32, [x, 0.21, z], C.dark, [0, 0, 0], 16);
    q.cylinder(0.15, 0.06, [x, 0.4, z], C.dark, [0, 0, 0], 16);
  }
  const quay = q.finish();
  quay.visible = false;
  g.add(quay);
  const r = new Model();
  // To the ship's stern and bow cleats when it lies alongside.
  rod(r, [BOLLARDS[0][0], 0.36, BOLLARDS[0][1]], [-3.55, 1.02, 1.12], 0.022, "#8a8f8b");
  rod(r, [BOLLARDS[1][0], 0.36, BOLLARDS[1][1]], [3.25, 1.5, 0.45], 0.022, "#8a8f8b");
  const moorings = r.finish();
  moorings.visible = false;
  g.add(moorings);

  // The paved lane for the plane: asphalt along its line of travel, white
  // markings, edge lights and a windsock.
  const strip = (x: number, z: number, length: number, width: number) => {
    const geo = new THREE.PlaneGeometry(length, width);
    geo.rotateX(-Math.PI / 2);
    geo.translate(x, 0, z);
    return geo;
  };
  const asphaltMaterial = flat(ASPHALT, 0);
  asphaltMaterial.toneMapped = false;
  const asphalt = new THREE.Mesh(
    strip(0, (RUNWAY.near + RUNWAY.far) / 2, 48, RUNWAY.near - RUNWAY.far),
    asphaltMaterial,
  );
  asphalt.position.y = 0.002;
  // Under everything else on the ground.
  asphalt.renderOrder = -1;
  const marks: THREE.BufferGeometry[] = [];
  for (const z of [RUNWAY.near - 0.32, RUNWAY.far + 0.32]) marks.push(strip(0, z, 48, 0.14));
  for (let x = -22; x < 22; x += 3) marks.push(strip(x, RUNWAY.z, 1.6, 0.16));
  // Threshold "piano keys" across the far left end, then touchdown bars.
  for (let z = RUNWAY.far + 0.75; z < RUNWAY.near - 0.6; z += 0.52)
    if (Math.abs(z - RUNWAY.z) > 0.4) marks.push(strip(-11.6, z, 2.6, 0.3));
  for (const dz of [-1.55, 1.55]) {
    marks.push(strip(-3.6, RUNWAY.z + dz, 3, 0.62));
    for (const w of [-0.3, 0.3]) marks.push(strip(1.6, RUNWAY.z + dz + w, 1.6, 0.18));
  }
  const markMaterial = flat("#f6f6f1", 0);
  markMaterial.toneMapped = false;
  const markings = new THREE.Mesh(mergeGeometries(marks), markMaterial);
  markings.position.y = 0.006;
  const number = label(
    g,
    "27",
    [-8.6, 0.007, RUNWAY.z],
    4.4,
    1.1,
    "#f6f6f1",
    [-Math.PI / 2, 0, Math.PI / 2],
  );
  const numberMaterial = number.material as THREE.MeshBasicMaterial;
  numberMaterial.toneMapped = false;
  numberMaterial.opacity = 0;
  const paved = new THREE.Group();
  paved.add(asphalt, markings);
  paved.visible = number.visible = false;
  g.add(paved);
  const e = new Model();
  for (let x = -21; x <= 21; x += 3)
    for (const z of [RUNWAY.near - 0.12, RUNWAY.far + 0.12]) {
      e.cylinder(0.045, 0.2, [x, 0.1, z], C.grey, [0, 0, 0], 8);
      e.sphere(0.075, [x, 0.22, z], C.white);
    }
  const edgeLights = e.finish();
  edgeLights.visible = false;
  g.add(edgeLights);
  // Windsock off the near edge, beside the loading pad.
  const windsock = new THREE.Group();
  const w = new Model();
  w.box([0.3, 0.06, 0.3], [0, 0.03, 0], C.grey);
  rod(w, [0, 0, 0], [0, 2.3, 0], 0.035, C.grey);
  windsock.add(w.finish());
  const sock = new THREE.Group();
  const k = new Model();
  k.add(new THREE.TorusGeometry(0.22, 0.02, 6, 20), C.dark, [0, 0, 0], [0, Math.PI / 2, 0], false);
  for (let i = 0; i < 5; i++) {
    const r0 = 0.22 - i * 0.022,
      r1 = r0 - 0.022;
    k.add(
      new THREE.CylinderGeometry(r1, r0, 0.24, 16, 1, true),
      i % 2 ? C.white : C.red,
      [0.12 + i * 0.24, 0, 0],
      [0, 0, -Math.PI / 2],
    );
  }
  sock.add(k.finish());
  sock.position.set(0.05, 2.18, 0);
  windsock.add(sock);
  windsock.position.set(WINDSOCK[0], 0, WINDSOCK[1]);
  windsock.visible = false;
  g.add(windsock);

  /** Sets how far the lane has turned into sea and into runway, 0 to 1. */
  function surface(sea: number, runway: number) {
    const on = sea > 0.001;
    water.visible = waves.visible = quay.visible = on;
    waterMaterial.opacity = sea;
    shadeMaterial.opacity = sea;
    water.position.y = WATER - 0.5 * (1 - sea);
    light.material.opacity = 0.9 * sea;
    dark.material.opacity = 0.9 * sea;
    quay.scale.y = Math.max(0.001, sea);
    cones.visible = sea < 0.999;
    cones.scale.y = Math.max(0.001, 1 - sea);
    lines.opacity = 1 - Math.max(sea, runway);
    const paving = runway > 0.001;
    paved.visible = number.visible = edgeLights.visible = windsock.visible = paving;
    asphaltMaterial.opacity = runway;
    markMaterial.opacity = numberMaterial.opacity = runway;
    edgeLights.scale.y = windsock.scale.y = Math.max(0.001, runway);
  }
  return {
    group: g,
    full,
    ready,
    waves,
    sock,
    moorings,
    surface,
  };
}

// ---------------------------------------------------------------- boxes

const BOX: Record<Exclude<ItemKind, "pallet">, [string, string, string]> = {
  // body, tape, shipping label
  parcel: [C.red, C.deepRed, C.white],
  medium: [C.wall, C.grey, C.white],
  large: [C.white, C.red, C.wall],
};
/** A box of the given kind: length along x, bottom centre at the origin. */
function itemModel(kind: ItemKind) {
  const [cl, ch, cw] = ITEMS[kind].cells;
  const l = cl * CELL,
    h = ch * CELL,
    w = cw * CELL;
  const m = new Model();
  const none = [0, 0, 0];
  if (kind === "pallet") {
    const base = 0.14,
      lh = h - base,
      y = base + lh / 2;
    m.box([l, 0.03, w], [0, base - 0.015, 0], C.grey);
    for (const z of [-w / 2 + 0.06, 0, w / 2 - 0.06])
      m.box([l, base - 0.03, 0.1], [0, (base - 0.03) / 2, z], C.grey);
    m.box([l - 0.04, lh, w - 0.04], [0, y, 0], C.wall);
    const front = w / 2 - 0.016,
      end = l / 2 - 0.016;
    m.box([0.006, lh, 0.006], [0, y, front], C.dark, none, false);
    m.box([l - 0.04, 0.006, 0.006], [0, y, front], C.dark, none, false);
    m.box([0.006, lh, 0.006], [end, y, 0], C.dark, none, false);
    m.box([0.006, 0.006, w - 0.04], [end, y, 0], C.dark, none, false);
    for (const x of [-l / 4, l / 4]) {
      m.box([0.05, 0.006, w - 0.03], [x, h + 0.003, 0], C.red, none, false);
      m.box([0.05, lh, 0.006], [x, y, front + 0.002], C.red, none, false);
    }
  } else {
    const [body, tape, sticker] = BOX[kind];
    const band = Math.max(0.04, l * 0.14);
    m.box([l, h, w], [0, h / 2, 0], body);
    m.box([band, 0.006, w + 0.004], [0, h + 0.003, 0], tape, none, false);
    m.box([band, h * 0.45, 0.006], [0, h * 0.775, w / 2 + 0.003], tape, none, false);
    m.box(
      [l * 0.3, h * 0.26, 0.006],
      [l * 0.25, h * 0.4, w / 2 + 0.004],
      sticker,
      none,
      kind !== "parcel",
    );
  }
  return m.finish();
}

/** Instance slots beyond MAX_ITEMS let removed boxes finish shrinking. */
const CAPACITY = MAX_ITEMS + 40;

type KindSet = {
  meshes: THREE.InstancedMesh[];
  /** Outline vertices of one box, in its own coordinates. */
  edges: Float32Array;
  free: number[];
  count: number;
};

type Place = "pad" | "inside" | "hidden";
type Target = { place: Place; pos: THREE.Vector3; turn: number; key: string };
type Tween = {
  from: THREE.Vector3;
  ctrl: THREE.Vector3;
  to: THREE.Vector3;
  turn0: number;
  turn1: number;
  scale0: number;
  scale1: number;
  start: number;
  duration: number;
  /** Pops up where it stands first, then travels. */
  grow: boolean;
};
type Entity = {
  id: number;
  kind: ItemKind;
  index: number;
  pos: THREE.Vector3;
  turn: number;
  scale: number;
  key: string;
  place: Place | "new";
  tween: Tween | null;
  removed: boolean;
};

export type Phase =
  | "away"
  | "arriving"
  | "opening"
  | "ready"
  | "unloading"
  | "closing"
  | "leaving";
export type SimStatus = {
  vehicle: VehicleKind | null;
  phase: Phase;
  /** Boxes travelling or waiting to. */
  moving: number;
  inside: number;
  onPad: number;
  /** Boxes that do not fit on the pad and are not drawn. */
  hidden: number;
  x: number;
  wing: number;
  /** Index of the camera framing in place, or -1 while it moves. */
  frame: number;
  /** How far the lane is flooded for the ship, 0 to 1. */
  sea: number;
  /** How far the lane is paved into a runway for the plane, 0 to 1. */
  runway: number;
};

/** What a camera framing must show, and the margin around it. */
export type Framing = { bounds: THREE.Box3[]; padding: number };
/** The camera `k` (eased) of the way between two framings. */
export type View = { from: number; to: number; k: number };

/** Where a vehicle starts, off screen behind it, and where it is gone ahead. */
export type Travel = { entry: number; exit: number };

export type LoadSimModel = {
  root: THREE.Group;
  /** One camera framing per vehicle: it opened up, and the pad. */
  frames: Framing[];
  /** Each vehicle, for working out where off screen begins when parked. */
  vehicles: Record<VehicleKind, THREE.Object3D>;
  frameOf: (vehicle: VehicleKind) => number;
  setTravel: (travel: Record<VehicleKind, Travel>) => void;
  view: () => View;
  sync: (
    vehicle: VehicleKind | null,
    items: readonly Item[],
    plan: LoadPlan | null,
  ) => void;
  step: (dt: number) => void;
  /** Jumps straight to where everything is heading (reduced motion). */
  settle: () => void;
  busy: () => boolean;
  /** Something idles in motion (the ship bobbing, ripples drifting). */
  alive: () => boolean;
  status: () => SimStatus;
  /** The vehicle on stage and the yard, for layout checks. */
  parts: () => Record<string, THREE.Object3D>;
  dispose: () => void;
};

const ARRIVE = 1.8,
  OPEN = 0.8,
  CLOSE = 0.6,
  LEAVE = 1.25,
  /** Camera move between framings, while the stage is empty. */
  REFRAME = 0.9,
  /** The lane turning into sea or runway, or back to road. */
  RESURFACE = 1.1;
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeIn = (k: number) => k * k * k;
const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
const easeBack = (k: number) => {
  const c = 1.9;
  return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
};
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const QUARTER = Math.PI / 2;

export function createLoadSimModel(): LoadSimModel {
  const root = new THREE.Group();
  const rigs: Record<VehicleKind, Rig> = {
    ship: shipRig(),
    truck: truckRig(),
    plane: planeRig(),
  };
  for (const rig of Object.values(rigs)) {
    rig.group.visible = false;
    root.add(rig.group);
  }
  const { group: yardGroup, full, waves, sock, moorings, surface } = yard();
  root.add(yardGroup);

  // The pad, a little stacked, the lettering in front of it, and the cones.
  const yardBounds = [
    new THREE.Box3(
      PAD.min.clone().add(new THREE.Vector3(-0.2, 0, -0.2)),
      padMax().add(new THREE.Vector3(0.2, 0.9, 0.8)),
    ),
    ...CONES.map(
      ([x, z]) =>
        new THREE.Box3(
          new THREE.Vector3(x - 0.2, 0, z - 0.2),
          new THREE.Vector3(x + 0.2, 0.6, z + 0.2),
        ),
    ),
  ];
  // Each framing shows its vehicle opened up.
  const opened = <T>(rig: Rig, measure: (group: THREE.Group) => T) => {
    rig.wing.rotation.x = -rig.lift;
    root.updateMatrixWorld(true);
    const result = measure(rig.group);
    rig.wing.rotation.x = 0;
    return result;
  };
  // Ship and plane reach out in every direction, so the corners of one world
  // box would leave a wide margin: frame their actual points instead.
  const points = (rig: Rig) =>
    opened(rig, (g) => worldPoints(g)).map((p) => new THREE.Box3(p, p));
  const frames: Framing[] = [];
  frames[rigs.ship.frame] = { bounds: [...points(rigs.ship), ...yardBounds], padding: 0.07 };
  frames[rigs.truck.frame] = {
    bounds: [opened(rigs.truck, (g) => new THREE.Box3().setFromObject(g)), ...yardBounds],
    padding: 0.04,
  };
  // Extra margin keeps the plane's fin clear of the labels; the windsock
  // only stands for the plane.
  const [wx, wz] = WINDSOCK;
  frames[rigs.plane.frame] = {
    bounds: [
      ...points(rigs.plane),
      ...yardBounds,
      new THREE.Box3(new THREE.Vector3(wx - 0.3, 0, wz - 0.3), new THREE.Vector3(wx + 1.3, 2.5, wz + 0.3)),
    ],
    padding: 0.12,
  };

  // One instanced set per box kind, sharing one outline buffer.
  let ink: THREE.Material | null = null;
  const sets = {} as Record<ItemKind, KindSet>;
  let widest = 0;
  for (const spec of ITEM_LIST) {
    const model = itemModel(spec.kind);
    const set: KindSet = {
      meshes: [],
      edges: new Float32Array(0),
      free: [],
      count: 0,
    };
    for (const child of model.children) {
      if (child instanceof THREE.LineSegments) {
        set.edges = Float32Array.from(child.geometry.attributes.position.array);
        ink = child.material as THREE.Material;
      } else if (child instanceof THREE.Mesh) {
        const mesh = new THREE.InstancedMesh(
          child.geometry,
          child.material as THREE.Material,
          CAPACITY,
        );
        mesh.count = 0;
        mesh.frustumCulled = false;
        root.add(mesh);
        set.meshes.push(mesh);
      }
    }
    widest = Math.max(widest, set.edges.length);
    sets[spec.kind] = set;
  }
  const edgeBuffer = new Float32Array(widest * CAPACITY);
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(edgeBuffer, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const outlines = new THREE.LineSegments(edgeGeometry, ink!);
  outlines.frustumCulled = false;
  root.add(outlines);

  let travel: Record<VehicleKind, Travel> = {
    ship: { entry: -16, exit: 16 },
    truck: { entry: -16, exit: 16 },
    plane: { entry: -22, exit: 22 },
  };
  // Camera moving from one framing to another (linear progress k), and how
  // far the lane is flooded. Both change only while the stage is empty.
  const shot = { from: rigs.truck.frame, to: rigs.truck.frame, k: 1 };
  /** How far the lane has turned into each ground other than road. */
  const ground = { sea: 0, runway: 0 };
  let now = 0,
    speed = 0,
    still = false;
  let desired: VehicleKind | null = null,
    present: VehicleKind | null = null,
    phase: Phase = "away",
    phaseTime = 0,
    x = 0,
    leaveFrom = 0,
    wing = 0;
  let items: readonly Item[] = [];
  let plan: LoadPlan | null = null;
  let waiting: Packing = pack([], PAD.cells, "floor"),
    leftover: Packing = waiting;
  const entities = new Map<number, Entity>();

  const loaded = () =>
    phase === "ready" && present !== null && present === desired && plan?.vehicle === present;

  function slotCentre(slot: Slot, kind: ItemKind) {
    const [l, , w] = ITEMS[kind].cells;
    const lx = slot.turned ? w : l,
      lz = slot.turned ? l : w;
    return new THREE.Vector3(
      (slot.x + lx / 2) * CELL,
      slot.y * CELL,
      (slot.z + lz / 2) * CELL,
    );
  }
  function targetOf(e: Entity): Target {
    if (loaded()) {
      const slot = plan!.slots.get(e.id);
      if (slot) {
        const rig = rigs[present!];
        return {
          place: "inside",
          pos: slotCentre(slot, e.kind).add(rig.hold).add(rig.group.position),
          turn: slot.turned ? QUARTER : 0,
          key: `in:${present}:${slot.x},${slot.y},${slot.z},${slot.turned}`,
        };
      }
    }
    const slot = (loaded() ? leftover : waiting).slots.get(e.id);
    if (!slot)
      return { place: "hidden", pos: e.pos.clone(), turn: e.turn, key: "hidden" };
    return {
      place: "pad",
      pos: slotCentre(slot, e.kind).add(PAD.min),
      turn: slot.turned ? QUARTER : 0,
      key: `pad:${slot.x},${slot.y},${slot.z},${slot.turned}`,
    };
  }

  /** Sends a box towards a new target, starting at `start`. */
  function send(e: Entity, t: Target, start: number) {
    const from = e.pos.clone();
    // Where the box physically is now, which may be mid-flight.
    const wasInside = e.place !== "new" && from.z < PAD.min.z - 0.35;
    const rig = present ? rigs[present] : null;
    let ctrl: THREE.Vector3,
      duration = 0.6,
      grow = false,
      scale0 = e.scale;
    if (t.place === "hidden") {
      ctrl = from.clone();
      t = { ...t, pos: from.clone() };
      duration = 0.25;
    } else if (e.place === "new" || e.scale < 0.05) {
      scale0 = 0;
      if (t.place === "inside" && rig) {
        // Appears at the edge of the pad in line with its slot, then is lifted in.
        from.set(
          THREE.MathUtils.clamp(t.pos.x, PAD.min.x + 0.3, padMax().x - 0.3),
          0,
          PAD.min.z + 0.3,
        );
        ctrl = new THREE.Vector3(t.pos.x, t.pos.y + rig.clearance, rig.doorway);
        grow = true;
        duration = 0.95;
      } else {
        from.copy(t.pos);
        ctrl = t.pos.clone();
        duration = 0.4;
      }
    } else if ((t.place === "inside" || wasInside) && rig) {
      const anchor = t.place === "inside" ? t.pos : from;
      ctrl = new THREE.Vector3(
        anchor.x,
        Math.max(from.y, t.pos.y) + rig.clearance,
        rig.doorway,
      );
      duration = t.place === "inside" ? 0.7 : 0.55;
    } else {
      ctrl = from.clone().lerp(t.pos, 0.5);
      ctrl.y = Math.max(from.y, t.pos.y) + 0.75;
      duration = 0.5;
    }
    e.tween = {
      from,
      ctrl,
      to: t.pos.clone(),
      turn0: e.turn,
      turn1: t.turn,
      scale0,
      scale1: t.place === "hidden" ? 0 : 1,
      start,
      duration,
      grow,
    };
    if (scale0 === 0) {
      e.scale = 0;
      e.pos.copy(from);
    }
    e.key = t.key;
    e.place = t.place;
  }

  /** Points every box at where it belongs now, in a sensible loading order. */
  function retarget() {
    const rank = new Map((plan?.order ?? []).map((id, i) => [id, i]));
    const position = new Map(items.map((item, i) => [item.id, i]));
    const changes: { e: Entity; t: Target; group: number; order: number }[] = [];
    for (const e of entities.values()) {
      if (e.removed) continue;
      const t = targetOf(e);
      if (t.key === e.key) continue;
      const inside = e.place === "inside";
      // Unload newest first, then shuffle, then put boxes down and load them.
      const group = inside && t.place !== "inside" ? 0 : inside ? 1 : t.place === "inside" ? 3 : 2;
      const order =
        group === 0
          ? -(rank.get(e.id) ?? 0)
          : group === 3
            ? (rank.get(e.id) ?? 0)
            : (position.get(e.id) ?? 0);
      changes.push({ e, t, group, order });
    }
    changes.sort((a, b) => a.group - b.group || a.order - b.order);
    const gap = Math.min(0.11, 2.6 / Math.max(1, changes.length));
    let start = now;
    for (const c of changes) {
      // Boxes that are already on their way keep going from where they are.
      send(c.e, c.t, start);
      start += gap;
    }
  }

  function allocate(kind: ItemKind) {
    const set = sets[kind];
    if (!set.free.length && set.count >= CAPACITY) {
      // Out of slots: finish removing boxes of this kind straight away.
      for (const e of entities.values())
        if (e.removed && e.kind === kind) release(e);
    }
    if (set.free.length) return set.free.pop()!;
    return set.count < CAPACITY ? set.count++ : -1;
  }
  function release(e: Entity) {
    entities.delete(e.id);
    if (e.index >= 0) {
      sets[e.kind].free.push(e.index);
      hide(e);
    }
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function hide(e: Entity) {
    for (const mesh of sets[e.kind].meshes) {
      mesh.setMatrixAt(e.index, zero);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function sync(
    vehicle: VehicleKind | null,
    next: readonly Item[],
    nextPlan: LoadPlan | null,
  ) {
    desired = vehicle;
    items = next;
    plan = nextPlan && nextPlan.vehicle === vehicle ? nextPlan : null;
    const ids = new Set(next.map((i) => i.id));
    for (const e of entities.values())
      if (!ids.has(e.id) && !e.removed) {
        e.removed = true;
        e.tween = {
          from: e.pos.clone(),
          ctrl: e.pos.clone(),
          to: e.pos.clone(),
          turn0: e.turn,
          turn1: e.turn,
          scale0: e.scale,
          scale1: 0,
          start: now,
          duration: 0.25,
          grow: false,
        };
      }
    for (const item of next)
      if (!entities.has(item.id)) {
        const index = allocate(item.kind);
        entities.set(item.id, {
          id: item.id,
          kind: item.kind,
          index,
          pos: new THREE.Vector3(),
          turn: 0,
          scale: 0,
          key: "",
          place: "new",
          tween: null,
          removed: false,
        });
      }
    waiting = pack(next, PAD.cells, "floor");
    const left = new Set(plan?.leftovers ?? []);
    leftover = pack(
      next.filter((i) => left.has(i.id)),
      PAD.cells,
      "floor",
    );
    retarget();
  }

  function setPhase(p: Phase) {
    phase = p;
    phaseTime = 0;
    retarget();
  }
  function startLeaving() {
    leaveFrom = x;
    setPhase("leaving");
  }

  /** Moves the camera towards a framing; true once it is there. */
  function reframe(target: number, dt: number) {
    if (shot.k < 1) {
      // Asked back to where it came from: turn round mid-move.
      if (target === shot.from) {
        [shot.from, shot.to] = [shot.to, shot.from];
        shot.k = 1 - shot.k;
      }
      shot.k = Math.min(1, shot.k + dt / REFRAME);
      return false;
    }
    if (shot.to === target) return true;
    shot.from = shot.to;
    shot.to = target;
    shot.k = Math.min(1, dt / REFRAME);
    return false;
  }
  /**
   * Turns the lane towards a ground (flooding, draining, paving or lifting
   * the runway, all at once); true once it is there.
   */
  function resurface(target: Ground, dt: number) {
    const move = dt / RESURFACE;
    let done = true;
    for (const key of ["sea", "runway"] as const) {
      const level = target === key ? 1 : 0;
      if (ground[key] === level) continue;
      done = false;
      ground[key] =
        ground[key] < level
          ? Math.min(level, ground[key] + move)
          : Math.max(level, ground[key] - move);
    }
    return done;
  }

  function advance(dt: number) {
    phaseTime += dt;
    switch (phase) {
      case "away":
        if (desired) {
          // An empty stage first reframes, and turns the lane into road,
          // sea or runway, for the vehicle on its way.
          const rig = rigs[desired];
          const framed = reframe(rig.frame, dt);
          const ready = resurface(rig.ground, dt);
          if (!framed || !ready) break;
          present = desired;
          rigs[present].group.visible = true;
          x = travel[present].entry;
          wing = 0;
          setPhase("arriving");
        }
        break;
      case "arriving": {
        if (desired !== present) return startLeaving();
        const k = clamp01(phaseTime / ARRIVE);
        x = travel[present!].entry * (1 - easeOut(k));
        if (k >= 1) setPhase("opening");
        break;
      }
      case "opening":
        if (desired !== present) return setPhase("closing");
        wing = Math.min(1, wing + dt / OPEN);
        if (wing >= 1) setPhase("ready");
        break;
      case "ready":
        if (desired !== present) setPhase("unloading");
        break;
      case "unloading":
        if (desired === present) return setPhase("ready");
        if (![...entities.values()].some((e) => e.tween && !e.removed))
          setPhase("closing");
        break;
      case "closing":
        if (desired === present) return setPhase("opening");
        wing = Math.max(0, wing - dt / CLOSE);
        if (wing <= 0) startLeaving();
        break;
      case "leaving": {
        const k = clamp01(phaseTime / LEAVE);
        x = leaveFrom + (travel[present!].exit - leaveFrom) * easeIn(k);
        if (k >= 1) {
          rigs[present!].group.visible = false;
          present = null;
          setPhase("away");
        }
        break;
      }
    }
  }

  const bez = (a: number, b: number, c: number, k: number) =>
    (1 - k) * (1 - k) * a + 2 * k * (1 - k) * b + k * k * c;
  function animateEntities() {
    for (const e of [...entities.values()]) {
      const tw = e.tween;
      if (!tw) continue;
      if (now < tw.start) continue;
      const k = clamp01((now - tw.start) / tw.duration);
      let p: number;
      if (tw.grow) {
        e.scale = easeBack(clamp01(k / 0.22));
        p = easeInOut(clamp01((k - 0.22) / 0.78));
      } else {
        p = easeInOut(k);
        e.scale =
          tw.scale1 > tw.scale0
            ? tw.scale0 + (tw.scale1 - tw.scale0) * easeBack(k)
            : tw.scale0 + (tw.scale1 - tw.scale0) * k;
      }
      e.pos.set(
        bez(tw.from.x, tw.ctrl.x, tw.to.x, p),
        bez(tw.from.y, tw.ctrl.y, tw.to.y, p),
        bez(tw.from.z, tw.ctrl.z, tw.to.z, p),
      );
      e.turn = tw.turn0 + (tw.turn1 - tw.turn0) * p;
      if (k >= 1) {
        e.tween = null;
        e.scale = tw.scale1;
        if (e.removed) release(e);
      }
    }
  }

  const matrix = new THREE.Matrix4(),
    quat = new THREE.Quaternion(),
    scale = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0),
    v = new THREE.Vector3();
  function pose() {
    // A gentle heave for whatever floats; held still for reduced motion.
    const bob = still ? 0 : Math.sin(now * 1.4) * 0.035;
    let floating = false;
    for (const kind of Object.keys(rigs) as VehicleKind[]) {
      const rig = rigs[kind];
      if (kind !== present) continue;
      rig.group.position.x = x;
      for (const w of rig.wheels) w.rotation.z = -x / rig.radius;
      // Propellers turn while taxiing and stop once parked.
      for (const p of rig.props) p.rotation.x = x * 2.4;
      rig.wing.rotation.x = -rig.lift * easeInOut(wing);
      if (rig.ground === "sea") {
        floating = true;
        rig.group.position.y = bob;
        if (rig.wake) rig.wake.opacity = still ? 0 : Math.min(0.75, speed / 8);
      }
    }
    surface(easeInOut(ground.sea), easeInOut(ground.runway));
    // The windsock swings and lifts a little in the breeze.
    sock.rotation.y = still ? 0.35 : 0.35 + Math.sin(now * 0.7) * 0.22;
    sock.rotation.z = still ? -0.12 : -0.12 + Math.sin(now * 1.9) * 0.05;
    waves.position.x = still ? 0 : Math.sin(now * 0.45) * 0.3;
    waves.position.z = still ? 0 : Math.sin(now * 0.6) * 0.06;
    moorings.visible =
      floating && x === 0 && phase !== "arriving" && phase !== "leaving";
    let n = 0;
    for (const e of entities.values()) {
      if (e.index < 0) continue;
      const set = sets[e.kind];
      if (e.scale < 0.001) {
        for (const mesh of set.meshes) mesh.setMatrixAt(e.index, zero);
        continue;
      }
      // Cargo settled aboard a floating vehicle rides with it.
      v.copy(e.pos);
      if (floating && e.place === "inside" && !e.tween) v.y += bob;
      matrix.compose(v, quat.setFromAxisAngle(up, e.turn), scale.setScalar(e.scale));
      for (const mesh of set.meshes) mesh.setMatrixAt(e.index, matrix);
      const edges = set.edges;
      for (let i = 0; i < edges.length; i += 3) {
        v.set(edges[i], edges[i + 1], edges[i + 2]).applyMatrix4(matrix);
        edgeBuffer[n++] = v.x;
        edgeBuffer[n++] = v.y;
        edgeBuffer[n++] = v.z;
      }
    }
    for (const set of Object.values(sets))
      for (const mesh of set.meshes) {
        mesh.count = set.count;
        mesh.instanceMatrix.needsUpdate = true;
      }
    edgeGeometry.setDrawRange(0, n / 3);
    edgeGeometry.attributes.position.needsUpdate = true;
    full.visible = loaded() && (plan?.leftovers.length ?? 0) > 0;
  }

  const busy = () =>
    (phase !== "away" && phase !== "ready") ||
    (phase === "away" && desired !== null) ||
    [...entities.values()].some((e) => e.tween);

  function step(dt: number) {
    now += dt;
    still = false;
    const before = x;
    advance(dt);
    speed = Math.abs(x - before) / dt;
    animateEntities();
    pose();
  }

  pose();
  return {
    root,
    frames,
    vehicles: {
      ship: rigs.ship.group,
      truck: rigs.truck.group,
      plane: rigs.plane.group,
    },
    frameOf: (vehicle) => rigs[vehicle].frame,
    setTravel(next) {
      travel = next;
    },
    view: () => ({ from: shot.from, to: shot.to, k: easeInOut(shot.k) }),
    sync,
    step,
    settle() {
      for (let i = 0; i < 24 && busy(); i++) step(4);
      still = true;
      speed = 0;
      pose();
    },
    busy,
    alive: () => ground.sea > 0 || ground.runway > 0,
    status() {
      let inside = 0,
        onPad = 0,
        hidden = 0,
        moving = 0;
      for (const e of entities.values()) {
        if (e.removed) continue;
        if (e.tween) moving++;
        if (e.place === "inside") inside++;
        else if (e.place === "pad") onPad++;
        else if (e.place === "hidden") hidden++;
      }
      return {
        vehicle: present,
        phase,
        moving,
        inside,
        onPad,
        hidden,
        x,
        wing,
        frame: shot.k >= 1 ? shot.to : -1,
        sea: ground.sea,
        runway: ground.runway,
      };
    },
    parts() {
      const parts: Record<string, THREE.Object3D> = { yard: yardGroup };
      if (present) parts.vehicle = rigs[present].group;
      return parts;
    },
    dispose() {
      for (const set of Object.values(sets))
        for (const mesh of set.meshes) mesh.dispose();
    },
  };
}
