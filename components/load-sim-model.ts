import * as THREE from "three";
import {
  C,
  Model,
  fadeTexture,
  footprint,
  label,
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

/** Dark lining and floor seen inside once the side is lifted. */
const INTERIOR = "#3d4241";
const FLOOR = "#4b504f";

/**
 * A vehicle heading +x whose near (+z) side and most of the roof lift up as
 * one wing, hinged along the roof, so the whole cargo space can be seen.
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
  /** Just outside the open side: boxes pass here on the way in and out. */
  doorway: number;
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
  };
}

function vanRig(): Rig {
  const HINGE = -0.38,
    TOP = 1.95;
  const m = new Model();
  // Underbody, floor with a white skirt, rear doors, far side, roof strip.
  m.box([3.7, 0.16, 1.36], [-0.12, 0.4, 0], C.dark);
  m.box([2.36, 0.16, 1.62], [-0.95, 0.54, 0], C.white);
  m.box([0.06, 1.33, 1.62], [-2.1, 1.285, 0], C.red);
  m.box([2.36, 1.25, 0.06], [-0.95, 1.245, -0.78], C.red);
  m.box([2.36, 0.08, HINGE + 0.81], [-0.95, TOP - 0.04, (HINGE - 0.81) / 2], C.red);
  m.box([2.2, 1.22, 0.02], [-0.95, 1.24, -0.74], INTERIOR, [0, 0, 0], false);
  m.box([0.02, 1.22, 1.5], [-2.06, 1.24, 0], INTERIOR, [0, 0, 0], false);
  m.box([0.02, 1.22, 1.5], [0.17, 1.24, 0], INTERIOR, [0, 0, 0], false);
  m.box([2.22, 0.02, 1.52], [-0.95, 0.63, 0], FLOOR, [0, 0, 0], false);
  m.box([2.36, 0.12, 0.06], [-0.95, 0.66, 0.78], C.white);
  // Cab: one sloping shell with a short bonnet, like a panel van.
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.49);
  s.lineTo(1.88, 0.49);
  s.lineTo(1.95, 0.62);
  s.lineTo(1.95, 0.9);
  s.quadraticCurveTo(1.94, 1.02, 1.82, 1.05);
  s.lineTo(1.45, 1.13);
  s.lineTo(1.0, 1.8);
  s.quadraticCurveTo(0.95, 1.92, 0.83, 1.92);
  s.lineTo(0.25, 1.92);
  s.closePath();
  m.add(
    new THREE.ExtrudeGeometry(s, {
      depth: 1.54,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 1,
      steps: 1,
    }),
    C.white,
    [0, 0, -0.77],
  );
  m.box([0.03, 0.7, 1.34], [1.258, 1.487, 0], C.glass, [0, 0, 0.591]);
  for (const side of [-1, 1]) {
    const pane = new THREE.Shape();
    pane.moveTo(0.36, 1.18);
    pane.lineTo(1.33, 1.18);
    pane.lineTo(0.97, 1.74);
    pane.lineTo(0.36, 1.74);
    pane.closePath();
    const glass = new THREE.ShapeGeometry(pane);
    if (side === -1) glass.scale(-1, 1, 1);
    m.add(glass, C.glass, [0, 0, side * 0.805], side === 1 ? [0, 0, 0] : [0, Math.PI, 0]);
    m.box([0.14, 0.035, 0.03], [0.45, 1.06, side * 0.81], C.dark);
    m.box([1.66, 0.07, 0.012], [1.08, 0.84, side * 0.806], C.red, [0, 0, 0], false);
    m.box([0.07, 0.17, 0.1], [1.36, 1.28, side * 0.9], C.white);
    m.box([0.05, 0.035, 0.12], [1.38, 1.22, side * 0.83], C.dark);
    m.box([0.04, 0.1, 0.26], [1.975, 0.82, side * 0.55], C.white);
    for (const x of [-1.4, 1.25])
      m.box([0.82, 0.26, 0.02], [x, 0.59, side * 0.812], C.dark, [0, 0, 0], false);
  }
  m.box([0.04, 0.12, 0.62], [1.975, 0.8, 0], C.dark);
  m.box([0.14, 0.15, 1.66], [1.97, 0.52, 0], C.grey);
  m.box([0.1, 0.12, 1.5], [-2.16, 0.52, 0], C.grey);
  const g = m.finish();

  const w = new Model();
  const span = 0.81 - HINGE;
  w.box([2.38, 0.08, span], [-0.95, -0.04, span / 2], C.red);
  w.box([2.36, 1.15, 0.06], [-0.95, 1.295 - TOP, 0.78 - HINGE], C.red);
  w.box([2.36, 0.07, 0.012], [-0.95, 0.95 - TOP, 0.816 - HINGE], C.white, [0, 0, 0], false);
  const wing = w.finish();
  label(wing, "3 DAYA TERANG", [-0.95, 1.4 - TOP, 0.818 - HINGE], 1.9, 0.475, C.white);
  wing.position.set(0, TOP, HINGE);
  g.add(wing);
  const wheels: THREE.Group[] = [];
  for (const x of [-1.4, 1.25])
    for (const z of [-0.7, 0.7]) {
      const r = wheel(0.34);
      r.position.set(x, 0.34, z);
      g.add(r);
      wheels.push(r);
    }
  footprint(g, -0.05, 0, 4.4, 1.75);
  return {
    group: g,
    wing,
    wheels,
    radius: 0.34,
    lift: 2.05,
    hold: new THREE.Vector3(-2.05, 0.64, -0.73),
    doorway: 1.2,
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

/** Lane lines, the loading pad with dashed edges, and its ground lettering. */
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
  // Cones marking either end of the parking bay.
  // Enough sides that only the silhouette gets an ink line at this size.
  for (const [x, z] of CONES) {
    m.box([0.38, 0.06, 0.38], [x, 0.03, z], C.dark);
    m.add(new THREE.ConeGeometry(0.15, 0.5, 20), C.red, [x, 0.31, z]);
    m.cylinder(0.096, 0.09, [x, 0.34, z], C.white, [0, 0, 0], 20);
  }
  g.add(m.finish());
  const ground: number[] = [-Math.PI / 2, 0, 0];
  const at = [mid.x - 1.3, 0.012, max.z + 0.48];
  const ready = label(g, "AREA MUAT", at, 2.2, 0.55, "#a9aea8", ground);
  const full = label(g, "TIDAK MUAT", at, 2.2, 0.55, C.red, ground);
  full.visible = false;
  return { group: g, full };
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
};

