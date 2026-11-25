import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const C = {
  red: "#ed4135",
  deepRed: "#c8322a",
  white: "#fffdf8",
  wall: "#e7e7e2",
  grey: "#c9ccca",
  dark: "#272a2b",
  ink: "#292c2c",
  glass: "#647474",
  tape: "#f4ece0",
  ground: "#f6f5f1",
};
const gradient = new THREE.DataTexture(
  new Uint8Array([155, 210, 255]),
  3,
  1,
  THREE.RedFormat,
);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;
const materials = new Map<string, THREE.MeshToonMaterial>();
function material(color: string) {
  if (!materials.has(color))
    materials.set(
      color,
      new THREE.MeshToonMaterial({
        color,
        gradientMap: gradient,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
  return materials.get(color)!;
}
const ink = new THREE.LineBasicMaterial({
  color: C.ink,
  transparent: true,
  opacity: 1,
});
const textTextures = new Map<string, THREE.CanvasTexture>();

/** Merge geometry by material. Each model uses a handful of draw calls, not one per detail. */
export class Model {
  group = new THREE.Group();
  parts = new Map<string, THREE.BufferGeometry[]>();
  edges: THREE.BufferGeometry[] = [];
  add(
    geometry: THREE.BufferGeometry,
    color: string,
    pos: number[] = [0, 0, 0],
    rot: number[] = [0, 0, 0],
    outline = true,
  ) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...(rot as [number, number, number])),
      ),
      new THREE.Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(matrix);
    if (!this.parts.has(color)) this.parts.set(color, []);
    this.parts.get(color)!.push(geometry);
    if (outline) this.edges.push(new THREE.EdgesGeometry(geometry, 28));
  }
  box(
    size: number[],
    pos: number[],
    color = C.white,
    rot: number[] = [0, 0, 0],
    outline = true,
  ) {
    this.add(
      new THREE.BoxGeometry(...(size as [number, number, number])),
      color,
      pos,
      rot,
      outline,
    );
  }
  cylinder(
    radius: number,
    height: number,
    pos: number[],
    color = C.dark,
    rot: number[] = [0, 0, 0],
    segments = 12,
    outline = true,
  ) {
    this.add(
      new THREE.CylinderGeometry(radius, radius, height, segments),
      color,
      pos,
      rot,
      outline,
    );
  }
  sphere(radius: number, pos: number[], color = C.white) {
    this.add(
      new THREE.SphereGeometry(radius, 12, 8),
      color,
      pos,
      [0, 0, 0],
      false,
    );
  }
  finish() {
    for (const [color, geos] of this.parts) {
      const geo = mergeGeometries(
        geos.map((g) => (g.index ? g.toNonIndexed() : g)),
      );
      this.group.add(new THREE.Mesh(geo, material(color)));
      geos.forEach((g) => g.dispose());
    }
    if (this.edges.length) {
      this.group.add(new THREE.LineSegments(mergeGeometries(this.edges), ink));
      this.edges.forEach((g) => g.dispose());
    }
    return this.group;
  }
}
/** Ink silhouette for smooth shells: back faces pushed out along their normals. */
const shellOutline = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { thickness: { value: 0.015 } },
  vertexShader:
    "uniform float thickness; void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*thickness,1.0);}",
  fragmentShader: "void main(){gl_FragColor=vec4(0.14,0.16,0.15,1.0);}",
});
/**
 * A curved part outlined by its silhouette; `edges` also inks its open
 * borders and sharp creases.
 */
