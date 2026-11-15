import { css, hex, mix } from './color.ts'
import { clamp, smoothstep } from './math.ts'
import { pline } from './rig.ts'
import { ABSEIL, BIKER, CLIMBER, CLIMB_TORSO, HANG, LEAP, SCRAMBLER, SURFER, bake, type Sprite } from './sprites.ts'
import type { View } from './view.ts'
import { WORLD_LEN, Z } from './world.ts'

export type ClimberMode =
  | 'surf'
  | 'snorkel'
  | 'beach'
  | 'bike'
  | 'hike'
  | 'climb'
  | 'scramble'
  | 'abseil'
  | 'ski'
  | 'alpine'
  | 'leap'
  | 'hang'
  | 'victory'
  | 'hidden'

export type ClimberView = {
  mode: ClimberMode
  /** World x of the feet (or the bike's bottom bracket). */
  x: number
  /** Screen y of the feet / waterline. */
  y: number
  dir: 1 | -1
  dist: number
  moving: boolean
  wave: number
  /** Abseil push-off, 0..1 while swinging away from the wall. */
  bounce: number
  /** Screen point the rope runs up to (abseil anchor, crevasse lip). */
  anchor: [number, number] | null
  /** Screen point a trailing rope runs down to. */
  tail: [number, number] | null
  /** On a cliff, the side the rock is on: 1 on the right, -1 on the left. */
  wall: 1 | -1
  /** Climbing a cliff: the world x of its foot and of its top. */
  cliff: { bottom: number; top: number } | null
  /** Where the pointer is on screen (fish dart away from it), or null. */
  pointer: [number, number] | null
}

const SAIL = ['#ff3fa4', '#ffcd75', '#41a6f6', '#f4f4f4']
const FRAME = '#3fb6a8'
const TYRE = '#1a1c2c'
const ROPE = '#ef7d57'

/** Left edge for a sprite whose layout is defined facing right. */
const place = (sx: number, offset: number, w: number, dir: 1 | -1) => (dir > 0 ? sx + offset : sx - offset - w + 1)

function blit(s: CanvasRenderingContext2D, sprite: Sprite, left: number, top: number, flip: boolean) {
  s.drawImage(bake(sprite, null, flip), Math.round(left), Math.round(top))
}

/* -------------------------------------------------------------------------- */
/* Bike                                                                        */
/* -------------------------------------------------------------------------- */

const RING: [number, number][] = [
  [-1, -4],
  [0, -4],
  [1, -4],
  [2, -3],
  [3, -2],
  [4, -1],
  [4, 0],
  [4, 1],
  [3, 2],
  [2, 3],
  [1, 4],
  [0, 4],
  [-1, 4],
  [-2, 3],
  [-3, 2],
  [-4, 1],
  [-4, 0],
  [-4, -1],
  [-3, -2],
  [-2, -3],
]

function wheel(s: CanvasRenderingContext2D, cx: number, cy: number, spin: number) {
  s.fillStyle = TYRE
  for (const [dx, dy] of RING) s.fillRect(cx + dx, cy + dy, 1, 1)
  s.fillStyle = '#94b0c2'
  for (let k = 0; k < 2; k++) {
    const a = spin + k * Math.PI
    s.fillRect(Math.round(cx + Math.cos(a) * 2), Math.round(cy + Math.sin(a) * 2), 1, 1)
  }
  s.fillStyle = '#c0c8d2'
  s.fillRect(cx, cy, 1, 1)
}

/**
 * A gravel bike. `x` is the bottom bracket's world-screen x, `rearY`/`frontY` the screen y of the
 * ground under each wheel. With `pedal` set, a rider is drawn pedalling (angle in radians).
 * Returns the rider's head position.
 */