export type LoadSimModel = {
  root: THREE.Group;
  /** World boxes the camera frames: the truck with its wing up, and the pad. */
  bounds: THREE.Box3[];
  /** The larger vehicle, parked, for working out where off screen begins. */
  measure: THREE.Object3D;
  setTravel: (entry: number, exit: number) => void;
  sync: (
    vehicle: VehicleKind | null,
    items: readonly Item[],
    plan: LoadPlan | null,
  ) => void;
  step: (dt: number) => void;
  /** Jumps straight to where everything is heading (reduced motion). */
  settle: () => void;
  busy: () => boolean;
  status: () => SimStatus;
  /** The vehicle on stage and the yard, for layout checks. */
  parts: () => Record<string, THREE.Object3D>;
  dispose: () => void;
};

const ARRIVE = 1.8,
  OPEN = 0.8,
  CLOSE = 0.6,
  LEAVE = 1.25;
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
  const rigs: Record<VehicleKind, Rig> = { van: vanRig(), truck: truckRig() };
  for (const rig of Object.values(rigs)) {
    rig.group.visible = false;
    root.add(rig.group);
  }
  const { group: yardGroup, full } = yard();
  root.add(yardGroup);

  // Frame the truck with its wing up (it covers the van too) and the pad.
  const truck = rigs.truck;
  truck.wing.rotation.x = -truck.lift;
  root.updateMatrixWorld(true);
  const bounds = [
    new THREE.Box3().setFromObject(truck.group),
    // The pad, a little stacked, and the lettering in front of it.
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
  truck.wing.rotation.x = 0;

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

  let entry = -16,
    exit = 16;
  let now = 0;
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
        ctrl = new THREE.Vector3(t.pos.x, t.pos.y + 0.45, rig.doorway);
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
        Math.max(from.y, t.pos.y) + 0.45,
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

  function advance(dt: number) {
    phaseTime += dt;
    switch (phase) {
      case "away":
        if (desired) {
          present = desired;
          rigs[present].group.visible = true;
          x = entry;
          wing = 0;
          setPhase("arriving");
        }
        break;
      case "arriving": {
        if (desired !== present) return startLeaving();
        const k = clamp01(phaseTime / ARRIVE);
        x = entry * (1 - easeOut(k));
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
        x = leaveFrom + (exit - leaveFrom) * easeIn(k);
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
    for (const kind of Object.keys(rigs) as VehicleKind[]) {
      const rig = rigs[kind];
      if (kind !== present) continue;
      rig.group.position.x = x;
      for (const w of rig.wheels) w.rotation.z = -x / rig.radius;
      rig.wing.rotation.x = -rig.lift * easeInOut(wing);
    }
    let n = 0;
    for (const e of entities.values()) {
      if (e.index < 0) continue;
      const set = sets[e.kind];
      if (e.scale < 0.001) {
        for (const mesh of set.meshes) mesh.setMatrixAt(e.index, zero);
        continue;
      }
      matrix.compose(e.pos, quat.setFromAxisAngle(up, e.turn), scale.setScalar(e.scale));
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
    advance(dt);
    animateEntities();
    pose();
  }

  pose();
  return {
    root,
    bounds,
    measure: truck.group,
    setTravel(a, b) {
      entry = a;
      exit = b;
    },
    sync,
    step,
    settle() {
      for (let i = 0; i < 24 && busy(); i++) step(4);
      pose();
    },
    busy,
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
      return { vehicle: present, phase, moving, inside, onPad, hidden, x, wing };
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