export function smooth(
  m: Model,
  geo: THREE.BufferGeometry,
  color: string,
  pos: number[],
  rot: number[] = [0, 0, 0],
  edges = false,
) {
  m.add(geo, color, pos, rot, edges);
  m.group.add(new THREE.Mesh(geo.clone(), shellOutline));
}
/** Flat slab from a top-view outline of [x, z] points, `thickness` up from `y`. */
export function plan(
  m: Model,
  points: number[][],
  thickness: number,
  y: number,
  color: string,
) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) =>
    i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
  );
  shape.closePath();
  m.add(
    new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }),
    color,
    [0, y, 0],
    [-Math.PI / 2, 0, 0],
  );
}
export function label(
  parent: THREE.Group,
  text: string,
  pos: number[],
  width: number,
  height: number,
  color = C.ink,
  rotation: number[] = [0, 0, 0],
  bg?: string,
) {
  const key = text + color + (bg || "");
  let texture = textTextures.get(key);
  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1024, 256);
    }
    ctx.fillStyle = color;
    ctx.font = "bold 130px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 139, 960);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textTextures.set(key, texture);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  mesh.position.set(...(pos as [number, number, number]));
  mesh.rotation.set(...(rotation as [number, number, number]));
  parent.add(mesh);
  return mesh;
}
export function footprint(
  parent: THREE.Group,
  x: number,
  z: number,
  width: number,
  depth: number,
) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color: "#d7dbd5",
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.014, z);
  parent.add(mesh);
}
/** Fades a ground line in and out along its length. */
export function fadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, "#000");
  gradient.addColorStop(0.25, "#fff");
  gradient.addColorStop(0.75, "#fff");
  gradient.addColorStop(1, "#000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, 64);
  return new THREE.CanvasTexture(canvas);
}

export function cargo(w = 0.7, h = 0.65, d = 0.7, red = false) {
  const m = new Model();
  const color = red ? C.red : C.wall;
  m.box([w, h, d], [0, h / 2, 0], color);
  m.box(
    [w * 0.13, 0.012, d + 0.015],
    [0, h + 0.009, 0],
    red ? C.deepRed : C.grey,
    [0, 0, 0],
    false,
  );
  m.box(
    [w * 0.13, h, 0.012],
    [0, h / 2, d / 2 + 0.009],
    red ? C.deepRed : C.grey,
    [0, 0, 0],
    false,
  );
  m.box([w * 0.3, h * 0.22, 0.014], [w * 0.22, h * 0.4, d / 2 + 0.02], C.white);
  m.box(
    [w * 0.025, h * 0.12, 0.017],
    [w * 0.18, h * 0.4, d / 2 + 0.03],
    C.dark,
    [0, 0, 0],
    false,
  );
  m.box(
    [w * 0.025, h * 0.12, 0.017],
    [w * 0.24, h * 0.4, d / 2 + 0.03],
    C.dark,
    [0, 0, 0],
    false,
  );
  return m.finish();
}
export function pallet(x = 0, z = 0, levels = 2, red = false) {
  const group = new THREE.Group(),
    m = new Model();
  for (let i = 0; i < 5; i++)
    m.box([1.65, 0.09, 0.21], [0, 0.18, -0.6 + i * 0.3], C.grey);
  for (let i = 0; i < 3; i++)
    m.box([0.2, 0.13, 1.5], [-0.65 + i * 0.65, 0.08, 0], C.grey);
  group.add(m.finish());
  for (let y = 0; y < levels; y++)
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const b = cargo(0.71, 0.61, 0.66, red && (i + j + y) % 3 !== 0);
        b.position.set(i * 0.78 - 0.39, 0.24 + y * 0.63, j * 0.73 - 0.36);
        group.add(b);
      }
  group.position.set(x, 0, z);
  return group;
}
export function wheel(radius = 0.46) {
  const m = new Model();
  m.cylinder(radius, 0.24, [0, 0, 0], C.dark, [Math.PI / 2, 0, 0], 20);
  for (const side of [-1, 1]) {
    m.cylinder(
      radius * 0.65,
      0.025,
      [0, 0, side * 0.132],
      C.white,
      [Math.PI / 2, 0, 0],
      16,
    );
    m.cylinder(
      radius * 0.27,
      0.04,
      [0, 0, side * 0.15],
      C.grey,
      [Math.PI / 2, 0, 0],
      12,
    );
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      m.cylinder(
        0.035,
        0.03,
        [
          Math.sin(a) * radius * 0.45,
          Math.cos(a) * radius * 0.45,
          side * 0.151,
        ],
        C.dark,
        [Math.PI / 2, 0, 0],
        6,
        false,
      );
    }
  }
  return m.finish();
}
export function truck(open = false) {
  const m = new Model();
  truckChassis(m);
  if (!open) {
    m.box([4.05, 2.3, 2.02], [-1, 2.22, 0], C.red);
    m.box([4.08, 0.16, 2.05], [-1, 1.4, 0], C.white);
    m.box([4.09, 0.08, 2.06], [-1, 3.25, 0], C.deepRed);
    for (let i = 0; i < 8; i++)
      m.box(
        [0.02, 1.62, 0.012],
        [-2.7 + i * 0.48, 2.3, 1.022],
        C.deepRed,
        [0, 0, 0],
        false,
      );
  } else {
    m.box([4.05, 2.3, 0.07], [-1, 2.22, -1], C.red);
    m.box([4.1, 0.17, 2.08], [-1, 3.3, 0], C.red);
    m.box([0.1, 2.3, 2], [-3, 2.22, 0], C.red);
    m.box([0.1, 2.3, 2], [1, 2.22, 0], C.red);
    m.box([4.1, 0.3, 0.06], [-1, 1.27, 1.01], C.red);
    for (let x = 0; x < 4; x++) {
      const b = cargo(0.8, 1.15, 1.65, x % 3 === 1);
      b.position.set(-2.5 + x * 0.92, 1.1, 0);
      m.group.add(b);
    }
  }
  const g = m.finish();
  const wheels = truckWheels(g);
  if (!open) {
    label(g, "3 Daya Terang →", [-1, 2.35, 1.036], 2.8, 0.7, C.white);
    label(g, "SETIAP KILO BERARTI", [-1, 1.83, 1.04], 2.4, 0.23, C.white);
  }
  footprint(g, 0, 0.1, 6.3, 2.25);
  g.userData.wheels = wheels;
  return g;
}
/**
 * Chassis, cargo floor and cab shared by every truck, heading +x. The cargo
 * body sits on the floor between x = -3 and x = 1 and is left to the caller.
 */
