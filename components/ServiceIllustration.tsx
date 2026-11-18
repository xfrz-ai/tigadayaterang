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
  camera: number[];
  drawCalls: number;
  rootRotation: number[];
};
type ServiceWindow = Window & {
  __relayServices?: Partial<Record<ServiceKind, Diagnostic>>;
};
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
    speed = useRef(1);
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
    model.animate(elapsed.current, dt, speed.current);
    const win = window as ServiceWindow;
    win.__relayServices ??= {};
    win.__relayServices[kind] = {
      time: elapsed.current,
      running,
      speed: speed.current,
      motion: model.motion(),
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