export function drawBike(
  s: CanvasRenderingContext2D,
  sx: number,
  rearGround: number,
  frontGround: number,
  dir: 1 | -1,
  spin: number,
  pedal: number | null,
): [number, number] {
  const rearY = rearGround - 5
  const frontY = frontGround - 5
  const P = (lx: number, ly: number): [number, number] => {
    const t = (lx + 6) / 12
    return [sx + lx * dir, Math.round(rearY + (frontY - rearY) * t + ly)]
  }
  const L = (a: [number, number], b: [number, number]) => pline(s, a[0], a[1], b[0], b[1])
  const R = P(-6, 0)
  const F = P(6, 0)
  const BB = P(0, 1)
  const S = P(-2, -6)
  const HT = P(4, -6)
  const HB = P(5, -4)
  const hip = P(-2, -8)
  const pedalPos = (a: number): [number, number] => [
    Math.round(BB[0] + Math.cos(a) * 2.5 * dir),
    Math.round(BB[1] + Math.sin(a) * 2.5),
  ]
  const leg = (a: number, thigh: string, shin: string) => {
    const pd = pedalPos(a)
    const dx = pd[0] - hip[0]
    const dy = pd[1] - hip[1]
    const d = Math.min(9.4, Math.hypot(dx, dy))
    const k = Math.sqrt(Math.max(0, 25 - (d / 2) ** 2))
    const mx = hip[0] + dx / 2
    const my = hip[1] + dy / 2
    // Knee bends forward (towards the handlebars) and up.
    const nx = (-dy / (Math.hypot(dx, dy) || 1)) * k
    const ny = (dx / (Math.hypot(dx, dy) || 1)) * k
    const sign = nx * dir > 0 ? 1 : -1
    const knee: [number, number] = [Math.round(mx + nx * sign), Math.round(my + ny * sign)]
    s.fillStyle = thigh
    L(hip, knee)
    s.fillStyle = shin
    L(knee, pd)
    s.fillStyle = '#f4f4f4'
    s.fillRect(pd[0] - (dir > 0 ? 0 : 1), pd[1], 2, 1)
  }

  if (pedal !== null) leg(pedal + Math.PI, '#333c57', '#d9a97e')
  wheel(s, R[0], R[1], spin)
  wheel(s, F[0], F[1], spin)
  s.fillStyle = FRAME
  L(R, BB)
  L(R, S)
  L(BB, S)
  L(S, HT)
  L(BB, HB)
  L(HT, HB)
  s.fillStyle = '#c0c8d2'
  L(HB, F)
  const bar = P(5, pedal !== null ? -9 : -8)
  s.fillStyle = '#566c86'
  L(HT, bar)
  s.fillStyle = TYRE
  s.fillRect(bar[0], bar[1], 1, 1)
  s.fillRect(bar[0] + dir, bar[1], 1, 2)
  const saddle = P(-2, -7)
  s.fillRect(Math.min(saddle[0], saddle[0] - 2 * dir), saddle[1], 3, 1)

  let head: [number, number] = [sx, rearY - 14]
  if (pedal !== null) {
    const left = dir > 0 ? hip[0] - 2 : hip[0] - (BIKER.w - 1 - 2)
    const top = hip[1] - 9
    blit(s, BIKER, left, top, dir < 0)
    leg(pedal, '#1a1c2c', '#f2c8a0')
    head = [left + (dir > 0 ? 6 : BIKER.w - 7), top + 3]
  }
  s.fillStyle = '#333c57'
  const pd = pedalPos(pedal ?? 0.6)
  L(BB, pd)
  return head
}

/* -------------------------------------------------------------------------- */
/* Windsurf rig                                                                */
/* -------------------------------------------------------------------------- */

function fillTriangle(s: CanvasRenderingContext2D, a: [number, number], b: [number, number], c: [number, number]) {
  const pts = [a, b, c].sort((p, q) => p[1] - q[1])
  const [p0, p1, p2] = pts
  const edgeX = (p: [number, number], q: [number, number], y: number) =>
    q[1] === p[1] ? p[0] : p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1])
  for (let y = Math.ceil(p0[1]); y <= Math.floor(p2[1]); y++) {
    const xa = edgeX(p0, p2, y)
    const xb = y < p1[1] ? edgeX(p0, p1, y) : edgeX(p1, p2, y)
    const x0 = Math.round(Math.min(xa, xb))
    const x1 = Math.round(Math.max(xa, xb))
    s.fillStyle = SAIL[Math.floor((y - p0[1]) / 4) % SAIL.length]
    s.fillRect(x0, y, x1 - x0 + 1, 1)
  }
}