export function truckChassis(m: Model) {
  m.box([6.1, 0.22, 1.9], [0, 0.67, 0], C.dark);
  m.box([4.05, 0.12, 2.12], [-1, 1.04, 0], C.white);
  const s = new THREE.Shape();
  s.moveTo(-0.75, 0);
  s.lineTo(1.15, 0);
  s.lineTo(1.15, 0.75);
  s.lineTo(0.72, 1.97);
  s.quadraticCurveTo(0.65, 2.12, 0.43, 2.15);
  s.lineTo(-0.75, 2.15);
  s.closePath();
  const cab = new THREE.ExtrudeGeometry(s, {
    depth: 1.85,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 1,
    steps: 1,
  });
  m.add(cab, C.white, [1.83, 0.8, -0.925]);
  // Sloping windshield, side windows, door panel and sculpted fascia.
  m.box([0.035, 1.04, 1.62], [2.79, 2.23, 0], C.glass, [0, 0, 0.345]);
  for (const side of [-1, 1]) {
    const win = new THREE.Shape();
    win.moveTo(0, 0);
    win.lineTo(0.91, 0);
    win.lineTo(0.61, 0.99);
    win.lineTo(0, 0.99);
    win.closePath();
    const windowGeo = new THREE.ShapeGeometry(win);
    if (side === -1) windowGeo.scale(-1, 1, 1);
    m.add(
      windowGeo,
      C.glass,
      [1.46, 1.83, side * 0.985],
      side === 1 ? [0, 0, 0] : [0, Math.PI, 0],
    );
    m.box([1.23, 0.52, 0.014], [2.03, 1.36, side * 0.974], C.white);
    m.box([0.24, 0.065, 0.035], [1.57, 1.64, side * 1.003], C.dark);
    m.box([0.32, 0.5, 0.15], [2.68, 1.92, side * 1.16], C.white);
    m.box([0.08, 0.07, 0.32], [2.68, 1.77, side * 1.04], C.dark);
    m.box([0.8, 0.12, 0.17], [2.04, 0.77, side * 1.04], C.grey);
    m.box([0.24, 0.16, 0.05], [-2.76, 1.18, side * 1.038], C.white);
  }
  m.box([0.06, 0.47, 1.4], [3.005, 1.2, 0], C.dark);
  for (let i = 0; i < 4; i++)
    m.box(
      [0.015, 0.025, 1.3],
      [3.04, 1.04 + i * 0.1, 0],
      C.grey,
      [0, 0, 0],
      false,
    );
  m.box([0.13, 0.2, 1.99], [2.98, 0.83, 0], C.grey);
  for (const z of [-0.79, 0.79])
    m.box([0.08, 0.22, 0.23], [3.04, 1.22, z], C.white);
  m.box([0.08, 0.13, 0.42], [3.07, 0.86, 0], C.white);
}
/** Two rear axles and a steer axle, added to a finished truck group. */
export function truckWheels(g: THREE.Group) {
  const wheels: THREE.Group[] = [];
  for (const x of [-2.1, -0.95, 2.15])
    for (const z of [-1.01, 1.01]) {
      const w = wheel();
      w.position.set(x, 0.47, z);
      g.add(w);
      wheels.push(w);
    }
  return wheels;
}
export function person(carry = true) {
  const g = new THREE.Group(),
    body = new Model();
  body.box([0.41, 0.6, 0.3], [0, 1.02, 0], C.red);
  body.box([0.08, 0.56, 0.315], [-0.12, 1.02, 0], C.white, [0, 0, 0], false);
  body.box([0.08, 0.56, 0.315], [0.12, 1.02, 0], C.white, [0, 0, 0], false);
  body.sphere(0.19, [0, 1.52, 0], "#f0d6bc");
  body.cylinder(0.215, 0.14, [0, 1.69, 0], C.white, [0, 0, 0], 12);
  body.box([0.44, 0.055, 0.36], [0, 1.62, 0.07], C.white);
  body.box([0.14, 0.11, 0.035], [0, 1.52, 0.18], C.dark, [0, 0, 0], false);
  for (const side of [-1, 1]) {
    body.box([0.14, 0.39, 0.16], [side * 0.28, 1.04, 0.07], C.dark, [
      0.5,
      0,
      side * 0.2,
    ]);
    body.box([0.14, 0.14, 0.35], [side * 0.27, 0.87, 0.26], C.white);
  }
  g.add(body.finish());
  const legs = [];
  for (const side of [-1, 1]) {
    const limb = new Model();
    limb.box([0.17, 0.58, 0.19], [0, -0.25, 0], C.dark);
    limb.box([0.2, 0.12, 0.33], [0, -0.57, 0.06], C.white);
    const l = limb.finish();
    l.position.set(side * 0.12, 0.68, 0);
    g.add(l);
    legs.push(l);
  }
  if (carry) {
    const b = cargo(0.55, 0.43, 0.43);
    b.position.set(0, 0.84, 0.43);
    g.add(b);
  }
  footprint(g, 0, 0, 0.65, 0.55);
  g.userData.legs = legs;
  return g;
}
export function forklift() {
  const m = new Model();
  m.box([1.65, 0.55, 0.96], [0, 0.53, 0], C.red);
  m.box([0.53, 0.72, 0.97], [-0.64, 0.8, 0], C.red);
  m.box([0.63, 0.13, 0.67], [-0.2, 0.95, 0], C.dark);
  m.box([0.14, 0.52, 0.66], [-0.48, 1.15, 0], C.dark, [0, 0, -0.12]);
  for (const z of [-0.43, 0.43]) {
    m.box([0.075, 1.43, 0.075], [-0.61, 1.53, z], C.dark);
    m.box([0.075, 1.43, 0.075], [0.49, 1.53, z], C.dark);
  }
  m.box([1.37, 0.12, 1.1], [-0.06, 2.27, 0], C.red);
  for (const z of [-0.4, 0.4]) {
    m.box([0.12, 2.45, 0.12], [0.95, 1.27, z], C.dark);
    m.box([0.15, 1.9, 0.1], [1.08, 1.07, z], C.grey);
  }
  m.box([0.1, 0.12, 0.9], [1.04, 2.34, 0], C.dark);
  m.cylinder(0.22, 0.045, [0.4, 1.23, 0], C.dark, [0, 0, -0.5]);
  const g = m.finish();
  const lift = new Model();
  lift.box([0.1, 0.55, 0.94], [1.19, 0.4, 0], C.dark);
  for (const z of [-0.35, 0.35])
    lift.box([1.18, 0.09, 0.13], [1.75, 0.14, z], C.dark);
  const fork = lift.finish();
  const p = pallet(1.78, 0, 1, true);
  p.scale.setScalar(0.7);
  p.position.y = 0.21;
  fork.add(p);
  g.add(fork);
  const wheels = [];
  for (const x of [-0.59, 0.59])
    for (const z of [-0.53, 0.53]) {
      const w = wheel(0.3);
      w.position.set(x, 0.3, z);
      g.add(w);
      wheels.push(w);
    }
  const driver = person(false);
  driver.scale.setScalar(0.65);
  driver.rotation.y = Math.PI / 2;
  driver.position.set(-0.1, 0.55, 0);
  g.add(driver);
  footprint(g, 0, 0, 2, 1.25);
  g.userData.wheels = wheels;
  g.userData.lift = fork;
  return g;
}
export function warehouse() {
  const m = new Model();
  // Open dock facade with real recesses and a deep roof silhouette.
  m.box([11, 4.3, 0.18], [0, 2.15, -7.8], C.wall);
  m.box([0.2, 4.3, 8], [5.5, 2.15, -3.9], C.wall);
  m.box([0.2, 4.3, 8], [-5.5, 2.15, -3.9], C.wall);
  m.box([11.1, 0.28, 8.1], [0, 4.36, -3.9], C.white);
  m.box([10.8, 0.04, 7.75], [0, 4.53, -3.9], C.grey);
  m.box([11.3, 0.23, 0.22], [0, 4.65, 0.19], C.white);
  m.box([0.2, 0.23, 8.2], [5.6, 4.65, -3.8], C.white);
  m.box([11.25, 0.45, 0.18], [0, 3.9, 0.18], C.red);
  m.box([11.2, 0.6, 0.24], [0, 3.35, 0.12], C.white);
  const doors: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const x = -3.65 + i * 3.65;
    m.box([3.11, 2.83, 0.12], [x, 1.48, -0.13], C.dark);
    for (const side of [-1, 1]) {
      m.box([0.22, 3, 0.38], [x + side * 1.59, 1.52, 0.16], C.grey);
      m.box([0.12, 2.5, 0.25], [x + side * 1.4, 1.42, 0.35], C.dark);
    }
    m.box([3.2, 0.22, 0.44], [x, 2.97, 0.23], C.dark);
    m.box([3.35, 0.18, 1.1], [x, 0.15, 0.43], C.grey);
    m.box(
      [0.15, 0.17, 0.2],
      [x + 1.65, 2.7, 0.43],
      i === 1 ? "#94b9a0" : C.red,
    );
    const d = new Model();
    d.box([2.76, 2.6, 0.09], [0, -1.3, 0], C.grey);
    for (let k = 0; k < 9; k++)
      d.box(
        [2.78, 0.024, 0.02],
        [0, -k * 0.29 - 0.13, 0.06],
        C.dark,
        [0, 0, 0],
        false,
      );
    const door = d.finish();
    door.position.set(x, 2.82, 0.25);
    m.group.add(door);
    doors.push(door);
    for (const side of [-1, 1]) {
      m.cylinder(0.09, 0.81, [x + side * 1.75, 0.45, 0.95], C.red);
      m.cylinder(0.095, 0.16, [x + side * 1.75, 0.66, 0.95], C.white);
    }
  }
  for (let i = 0; i < 8; i++)
    m.box([0.015, 3.6, 7.7], [5.61, 2.2, -3.8], C.grey, [0, 0, 0], false);
  // Roof plant and raised solar arrays.
  for (let i = 0; i < 3; i++) {
    m.box([1.4, 0.48, 1.2], [-3 + i * 2.7, 4.83, -5.7], C.white);
    m.cylinder(0.4, 0.055, [-3 + i * 2.7, 5.1, -5.7], C.dark, [0, 0, 0], 20);
    m.cylinder(0.13, 0.065, [-3 + i * 2.7, 5.13, -5.7], C.grey);
    for (let j = 0; j < 5; j++)
      m.box(
        [1.2, 0.02, 0.025],
        [-3 + i * 2.7, 5.14, -6.1 + j * 0.2],
        C.grey,
        [0, 0, 0],
        false,
      );
  }
  for (let i = 0; i < 3; i++) {
    m.box(
      [2.4, 0.12, 1.65],
      [-3.35 + i * 3.1, 4.75, -2.5],
      C.dark,
      [0.13, 0, 0],
    );
    for (let k = 0; k < 5; k++)
      m.box(
        [0.015, 0.015, 1.62],
        [-4.36 + i * 3.1 + k * 0.49, 4.84, -2.5],
        C.grey,
        [0.13, 0, 0],
        false,
      );
    m.box(
      [2.37, 0.015, 0.015],
      [-3.35 + i * 3.1, 4.84, -2.5],
      C.grey,
      [0, 0, 0],
      false,
    );
  }
  const g = m.finish();
  for (let i = 0; i < 3; i++)
    label(g, `0${i + 1}`, [-3.65 + i * 3.65, 3.35, 0.251], 0.43, 0.27);
  label(
    g,
    "3 DAYA TERANG / PUSAT DISTRIBUSI",
    [0, 3.91, 0.281],
    6.4,
    0.38,
    C.white,
  );
  label(g, "HUB 01", [5.613, 3.2, -2], 2.6, 0.6, C.ink, [0, Math.PI / 2, 0]);
  for (const z of [-1, -3, -5]) {
    const ac = new Model();
    ac.box([0.5, 0.8, 1.25], [5.84, 1.15, z], C.white);
    ac.cylinder(0.28, 0.04, [6.11, 1.15, z], C.dark, [0, 0, Math.PI / 2], 20);
    ac.cylinder(0.17, 0.05, [6.14, 1.15, z], C.grey, [0, 0, Math.PI / 2]);
    g.add(ac.finish());
  }
  g.userData.doors = doors;
  return g;
}
export function ground() {
  const m = new Model();
  m.box([130, 0.025, 5.6], [0, -0.02, 6.4], "#e9ebe6", [0, 0, 0], false);
  m.box([5, 0.02, 75], [-13, -0.01, -15], "#e9ebe6", [0, 0, 0], false);
  for (let i = -18; i < 22; i++) {
    m.box(
      [1.25, 0.012, 0.055],
      [i * 2.7, 0.012, 6.4],
      C.white,
      [0, 0, 0],
      false,
    );
  }
  for (const z of [3.65, 9.15])
    m.box([130, 0.012, 0.07], [0, 0.015, z], C.white, [0, 0, 0], false);
  for (let i = -13; i < 15; i++)
    m.box([0.07, 0.012, 1.3], [-13, 0.018, i * 2.8], C.white, [0, 0, 0], false);
  // Forecourt parking guides, crossing, and precise red route markings.
  for (let i = 0; i < 4; i++)
    m.box(
      [0.055, 0.014, 3],
      [4 + i * 3.65, 0.02, 1.5],
      C.grey,
      [0, 0, 0],
      false,
    );
  for (let i = 0; i < 7; i++)
    m.box(
      [0.35, 0.015, 2.1],
      [-5.8 + i * 0.7, 0.026, 6.4],
      C.white,
      [0, 0, 0],
      false,
    );
  m.box([0.075, 0.018, 6], [-1.6, 0.024, -0.1], C.red, [0, 0, 0], false);
  m.box([10, 0.018, 0.075], [-6.55, 0.025, -3.05], C.red, [0, 0, 0], false);
  const g = m.finish();
  label(g, "P E L A N", [-7, 0.028, 8.3], 2, 0.7, "#a9aea8", [
    -Math.PI / 2,
    0,
    0,
  ]);
  label(g, "BONGKAR MUAT", [6, 0.029, 2.6], 3.5, 0.5, "#9b9f99", [
    -Math.PI / 2,
    0,
    0,
  ]);
  return g;
}
export function props() {
  const g = new THREE.Group();
  g.add(
    pallet(-8, -3.9, 3, true),
    pallet(-10.1, -4.1, 1),
    pallet(-7, -1.7, 2, true),
    pallet(1.3, -2, 2),
    pallet(1.3, -4.7, 1, true),
    pallet(13, 1.1, 2, true),
    pallet(-0.2, 10.4, 2, true),
  );
  const m = new Model();
  for (const [x, z] of [
    [-11, -2.3],
    [1.4, 2.8],
    [14, 3],
  ]) {
    m.cylinder(0.2, 0.08, [x, 0.05, z], C.dark);
    m.add(new THREE.ConeGeometry(0.15, 0.5, 12), C.red, [x, 0.34, z]);
    m.cylinder(0.095, 0.09, [x, 0.37, z], C.white);
  }
  for (let i = 0; i < 3; i++) {
    m.box([0.7, 0.11, 1.1], [-5.1, 0.1 + i * 0.13, -4.3], C.grey);
  }
  // A little dispatch office on the far left, with a red awning and window mullions.
  m.box([4, 2.65, 3], [-18, 1.33, -3], C.wall);
  m.box([4.2, 0.16, 3.2], [-18, 2.72, -3], C.white);
  m.box([4.1, 0.23, 0.65], [-18, 2.38, -1.35], C.red);
  for (let i = 0; i < 3; i++) {
    m.box([0.9, 1.2, 0.02], [-19.1 + i * 1.1, 1.5, -1.48], C.glass);
    m.box([0.04, 1.2, 0.04], [-19.1 + i * 1.1, 1.5, -1.45], C.white);
  }
  g.add(m.finish());
  return g;
}
export function disposeScene(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments)
      o.geometry.dispose();
  });
}

