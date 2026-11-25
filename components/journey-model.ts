import * as THREE from "three";
import { C, Model, cargo, disposeScene, smooth } from "./models";
import { STOP_COUNT, nearStop } from "./journey-timeline";
import { createServiceModel, type ServiceKind } from "./service-models";

/**
 * The services journey: one route that winds down the page. A winding road
 * from the warehouse to the port, a winding sea lane to the airport, then a
 * runway and a dashed flight path through the clouds. The truck, ship and
 * plane from the service illustrations ride it in turn, each stopping once
 * (heading +x, as in their cards) while its service is explained.
 */

/** Camera offset shared by every scene, and the screen's right on the ground. */
export const VIEW = new THREE.Vector3(11, 10, 14);
export const RIGHT = new THREE.Vector3(VIEW.z, 0, -VIEW.x).normalize();

/** Sampling step along the route. */
const STEP = 0.25;
/** Cruising height of the plane, and the flight path's height above it. */
const ALTITUDE = 8;

type Piece =
  | { straight: number; mark?: "stop" | "port" | "airport" }
  | { turn: number; radius: number };

// Straights head +x (right and a little down on screen) or back the other
// way; each bend swings the route round so it snakes down the screen.
const PIECES: Piece[] = [
  // Road.
  { straight: 8 },
  { turn: 110, radius: 7 },
  { straight: 18 },
  { turn: -110, radius: 7 },
  { straight: 12, mark: "stop" },
  { straight: 12 },
  { turn: 110, radius: 7 },
  { straight: 16 },
  { turn: -110, radius: 7 },
  { straight: 12, mark: "port" },
  // Sea.
  { straight: 8 },
  { turn: 110, radius: 10 },
  { straight: 18 },
  { turn: -110, radius: 10 },
  { straight: 14, mark: "stop" },
  { straight: 14 },
  { turn: 110, radius: 10 },
  { straight: 16 },
  { turn: -110, radius: 10 },
  { straight: 10, mark: "airport" },
  // Runway, then the air.
  { straight: 36 },
  { turn: 110, radius: 12 },
  { straight: 16 },
  { turn: -110, radius: 12 },
  { straight: 18, mark: "stop" },
  { straight: 18 },
  { turn: 110, radius: 12 },
  { straight: 40 },
];

/** The route as samples every STEP: position and heading (radians from +x). */
function buildRoute() {
  const xs = [0],
    zs = [0],
    hs = [0];
  const marks = { stop: [] as number[], port: 0, airport: 0 };
  let x = 0,
    z = 0,
    h = 0,
    length = 0;
  for (const piece of PIECES) {
    const arc = "turn" in piece;
    const len = arc
      ? (Math.abs(piece.turn) * Math.PI * piece.radius) / 180
      : piece.straight;
    const n = Math.max(1, Math.round(len / STEP));
    const dh = arc ? (piece.turn * Math.PI) / 180 / n : 0;
    for (let i = 0; i < n; i++) {
      h += dh / 2;
      x += (Math.cos(h) * len) / n;
      z += (Math.sin(h) * len) / n;
      h += dh / 2;
      xs.push(x);
      zs.push(z);
      hs.push(h);
    }
    length += len;
    const mark = arc ? undefined : piece.mark;
    if (mark === "stop") marks.stop.push(length);
    else if (mark === "port") marks.port = length;
    else if (mark === "airport") marks.airport = length;
  }
  return { xs, zs, hs, length, marks };
}

const route = buildRoute();
const PORT = route.marks.port,
  AIRPORT = route.marks.airport,
  STOPS = route.marks.stop;

/** Point and heading `s` along the route (clamped to its ends, then straight on). */
function at(s: number) {
  const last = route.xs.length - 1;
  const f = Math.min(Math.max(s / STEP, 0), last);
  const i = Math.min(Math.floor(f), last - 1),
    t = f - i;
  const h = route.hs[i] + (route.hs[i + 1] - route.hs[i]) * t;
  const point = new THREE.Vector3(
    route.xs[i] + (route.xs[i + 1] - route.xs[i]) * t,
    0,
    route.zs[i] + (route.zs[i + 1] - route.zs[i]) * t,
  );
  // Past either end, carry straight on.
  const beyond = s < 0 ? s : s > route.length ? s - route.length : 0;
  point.x += Math.cos(h) * beyond;
  point.z += Math.sin(h) * beyond;
  return { point, h };
}
const across = (h: number) => new THREE.Vector3(-Math.sin(h), 0, Math.cos(h));

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Overshoots a little before settling, for the vehicles popping in. */
const backOut = (t: number) => 1 + 2.9 * (t - 1) ** 3 + 1.9 * (t - 1) ** 2;

