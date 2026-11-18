import type { ReactNode, SVGProps } from "react";

/**
 * Tiny isometric SVG drawing kit. Shapes are described in 3D world units and
 * projected with the same view direction as the WebGL scenes, so the icons
 * share their angle, ink outlines and light-from-the-upper-left shading
 * without needing a WebGL canvas each.
 */
type V3 = readonly [number, number, number];
type Pt = readonly [number, number];

const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3, k = 1): V3 => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
];
const fmt = (n: number) => +n.toFixed(3);

// Camera offset (11, 10, 14), as in ServiceIllustration and AboutScene.
const VIEW = unit([11, 10, 14]);
const RIGHT = unit([14, 0, -11]);
const UP = unit([-110, 317, -140]);
/** Pixels per world unit. */
const SCALE = 40;
const project = (p: V3): Pt => [SCALE * dot(p, RIGHT), -SCALE * dot(p, UP)];
/** Distance towards the camera, for back-to-front ordering. */
export const depth = (p: V3) => dot(p, VIEW);

/** Palette shared with `C` in models.ts (kept separate so three.js stays out of this bundle). */
export const ISO = {
  red: "#ed4135",
  deepRed: "#c8322a",
  white: "#fffdf8",
  wall: "#e7e7e2",
  grey: "#c9ccca",
  dark: "#272a2b",
  ink: "#242827",
};
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  return `#${[n >> 16, (n >> 8) & 255, n & 255]
    .map((c) =>
      Math.round(Math.min(255, c * f))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
/** Thin ink line that keeps its width however the face is skewed. */
export const inkLine = {
  stroke: ISO.ink,
  strokeWidth: 1.3,
  strokeLinejoin: "round",
  strokeLinecap: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

// Visible faces of an axis-aligned box and how lit they are.
type Face = "top" | "front" | "side";
const LIGHT: Record<Face, number> = { top: 1, front: 0.9, side: 0.76 };
/** Draws 2D content on a face; receives the face size in world units. */
type Decal = (size: [number, number]) => ReactNode;

export class IsoDrawing {
  private nodes: ReactNode[] = [];
  private points: Pt[] = [];

  private push(node: (key: number) => ReactNode, pts: Pt[]) {
    this.points.push(...pts);
    this.nodes.push(node(this.nodes.length));
  }
  private poly(pts: V3[], props: SVGProps<SVGPolygonElement>) {
    const p = pts.map(project);
    this.push(
      (key) => (
        <polygon
          key={key}
          points={p.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" ")}
          {...props}
        />
      ),
      p,
    );
  }
  /** Maps 2D content (world units, v pointing down the face) onto a plane. */
  private decal(origin: V3, u: V3, v: V3, content: ReactNode) {
    const [e, f] = project(origin),
      [a, b] = project(u),
      [c, d] = project(v);
    this.push(
      (key) => (
        <g
          key={key}
          transform={`matrix(${[a, b, c, d, e, f].map(fmt).join(" ")})`}
        >
          {content}
        </g>
      ),
      [],
    );
  }
  /** Flat polygon in 3D, filled and outlined. */
  flat(pts: V3[], fill: string) {
    this.poly(pts, { fill, ...inkLine });
    return this;
  }
  /** Soft contact shadow on the ground. */
  shadow(cx: number, cz: number, rx: number, rz: number) {
    const pts = Array.from({ length: 48 }, (_, i): V3 => {
      const t = (i / 48) * Math.PI * 2;
      return [cx + Math.cos(t) * rx, 0, cz + Math.sin(t) * rz];
    });
    this.poly(pts, { fill: "#e2e4dc" });
    return this;
  }
  /** Axis-aligned box: the three faces turned to the camera, with decals. */
  box(
    min: V3,
    size: V3,
    color: string,
    decals: Partial<Record<Face, Decal>> = {},
  ) {
    const [x0, y0, z0] = min,
      [w, h, d] = size;
    const x1 = x0 + w,
      y1 = y0 + h,
      z1 = z0 + d;
    const faces: [Face, V3, V3, V3, number, number][] = [
      ["top", [x0, y1, z0], [1, 0, 0], [0, 0, 1], w, d],
      ["front", [x0, y1, z1], [1, 0, 0], [0, -1, 0], w, h],
      ["side", [x1, y1, z1], [0, 0, -1], [0, -1, 0], d, h],
    ];
    for (const [face, o, u, v, lu, lv] of faces) {
      const corners = [
        o,
        add(o, u, lu),
        add(add(o, u, lu), v, lv),
        add(o, v, lv),
      ];
      // Fill, then decal, then outline, so decals never hide the edges.
      this.poly(corners, { fill: shade(color, LIGHT[face]) });
      const decal = decals[face];
      if (decal) this.decal(o, u, v, decal([lu, lv]));
      this.poly(corners, { fill: "none", ...inkLine });
    }
    return this;
  }
  /** Open path through 3D points. */
  path(pts: V3[], props: SVGProps<SVGPathElement>) {
    const p = pts.map(project);
    this.push(
      (key) => (
        <path
          key={key}
          d={`M${p.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}`}
          fill="none"
          {...props}
        />
      ),
      p,
    );
    return this;
  }
  /** Screen-facing content anchored at a 3D point; extent is [l, t, r, b] in px. */
  billboard(
    at: V3,
    extent: [number, number, number, number],
    content: ReactNode,
  ) {
    const [x, y] = project(at);
    this.push(
      (key) => (
        <g key={key} transform={`translate(${fmt(x)} ${fmt(y)})`}>
          {content}
        </g>
      ),
      [
        [x + extent[0], y + extent[1]],
        [x + extent[2], y + extent[3]],
      ],
    );
    return this;
  }
  /** The finished drawing, sized 1:1 in px with a small margin. */
  svg() {
    const pad = 5;
    const xs = this.points.map((p) => p[0]),
      ys = this.points.map((p) => p[1]);
    const x = Math.floor(Math.min(...xs) - pad),
      y = Math.floor(Math.min(...ys) - pad);
    const w = Math.ceil(Math.max(...xs) + pad - x),
      h = Math.ceil(Math.max(...ys) + pad - y);
    return (
      <svg
        viewBox={`${x} ${y} ${w} ${h}`}
        width={w}
        height={h}
        aria-hidden="true"
        focusable="false"
      >
        {this.nodes}
      </svg>
    );
  }
}
