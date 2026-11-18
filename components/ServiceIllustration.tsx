"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { createServiceModel, type ServiceKind } from "./service-models";
import { disposeScene } from "./models";

/** Pointer position over the card art, normalised to -1..1 on each axis. */
export type PointerState = { x: number; y: number };

type Diagnostic = {
  time: number;
  running: boolean;
  speed: number;
  motion: number;
  depth: number;
  camera: number[];
  drawCalls: number;
  rootRotation: number[];
};
type ServiceWindow = Window & {
  __relayServices?: Partial<Record<ServiceKind, Diagnostic>>;
};

// How far the scene sinks into the card on hover: at full depth it is drawn
// at (1 - DEPTH) of its resting size, framed by the inner walls of the card.
const DEPTH = 0.28;
// How far the back of the recess follows the pointer, as a fraction of the
// card size. Must stay below DEPTH / 2 so the back never crosses the opening.
const PARALLAX = 0.07;
const WALLS = ["top", "right", "bottom", "left"] as const;

function IllustrationWorld({
  kind,
  running,
  hovered,
  pointer,
  frame,
}: {
  kind: ServiceKind;
  running: boolean;
  hovered: boolean;
  pointer: RefObject<PointerState>;
  frame: RefObject<SVGSVGElement | null>;
}) {
  const model = useMemo(() => createServiceModel(kind), [kind]);
  const { camera, size, gl, invalidate } = useThree();
  const elapsed = useRef(0),
    speed = useRef(1),
    depth = useRef(0),
    look = useRef({ x: 0, y: 0 }),
    drawn = useRef("");
  // Fixed isometric view; hover only dollies the camera sideways and zooms.
  const view = useMemo(() => {
    const target = new THREE.Vector3(...model.focal);
    const eye = target.clone().add(new THREE.Vector3(11, 10, 14));
    const forward = target.clone().sub(eye).normalize();
    const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const up = right.clone().cross(forward);
    return { target, eye, right, up };
  }, [model]);
  const baseZoom = Math.min(
    size.width / model.span,
    size.height / (model.span * 0.85),
  );
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.position.copy(view.eye);
    cam.lookAt(view.target);
    cam.zoom = baseZoom;
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, view, baseZoom, invalidate]);
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

    // Sink into the card on hover, rise back out on leave.
    let d = THREE.MathUtils.damp(depth.current, hovered ? 1 : 0, 4.5, dt);
    if (!hovered && d < 1e-3) d = 0;
    depth.current = d;
    const aim = pointer.current;
    look.current.x = THREE.MathUtils.damp(look.current.x, aim.x, 6, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, aim.y, 6, dt);
    // Offset of the recess centre, as a fraction of the card art size.
    const ox = look.current.x * PARALLAX * d,
      oy = look.current.y * PARALLAX * d,
      scale = 1 - DEPTH * d;
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = baseZoom * scale;
    cam.position
      .copy(view.eye)
      .addScaledVector(view.right, (-ox * size.width) / cam.zoom)
      .addScaledVector(view.up, (oy * size.height) / cam.zoom);
    cam.updateProjectionMatrix();

    // Inner walls drawn in the same frame as the scene so they stay locked.
    const svg = frame.current;
    const key = `${d.toFixed(4)}|${ox.toFixed(4)}|${oy.toFixed(4)}|${size.width}x${size.height}`;
    if (svg && key !== drawn.current) {
      drawn.current = key;
      const h = 50 * scale,
        cx = 50 + ox * 100,
        cy = 50 + oy * 100;
      const [l, r, t, b] = [cx - h, cx + h, cy - h, cy + h];
      const walls = {
        top: `0,0 100,0 ${r},${t} ${l},${t}`,
        right: `100,0 100,100 ${r},${b} ${r},${t}`,
        bottom: `0,100 100,100 ${r},${b} ${l},${b}`,
        left: `0,0 0,100 ${l},${b} ${l},${t}`,
      };
      // Soft shadow the top and left walls cast onto the back of the recess.
      const sy = ((18 * d) / size.height) * 100,
        sx = ((18 * d) / size.width) * 100;
      const shadows = {
        top: `${l},${t} ${r},${t} ${r},${t + sy} ${l + sx},${t + sy}`,
        left: `${l},${t} ${l + sx},${t + sy} ${l + sx},${b} ${l},${b}`,
      };
      svg.style.visibility = d > 0 ? "visible" : "hidden";
      for (const wall of WALLS)
        svg
          .querySelector(`[data-wall="${wall}"]`)
          ?.setAttribute("points", walls[wall]);
      for (const side of ["top", "left"] as const)
        svg
          .querySelector(`[data-shadow="${side}"]`)
          ?.setAttribute("points", shadows[side]);
      svg
        .querySelector("[data-edges]")
        ?.setAttribute(
          "d",
          `M${l},${t}H${r}V${b}H${l}Z M0,0L${l},${t} M100,0L${r},${t} M100,100L${r},${b} M0,100L${l},${b} M0,100H100`,
        );
    }

    const win = window as ServiceWindow;
    win.__relayServices ??= {};
    win.__relayServices[kind] = {
      time: elapsed.current,
      running,
      speed: speed.current,
      motion: model.motion(),
      depth: d,
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

/**
 * Inner walls of the recess the scene sinks into. Shaded to match the scene
 * light (upper left), so the top and left walls sit in shadow.
 */
function DepthFrame({
  kind,
  frame,
}: {
  kind: ServiceKind;
  frame: RefObject<SVGSVGElement | null>;
}) {
  const shades: Record<(typeof WALLS)[number], [string, string, string]> = {
    top: ["0 0 0 1", "#ecebe5", "#d7d9d3"],
    right: ["1 0 0 0", "#f8f7f2", "#e9eae4"],
    bottom: ["0 1 0 0", "#fcfbf6", "#eeeee8"],
    left: ["0 0 1 0", "#efeee8", "#dfe0da"],
  };
  return (
    <svg
      ref={frame}
      className="cargo-service-depth"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {WALLS.map((wall) => {
          const [x1, y1, x2, y2] = shades[wall][0].split(" ");
          return (
            <linearGradient
              key={wall}
              id={`depth-${kind}-${wall}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            >
              <stop offset="0" stopColor={shades[wall][1]} />
              <stop offset="1" stopColor={shades[wall][2]} />
            </linearGradient>
          );
        })}
        {(["top", "left"] as const).map((side) => (
          <linearGradient
            key={side}
            id={`depth-${kind}-shadow-${side}`}
            x2={side === "left" ? 1 : 0}
            y2={side === "top" ? 1 : 0}
          >
            <stop offset="0" stopColor="currentColor" stopOpacity="0.13" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {(["top", "left"] as const).map((side) => (
        <polygon
          key={side}
          data-shadow={side}
          points="0,0 0,0 0,0"
          fill={`url(#depth-${kind}-shadow-${side})`}
        />
      ))}
      {WALLS.map((wall) => (
        <polygon
          key={wall}
          data-wall={wall}
          points="0,0 0,0 0,0"
          fill={`url(#depth-${kind}-${wall})`}
        />
      ))}
      <path
        data-edges=""
        d="M0,0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function ServiceIllustration({
  kind,
  running,
  hovered,
  pointer,
}: {
  kind: ServiceKind;
  running: boolean;
  hovered: boolean;
  pointer: RefObject<PointerState>;
}) {
  const frame = useRef<SVGSVGElement>(null);
  return (
    <>
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
        <IllustrationWorld
          kind={kind}
          running={running}
          hovered={hovered}
          pointer={pointer}
          frame={frame}
        />
      </Canvas>
      <DepthFrame kind={kind} frame={frame} />
    </>
  );
}
