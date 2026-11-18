"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createServiceModel, type ServiceKind } from "./service-models";
import { disposeScene } from "./models";

type Diagnostic = {
  time: number;
  running: boolean;
  speed: number;
  motion: number;
  travel: number;
  trips: number;
  camera: number[];
  drawCalls: number;
  rootRotation: number[];
};
type ServiceWindow = Window & {
  __relayServices?: Partial<Record<ServiceKind, Diagnostic>>;
};

// Hover drive-through: the vehicle pulls away from the centre and leaves the
// card ahead of it (bottom right), then comes back in from behind (top left)
// and settles in the centre. Runs once per hover.
const DRIVE_OUT = 0.7; // seconds, accelerating away
const DRIVE_IN = 0.95; // seconds, decelerating back to rest
// Extra distance past the card edge, in normalised screen units, so outlines
// and bobbing never leave a sliver visible at the moment of the wrap.
const EDGE_MARGIN = 0.06;

type Trip = { t: number; exit: number; entry: number };

/**
 * Distances along +x at which the vehicle is fully outside the view: `exit`
 * (positive, leaving ahead) and `entry` (negative, arriving from behind).
 */
function tripBounds(
  travel: THREE.Group,
  camera: THREE.OrthographicCamera,
): Omit<Trip, "t"> {
  const saved = travel.position.x;
  travel.position.x = 0;
  travel.updateWorldMatrix(true, true);
  camera.updateMatrixWorld();
  const box = new THREE.Box3().setFromObject(travel);
  travel.position.x = saved;
  const ndc = new THREE.Box2();
  const v = new THREE.Vector3();
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        v.set(x, y, z).project(camera);
        ndc.expandByPoint(new THREE.Vector2(v.x, v.y));
      }
  // Screen shift per world unit of travel (orthographic, so it is linear).
  const o = new THREE.Vector3(0, 0, 0).project(camera),
    step = new THREE.Vector3(1, 0, 0).project(camera).sub(o);
  const edge = 1 + EDGE_MARGIN,
    exits: number[] = [],
    entries: number[] = [];
  if (step.x > 1e-6) {
    exits.push((edge - ndc.min.x) / step.x);
    entries.push((-edge - ndc.max.x) / step.x);
  }
  if (step.y < -1e-6) {
    exits.push((-edge - ndc.max.y) / step.y);
    entries.push((edge - ndc.min.y) / step.y);
  }
  return {
    exit: exits.length ? Math.min(...exits) : 20,
    entry: entries.length ? Math.max(...entries) : -20,
  };
}

function IllustrationWorld({
  kind,
  running,
  hovered,
}: {
  kind: ServiceKind;
  running: boolean;
  hovered: boolean;
}) {
  const model = useMemo(() => createServiceModel(kind), [kind]);
  const { camera, size, gl, invalidate } = useThree();
  const elapsed = useRef(0),
    speed = useRef(1),
    trip = useRef<Trip | null>(null),
    trips = useRef(0),
    wasHovered = useRef(false);
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    const target = new THREE.Vector3(...model.focal);
    cam.position.copy(target).add(new THREE.Vector3(11, 10, 14));
    cam.lookAt(target);
    cam.zoom = Math.min(
      size.width / model.span,
      size.height / (model.span * 0.85),
    );
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size, model, invalidate]);
  useEffect(() => {
    const win = window as ServiceWindow;
    win.__relayServices ??= {};
    if (win.__relayServices[kind]) win.__relayServices[kind]!.running = running;
    invalidate();
  }, [kind, running, invalidate]);
  useEffect(
    () => () => {
      disposeScene(model.root);
      delete (window as ServiceWindow).__relayServices?.[kind];
    },
    [model, kind],
  );
  useFrame((_, delta) => {
    const dt = running ? Math.min(delta, 0.05) : 0;
    speed.current = THREE.MathUtils.damp(
      speed.current,
      hovered ? 1.55 : 1,
      4,
      dt,
    );
    elapsed.current += dt * speed.current;

    // Start one drive-through when the pointer arrives; a trip already under
    // way is never restarted, and staying hovered does not repeat it.
    if (hovered && !wasHovered.current && running && !trip.current) {
      trip.current = {
        t: 0,
        ...tripBounds(model.travel, camera as THREE.OrthographicCamera),
      };
      trips.current += 1;
    }
    wasHovered.current = hovered;
    let offset = 0;
    const current = trip.current;
    if (current) {
      current.t += dt;
      if (current.t < DRIVE_OUT) {
        const k = current.t / DRIVE_OUT;
        offset = current.exit * k * k;
      } else if (current.t < DRIVE_OUT + DRIVE_IN) {
        const k = (current.t - DRIVE_OUT) / DRIVE_IN;
        offset = current.entry * (1 - k) ** 3;
      } else trip.current = null;
    }
    model.travel.position.x = offset;
    model.animate(elapsed.current, dt, speed.current);

    const win = window as ServiceWindow;
    win.__relayServices ??= {};
    win.__relayServices[kind] = {
      time: elapsed.current,
      running,
      speed: speed.current,
      motion: model.motion(),
      travel: offset,
      trips: trips.current,
      camera: camera.position.toArray(),
      drawCalls: gl.info.render.calls,
      rootRotation: model.root.rotation.toArray().slice(0, 3) as number[],
    };
  });
  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[-15, 30, 20]} intensity={1.5} />
      <primitive object={model.root} />
    </>
  );
}
export default function ServiceIllustration({
  kind,
  running,
  hovered,
}: {
  kind: ServiceKind;
  running: boolean;
  hovered: boolean;
}) {
  return (
    <Canvas
      orthographic
      frameloop={running ? "always" : "demand"}
      camera={{ position: [11, 10, 14], near: 0.1, far: 100, zoom: 35 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        // The ocean dolphin is clipped at the water line.
        gl.localClippingEnabled = true;
      }}
      fallback={
        <span className="service-webgl-fallback">
          Explore{" "}
          {kind === "road"
            ? "road transportation"
            : kind === "air"
              ? "air freight"
              : kind === "ocean"
                ? "ocean freight"
                : "drone delivery"}
          .
        </span>
      }
    >
      <IllustrationWorld kind={kind} running={running} hovered={hovered} />
    </Canvas>
  );
}
