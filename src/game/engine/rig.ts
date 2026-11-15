import { bake, FIXED, Q, FLAMINGO, type Sprite } from './sprites.ts'

/** Pixel line (Bresenham), used for legs, ropes, bike frames and wings. */
export function pline(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 1) {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (let i = 0; i < 256; i++) {
    ctx.fillRect(x0, y0, w, 1)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}

export type QuadPose = 'stand' | 'graze'

export type QuadSpec = {
  poses: { stand: Sprite; graze?: Sprite }
  /** Row (from the sprite top) where the legs attach. */
  legTop: number
  front: number
  back: number
  len: number
  thick?: number
  knee?: boolean
  near: string
  far: string
  foot: string
  stride: number
  lift: number
  gait: 'trot' | 'bound'
  /** Eye pixel in the stand pose (for eyeshine at night). */
  eye?: [number, number]
}

export const QUADS: Record<string, QuadSpec> = {
  fox: {
    poses: { stand: Q.fox },
    legTop: 8,
    front: 11,
    back: 4,
    len: 3,
    near: FIXED.k,
    far: FIXED.N,
    foot: FIXED.k,
    stride: 2.2,
    lift: 1.5,
    gait: 'bound',
    eye: [13, 3],
  },
  deer: {
    poses: { stand: Q.deer, graze: Q.deerGraze },
    legTop: 10,
    front: 10,
    back: 3,
    len: 5,
    knee: true,
    near: FIXED.d,
    far: FIXED.N,
    foot: FIXED.k,
    stride: 2.6,
    lift: 2,
    gait: 'bound',
    eye: [11, 3],
  },
  chamois: {
    poses: { stand: Q.chamois },
    legTop: 9,
    front: 9,
    back: 2,
    len: 4,
    knee: true,
    near: FIXED.N,
    far: FIXED.z,
    foot: FIXED.k,
    stride: 2.4,
    lift: 2,
    gait: 'bound',
    eye: [11, 2],
  },
  ibex: {
    poses: { stand: Q.ibex },
    legTop: 11,
    front: 11,
    back: 3,
    len: 4,
    knee: true,
    near: FIXED.i,
    far: FIXED.I,
    foot: FIXED.k,
    stride: 2,
    lift: 2,
    gait: 'trot',
    eye: [14, 4],
  },
  cow: {
    poses: { stand: Q.cow, graze: Q.cowGraze },
    legTop: 8,
    front: 13,
    back: 4,
    len: 3,
    thick: 2,
    near: FIXED.d,
    far: FIXED.N,
    foot: FIXED.k,
    stride: 1.6,
    lift: 1,
    gait: 'trot',
    eye: [16, 2],
  },
  sheep: {
    poses: { stand: Q.sheep, graze: Q.sheepGraze },
    legTop: 5,
    front: 9,
    back: 2,
    len: 3,
    near: FIXED.G,
    far: FIXED.g,
    foot: FIXED.K,
    stride: 1.6,
    lift: 1,
    gait: 'trot',
    eye: [11, 1],
  },
}

export type QuadState = { pose: QuadPose; phase: number; speed: number }

/** Height of a quadruped from the ground to the top of its body sprite. */
export function quadHeight(spec: QuadSpec) {
  return spec.legTop + spec.len
}

/**
 * Draws a four-legged animal with procedurally animated legs. `x` is the screen centre, `ground`
 * the screen y of the ground under it. Returns the eye position (for night eyeshine).
 */
export function drawQuad(
  ctx: CanvasRenderingContext2D,
  spec: QuadSpec,
  st: QuadState,
  x: number,
  ground: number,
  dir: 1 | -1,
  lift = 0,
): [number, number] | null {
  const sprite = (st.pose === 'graze' && spec.poses.graze) || spec.poses.stand
  const moving = st.speed > 1.5
  const running = st.speed > 26
  const bob = moving ? Math.round(Math.abs(Math.sin(st.phase)) * (running ? 1.6 : 0.8)) : 0
  const left = Math.round(x - sprite.w / 2)
  const top = Math.round(ground - spec.len - spec.legTop - bob - lift)
  const mx = (lx: number) => (dir > 0 ? left + lx : left + sprite.w - 1 - lx)
  const legY = top + spec.legTop
  const footY = ground - 1 - lift
  const offsets =
    spec.gait === 'bound'
      ? { fn: 0, ff: 0.45, bn: Math.PI, bf: Math.PI + 0.45 }
      : { fn: 0, ff: Math.PI, bn: Math.PI, bf: 0 }
  const stride = running ? spec.stride * 1.35 : spec.stride
  const leg = (baseX: number, ph: number, color: string, hind: boolean) => {
    const swing = moving ? Math.sin(st.phase + ph) * stride : 0
    const up = moving ? Math.max(0, Math.cos(st.phase + ph)) * spec.lift : 0
    const tx = mx(baseX)
    const fx = mx(baseX) + Math.round(swing) * dir
    const fy = Math.round(footY - up)
    ctx.fillStyle = color
    const w = spec.thick ?? 1
    if (spec.knee && hind) {
      const kx = tx - dir + Math.round(swing * 0.4) * dir
      const ky = legY + Math.round(spec.len * 0.45)
      pline(ctx, tx, legY, kx, ky, w)
      pline(ctx, kx, ky, fx, fy, w)
    } else {
      pline(ctx, tx, legY, fx, fy, w)
    }
    ctx.fillStyle = spec.foot
    ctx.fillRect(dir > 0 ? fx : fx - (w - 1), fy, w, 1)
  }
  leg(spec.front + 1, offsets.ff, spec.far, false)
  leg(spec.back + 1, offsets.bf, spec.far, true)
  ctx.drawImage(bake(sprite, null, dir < 0), left, top)
  leg(spec.front, offsets.fn, spec.near, false)
  leg(spec.back, offsets.bn, spec.near, true)
  if (!spec.eye || st.pose === 'graze') return null
  return [mx(spec.eye[0]), top + spec.eye[1]]
}

export type WingStyle = 'eagle' | 'gull' | 'chough'

const WING: Record<WingStyle, { span: number; body: string; wing: string; tip: string; head: string; bent: number }> = {
  eagle: { span: 10, body: FIXED.N, wing: FIXED.N, tip: FIXED.k, head: FIXED.y, bent: 0 },
  gull: { span: 8, body: FIXED.w, wing: FIXED.G, tip: FIXED.k, head: FIXED.w, bent: 1 },
  chough: { span: 5, body: FIXED.k, wing: FIXED.k, tip: FIXED.K, head: FIXED.k, bent: 0 },
}

/**
 * A flying bird seen head-on: two wings whose tips follow a smooth flap cycle. `flap` in [-1, 1]
 * (1 = wings up). Gulls get the classic bent-wrist "M".
 */
export function drawSpreadBird(ctx: CanvasRenderingContext2D, style: WingStyle, cx: number, cy: number, flap: number) {
  const w = WING[style]
  cx = Math.round(cx)
  cy = Math.round(cy)
  for (const side of [-1, 1]) {
    for (let i = 1; i <= w.span; i++) {
      const t = i / w.span
      const wrist = w.bent ? (t < 0.45 ? -t * 3 : -1.35 + (t - 0.45) * 3.2) : 0
      const y = cy + Math.round(-flap * w.span * 0.5 * Math.pow(t, 1.4) + wrist + (style === 'eagle' ? -t * 1.2 : 0))
      const thick = t < 0.35 ? 2 : t < 0.8 ? 2 : 1
      ctx.fillStyle = t > 0.82 ? w.tip : w.wing
      ctx.fillRect(cx + side * i, y, 1, thick)
      // Separated "fingers" on an eagle's wingtip.
      if (style === 'eagle' && t > 0.8 && i % 2 === 0) ctx.fillRect(cx + side * i, y - 1, 1, 1)
    }
  }
  ctx.fillStyle = w.body
  ctx.fillRect(cx - 1, cy - 1, 3, 3)
  ctx.fillRect(cx, cy + 2, 1, 2)
  ctx.fillStyle = w.head
  ctx.fillRect(cx, cy - 2, 1, 1)
}

/** Flamingo: body + neck sprite, long pink legs; one leg tucked when standing still. Returns the leg's x. */
export function drawFlamingo(
  ctx: CanvasRenderingContext2D,
  pose: 'stand' | 'feed',
  phase: number,
  moving: boolean,
  x: number,
  ground: number,
  dir: 1 | -1,
): number {
  const sprite = FLAMINGO[pose]
  const len = 8
  const left = Math.round(x - sprite.w / 2)
  const top = Math.round(ground - len - 9)
  const hip = (dir > 0 ? left + 4 : left + sprite.w - 5)
  ctx.fillStyle = FIXED.F
  if (moving) {
    for (const ph of [0, Math.PI]) {
      const swing = Math.round(Math.sin(phase + ph) * 2)
      pline(ctx, hip, top + 9, hip + swing * dir, ground - 1 - Math.max(0, Math.round(Math.cos(phase + ph) * 1.5)))
    }
  } else {
    pline(ctx, hip, top + 9, hip, ground - 1)
    // The famous one-legged pose: the other leg folded up.
    pline(ctx, hip, top + 10, hip - 2 * dir, top + 12)
    pline(ctx, hip - 2 * dir, top + 12, hip, top + 13)
  }
  ctx.drawImage(bake(sprite, null, dir < 0), left, top)
  return hip
}

/**
 * A flamingo in flight, seen from the side: neck stretched out in front, legs trailing behind,
 * pink wings with black flight feathers. `flap` in [-1, 1] (1 = wings up). With `running`, the
 * legs dangle and paddle as it patters across the water to take off.
 */
export function drawFlyingFlamingo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dir: 1 | -1,
  flap: number,
  running = false,
  phase = 0,
) {
  const x = Math.round(cx)
  const y = Math.round(cy)
  const X = (dx: number) => x + dx * dir
  // Legs: trailing straight back in flight, paddling below while running.
  ctx.fillStyle = FIXED.F
  if (running) {
    const stride = Math.round(Math.sin(phase) * 2)
    pline(ctx, X(-1), y + 1, X(-1 + stride), y + 6)
    pline(ctx, X(-2), y + 1, X(-2 - stride), y + 6)
  } else {
    pline(ctx, X(-3), y + 1, X(-11), y + 2)
    ctx.fillStyle = FIXED.k
    ctx.fillRect(X(-11), y + 2, 1, 1)
  }
  // Neck and head, with the black-tipped bill.
  ctx.fillStyle = FIXED.f
  pline(ctx, X(3), y - 1, X(8), y - 2)
  ctx.fillRect(X(9), y - 3, 1, 2)
  ctx.fillStyle = FIXED.w
  ctx.fillRect(X(10), y - 3, 1, 1)
  ctx.fillStyle = FIXED.k
  ctx.fillRect(X(11), y - 2, 1, 1)
  // Body.
  ctx.fillStyle = FIXED.f
  ctx.fillRect(Math.min(X(-3), X(3)), y - 1, 7, 2)
  ctx.fillStyle = FIXED.F
  ctx.fillRect(Math.min(X(-2), X(2)), y + 1, 5, 1)
  // The near wing: pink coverts, then black primaries out at the tip.
  const len = 8
  const tipY = y - 1 - Math.round(flap * 7)
  const tipX = X(-1 - Math.round((1 - Math.abs(flap)) * 3))
  for (let i = 0; i <= len; i++) {
    const t = i / len
    const wx = Math.round(X(1) + (tipX - X(1)) * t)
    const wy = Math.round(y - 1 + (tipY - (y - 1)) * t)
    ctx.fillStyle = t > 0.6 ? FIXED.k : t > 0.25 ? FIXED.F : FIXED.f
    ctx.fillRect(wx, wy, 2, 1)
  }
}

