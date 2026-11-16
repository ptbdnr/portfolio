/**
 * Directions, the camera and projection, shared by the renderer, the hotspots laid over it and
 * the sound. A direction is a yaw (degrees, 0 = the middle of a panorama, positive to the right)
 * and a pitch (degrees, positive up). In 3D: x to the right, y up, and -z straight ahead at yaw 0.
 */

export type Vec3 = [number, number, number]
export type Dir = { yaw: number; pitch: number }

export const DEG = Math.PI / 180

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const easeOut = (t: number) => 1 - (1 - t) ** 3

/** An angle in degrees, brought into (-180, 180]. */
export function wrap(deg: number) {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180
  return d === -180 ? 180 : d
}

/** The shortest signed turn from `from` to `to`, in degrees. */
export const turn = (from: number, to: number) => wrap(to - from)

/** Approaches `target` exponentially: `rate` is roughly how many times per second the gap shrinks by e. */
export const approach = (value: number, target: number, rate: number, dt: number) => target + (value - target) * Math.exp(-rate * dt)

export function dirToVec(yaw: number, pitch: number): Vec3 {
  const y = yaw * DEG
  const p = pitch * DEG
  return [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)]
}

export function vecToDir([x, y, z]: Vec3): Dir {
  const len = Math.hypot(x, y, z) || 1
  return { yaw: wrap(Math.atan2(x, -z) / DEG), pitch: Math.asin(clamp(y / len, -1, 1)) / DEG }
}

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1))

/** Angle between two directions, in degrees. */
export function angleBetween(a: Dir, b: Dir) {
  return Math.acos(clamp(dot(dirToVec(a.yaw, a.pitch), dirToVec(b.yaw, b.pitch)), -1, 1)) / DEG
}

/** Turns a vector about the vertical axis by `deg` (the same way yaw increases). */
export function rotateYaw([x, y, z]: Vec3, deg: number): Vec3 {
  const a = deg * DEG
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c - z * s, y, x * s + z * c]
}

/** Where the camera looks and how wide; `fov` spans the longer side of the screen. */
export type Camera = { yaw: number; pitch: number; roll: number; fov: number; width: number; height: number }

export type Basis = { right: Vec3; up: Vec3; fwd: Vec3; tanX: number; tanY: number; focal: number }

export function basis(cam: Camera): Basis {
  const fwd = dirToVec(cam.yaw, cam.pitch)
  const y = cam.yaw * DEG
  let right: Vec3 = [Math.cos(y), 0, Math.sin(y)]
  let up = cross(right, fwd)
  if (cam.roll) {
    const r = cam.roll * DEG
    const c = Math.cos(r)
    const s = Math.sin(r)
    ;[right, up] = [add(scale(right, c), scale(up, s)), sub(scale(up, c), scale(right, s))]
  }
  const t = Math.tan((cam.fov * DEG) / 2)
  const wide = cam.width >= cam.height
  const tanX = wide ? t : (t * cam.width) / cam.height
  const tanY = wide ? (t * cam.height) / cam.width : t
  return { right, up, fwd, tanX, tanY, focal: cam.width / 2 / tanX }
}

/** The vertical field of view (degrees) for a camera. */
export function verticalFov(cam: Camera) {
  return (2 * Math.atan(basis(cam).tanY)) / DEG
}

export type Projected = { x: number; y: number; depth: number; visible: boolean }

/** Screen position (CSS pixels) of a point or direction relative to the camera. */
export function projectVec(b: Basis, cam: Camera, v: Vec3): Projected {
  const cz = dot(v, b.fwd)
  if (cz <= 1e-4) return { x: 0, y: 0, depth: cz, visible: false }
  const x = cam.width / 2 + (dot(v, b.right) / cz) * b.focal
  const y = cam.height / 2 - (dot(v, b.up) / cz) * b.focal
  const margin = 80
  return { x, y, depth: cz, visible: x > -margin && x < cam.width + margin && y > -margin && y < cam.height + margin }
}

export const project = (b: Basis, cam: Camera, d: Dir) => projectVec(b, cam, dirToVec(d.yaw, d.pitch))

/** The direction through a point on the screen (CSS pixels). */
export function unproject(b: Basis, cam: Camera, x: number, y: number): Dir {
  const nx = ((x / cam.width) * 2 - 1) * b.tanX
  const ny = (1 - (y / cam.height) * 2) * b.tanY
  return vecToDir(add(add(scale(b.right, nx), scale(b.up, ny)), b.fwd))
}

/**
 * A CSS `matrix3d` that lays an element (w×h CSS pixels, transform-origin 0 0, placed at the top
 * left of the screen) flat on the ground, `distance` metres away towards `yaw`, its top edge pointing
 * that way. Null when any corner would be behind the camera (CSS can't draw that).
 */
export function groundMatrix(b: Basis, cam: Camera, yaw: number, distance: number, eye: number, w: number, h: number, metresPerPx: number) {
  const fwd = dirToVec(yaw, 0)
  const right: Vec3 = [Math.cos(yaw * DEG), 0, Math.sin(yaw * DEG)]
  const centre: Vec3 = [fwd[0] * distance, -eye, fwd[2] * distance]
  const U = scale(right, metresPerPx)
  const V = scale(fwd, -metresPerPx)
  const origin = sub(sub(centre, scale(U, w / 2)), scale(V, h / 2))
  for (const [cx, cy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ]) {
    if (dot(add(origin, add(scale(U, cx), scale(V, cy))), b.fwd) < 0.25) return null
  }
  // Camera-space coordinates are linear in (x, y, 1); screen = centre + focal * (c.xy / c.z).
  const col = (v: Vec3) => [dot(v, b.right), dot(v, b.up), dot(v, b.fwd)]
  const [ux, uy, uz] = col(U)
  const [vx, vy, vz] = col(V)
  const [ox, oy, oz] = col(origin)
  const W2 = cam.width / 2
  const H2 = cam.height / 2
  const f = b.focal
  // Rows: X·w, Y·w, z, w  (column-major for CSS).
  // prettier-ignore
  const m = [
    W2 * uz + f * ux, H2 * uz - f * uy, 0, uz,
    W2 * vz + f * vx, H2 * vz - f * vy, 0, vz,
    0, 0, 1, 0,
    W2 * oz + f * ox, H2 * oz - f * oy, 0, oz,
  ]
  return `matrix3d(${m.map((n) => +n.toFixed(6)).join(',')})`
}

/* ------------------------------------------------------------------ noise & randomness */

/** A small, fast seeded random number generator. */
export function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth 1D noise in [-1, 1]. */
export function noise1(x: number, seed = 0) {
  const i = Math.floor(x)
  const f = x - i
  const h = (n: number) => {
    const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453
    return (s - Math.floor(s)) * 2 - 1
  }
  const u = f * f * (3 - 2 * f)
  return h(i) * (1 - u) + h(i + 1) * u
}
