import * as THREE from "three";

type Size = { width: number; height: number };

/**
 * Aims an orthographic camera from `offset` and pans and zooms it so every
 * box fits the canvas. Each box is measured on screen separately, so the empty
 * corners of one combined world box do not shrink the picture.
 */
export function fitOrthographic(
  cam: THREE.OrthographicCamera,
  offset: THREE.Vector3,
  bounds: THREE.Box3[],
  size: Size,
  padding: number,
) {
  const center = bounds[0].getCenter(new THREE.Vector3());
  cam.position.copy(center).add(offset);
  cam.lookAt(center);
  cam.updateMatrixWorld();
  const view = new THREE.Box3();
  for (const { min, max } of bounds)
    for (const x of [min.x, max.x])
      for (const y of [min.y, max.y])
        for (const z of [min.z, max.z])
          view.expandByPoint(
            new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse),
          );
  const mid = view.getCenter(new THREE.Vector3());
  cam.position
    .addScaledVector(
      new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0),
      mid.x,
    )
    .addScaledVector(
      new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1),
      mid.y,
    );
  cam.zoom = Math.min(
    size.width / ((view.max.x - view.min.x) * (1 + padding)),
    size.height / ((view.max.y - view.min.y) * (1 + padding)),
  );
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

/** Projects a world point to canvas CSS pixels. */
export function toCanvas(p: THREE.Vector3, camera: THREE.Camera, size: Size) {
  const v = p.clone().project(camera);
  return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
}

/** Screen rectangles [left, top, right, bottom] of objects, for layout checks. */
export function screenRects(
  parts: Record<string, THREE.Object3D>,
  camera: THREE.Camera,
  size: Size,
) {
  const box = new THREE.Box3();
  return Object.fromEntries(
    Object.entries(parts).map(([name, part]) => {
      box.setFromObject(part);
      const r = [Infinity, Infinity, -Infinity, -Infinity];
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            const [px, py] = toCanvas(new THREE.Vector3(x, y, z), camera, size);
            r[0] = Math.min(r[0], px);
            r[1] = Math.min(r[1], py);
            r[2] = Math.max(r[2], px);
            r[3] = Math.max(r[3], py);
          }
      return [name, r.map(Math.round)];
    }),
  );
}