function drawSurf(s: CanvasRenderingContext2D, v: View, c: ClimberView, sx: number): [number, number] {
  const dir = c.dir
  const bob = v.reducedMotion ? 0 : Math.round(Math.sin(v.time * 2.2) * 0.8)
  const wl = c.y + bob
  // Wake and spray.
  if (c.moving && !v.reducedMotion) {
    s.fillStyle = '#f4fbff'
    for (let i = 0; i < 7; i++) {
      const wx = sx - dir * (9 + i * 2 + (Math.floor(v.time * 12) % 2))
      if ((i + Math.floor(v.time * 8)) % 3 !== 0) s.fillRect(wx, c.y - (i % 2), 1, 1)
    }
    s.fillRect(sx + dir * 9, wl - 2 - (Math.floor(v.time * 10) % 2), 1, 1)
  }
  const mf: [number, number] = [sx + 2 * dir, wl - 2]
  const mt: [number, number] = [sx + 5 * dir, wl - 30]
  const clew: [number, number] = [sx - 9 * dir, wl - 9]
  fillTriangle(s, mt, [mf[0], mf[1] - 1], clew)
  s.fillStyle = '#e8e8e8'
  pline(s, mf[0], mf[1], mt[0], mt[1])
  // Board.
  s.fillStyle = 'rgba(0,0,0,0.22)'
  s.fillRect(sx - 7, c.y, 14, 1)
  s.fillStyle = '#f4f4f4'
  s.fillRect(sx - 8, wl - 1, 16, 1)
  s.fillRect(dir > 0 ? sx + 8 : sx - 9, wl - 2, 1, 1)
  s.fillStyle = '#ef7d57'
  s.fillRect(sx - 3, wl - 1, 6, 1)
  const frame = SURFER[Math.floor(v.time * 1.5) % 2]
  const left = place(sx, -9, frame.w, dir)
  const top = wl - 2 - (frame.h - 1)
  blit(s, frame, left, top, dir < 0)
  s.fillStyle = '#566c86'
  pline(s, sx + 3 * dir, wl - 9, clew[0], clew[1])
  return [left + (dir > 0 ? 5 : frame.w - 6), top + 3]
}

/* -------------------------------------------------------------------------- */
/* Snorkelling                                                                 */
/* -------------------------------------------------------------------------- */

const SEA_TINT = hex('#2d8fc4')
const tints = new Map<string, string>()
/** A colour seen through `depth` pixels of sea water. */
function wet(color: string, depth: number) {
  if (depth <= 0) return color
  const k = Math.min(0.62, 0.16 + depth * 0.03)
  const key = `${color}|${k.toFixed(2)}`
  let c = tints.get(key)
  if (!c) {
    c = css(mix(hex(color), SEA_TINT, k))
    tints.set(key, c)
  }
  return c
}

/** Mediterranean fish: damselfish (dark, and the electric-blue young), saddled bream, rainbow wrasse, salema. */
const FISH = [
  { body: '#3d3540', tail: '#5d5060' },
  { body: '#2f7fe8', tail: '#73eff7' },
  { body: '#c9d2da', tail: '#2a2e38' },
  { body: '#ef7d57', tail: '#3b8be0' },
  { body: '#d9d39c', tail: '#e8c84a' },
  { body: '#3d3540', tail: '#5d5060' },
]
const FISH_SPOTS = [
  [-30, 9],
  [-14, 16],
  [6, 7],
  [20, 20],
  [34, 12],
  [-4, 25],
] as const

