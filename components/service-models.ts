import * as THREE from "three";
import { Model, C, batchStatic, cargo, label, truck } from "./models";

export type ServiceKind = "road" | "ocean" | "air" | "drone";
export type ServiceModel = {
  root: THREE.Group;
  animate: (time: number, delta: number, speed: number) => void;
  focal: [number, number, number];
  span: number;
  motion: () => number;
};
const shadowMaterial = new THREE.MeshBasicMaterial({
  color: "#d5d9d2",
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
});
const shellOutline = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { thickness: { value: 0.015 } },
  vertexShader:
    "uniform float thickness; void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*thickness,1.0);}",
  fragmentShader: "void main(){gl_FragColor=vec4(0.14,0.16,0.15,1.0);}",
});
function shadow(root: THREE.Group, width: number, depth: number, x = 0, z = 0) {
  const g = new THREE.CircleGeometry(1, 48);
  g.scale(width / 2, depth / 2, 1);
  const mesh = new THREE.Mesh(g, shadowMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.015, z);
  root.add(mesh);
  return mesh;
}
function smooth(
  m: Model,
  geo: THREE.BufferGeometry,
  color: string,
  pos: number[],
  rot: number[] = [0, 0, 0],
) {
  m.add(geo, color, pos, rot, false);
  m.group.add(new THREE.Mesh(geo.clone(), shellOutline));
}
function plan(
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
function tube(
  m: Model,
  a: number[],
  b: number[],
  radius: number,
  color = C.dark,
) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b),
    direction = end.clone().sub(start);
  const geo = new THREE.CylinderGeometry(radius, radius, direction.length(), 8);
  geo.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    ),
  );
  m.add(
    geo,
    color,
    start.add(end).multiplyScalar(0.5).toArray(),
    [0, 0, 0],
    false,
  );
}
const containerCache = new Map<string, THREE.Group>();
function container(color: string) {
  if (!containerCache.has(color)) {
    const m = new Model();
    m.box([1.68, 0.83, 1.02], [0, 0.415, 0], color);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++)
        m.box(
          [0.035, 0.73, 0.035],
          [-0.75 + i * 0.166, 0.415, side * 0.52],
          color,
        );
      m.box([1.72, 0.045, 0.045], [0, 0.07, side * 0.52], C.grey);
      m.box([1.72, 0.045, 0.045], [0, 0.77, side * 0.52], C.grey);
    }
    for (let i = 0; i < 7; i++)
      m.box([0.035, 0.02, 1.02], [-0.7 + i * 0.23, 0.845, 0], color);
    for (const z of [-0.25, 0.25])
      m.box([0.025, 0.69, 0.025], [0.855, 0.42, z], C.grey);
    containerCache.set(color, m.finish());
  }
  return containerCache.get(color)!.clone(true);
}
function road(): ServiceModel {
  const root = new THREE.Group(),
    vehicle = truck();
  batchStatic(vehicle, vehicle.userData.wheels);
  root.add(vehicle);
  vehicle.position.set(-0.25, 0.12, 0);
  const decor = new THREE.Group();
  for (const [x, z, size, red] of [
    [-3.2, 1.9, 0.8, 1],
    [-2.3, 2, 0.57, 0],
    [-2.8, -2.3, 0.6, 0],
  ]) {
    const b = cargo(size, size * 0.85, size, !!red);
    b.position.set(x, 0.03, z);
    decor.add(b);
  }
  root.add(batchStatic(decor));
  const lane = new Model();
  lane.box([16, 0.025, 3.2], [0, -0.035, 0], "#edf0e9", [0, 0, 0], false);
  for (const z of [-1.64, 1.64])
    lane.box([16, 0.015, 0.035], [0, -0.01, z], C.grey, [0, 0, 0], false);
  root.add(lane.finish());
  const marks = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const m = new Model();
    m.box(
      [0.9, 0.012, 0.06],
      [i * 1.8 - 7.2, 0.008, -1.35],
      C.white,
      [0, 0, 0],
      false,
    );
    marks.add(m.finish());
  }
  root.add(batchStatic(marks));
  return {
    root,
    focal: [0, 1.1, 0],
    span: 7.5,
    motion: () => vehicle.userData.wheels[0].rotation.z,
    animate(t, dt, speed) {
      vehicle.position.x = -0.25 + Math.sin(t * 0.55) * 0.13;
      vehicle.position.y = 0.12 + Math.sin(t * 7) * 0.012;
      vehicle.userData.wheels.forEach(
        (w: THREE.Group) => (w.rotation.z -= (dt * speed * 1.6) / 0.46),
      );
      marks.position.x = -((t * 1.6) % 1.8);
    },
  };
}
function ocean(): ServiceModel {
  const root = new THREE.Group(),
    ship = new THREE.Group(),
    m = new Model();
  const hull = [
    [-4.6, -1.05],
    [-4.6, 1.05],
    [2.5, 1.35],
    [3.9, 0.95],
    [4.7, 0],
    [3.9, -0.95],
    [2.5, -1.35],
  ];
  plan(
    m,
    hull.map(([x, z]) => [x * 0.97, z * 0.86]),
    0.33,
    0.1,
    C.red,
  );
  plan(m, hull, 0.68, 0.4, C.dark);
  plan(
    m,
    hull.map(([x, z]) => [x * 0.99, z * 0.98]),
    0.08,
    1.08,
    C.white,
  );
  plan(
    m,
    hull.map(([x, z]) => [x * 0.96, z * 0.9]),
    0.035,
    1.17,
    C.grey,
  );
  // Bridge, wheelhouse glazing, funnel, mast, safety rails, and mooring equipment.
  m.box([1.33, 1.16, 2.02], [-3.62, 1.77, 0], C.white);
  m.box([1.65, 0.67, 2.22], [-3.55, 2.67, 0], C.white);
  m.box([1.76, 0.1, 2.35], [-3.55, 3.04, 0], C.white);
  for (let i = 0; i < 4; i++) {
    m.box([0.015, 0.3, 0.35], [-2.712, 2.72, -0.76 + i * 0.51], C.glass);
    m.box([0.25, 0.3, 0.015], [-4.11 + i * 0.37, 2.72, 1.124], C.glass);
  }
  for (let i = 0; i < 3; i++)
    m.box([0.19, 0.26, 0.02], [-4.03 + i * 0.38, 1.98, 1.024], C.glass);
  m.box([0.62, 0.95, 0.7], [-4.12, 3.34, -0.42], C.red);
  m.box([0.67, 0.14, 0.76], [-4.12, 3.84, -0.42], C.dark);
  tube(m, [-3.2, 3.05, 0.1], [-3.2, 4, 0.1], 0.035);
  tube(m, [-3.7, 3.7, 0.1], [-2.7, 3.7, 0.1], 0.025);
  m.sphere(0.08, [-3.2, 4, 0.1], C.red);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const x = -4.4 + i * 0.56,
        z =
          (x < 2.5 ? 1.1 + (x + 4.4) * 0.033 : 1.35 - (x - 2.5) * 0.46) * side;
      tube(m, [x, 1.17, z], [x, 1.52, z], 0.018, C.grey);
      if (i < 13) {
        const nx = x + 0.56,
          nz =
            (nx < 2.5 ? 1.1 + (nx + 4.4) * 0.033 : 1.35 - (nx - 2.5) * 0.46) *
            side;
        tube(m, [x, 1.51, z], [nx, 1.51, nz], 0.019, C.grey);
      }
    }
    for (const x of [2.65, 3.25]) {
      m.cylinder(0.095, 0.15, [x, 1.3, side * 0.5], C.dark);
      m.cylinder(0.14, 0.035, [x, 1.39, side * 0.5], C.grey);
    }
  }
  ship.add(m.finish());
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 3; col++)
      for (let level = 0; level < (col === 2 ? 1 : 2); level++) {
        const color = [C.red, C.wall, C.deepRed][(row + col + level) % 3];
        const c = container(color);
        c.position.set(
          -1.9 + col * 1.78,
          1.2 + level * 0.86,
          row ? 0.56 : -0.56,
        );
        ship.add(c);
      }
  label(ship, "3 DAYA TERANG", [0, 0.74, 1.37], 2.45, 0.28, C.white);
  batchStatic(ship);
  root.add(ship);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({
      color: "#eef1ec",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(6.2, 2.75, 1);
  root.add(water);
  const waves: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) {
    const w = new Model();
    const x = -5.4 + (i % 3) * 3.6,
      z = i < 3 ? 1.85 : i < 6 ? -1.9 : 2.4;
    w.box(
      [i < 6 ? 1.9 : 1, 0.018, 0.035],
      [x, 0.025, z],
      i % 2 ? C.white : "#cdd5d0",
      [0, 0, 0],
      false,
    );
    const group = w.finish();
    root.add(group);
    waves.push(group);
  }
  return {
    root,
    focal: [0, 1.5, 0],
    span: 10.6,
    motion: () => waves[0].position.x,
    animate(t) {
      ship.position.y = Math.sin(t * 1.25) * 0.048;
      waves.forEach((w, i) => {
        w.position.x = Math.sin(t * 0.7 + i) * 0.23;
        w.position.z = Math.sin(t * 0.8 + i * 0.5) * 0.06;
      });
    },
  };
}
function airplane(): ServiceModel {
  const root = new THREE.Group(),
    aircraft = new THREE.Group(),
    m = new Model();
  const profile = [
    [0, -5.65],
    [0.12, -5.3],
    [0.28, -4.5],
    [0.5, -3.2],
    [0.64, -2],
    [0.66, 2.8],
    [0.58, 3.8],
    [0.41, 4.6],
    [0.17, 5.15],
    [0, 5.35],
  ].map(([r, x]) => new THREE.Vector2(r, x));
  smooth(
    m,
    new THREE.LatheGeometry(profile, 32),
    C.white,
    [0, 1.85, 0],
    [0, 0, -Math.PI / 2],
  );
  for (const side of [-1, 1]) {
    plan(
      m,
      [
        [1.1, side * 0.47],
        [-1.85, side * 5.05],
        [-3.05, side * 5.25],
        [-2.45, side * 1.1],
        [-2.4, side * 0.4],
      ],
      0.08,
      1.67,
      C.wall,
    );
    plan(
      m,
      [
        [-1.85, side * 5.05],
        [-2.2, side * 4.53],
        [-3.07, side * 4.58],
        [-3.05, side * 5.25],
      ],
      0.095,
      1.68,
      C.red,
    );
    plan(
      m,
      [
        [-3.8, side * 0.2],
        [-5.1, side * 2.3],
        [-5.8, side * 2.35],
        [-5.2, side * 0.2],
      ],
      0.065,
      2.02,
      C.white,
    );
    for (let i = 0; i < 12; i++)
      m.box(
        [0.2, 0.16, 0.025],
        [-2.2 + i * 0.46, 2.05, side * 0.635],
        C.glass,
        [0, 0, 0],
        false,
      );
    // Cockpit glass follows the nose taper.
    m.box([0.61, 0.22, 0.027], [4.02, 2.14, side * 0.47], C.glass, [
      0,
      side * 0.29,
      0,
    ]);
    m.box([0.32, 0.22, 0.025], [4.51, 2.12, side * 0.35], C.glass, [
      0,
      side * 0.55,
      0,
    ]);
    m.box([1.35, 0.69, 0.02], [-2.35, 1.7, side * 0.647], C.white);
    for (const x of [-2.87, -1.84])
      m.box([0.07, 0.15, 0.04], [x, 1.72, side * 0.672], C.grey);
    tube(m, [-1.7, 1.78, side * 1.12], [-2.8, 1.78, side * 4.8], 0.012, C.grey);
    m.box([0.27, 0.74, 0.12], [0.2, 1.35, side * 2.46], C.grey);
  }
  const fin = new THREE.Shape();
  fin.moveTo(-5.3, 1.97);
  fin.lineTo(-5.24, 4.04);
  fin.lineTo(-4.64, 4.12);
  fin.lineTo(-3.1, 2.1);
  fin.closePath();
  m.add(
    new THREE.ExtrudeGeometry(fin, { depth: 0.12, bevelEnabled: false }),
    C.red,
    [0, 0, -0.06],
  );
  const jets: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const z = side * 2.46,
      profile = [
        [0.27, -0.9],
        [0.42, -0.6],
        [0.47, 0.7],
        [0.43, 0.95],
      ].map(([r, x]) => new THREE.Vector2(r, x));
    smooth(
      m,
      new THREE.LatheGeometry(profile, 24),
      C.red,
      [0.1, 1.03, z],
      [0, 0, -Math.PI / 2],
    );
    m.cylinder(0.45, 0.105, [1.02, 1.03, z], C.white, [0, 0, Math.PI / 2], 24);
    m.cylinder(0.36, 0.11, [1.09, 1.03, z], C.dark, [0, 0, Math.PI / 2], 24);
    const fan = new Model();
    fan.cylinder(0.11, 0.15, [0.07, 0, 0], C.grey, [0, 0, Math.PI / 2], 16);
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9;
      fan.box(
        [0.035, 0.27, 0.075],
        [0.065, Math.cos(a) * 0.21, Math.sin(a) * 0.21],
        C.grey,
        [a + 0.45, 0, 0],
        false,
      );
    }
    const rotor = fan.finish();
    rotor.position.set(1.12, 1.03, z);
    jets.push(rotor);
    aircraft.add(rotor);
  }
  aircraft.add(m.finish());
  label(aircraft, "3 Daya Terang", [-0.2, 1.64, 0.672], 2.5, 0.38, C.red);
  batchStatic(aircraft, jets);
  root.add(aircraft);
  shadow(root, 8.2, 4.5, 0.3, 0.3);
  const slips = new THREE.Group();
  const sm = new Model();
  for (const [x, z] of [
    [3, 3.8],
    [4.4, -2.8],
    [-3, 3.7],
  ])
    sm.box([1, 0.015, 0.025], [x, 0.03, z], C.grey, [0, 0, 0], false);
  slips.add(sm.finish());
  root.add(slips);
  return {
    root,
    focal: [0, 1.7, 0],
    span: 10.3,
    motion: () => jets[0].rotation.x,
    animate(t, dt, speed) {
      aircraft.position.y = Math.sin(t * 1.15) * 0.09;
      aircraft.position.x = Math.sin(t * 0.45) * 0.1;
      jets.forEach((j) => (j.rotation.x += dt * speed * 6));
      slips.position.x = -Math.sin(t * 0.65) * 0.3;
    },
  };
}
function drone(): ServiceModel {
  const root = new THREE.Group(),
    drone = new THREE.Group(),
    m = new Model();
  m.cylinder(0.67, 0.24, [0, 2.45, 0], C.dark, [0, 0, 0], 32);
  m.cylinder(0.61, 0.28, [0, 2.65, 0], C.white, [0, 0, 0], 32);
  m.cylinder(0.49, 0.045, [0, 2.81, 0], C.red, [0, 0, 0], 32);
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++)
      if (x * x + z * z < 6)
        m.cylinder(
          0.025,
          0.012,
          [x * 0.12, 2.84, z * 0.12],
          C.dark,
          [0, 0, 0],
          6,
          false,
        );
  m.sphere(0.18, [0.51, 2.36, 0.05], C.dark);
  m.cylinder(0.1, 0.04, [0.67, 2.36, 0.05], C.glass, [0, 0, Math.PI / 2], 16);
  const rotors: THREE.Group[] = [];
  for (const x of [-1.48, 1.48])
    for (const z of [-1.48, 1.48]) {
      tube(m, [x * 0.25, 2.55, z * 0.25], [x, 2.53, z], 0.075, C.dark);
      tube(m, [x * 0.13, 2.38, z * 0.4], [x, 2.51, z], 0.043, C.grey);
      m.cylinder(0.17, 0.4, [x, 2.56, z], C.white, [0, 0, 0], 16);
      m.cylinder(0.19, 0.08, [x, 2.8, z], C.red, [0, 0, 0], 16);
      m.cylinder(0.09, 0.12, [x, 2.89, z], C.dark, [0, 0, 0], 16);
      const prop = new Model();
      const blade = [
        [0.05, -0.075],
        [0.83, -0.19],
        [1, -0.05],
        [0.29, 0.095],
        [-0.05, 0.075],
        [-0.83, 0.19],
        [-1, 0.05],
        [-0.29, -0.095],
      ];
      plan(prop, blade, 0.025, 0, C.dark);
      prop.cylinder(0.1, 0.04, [0, 0.03, 0], C.grey, [0, 0, 0], 16);
      const rotor = prop.finish();
      rotor.position.set(x, 2.94, z);
      drone.add(rotor);
      rotors.push(rotor);
    }
  // Two landing skids and a suspended parcel with a real sling.
  for (const z of [-0.54, 0.54]) {
    tube(m, [-0.39, 2.33, z * 0.6], [-0.56, 1.83, z], 0.035);
    tube(m, [0.39, 2.33, z * 0.6], [0.56, 1.83, z], 0.035);
    tube(m, [-0.7, 1.83, z], [0.7, 1.83, z], 0.045);
  }
  const parcel = cargo(1.2, 0.95, 1.05, true);
  parcel.position.set(0, 0.47, 0);
  drone.add(parcel);
  for (const x of [-0.4, 0.4])
    for (const z of [-0.36, 0.36])
      tube(m, [0, 2.29, 0], [x, 1.43, z], 0.018, C.dark);
  m.box([0.14, 0.015, 1.08], [0, 1.435, 0], C.white);
  m.box([1.23, 0.015, 0.14], [0, 1.44, 0], C.white);
  m.box([0.14, 0.98, 0.015], [0, 0.94, 0.535], C.white);
  drone.add(m.finish());
  batchStatic(drone, rotors);
  root.add(drone);
  const shade = shadow(root, 3.2, 2.5);
  return {
    root,
    focal: [0, 1.65, 0],
    span: 6.45,
    motion: () => rotors[0].rotation.y,
    animate(t, dt, speed) {
      drone.position.y = Math.sin(t * 1.65) * 0.12;
      drone.position.x = Math.sin(t * 0.7) * 0.035;
      rotors.forEach(
        (r, i) => (r.rotation.y += dt * speed * (i % 2 ? 1 : -1) * 11),
      );
      shade.scale.setScalar(1 - Math.sin(t * 1.65) * 0.035);
    },
  };
}
export function createServiceModel(kind: ServiceKind): ServiceModel {
  return { road, ocean, air: airplane, drone }[kind]();
}
