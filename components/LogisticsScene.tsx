"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  C,
  batchStatic,
  cargo,
  disposeScene,
  forklift,
  ground,
  person,
  props,
  truck,
  warehouse,
} from "./models";

const ease = (v: number) => v * v * (3 - 2 * v);
function travel(
  t: number,
  phase: number,
  start: number,
  stop: number,
  end: number,
) {
  const p = (t + phase) % 48;
  if (p < 17) return THREE.MathUtils.lerp(start, stop, ease(p / 17));
  if (p < 23) return stop;
  return THREE.MathUtils.lerp(stop, end, ease((p - 23) / 25));
}
function World({ paused, onReady }: { paused: boolean; onReady: () => void }) {
  const { camera, size, gl } = useThree();
  const clock = useRef(0);
  const scene = useMemo(() => {
    const root = new THREE.Group();
    root.add(ground(), batchStatic(props()));
    const hub = warehouse();
    batchStatic(hub, hub.userData.doors);
    hub.position.set(9, 0, -2.5);
    root.add(hub);
    const trucks = [truck(), truck(true), truck()];
    trucks[0].position.set(-10, 0, 5);
    trucks[1].position.set(0, 0, 8);
    trucks[1].rotation.y = Math.PI;
    trucks[2].scale.setScalar(0.74);
    trucks[2].rotation.y = -Math.PI / 2;
    trucks[2].position.set(12.65, 0, 0.3);
    trucks.forEach((t) => {
      batchStatic(t, t.userData.wheels);
      root.add(t);
    });
    const lifts = [forklift(), forklift()];
    lifts[0].position.set(0, 0, -1);
    lifts[1].position.set(6, 0, 1);
    lifts[1].scale.setScalar(0.8);
    lifts.forEach((f) => {
      batchStatic(f.userData.lift);
      batchStatic(f, [...f.userData.wheels, f.userData.lift]);
      root.add(f);
    });
    const workers = [person(), person(), person(false), person()];
    workers.forEach((p) => {
      batchStatic(p, p.userData.legs);
      root.add(p);
    });
    const parcels = Array.from({ length: 4 }, (_, i) => {
      const b = cargo(0.46, 0.4, 0.48, i % 2 === 0);
      root.add(b);
      return b;
    });
    return { root, hub, trucks, lifts, workers, parcels };
  }, []);
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    const mobile = size.width < 700;
    cam.zoom = mobile ? size.width / 29 : size.width / 34;
    const target = new THREE.Vector3(mobile ? 0.7 : 0, 2, mobile ? 1 : 0);
    cam.position.copy(target).add(new THREE.Vector3(27, 27, 34));
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  useEffect(() => {
    onReady();
    return () => disposeScene(scene.root);
  }, [scene, onReady]);
  useFrame((_, delta) => {
    if (!paused) clock.current += Math.min(delta, 0.05);
    const t = clock.current;
    const { trucks, lifts, workers, hub, parcels } = scene;
    [0, 1].forEach((i) => {
      const obj = trucks[i];
      const old = obj.position.x;
      obj.position.x =
        i === 0 ? travel(t, 14, -43, -6, 44) : travel(t, 30, 44, 1, -44);
      const dx = obj.position.x - old;
      (obj.userData.wheels as THREE.Group[]).forEach(
        (w) => (w.rotation.z -= (i === 0 ? dx : -dx) / 0.46),
      );
    });
    const dock = trucks[2],
      old = dock.position.z;
    const p = (t + 12) % 58;
    dock.position.z =
      p < 19
        ? THREE.MathUtils.lerp(24, 0.5, ease(p / 19))
        : p < 38
          ? 0.5
          : THREE.MathUtils.lerp(0.5, 24, ease((p - 38) / 20));
    (dock.userData.wheels as THREE.Group[]).forEach(
      (w) => (w.rotation.z += (dock.position.z - old) / 0.34),
    );
    lifts.forEach((f, i) => {
      const phase = (t * 0.21 + i * Math.PI) % (Math.PI * 2);
      const x = (i ? 3.5 : -2.6) + Math.cos(phase) * (i ? 1.4 : 2.4);
      const z = (i ? 0.6 : -3.6) + Math.sin(phase) * 0.7;
      const dx = x - f.position.x,
        dz = z - f.position.z;
      f.position.set(x, 0, z);
      f.rotation.y = Math.atan2(
        -Math.cos(phase) * 0.7,
        -Math.sin(phase) * (i ? 1.4 : 2.4),
      );
      f.userData.wheels.forEach(
        (w: THREE.Group) => (w.rotation.z -= Math.hypot(dx, dz) / 0.3),
      );
      f.userData.lift.position.y = 0.13 + (Math.sin(phase * 2) + 1) * 0.18;
    });
    workers.forEach((w, i) => {
      const phase = t * 0.26 + i * 1.6;
      const cx = [-5.5, 0.1, 7.3, 2][i],
        cz = [0.8, 2.4, -1.3, 10.6][i];
      const x = cx + Math.sin(phase) * 1.35,
        z = cz + Math.cos(phase) * 0.45;
      w.position.set(x, Math.abs(Math.sin(t * 5 + i)) * 0.017, z);
      w.rotation.y = Math.atan2(
        Math.cos(phase) * 1.35,
        -Math.sin(phase) * 0.45,
      );
      w.userData.legs.forEach(
        (leg: THREE.Group, j: number) =>
          (leg.rotation.x = Math.sin(t * 5 + i + j * Math.PI) * 0.42),
      );
    });
    (hub.userData.doors as THREE.Group[]).forEach((door, i) => {
      const p = (t + i * 8) % 30;
      const open =
        p < 5 ? ease(p / 5) : p < 20 ? 1 : p < 25 ? 1 - ease((p - 20) / 5) : 0;
      const dockPhase = (t + 12) % 58;
      const dockOpen =
        dockPhase < 5
          ? ease(dockPhase / 5)
          : dockPhase < 40
            ? 1
            : dockPhase < 46
              ? 1 - ease((dockPhase - 40) / 6)
              : 0;
      door.scale.y = 1 - (i === 2 ? dockOpen : open) * 0.86;
    });
    parcels.forEach((b, i) => {
      const p = (t * 0.13 + i * 0.25) % 1;
      b.position.set(5.35, 0.23, -3.6 + p * 2);
      b.scale.setScalar(Math.min(1, p * 12, (1 - p) * 12));
    });
    // Small diagnostics for repeatable browser checks; no React state updates in the render loop.
    if (typeof window !== "undefined")
      Object.assign(window, {
        __relayScene: {
          time: t,
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          truckX: trucks[0].position.x,
          forkliftX: lifts[0].position.x,
          workerX: workers[0].position.x,
          doorScale: hub.userData.doors[0].scale.y,
          wheelRotation: trucks[0].userData.wheels[0].rotation.z,
          camera: camera.position.toArray(),
          paused,
        },
      });
  });
  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[-15, 30, 20]} intensity={1.5} />
      <primitive object={scene.root} />
    </>
  );
}
export default function LogisticsScene({
  paused,
  onReady,
}: {
  paused: boolean;
  onReady: () => void;
}) {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("webgl2");
    if (!ctx) setSupported(false);
    else ctx.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  if (!supported)
    return (
      <div className="scene-unavailable">
        <span className="eyebrow">GOOD THINGS ARE ON THE WAY</span>
        <p>Explore a connected approach to logistics below.</p>
        <small>The animated illustration requires WebGL 2.</small>
      </div>
    );
  return (
    <Canvas
      frameloop={paused ? "demand" : "always"}
      orthographic
      camera={{ near: 0.1, far: 200, position: [27, 27, 34], zoom: 35 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: C.ground }}
    >
      <World paused={paused} onReady={onReady} />
    </Canvas>
  );
}