function drawFish(s: CanvasRenderingContext2D, v: View, c: ClimberView, sx: number, wl: number) {
  const t = v.reducedMotion ? 0 : v.time
  const shore = Z.shore * WORLD_LEN
  FISH_SPOTS.forEach(([bx, by], i) => {
    const swim = Math.sin(t * 0.6 + i * 1.9)
    let x = bx + swim * 7
    let heading = Math.cos(t * 0.6 + i * 1.9) >= 0 ? 1 : -1
    let y = by + Math.round(Math.sin(t * 0.9 + i) * 1.5)
    // A fish darts off when the pointer comes close.
    if (c.pointer) {
      const dx = sx + x - c.pointer[0]
      const d = Math.hypot(dx, wl + y - c.pointer[1])
      if (d < 16) {
        heading = dx >= 0 ? 1 : -1
        x += heading * (16 - d) * 1.1
      }
    }
    // Never below the sea bed (it shelves up towards the beach).
    const bed = Math.round(1 + (shore - (c.x + x)) * 0.7)
    y = Math.min(y, bed - 3)
    if (y < 3) return
    const fx = Math.round(sx + x)
    const fy = wl + y
    const f = FISH[i]
    // Seen through the water, but not so faintly they disappear.
    const depth = Math.round(y * 0.55)
    const body = wet(f.body, depth)
    const tail = wet(f.tail, depth)
    const flick = Math.floor(t * 6 + i) % 2
    const X = (dx: number) => (heading > 0 ? fx + dx : fx - dx)
    s.fillStyle = body
    for (let dx = -2; dx <= 2; dx++) s.fillRect(X(dx), fy, 1, 1)
    for (let dx = -1; dx <= 1; dx++) {
      s.fillRect(X(dx), fy - 1, 1, 1)
      s.fillRect(X(dx), fy + 1, 1, 1)
    }
    s.fillStyle = wet('#1a1c2c', depth)
    s.fillRect(X(1), fy - 1, 1, 1)
    s.fillStyle = tail
    s.fillRect(X(-3), fy, 1, 1)
    if (flick) {
      s.fillRect(X(-4), fy - 1, 1, 1)
      s.fillRect(X(-4), fy + 1, 1, 1)
    } else s.fillRect(X(-4), fy, 1, 1)
  })
}

/**
 * Snorkelling: face down at the surface with mask and snorkel, fins kicking, towing the red
 * diver-down buoy that snorkellers carry in Italy, with fish below. Returns the head position.
 */
function drawSnorkel(s: CanvasRenderingContext2D, v: View, c: ClimberView, sx: number): [number, number] {
  const dir = c.dir
  const t = v.reducedMotion ? 0 : v.time
  const bob = Math.round(Math.sin(t * 2.2) * 0.6)
  const wl = c.y + bob
  drawFish(s, v, c, sx, wl)
  // dy is measured from the water's surface; below it everything takes on the sea's blue.
  const px = (dx: number, dy: number, color: string, w = 1) => {
    s.fillStyle = wet(color, dy)
    s.fillRect(dir > 0 ? sx + dx : sx - dx - w + 1, wl + dy, w, 1)
  }
  const kick = Math.sin(t * (c.moving ? 9 : 2.5))
  const k = Math.round(kick * 1.5)

  // The buoy and its flag, bobbing a little out of step, on a line from his waist.
  const by = Math.round(Math.sin(t * 2.2 + 1.3) * 0.6)
  for (let x = -24; x <= -9; x += 3) px(x, 1 + (x < -16 ? 0 : 1), '#e8e0c8')
  px(-28, -2 + by, '#d43a3a', 3)
  px(-28, -1 + by, '#d43a3a')
  px(-27, -1 + by, '#f4f4f4')
  px(-26, -1 + by, '#d43a3a')
  px(-28, 0 + by, '#b52f2f', 3)
  px(-27, -5 + by, '#1a1c2c')
  px(-27, -4 + by, '#1a1c2c')
  px(-27, -3 + by, '#1a1c2c')
  for (let r = 0; r < 3; r++) {
    for (let q = 0; q < 4; q++) px(-26 + q, -6 + r + by, q === r || q === r + 1 ? '#f4f4f4' : '#d43a3a')
  }

  // Fins and legs, kicking just under the surface; a splash when a fin breaks it.
  for (const [side, off] of [
    [1, 0],
    [-1, 1],
  ] as const) {
    const ky = 1 + side * k
    const color = off ? '#d9a07e' : '#f2c8a0'
    s.fillStyle = wet(color, Math.max(1, ky))
    const hip: [number, number] = [dir > 0 ? sx - 8 : sx + 8, wl + 1]
    const ankle: [number, number] = [dir > 0 ? sx - 13 : sx + 13, wl + Math.max(0, ky)]
    pline(s, hip[0], hip[1], ankle[0], ankle[1])
    px(-17, Math.max(0, ky + side), off ? '#d0891a' : '#f9a31b', 4)
  }
  if (c.moving && !v.reducedMotion && k !== 0) {
    s.fillStyle = '#f4fbff'
    s.fillRect(dir > 0 ? sx - 16 - (Math.floor(t * 10) % 3) : sx + 16 + (Math.floor(t * 10) % 3), wl - 1, 1, 1)
    s.fillRect(dir > 0 ? sx - 14 : sx + 14, wl - 1 - (Math.floor(t * 8) % 2), 1, 1)
  }
  // Swim shorts, a rash vest with its wet back just out of the water.
  px(-8, 0, '#b13e53', 3)
  px(-8, 1, '#b13e53', 3)
  px(-5, 0, '#3b5dc9', 8)
  px(-5, 1, '#3b5dc9', 8)
  px(-4, -1, '#41a6f6', 6)
  px(-1, -1, '#73eff7')
  // An arm reaching forward under the water, slowly sculling.
  const reach = 6 + Math.round(Math.sin(t * 1.6) * 1.5)
  px(2, 2, '#f2c8a0', reach)
  // Head: hair on top, the mask strap, glass at the front; the snorkel up out of the water.
  px(3, -1, '#5a3a22', 3)
  px(2, 0, '#1a1c2c')
  px(3, 0, '#5a3a22')
  px(4, 0, '#f2c8a0', 2)
  px(6, 0, '#1a1c2c')
  px(7, 0, '#73eff7')
  px(3, 1, '#f2c8a0', 3)
  px(6, 1, '#1a1c2c')
  px(7, 1, '#73eff7')
  px(4, -4, '#2b3a67')
  px(4, -3, '#2b3a67')
  px(4, -2, '#2b3a67')
  px(4, -6, '#f9a31b')
  px(4, -5, '#f9a31b')
  // Little ripples around him on the surface.
  if (!v.reducedMotion && Math.floor(t * 2) % 2 === 0) {
    s.fillStyle = 'rgba(244,251,255,0.7)'
    s.fillRect(dir > 0 ? sx + 9 : sx - 9, wl, 1, 1)
    s.fillRect(dir > 0 ? sx - 10 : sx + 10, wl, 1, 1)
  }
  return [dir > 0 ? sx + 5 : sx - 5, wl - 1]
}