/** A dolphin drawn along its direction of travel, so jumps arc smoothly at any angle. */
export function drawDolphin(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, dir: 1 | -1) {
  const len = 13
  const cos = Math.cos(angle) * dir
  const sin = Math.sin(angle)
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1)
    const px = x + (t - 0.5) * len * cos
    const py = y + (t - 0.5) * len * sin
    const thick = t < 0.15 ? 1 : t < 0.8 ? 2 : 1
    ctx.fillStyle = FIXED.D
    ctx.fillRect(Math.round(px), Math.round(py - thick + 1), 1, thick)
    if (thick > 1) {
      ctx.fillStyle = FIXED.W
      ctx.fillRect(Math.round(px), Math.round(py + 1), 1, 1)
    }
  }
  // Dorsal fin and tail flukes.
  const fin = { x: x + 0.05 * len * cos - 2 * sin * dir, y: y + 0.05 * len * sin - 2 }
  ctx.fillStyle = FIXED.D
  ctx.fillRect(Math.round(fin.x), Math.round(fin.y), 1, 2)
  const tail = { x: x - 0.5 * len * cos, y: y - 0.5 * len * sin }
  ctx.fillRect(Math.round(tail.x) - 1, Math.round(tail.y) - 1, 1, 1)
  ctx.fillRect(Math.round(tail.x) - 1, Math.round(tail.y) + 1, 1, 1)
  const nose = { x: x + 0.5 * len * cos, y: y + 0.5 * len * sin }
  ctx.fillStyle = FIXED.k
  ctx.fillRect(Math.round(nose.x - 2 * cos), Math.round(nose.y - 1), 1, 1)
}
