"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createContactModel } from "./contact-model";
import { disposeScene } from "./models";
import { fitOrthographic, screenRects } from "./scene-frame";

type ContactWindow = Window & {
  __relayContact?: {
    time: number;
    running: boolean;
    camera: number[];
    drawCalls: number;
    /** Screen rectangles [left, top, right, bottom] of the main pieces. */
    parts: Record<string, number[]>;
  };
};

// Same isometric view direction as the other scenes.
const VIEW = new THREE.Vector3(11, 10, 14);
const PADDING = 0.06;

function ContactWorld({ running }: { running: boolean }) {
  const model = useMemo(() => createContactModel(), []);
  const { camera, size, gl, invalidate } = useThree();
  const elapsed = useRef(0);
  useEffect(() => {
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
      delete (window as ContactWindow).__relayContact;
    },
    [model],
  );
  useFrame((_, delta) => {
    if (running) elapsed.current += Math.min(delta, 0.05);
    model.animate(elapsed.current);
    (window as ContactWindow).__relayContact = {
      time: elapsed.current,
      running,
      camera: camera.position.toArray(),
      drawCalls: gl.info.render.calls,
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

export default function ContactScene({ running }: { running: boolean }) {
  return (
    <Canvas
      orthographic
      frameloop={running ? "always" : "demand"}
      camera={{ position: VIEW.toArray(), near: 0.1, far: 100, zoom: 40 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <ContactWorld running={running} />
    </Canvas>
  );
}