/* -------------------------------------------------------------------------- */
/* Scrambling                                                                  */
/* -------------------------------------------------------------------------- */

/** A two-part limb from `a` towards `b`, bending to one side; returns where its end lands. */
function limb(
  s: CanvasRenderingContext2D,
  a: [number, number],
  b: [number, number],
  l1: number,
  l2: number,
  bend: 1 | -1,
  upper: string,
  lower: string,
): [number, number] {
  let dx = b[0] - a[0]
  let dy = b[1] - a[1]
  let d = Math.hypot(dx, dy) || 1
  const reach = l1 + l2 - 0.05
  if (d > reach) {
    dx = (dx / d) * reach
    dy = (dy / d) * reach
    d = reach
  }
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along))
  const ux = dx / d
  const uy = dy / d
  const jx = Math.round(a[0] + ux * along - uy * h * bend)
  const jy = Math.round(a[1] + uy * along + ux * h * bend)
  const end: [number, number] = [Math.round(a[0] + dx), Math.round(a[1] + dy)]
  s.fillStyle = upper
  pline(s, a[0], a[1], jx, jy)
  s.fillStyle = lower
  pline(s, jx, jy, end[0], end[1])
  return end
}

/**
 * Scrambling up the rock steps: no rope, just hands and boots on the rock, one hand reaching for
 * the next ledge while a boot steps up. He always faces the rock, going up or coming down.
 */
