"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createJourneyModel, RIGHT, VIEW } from "./journey-model";
import { disposeScene } from "./models";

/** Place on the journey (see journey-timeline), and who to tell when it moves. */
export type JourneyProgress = { value: number; listeners: Set<() => void> };

type JourneyWindow = Window & {
  __relayJourney?: {
    x: number;
    s: number;
    zoom: number;
    near: number[];
    clock: number;
    drawCalls: number;
  };
};

const BACK = VIEW.clone().setLength(200);
/** The screen's up, on the ground plane's tilt. */
const UP = new THREE.Vector3(0, 1, 0)
  .addScaledVector(VIEW.clone().normalize(), -VIEW.clone().normalize().y)
  .normalize();

/**
 * How the camera frames the journey on a screen this size. The zoom stays
 * the same all the way; at a stop the text sits either side of the vehicle
 * (wide screens) or above and below it (narrow ones).
 */
function framing(width: number, height: number) {
  const narrow = width < 1000;
  return {
    /** World units across the screen. */
    across: width < 700 ? 22 : narrow ? 34 : 44,
    /** Vehicle raised above the middle at a stop, as a share of the height. */
    raise: narrow ? 0.05 : 0,
    height,
  };
}

function JourneyWorld({
  progress,
  running,
  reduced,
}: {
  progress: JourneyProgress;
  running: boolean;
  reduced: boolean;
}) {
  const model = useMemo(() => createJourneyModel(), []);
  const { camera, size, gl, invalidate } = useThree();
  const shown = useRef(progress.value),
    clock = useRef(0);
  useEffect(() => {
    const listener = () => invalidate();
    progress.listeners.add(listener);
    return () => {
      progress.listeners.delete(listener);
    };
  }, [progress, invalidate]);
  useEffect(() => invalidate(), [size, invalidate]);
  useEffect(
    () => () => {
      disposeScene(model.root);
      delete (window as JourneyWindow).__relayJourney;
    },
    [model],
  );
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = progress.value;
    // Eases after the scroll so the ride never jumps; reduced motion snaps.
    shown.current = reduced
      ? target
      : THREE.MathUtils.damp(shown.current, target, 5, dt);
    const moving = Math.abs(shown.current - target) > 0.0004;
    if (!moving) shown.current = target;
    if (running) clock.current += dt;
    const pose = model.pose(shown.current, clock.current, running ? dt : 0);

    // One zoom throughout: no closing in at the stops.
    const f = framing(size.width, size.height);
    const zoom = Math.min(size.width / f.across, size.height / 22);
    const near = Math.max(...pose.near);
    // Across the screen: the whole route's width stays in view while
    // travelling, and the vehicle is centred at a stop.
    const half = size.width / 2 / zoom;
    const loose = THREE.MathUtils.clamp(1 - (half - 7) / pose.half, 0, 1);
    const follow = THREE.MathUtils.lerp(loose, 1, near);
    const u = pose.target.dot(RIGHT);
    const centre = pose.target
      .clone()
      .addScaledVector(RIGHT, -(u - pose.mid) * (1 - follow))
      .addScaledVector(UP, -(f.raise * near * size.height) / zoom);
    const cam = camera as THREE.OrthographicCamera;
    cam.position.copy(centre).add(BACK);
    cam.lookAt(centre);
    cam.zoom = zoom;
    cam.updateProjectionMatrix();
    if (moving) invalidate();
    (window as JourneyWindow).__relayJourney = {
      x: shown.current,
      s: pose.s,
      zoom,
      near: pose.near,
      clock: clock.current,
      drawCalls: gl.info.render.calls,
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

/**
 * The services journey in 3D: a truck, a ship and a plane taking turns along
 * one winding route, driven by the scroll.
 */
export default function ServicesJourney({
  progress,
  running,
  reduced,
}: {
  progress: JourneyProgress;
  running: boolean;
  reduced: boolean;
}) {
  return (
    <Canvas
      orthographic
      frameloop={running ? "always" : "demand"}
      camera={{ position: BACK.toArray(), near: 1, far: 600, zoom: 20 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        // The dolphin by the ship is clipped at the water line.
        gl.localClippingEnabled = true;
      }}
      fallback={null}
    >
      <JourneyWorld progress={progress} running={running} reduced={reduced} />
    </Canvas>
  );
}
