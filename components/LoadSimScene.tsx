"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Item, LoadPlan, VehicleKind } from "./load-sim-data";
import { createLoadSimModel, type SimStatus } from "./load-sim-model";
import { disposeScene } from "./models";
import { fitOrthographic, screenRects } from "./scene-frame";

type SimWindow = Window & {
  __relaySim?: SimStatus & {
    running: boolean;
    reduced: boolean;
    camera: number[];
    drawCalls: number;
    /** Screen rectangles [left, top, right, bottom] of the framed pieces. */
    parts: Record<string, number[]>;
  };
};

// Same isometric view direction as the other scenes.
const VIEW = new THREE.Vector3(11, 10, 14);
const PADDING = 0.04;
/** Past the canvas edge, in normalised screen units, before a vehicle counts as gone. */
const EDGE = 1.06;

/**
 * Distances along +x at which a parked vehicle is fully off the canvas:
 * `entry` behind it (negative, where it drives in from) and `exit` ahead.
 */
function travelLimits(vehicle: THREE.Object3D, camera: THREE.Camera) {
  const saved = vehicle.position.x;
  vehicle.position.x = 0;
  vehicle.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(vehicle);
  vehicle.position.x = saved;
  vehicle.updateWorldMatrix(true, true);
  camera.updateMatrixWorld();
  const ndc = new THREE.Box2(),
    p = new THREE.Vector3();
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        p.set(x, y, z).project(camera);
        ndc.expandByPoint(new THREE.Vector2(p.x, p.y));
      }
  const o = new THREE.Vector3().project(camera),
    step = new THREE.Vector3(1, 0, 0).project(camera).sub(o);
  // Heading +x moves right and down the screen; take whichever edge is crossed first.
  const exit = Math.min((EDGE - ndc.min.x) / step.x, (-EDGE - ndc.max.y) / step.y);
  const entry = Math.max((-EDGE - ndc.max.x) / step.x, (EDGE - ndc.min.y) / step.y);
  return { entry, exit };
}

type Props = {
  vehicle: VehicleKind | null;
  items: readonly Item[];
  plan: LoadPlan | null;
  /** On screen, tab visible, motion allowed. */
  running: boolean;
  /** Reduced motion: every change jumps straight to its end. */
  reduced: boolean;
  onStatus: (status: SimStatus) => void;
};

function SimWorld({ vehicle, items, plan, running, reduced, onStatus }: Props) {
  const model = useMemo(() => createLoadSimModel(), []);
  const { camera, size, gl, invalidate } = useThree();
  const reported = useRef("");
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    fitOrthographic(cam, VIEW, model.bounds, size, PADDING);
    const { entry, exit } = travelLimits(model.measure, cam);
    model.setTravel(entry, exit);
    invalidate();
  }, [camera, size, model, invalidate]);
  useEffect(() => {
    model.sync(vehicle, items, plan);
    invalidate();
  }, [model, vehicle, items, plan, invalidate]);
  useEffect(() => {
    invalidate();
  }, [running, reduced, invalidate]);
  useEffect(
    () => () => {
      model.dispose();
      disposeScene(model.root);
      delete (window as SimWindow).__relaySim;
    },
    [model],
  );
  useFrame((_, delta) => {
    if (reduced) model.settle();
    else if (running) model.step(Math.min(delta, 0.05));
    // Rendering is on demand: keep drawing only while something moves.
    if (running && !reduced && model.busy()) invalidate();
    const status = model.status();
    const key = `${status.vehicle}|${status.phase}|${status.moving > 0}|${status.hidden}`;
    if (key !== reported.current) {
      reported.current = key;
      onStatus(status);
    }
    (window as SimWindow).__relaySim = {
      ...status,
      running,
      reduced,
      camera: camera.position.toArray(),
      drawCalls: gl.info.render.calls,
      parts: screenRects(model.parts(), camera, size),
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

export default function LoadSimScene(props: Props) {
  return (
    <Canvas
      orthographic
      frameloop="demand"
      camera={{ position: VIEW.toArray(), near: 0.1, far: 100, zoom: 40 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      fallback={
        <span className="loadsim-fallback">
          Simulasi 3D membutuhkan WebGL. Panel di samping tetap menghitung
          muatan Anda.
        </span>
      }
    >
      <SimWorld {...props} />
    </Canvas>
  );
}