function drawScramble(s: CanvasRenderingContext2D, v: View, c: ClimberView, sx: number): [number, number] {
  const ground = (dx: number) => v.walkY(c.x + dx) - 1
  const phase = c.moving && !v.reducedMotion ? c.dist / 4 : 0
  const step = Math.floor(phase) % 2
  const lift = c.moving && !v.reducedMotion ? Math.round(Math.abs(Math.sin(phase * Math.PI)) * 2) : 0
  const backFoot: [number, number] = [sx - 3, ground(-3)]
  const frontFoot: [number, number] = [sx + 2, ground(2) - lift]
  const hip: [number, number] = [sx - 1, Math.round((backFoot[1] + frontFoot[1]) / 2) - 5]
  const left = hip[0] - 3
  const top = hip[1] - 8
  const shoulder: [number, number] = [left + 6, top + 5]
  const hold = (dx: number): [number, number] => [sx + dx, ground(dx)]
  // Hands go for the highest rock within reach (the top of the next step), the other a little lower.
  let best = 4
  for (let dx = 3; dx <= 10; dx++) {
    const p = hold(dx)
    if (Math.hypot(p[0] - shoulder[0], p[1] - shoulder[1]) <= 7.8 && p[1] <= hold(best)[1]) best = dx
  }
  const [nearHand, farHand] = step ? [hold(best - 3), hold(best)] : [hold(best), hold(best - 3)]

  // The far arm and leg first, a shade darker, behind the body.
  limb(s, shoulder, farHand, 4, 4, 1, '#2b3f8f', '#c9a07e')
  const far = limb(s, hip, backFoot, 4, 4, -1, '#5a3a22', '#7a2a3a')
  s.fillStyle = TYRE
  s.fillRect(far[0], far[1], 2, 1)
  blit(s, SCRAMBLER, left, top, false)
  const near = limb(s, hip, frontFoot, 4, 4, -1, '#8a5a3b', '#b13e53')
  s.fillStyle = TYRE
  s.fillRect(near[0], near[1], 2, 1)
  const hand = limb(s, shoulder, nearHand, 4, 4, 1, '#3b5dc9', '#3b5dc9')
  s.fillStyle = '#f2c8a0'
  s.fillRect(hand[0], hand[1], 1, 1)
  return [left + 8, top + 2]
}

/* -------------------------------------------------------------------------- */
/* Climbing                                                                    */
/* -------------------------------------------------------------------------- */

/** Height gained per climbing move, in pixels. */
const CLIMB_STEP = 5
/** Quickdraws on the route, as heights above the foot of the cliff. */
const BOLTS = [9, 20, 31]

/**
 * Climbing up a cliff, driven by how high he is: one hand reaches for the next hold, the opposite
 * foot steps up high, then he stands up on it — so he rises in pulls, hands and feet always on the
 * rock. The rope runs from his harness down through the quickdraws below him to the belay.
 */
