"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createAboutModel } from "./about-model";
import { disposeScene } from "./models";
import { fitOrthographic, screenRects, toCanvas } from "./scene-frame";

type AboutWindow = Window & {
  __relayAbout?: {
    time: number;
    running: boolean;
    workerX: number;
    carrying: boolean;
    camera: number[];
    drawCalls: number;
    /** Truck roof corners in canvas CSS pixels. */
    roof: number[][];
    /** Screen rectangles [left, top, right, bottom] of the main pieces. */
    parts: Record<string, number[]>;
  };
};

// Same isometric view direction as the service cards.
const VIEW = new THREE.Vector3(11, 10, 14);
const PADDING = 0.06;

function AboutWorld({ running }: { running: boolean }) {
  const model = useMemo(() => createAboutModel(), []);
  const { camera, size, gl, invalidate } = useThree();
  const elapsed = useRef(0);
  useEffect(() => {
    // Fit the truck, the parcels and the worker's path to the canvas.
    fitOrthographic(
      camera as THREE.OrthographicCamera,
      VIEW,
      model.bounds,
      size,
      PADDING,
    );
    invalidate();
  }, [camera, size, model, invalidate]);
  useEffect(() => {
    invalidate();
  }, [running, invalidate]);
  useEffect(
    () => () => {
      disposeScene(model.root);
      delete (window as AboutWindow).__relayAbout;
    },
    [model],
  );
  useFrame((_, delta) => {
    if (running) elapsed.current += Math.min(delta, 0.05);
    model.animate(elapsed.current);
    (window as AboutWindow).__relayAbout = {
      time: elapsed.current,
      running,
      ...model.state(),
      camera: camera.position.toArray(),
      drawCalls: gl.info.render.calls,
      roof: model.roof.map((p) => toCanvas(p, camera, size)),
      parts: screenRects(model.parts, camera, size),
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

export default function AboutScene({ running }: { running: boolean }) {
  return (
    <Canvas
      orthographic
      frameloop={running ? "always" : "demand"}
      camera={{ position: VIEW.toArray(), near: 0.1, far: 100, zoom: 40 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      fallback={
        <span className="company-scene-fallback">
          Truk 3 Daya Terang siap memuat kiriman Anda.
        </span>
      }
    >
      <AboutWorld running={running} />
    </Canvas>
  );
}
