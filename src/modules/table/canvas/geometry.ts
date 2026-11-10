import type { Camera, Drawing, Point, Scene, Token } from "../types";
export function clientToCanvas(
  client: Point,
  bounds: Pick<DOMRect, "left" | "top" | "right">,
  rotated: boolean,
): Point {
  return rotated
    ? [client[1] - bounds.top, bounds.right - client[0]]
    : [client[0] - bounds.left, client[1] - bounds.top];
}
export type Pinch = { camera: Camera; center: Point; distance: number };
export function beginPinch(camera: Camera, a: Point, b: Point): Pinch {
  return {
    camera: { ...camera },
    center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    distance: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
  };
}
export function pinchCamera(pinch: Pinch, a: Point, b: Point): Camera {
  const anchor = screenToWorld(pinch.center, pinch.camera);
  const scale = Math.min(
    4,
    Math.max(
      0.1,
      (pinch.camera.scale * Math.hypot(a[0] - b[0], a[1] - b[1])) /
        pinch.distance,
    ),
  );
  return {
    x: (a[0] + b[0]) / 2 - anchor[0] * scale,
    y: (a[1] + b[1]) / 2 - anchor[1] * scale,
    scale,
  };
}
export function screenToWorld(point: Point, camera: Camera): Point {
  return [
    (point[0] - camera.x) / camera.scale,
    (point[1] - camera.y) / camera.scale,
  ];
}
export function snapPoint(point: Point, scene: Scene, snap: boolean): Point {
  if (!snap) return point;
  const x = point[0] - scene.grid_x,
    y = point[1] - scene.grid_y,
    s = scene.grid_size;
  if (scene.grid_type === "square")
    return [
      Math.round(x / s) * s + scene.grid_x,
      Math.round(y / s) * s + scene.grid_y,
    ];
  const radius = s / 2,
    q = ((2 / 3) * x) / radius,
    r = (-x / 3 + (Math.sqrt(3) / 3) * y) / radius;
  let cx = Math.round(q),
    cz = Math.round(r);
  const cy = Math.round(-q - r),
    dx = Math.abs(cx - q),
    dy = Math.abs(cy + q + r),
    dz = Math.abs(cz - r);
  if (dx > dy && dx > dz) cx = -cy - cz;
  else if (dz > dy) cz = -cx - cy;
  return [
    radius * 1.5 * cx + scene.grid_x,
    radius * Math.sqrt(3) * (cz + cx / 2) + scene.grid_y,
  ];
}
export function snapToken(
  point: Point,
  size: number,
  scene: Scene,
  snap: boolean,
): Point {
  if (!snap || scene.grid_type === "square")
    return snapPoint(point, scene, snap);
  const half = (size * scene.grid_size) / 2,
    center = snapPoint([point[0] + half, point[1] + half], scene, true);
  return [center[0] - half, center[1] - half];
}
export function drawingBounds(
  drawing: Pick<Drawing, "points" | "tool" | "text" | "width">,
) {
  const xs = drawing.points.map((p) => p[0]),
    ys = drawing.points.map((p) => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width:
      Math.max(...xs) -
      Math.min(...xs) +
      (drawing.tool === "text"
        ? Math.max(30, drawing.text.length * (16 + drawing.width * 2) * 0.55)
        : 0),
    height:
      Math.max(...ys) -
      Math.min(...ys) +
      (drawing.tool === "text" ? 24 + drawing.width * 2 : 0),
  };
}
export function hitToken(point: Point, tokens: Token[], scene: Scene) {
  return [...tokens].reverse().find((t) => {
    const size = t.size * scene.grid_size;
    return (
      point[0] >= t.x &&
      point[0] <= t.x + size &&
      point[1] >= t.y &&
      point[1] <= t.y + size
    );
  });
}
export function hitDrawing(
  point: Point,
  drawings: Drawing[],
  tolerance: number,
) {
  return [...drawings].reverse().find((d) => {
    const b = drawingBounds(d);
    return (
      point[0] >= b.x - tolerance &&
      point[0] <= b.x + b.width + tolerance &&
      point[1] >= b.y - tolerance &&
      point[1] <= b.y + b.height + tolerance
    );
  });
}
export function fitCamera(width: number, height: number, scene: Scene): Camera {
  const scale = Math.max(
    0.1,
    Math.min(
      2,
      (width - 80) / scene.map_width,
      (height - 80) / scene.map_height,
    ),
  );
  return {
    x: width / 2 - (scene.map_x + scene.map_width / 2) * scale,
    y: height / 2 - (scene.map_y + scene.map_height / 2) * scale,
    scale,
  };
}