function drawClimb(s: CanvasRenderingContext2D, v: View, c: ClimberView, cliff: { bottom: number; top: number }): [number, number] {
  const w = c.wall
  const baseY = v.groundY(cliff.bottom)
  const total = Math.max(1, baseY - v.groundY(cliff.top))
  const h = clamp(baseY - v.groundY(c.x), 0, total)
  /** Screen x of the rock face at a height above the foot of the cliff. */
  const face = (height: number) => {
    const y = baseY - clamp(height, 0, total)
    let lo = cliff.bottom
    let hi = cliff.top
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2
      if (v.groundY(mid) > y) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2 - v.camX
  }
  /** A point on (or `off` pixels out from) the rock face at a height. */
  const at = (height: number, off: number): [number, number] => [Math.round(face(height) - w * off), Math.round(baseY - height)]

  // Each move: a hand reaches up (0–0.35), the opposite foot steps up high (0.3–0.75) and he stands up on it (0.45–1).
  const k = Math.floor(h / CLIMB_STEP)
  const phase = h / CLIMB_STEP - k
  const reach = smoothstep(0, 0.35, phase)
  const stepUp = smoothstep(0.3, 0.75, phase)
  const body = CLIMB_STEP * (k + smoothstep(0.45, 1, phase))
  const hand = (side: number) => CLIMB_STEP * (k % 2 === side ? k - 1 + 2 * reach : k) + 12
  // Feet: one on a hold a little below the hip, the other stepping up high; both within a leg's reach.
  const hipH = body + 6
  const foot = (side: number) => clamp(CLIMB_STEP * ((k + 1) % 2 === side ? k - 1 + 2 * stepUp : k) + 2, hipH - 8, hipH - 1)

  const hip = at(hipH, 3)
  const left = hip[0] - 4
  const top = hip[1] - 9
  const shoulder: [number, number] = [left + (w > 0 ? 5 : 3), top + 5]
  const harness: [number, number] = [hip[0], hip[1]]
  // The moving hand or foot comes off the rock a little on its way to the next hold.
  const reachHand = (side: number) => at(hand(side), 1 + (k % 2 === side ? Math.sin(Math.PI * reach) * 2 : 0))
  const stepFoot = (side: number) => at(foot(side), 1 + ((k + 1) % 2 === side ? Math.sin(Math.PI * stepUp) * 2 : 0))

  // Quickdraws on the rock; the rope runs from the harness through the ones below him, down to the belay.
  for (const b of BOLTS) {
    if (b > total - 3) continue
    const [bx, by] = at(b, 0)
    s.fillStyle = '#c0c8d2'
    s.fillRect(bx, by, 1, 1)
    s.fillStyle = '#f9a31b'
    s.fillRect(bx - w, by + 1, 1, 2)
  }
  s.fillStyle = ROPE
  let from = harness
  for (const b of [...BOLTS].reverse()) {
    if (b >= body + 6 || b > total - 3) continue
    const [bx, by] = at(b, 0)
    const clip: [number, number] = [bx - w, by + 3]
    pline(s, from[0], from[1], clip[0], clip[1])
    from = clip
  }
  if (c.tail) pline(s, from[0], from[1], c.tail[0], c.tail[1])

  // Far arm and leg behind the body (a shade darker), then the body, then the near leg and arm.
  // A boot points into the rock, toe on the hold.
  const boot = (p: [number, number]) => {
    s.fillStyle = TYRE
    s.fillRect(w > 0 ? p[0] : p[0] - 1, p[1], 2, 1)
  }
  limb(s, shoulder, reachHand(1), 4, 5, w, '#2b3f8f', '#2b3f8f')
  boot(limb(s, hip, stepFoot(1), 4, 5, -w as 1 | -1, '#5a3a22', '#7a2a3a'))
  blit(s, CLIMB_TORSO, left, top, w < 0)
  boot(limb(s, hip, stepFoot(0), 4, 5, -w as 1 | -1, '#8a5a3b', '#b13e53'))
  const near = limb(s, shoulder, reachHand(0), 4, 5, w, '#3b5dc9', '#3b5dc9')
  s.fillStyle = '#f2c8a0'
  s.fillRect(near[0], near[1], 1, 1)
  return [left + (w > 0 ? 5 : 3), top + 3]
}

/* -------------------------------------------------------------------------- */
/* The climber                                                                 */
/* -------------------------------------------------------------------------- */