export function batchStatic(
  root: THREE.Group,
  excluded: THREE.Object3D[] = [],
) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<
    string,
    { material: THREE.Material; geos: THREE.BufferGeometry[]; line: boolean }
  >();
  const remove: THREE.Object3D[] = [];
  const visit = (obj: THREE.Object3D) => {
    if (excluded.includes(obj)) return;
    if (
      (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) &&
      !Array.isArray(obj.material)
    ) {
      const line = obj instanceof THREE.LineSegments,
        key = obj.material.uuid + (line ? "line" : "mesh");
      const geo = obj.geometry
        .clone()
        .applyMatrix4(
          new THREE.Matrix4().multiplyMatrices(inverse, obj.matrixWorld),
        );
      if (!batches.has(key))
        batches.set(key, { material: obj.material, geos: [], line });
      batches.get(key)!.geos.push(geo.index ? geo.toNonIndexed() : geo);
      remove.push(obj);
    }
    for (const c of obj.children) visit(c);
  };
  visit(root);
  remove.forEach((o) => o.removeFromParent());
  for (const { material, geos, line } of batches.values()) {
    const geo = mergeGeometries(geos);
    root.add(
      line
        ? new THREE.LineSegments(geo, material)
        : new THREE.Mesh(geo, material),
    );
    geos.forEach((g) => g.dispose());
  }
  return root;
}