/** Where the truck waits at the start: parked in the yard, its back to the warehouse door. */
const START = -1.8;

/** Plane height: rolls down the runway, lifts off, climbs to cruise. */
function altitude(s: number) {
  return ALTITUDE * smoothstep(AIRPORT + 24, AIRPORT + 64, s);
}

/**
 * A strip following the route from `s0` to `s1`, `width` wide and `offset`
 * to the left of the centre line, its top at `top`. With a `thickness` it is
 * a slab, with walls and ends.
 */
function strip(
  s0: number,
  s1: number,
  width: number,
  top: number,
  thickness = 0,
  offset = 0,
) {
  const n = Math.max(1, Math.ceil((s1 - s0) / 0.5));
  const left: THREE.Vector3[] = [],
    right: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const { point, h } = at(s0 + ((s1 - s0) * i) / n);
    const side = across(h);
    left.push(point.clone().addScaledVector(side, offset + width / 2).setY(top));
    right.push(point.clone().addScaledVector(side, offset - width / 2).setY(top));
  }
  const out: number[] = [];
  const tri = (...v: THREE.Vector3[]) => v.forEach((p) => out.push(p.x, p.y, p.z));
  const down = (p: THREE.Vector3) => p.clone().setY(top - thickness);
  for (let i = 0; i < n; i++) {
    const [l0, l1, r0, r1] = [left[i], left[i + 1], right[i], right[i + 1]];
    tri(l0, l1, r0);
    tri(r0, l1, r1);
    if (!thickness) continue;
    tri(l0, down(l0), l1);
    tri(l1, down(l0), down(l1));
    tri(r0, r1, down(r0));
    tri(r1, down(r1), down(r0));
  }
  if (thickness) {
    const [l, r] = [left[0], right[0]];
    tri(l, r, down(l));
    tri(r, down(r), down(l));
    const [le, re] = [left[n], right[n]];
    tri(le, down(le), re);
    tri(re, down(le), down(re));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Places a group `s` along the route, `side` to its left, facing along it. */
function place(object: THREE.Object3D, s: number, side = 0, y = 0) {
  const { point, h } = at(s);
  object.position.copy(point).addScaledVector(across(h), side).setY(y);
  object.rotation.y = -h;
  return object;
}

const ASPHALT = "#3b403f";
const RUNWAY = "#858b89";
const WATER = "#d3e5e7";
const QUAY = C.wall;

function ground() {
  const m = new Model();
  // Warehouse yard and the road out of it.
  m.add(strip(-15, -1, 10, 0.1, 0.3), QUAY);
  m.add(strip(-1.5, PORT - 4, 3.8, 0.12, 0.3), ASPHALT);
  for (const side of [-1, 1])
    m.add(strip(-1.5, PORT - 4, 0.07, 0.125, 0, side * 1.55), C.white, [0, 0, 0], [0, 0, 0], false);
  for (let s = 0; s < PORT - 6; s += 2.2)
    m.add(strip(s, s + 1.1, 0.14, 0.13), C.white, [0, 0, 0], [0, 0, 0], false);
  // The sea lane, with quays at the port and at the airport.
  m.add(strip(PORT - 2, AIRPORT + 2, 12, 0), WATER);
  m.add(strip(PORT - 6, PORT + 1, 14, 0.18, 0.6), QUAY);
  m.add(strip(AIRPORT - 2, AIRPORT + 4, 14, 0.18, 0.6), QUAY);
  // Runway: centre dashes and threshold bars at the start.
  m.add(strip(AIRPORT + 3, AIRPORT + 40, 6.5, 0.12, 0.35), RUNWAY);
  for (let s = AIRPORT + 8; s < AIRPORT + 38; s += 2.4)
    m.add(strip(s, s + 1.2, 0.16, 0.125), C.white, [0, 0, 0], [0, 0, 0], false);
  for (let i = 0; i < 8; i++)
    m.add(
      strip(AIRPORT + 4, AIRPORT + 6, 0.32, 0.125, 0, -2.45 + i * 0.7),
      C.white,
      [0, 0, 0],
      [0, 0, 0],
      false,
    );
  const group = m.finish();
  group.add(warehouse(), port(), tower(), clouds(), flightPath());
  return group;
}

function warehouse() {
  const m = new Model();
  m.box([5, 3.1, 6], [0, 1.65, 0], C.white);
  m.box([5.3, 0.22, 6.3], [0, 3.31, 0], C.grey);
  m.box([5.04, 0.42, 6.04], [0, 2.7, 0], C.red, [0, 0, 0], false);
  m.box([0.04, 1.9, 2.4], [2.52, 1.05, 0], C.dark);
  const g = m.finish();
  // Boxes waiting in the yard.
  for (const [x, z, size, red] of [
    [1.2, -4.1, 1.1, 1],
    [2.4, -4.2, 0.8, 0],
    [1.9, 4, 0.9, 0],
  ] as const) {
    const b = cargo(size, size * 0.85, size, !!red);
    b.position.set(x, 0.1, z);
    g.add(b);
  }
  return place(g, -8.5, 0, 0.1);
}

function port() {
  const g = new THREE.Group();
  // Stacks of cargo either side of the quay, and bollards at its edge.
  for (const [ds, side, red] of [
    [-4.5, 5.2, 1],
    [-2.6, 5.4, 0],
    [-4.2, -5.3, 0],
    [-2.2, -5.5, 1],
  ] as const) {
    const stack = new THREE.Group();
    for (let level = 0; level < 2; level++) {
      const b = cargo(1.5, 1.1, 1.5, (level + (red ? 0 : 1)) % 2 === 0);
      b.position.y = level * 1.1;
      stack.add(b);
    }
    g.add(place(stack, PORT + ds, side, 0.18));
  }
  const m = new Model();
  for (const side of [-5.5, -3, 3, 5.5])
    m.cylinder(0.18, 0.4, [0, 0.38, side], C.dark);
  g.add(place(m.finish(), PORT + 0.4));
  return g;
}

function tower() {
  const m = new Model();
  m.box([2.2, 1.2, 2.2], [0, 0.6, 0], C.white);
  m.cylinder(0.55, 4.6, [0, 3.4, 0], C.white, [0, 0, 0], 16);
  m.cylinder(1.15, 0.9, [0, 6.1, 0], C.glass, [0, 0, 0], 16);
  m.cylinder(1.3, 0.22, [0, 6.65, 0], C.red, [0, 0, 0], 16);
  m.cylinder(0.05, 0.9, [0, 7.2, 0], C.dark, [0, 0, 0], 6);
  // Behind the runway, so it rises into open space rather than over it.
  return place(m.finish(), AIRPORT + 16, -7.5, 0.12);
}

/** Puffs of cloud beside the flight path. */
function clouds() {
  const m = new Model();
  const puff = (s: number, side: number, y: number, size: number) => {
    const { point, h } = at(s);
    const c = point.addScaledVector(across(h), side).setY(y);
    for (const [dx, dy, dz, r] of [
      [0, 0, 0, 1],
      [0.9, -0.2, 0.3, 0.72],
      [-0.95, -0.25, -0.2, 0.68],
      [0.3, 0.35, -0.6, 0.6],
    ]) {
      const geo = new THREE.SphereGeometry(r * size, 18, 12);
      geo.scale(1.15, 0.78, 1);
      smooth(m, geo, C.white, [c.x + dx * size, c.y + dy * size, c.z + dz * size]);
    }
  };
  puff(AIRPORT + 74, 9, ALTITUDE + 1.5, 1.4);
  puff(AIRPORT + 92, -10, ALTITUDE - 1, 1.2);
  puff(STOPS[2] - 6, 11, ALTITUDE + 3, 1.5);
  puff(STOPS[2] + 4, -12, ALTITUDE + 0.5, 1.1);
  puff(STOPS[2] + 26, 8, ALTITUDE - 0.5, 1.3);
  return m.finish();
}

/** Red dashes tracing the plane's way through the air. */
function flightPath() {
  const m = new Model();
  for (let s = AIRPORT + 40; s < route.length; s += 2.2) {
    const { point, h } = at(s);
    const y = altitude(s) + 1.45;
    const pitch = Math.atan2(altitude(s + 0.5) - altitude(s - 0.5), 1);
    m.box([0.9, 0.1, 0.1], [point.x, y, point.z], C.red, [0, -h, pitch], false);
  }
  return m.finish();
}

/** A vehicle from a service illustration, without its card's ground. */
function vehicle(kind: ServiceKind) {
  const service = createServiceModel(kind);
  for (const o of service.scenery) {
    o.removeFromParent();
    disposeScene(o);
  }
  const holder = new THREE.Group(),
    pop = new THREE.Group();
  pop.add(service.root);
  holder.add(pop);
  const wheels: THREE.Object3D[] = [];
  service.travel.traverse((o) => {
    if (o.userData.wheels) wheels.push(...o.userData.wheels);
  });
  return { service, holder, pop, wheels };
}

export function createJourneyModel() {
  const root = new THREE.Group();
  root.add(ground());
  const truck = vehicle("road"),
    ship = vehicle("ocean"),
    plane = vehicle("air");
  root.add(truck.holder, ship.holder, plane.holder);
  // The plane climbs inside its group; its shadow stays on the ground.
  const lifter = new THREE.Group();
  const shadow = plane.service.travel.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh,
  );
  for (const c of [...plane.service.travel.children])
    if (c !== shadow) lifter.add(c);
  plane.service.travel.add(lifter);
  if (shadow) shadow.material = (shadow.material as THREE.Material).clone();

  // Where the stretch of route around each point lies across the screen, to
  // keep it in view when zoomed out: its middle and how far it swings.
  const us = route.xs.map((x, i) => x * RIGHT.x + route.zs[i] * RIGHT.z);
  const WINDOW = Math.round(36 / STEP);
  const spread = us.map((_, i) => {
    const near = us.slice(Math.max(0, i - WINDOW), i + WINDOW + 1);
    const lo = Math.min(...near),
      hi = Math.max(...near);
    return { mid: (lo + hi) / 2, half: (hi - lo) / 2 };
  });
  const spreadAt = (s: number) =>
    spread[THREE.MathUtils.clamp(Math.round(s / STEP), 0, spread.length - 1)];

  /** Distance along the route for a place on the journey timeline. */
  function sAt(x: number) {
    if (x <= 1) return START + x * (STOPS[0] - START);
    if (x >= STOP_COUNT) return STOPS[STOP_COUNT - 1] + (x - STOP_COUNT) * 40;
    const i = Math.floor(x);
    return STOPS[i - 1] + (STOPS[i] - STOPS[i - 1]) * (x - i);
  }

  let lastS = START;
  /**
   * Poses everything at journey place `x` and clock `t`. Returns the point
   * the camera should centre on and how close each stop is.
   */
  function pose(x: number, t: number, dt: number) {
    const s = sAt(x);
    const moved = s - lastS;
    lastS = s;
    // Truck: up to the quay, where it shrinks away.
    const kTruck = 1 - smoothstep(PORT - 6, PORT - 2, s);
    // (The truck already sits at road height inside its group.)
    place(truck.holder, Math.min(s, PORT - 2));
    truck.holder.visible = kTruck > 0.001;
    truck.pop.scale.setScalar(Math.max(kTruck, 0.001));
    if (Math.abs(moved) < 5)
      truck.wheels.forEach((w) => (w.rotation.z -= moved / 0.46));
    truck.service.animate(t, dt, 0);
    // Ship: pops up in the water past the quay, gone before the airport.
    const kShip =
      backOut(smoothstep(PORT + 4, PORT + 8, s)) *
      (1 - smoothstep(AIRPORT - 7, AIRPORT - 3, s));
    place(ship.holder, THREE.MathUtils.clamp(s, PORT + 4, AIRPORT - 3));
    ship.holder.visible = kShip > 0.001;
    ship.pop.scale.setScalar(Math.max(kShip, 0.001));
    ship.service.animate(t, dt, 1);
    // Plane: pops up on the runway, rolls, lifts off and climbs, banking
    // into the bends.
    const kPlane = backOut(smoothstep(AIRPORT + 4, AIRPORT + 8, s));
    const sPlane = Math.max(s, AIRPORT + 4);
    place(plane.holder, sPlane, 0, 0.12);
    plane.holder.visible = kPlane > 0.001;
    plane.pop.scale.setScalar(Math.max(kPlane, 0.001));
    const height = altitude(sPlane),
      airborne = height / ALTITUDE;
    lifter.position.y = height - 0.45;
    lifter.rotation.z =
      Math.atan2(altitude(sPlane + 1) - altitude(sPlane - 1), 2) * 0.9;
    const bend = (at(sPlane + 2).h - at(sPlane - 2).h) / 4;
    lifter.rotation.x = THREE.MathUtils.clamp(bend * 4, -0.45, 0.45) * airborne;
    if (shadow) {
      shadow.scale.setScalar(1 - airborne * 0.45);
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.38 * (1 - airborne * 0.6);
    }
    plane.service.animate(t, dt, 1);

    // The camera centres on whichever vehicle is out.
    const lift =
      s < PORT ? 1.3 : s < AIRPORT + 2 ? 1.6 : altitude(sPlane) + 1.3;
    const target = at(s).point.setY(lift);
    const near = Array.from({ length: STOP_COUNT }, (_, i) => nearStop(x, i));
    return { target, near, s, ...spreadAt(s) };
  }

  return {
    root,
    pose,
  };
}
export type JourneyModel = ReturnType<typeof createJourneyModel>;