/** Draws the climber; returns the head position (for the torch) or null when hidden. */
export function drawClimber(s: CanvasRenderingContext2D, v: View, c: ClimberView): [number, number] | null {
  const sx = Math.round(c.x - v.camX)
  const dir = c.dir
  const step = Math.floor(c.dist / 3.5)
  switch (c.mode) {
    case 'hidden':
      return null
    case 'surf':
      return drawSurf(s, v, c, sx)
    case 'snorkel':
      return drawSnorkel(s, v, c, sx)
    case 'scramble':
      return drawScramble(s, v, c, sx)
    case 'bike': {
      const pedal = c.dist / 2.6
      return drawBike(s, sx, v.walkY(c.x - 6 * dir), v.walkY(c.x + 6 * dir), dir, c.dist / 4, pedal)
    }
    case 'climb':
      // Climbing only happens on a cliff (see Engine.cliffAt).
      return c.cliff ? drawClimb(s, v, c, c.cliff) : null
    case 'abseil': {
      // Drawn facing rock on the left; mirrored when the rock is on the right.
      const frame = c.bounce > 0 ? ABSEIL[1] : ABSEIL[Math.floor(c.dist / 3) % 2]
      const flip = c.wall > 0
      const push = Math.sin(clamp(c.bounce) * Math.PI)
      const off = -1 + Math.round(push * 8)
      const left = flip ? sx - off - (frame.w - 1) : sx + off
      const X = (lx: number) => (flip ? left + frame.w - 1 - lx : left + lx)
      const top = c.y - frame.h + 1 - Math.round(push * 2)
      s.fillStyle = ROPE
      if (c.anchor) pline(s, c.anchor[0], c.anchor[1], X(9), top + 7)
      if (c.tail) pline(s, X(4), top + 8, c.tail[0], c.tail[1])
      blit(s, frame, left, top, flip)
      return [X(6), top + 3]
    }
    case 'leap': {
      const left = sx - 6
      const top = c.y - LEAP.h
      blit(s, LEAP, left, top, dir < 0)
      return [left + 6, top + 5]
    }
    case 'hang': {
      const left = sx - 6
      const top = c.y
      if (c.anchor) {
        s.fillStyle = ROPE
        pline(s, c.anchor[0], c.anchor[1], left + 5, top)
      }
      blit(s, HANG, left, top, dir < 0)
      return [left + 6, top + 5]
    }
    default:
      break
  }

  // Walking modes.
  const gy = c.y
  const mode = c.mode
  let sprite: Sprite
  if (mode === 'victory') sprite = CLIMBER.victory
  else if (mode === 'beach') sprite = c.moving ? CLIMBER.beach[step % 4] : CLIMBER.beach[0]
  else if (mode === 'ski') sprite = c.moving ? (dir > 0 ? CLIMBER.skin[step % 2] : CLIMBER.descend) : CLIMBER.skiIdle[0]
  else if (mode === 'alpine') sprite = c.moving ? CLIMBER.alpine[step % 4] : CLIMBER.alpine[0]
  else sprite = c.moving ? CLIMBER.walk[step % 4] : CLIMBER.idle[0]

  const top = gy - sprite.h
  const left = sx - 6
  const flip = dir < 0

  if (mode === 'ski') {
    s.fillStyle = '#ef7d57'
    for (let i = -7; i <= 8; i++) s.fillRect(sx + i, v.walkY(c.x + i) - 1, 1, 1)
    const tipX = sx + (dir > 0 ? 9 : -8)
    s.fillRect(tipX, v.walkY(c.x + (dir > 0 ? 9 : -8)) - 2, 1, 1)
  }
  blit(s, sprite, left, top, flip)

  s.fillStyle = '#94b0c2'
  const swing = Math.round(Math.sin(c.dist / 3.5) * 2)
  if (mode === 'hike') {
    pline(s, sx + dir * 3, top + 9, sx + dir * (6 + (c.moving ? swing : 0)), gy - 1)
  } else if (mode === 'ski' && sprite !== CLIMBER.descend) {
    pline(s, sx + dir * 3, top + 9, sx + dir * (6 + swing), gy - 1)
    pline(s, sx - dir * 2, top + 9, sx - dir * (3 - swing), gy - 1)
  } else if (mode === 'ski') {
    pline(s, sx + dir * 5, top + 8, sx - dir * 4, top + 12)
    if (!v.reducedMotion && c.moving) {
      s.fillStyle = '#ffffff'
      for (let i = 0; i < 4; i++) s.fillRect(sx - dir * (8 + ((v.time * 40 + i * 3) % 8)), gy - 2 - (i % 3), 1, 1)
    }
  } else if (mode === 'alpine') {
    s.fillStyle = '#c28b5c'
    pline(s, sx + dir * 4, top + 9, sx + dir * 5, gy - 3)
    s.fillStyle = '#c0c8d2'
    s.fillRect(sx + dir * 4 - (dir < 0 ? 1 : 0), top + 8, 2, 1)
  } else if (mode === 'victory') {
    s.fillStyle = '#c0c8d2'
    s.fillRect(sx + (flip ? -6 : 4), top - 2, 1, 3)
    s.fillRect(sx + (flip ? -7 : 3), top - 2, 3, 1)
  }
  if (c.wave > 0 && mode !== 'victory') {
    const up = Math.floor(v.time * 6) % 2
    s.fillStyle = mode === 'beach' ? '#41a6f6' : '#3b5dc9'
    s.fillRect(sx + dir * 4, top + 6, 1, 2)
    s.fillStyle = '#f2c8a0'
    s.fillRect(sx + dir * (5 + up), top + 4, 1, 2)
  }
  return [sx + (flip ? -1 : 1), top + 4]
}
