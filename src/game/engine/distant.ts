import { ISLAND, MID_PARALLAX, midRidge, midRidgeY } from './backdrop.ts'
import { hash, smoothstep } from './math.ts'
import type { View } from './view.ts'
import { WORLD_LEN } from './world.ts'

/**
 * Small, quiet things to notice in the background, never in the way: a jet's contrail, a flock of
 * birds, a paraglider over the valley, a hot-air balloon over the countryside, a cable car on a far
 * ridge, a lighthouse and a ferry out at sea, the odd shooting star at night. Most of the time
 * there's nothing much at all. None of them ever pops in or out: they ease in and out at either end
 * of their run, as the light goes, and towards the ends of the stretch of trail where they belong.
 */
export type Tops = { near: Int16Array; mid: Int16Array; far: Int16Array }

/**
 * When the travelling things show up: every `period` seconds (offset by `phase`) for `len`
 * seconds, except that about a third of the time they skip their turn, so it never feels like
 * clockwork.
 */
export const SCHEDULE = {
  contrail: { period: 160, len: 40, phase: 17 },
  birds: { period: 110, len: 25, phase: 52 },
  paraglider: { period: 150, len: 60, phase: 30 },
  balloon: { period: 200, len: 80, phase: 80 },
  ferry: { period: 120, len: 90, phase: 5 },
  shootingStar: { period: 34, len: 0.9, phase: 11 },
} as const

export type Mover = keyof typeof SCHEDULE

/** The current run of a mover (when it started), or null when it isn't out. */
export function slotOf(mover: Mover, t: number): { from: number; p: number; seed: number } | null {
  const { period, len, phase } = SCHEDULE[mover]
  const k = Math.floor((t + phase) / period)
  if (hash(k, period * 7 + len) < 0.35) return null
  const from = k * period - phase
  const p = (t - from) / len
  return p >= 0 && p < 1 ? { from, p, seed: k } : null
}

const trailAt = (v: View) => v.camX / WORLD_LEN
/** Out by day: fading away as night falls (and back as it lifts). */
const byDay = (v: View) => smoothstep(0.32, 0.48, v.sky.daylight)
/** High in the sky: gone a little before dusk. */
const beforeDusk = (v: View) => smoothstep(0.47, 0.63, v.sky.daylight)
/** Lamps come on through sunset. */
const lamps = (v: View) => 1 - smoothstep(0.64, 0.8, v.sky.daylight)

/** Eases in over the first 1/k of a run and out over the last. */
export const ends = (p: number, k = 5) => smoothstep(0, 1 / k, p) * smoothstep(0, 1 / k, 1 - p)

/** 1 along the stretch of trail from `lo` to `hi`, easing to 0 across `edge` around either end. */
export const along = (f: number, lo: number, hi: number, edge = 0.03) =>
  smoothstep(lo - edge / 2, lo + edge / 2, f) * (1 - smoothstep(hi - edge / 2, hi + edge / 2, f))

/** Out in the landscape: in front of the far mountains, but not where the near hills or the ground hide it. */
function clear(v: View, tops: Tops, x: number, y: number) {
  return x >= 0 && x < v.W && y >= 0 && y < tops.near[x] && y < v.groundY(v.camX + x)
}

function px(s: CanvasRenderingContext2D, v: View, tops: Tops, x: number, y: number, w = 1) {
  const cx = Math.round(x)
  const cy = Math.round(y)
  for (let k = 0; k < w; k++) if (clear(v, tops, cx + k, cy)) s.fillRect(cx + k, cy, 1, 1)
}

/* -------------------------------------------------------------------------- */
/* In the sky, behind the landscape (the hills and mountains hide them where they're in front)   */
/* -------------------------------------------------------------------------- */

function contrail(s: CanvasRenderingContext2D, v: View, t: number) {
  const run = slotOf('contrail', t)
  const fade = run ? ends(run.p, 6) * beforeDusk(v) : 0
  if (!run || fade <= 0) return
  const dir = hash(run.seed, 4) < 0.5 ? 1 : -1
  const y = Math.round(6 + hash(run.seed, 3) * v.horizon * 0.25)
  const x = Math.round(dir > 0 ? -20 + run.p * (v.W + 40) : v.W + 20 - run.p * (v.W + 40))
  // The trail behind the plane spreads and fades.
  for (let k = 1; k < 60; k++) {
    s.fillStyle = `rgba(255,255,255,${(0.3 * (1 - k / 60) * fade).toFixed(3)})`
    s.fillRect(x - dir * Math.round(k * 1.2), y + (k > 25 ? 1 : 0), 1, k > 40 ? 2 : 1)
  }
  s.fillStyle = `rgba(250,252,255,${(0.8 * fade).toFixed(2)})`
  s.fillRect(x, y, 2, 1)
}

function birds(s: CanvasRenderingContext2D, v: View, t: number) {
  const run = slotOf('birds', t)
  const fade = run ? beforeDusk(v) : 0
  if (!run || fade <= 0) return
  const dir = hash(run.seed, 5) < 0.5 ? 1 : -1
  const baseY = 12 + hash(run.seed, 6) * v.horizon * 0.3
  // In from off one side of the screen and out past the other.
  const head = dir > 0 ? -10 + run.p * (v.W + 30) : v.W + 10 - run.p * (v.W + 30)
  s.fillStyle = `rgba(40,46,66,${(0.5 * fade).toFixed(3)})`
  // A loose V of small birds, flapping out of step.
  for (let i = 0; i < 7; i++) {
    const row = Math.ceil(i / 2)
    const side = i % 2 ? 1 : -1
    const bx = Math.round(head - dir * row * 4)
    const by = Math.round(baseY + side * row * 2 + Math.sin(t * 2 + i) * 0.6)
    const up = Math.floor(t * 5 + i * 1.7) % 2
    s.fillRect(bx, by, 1, 1)
    s.fillRect(bx - 1, by - up, 1, 1)
    s.fillRect(bx + 1, by - up, 1, 1)
  }
}

function shootingStar(s: CanvasRenderingContext2D, v: View, t: number) {
  const run = slotOf('shootingStar', t)
  const fade = run ? smoothstep(0.4, 0.6, v.sky.stars) : 0
  if (!run || fade <= 0) return
  const sx = v.W * (0.15 + 0.6 * hash(run.seed, 12))
  const sy = v.horizon * (0.08 + 0.22 * hash(run.seed, 13))
  for (let k = 0; k < 8; k++) {
    const q = run.p - k * 0.035
    if (q < 0) continue
    s.fillStyle = `rgba(255,255,236,${(0.95 * fade * (1 - k / 8) * Math.min(1, (1 - run.p) * 3)).toFixed(2)})`
    s.fillRect(Math.round(sx + q * 52), Math.round(sy + q * 20), 1, 1)
  }
}

/* -------------------------------------------------------------------------- */
/* Out in the landscape                                                          */
/* -------------------------------------------------------------------------- */

/** The paraglider over the valley: where it is and how much of it shows, or null while there's none. */
export function paragliderAt(v: View, t: number) {
  const run = slotOf('paraglider', t)
  if (!run) return null
  const alpha = 0.9 * ends(run.p) * along(trailAt(v), 0.2, 0.6) * byDay(v)
  if (alpha <= 0.01) return null
  // Rising on a thermal as it appears, and gliding down to land as it goes.
  const low = 18 * (1 - smoothstep(0, 0.3, run.p) + smoothstep(0.7, 1, run.p))
  return {
    x: v.W * (0.12 + 0.36 * hash(run.seed, 7)) + Math.sin(t * 0.25) * 24,
    y: v.horizon * (0.42 + 0.22 * hash(run.seed, 8)) + Math.sin(t * 0.4) * 3 + run.p * 12 + low,
    alpha,
  }
}

function paraglider(s: CanvasRenderingContext2D, v: View, t: number, tops: Tops) {
  const at = paragliderAt(v, t)
  if (!at) return
  const { x: cx, y: cy } = at
  s.globalAlpha = at.alpha
  // The wing: a little red arc with a yellow tip, and the pilot hanging below on fine lines.
  s.fillStyle = '#d4483a'
  px(s, v, tops, cx - 3, cy + 1)
  px(s, v, tops, cx - 2, cy, 4)
  px(s, v, tops, cx + 2, cy + 1)
  s.fillStyle = '#f2c14e'
  px(s, v, tops, cx + 1, cy)
  s.fillStyle = 'rgba(60,64,80,0.6)'
  px(s, v, tops, cx - 1, cy + 2)
  px(s, v, tops, cx + 1, cy + 2)
  s.fillStyle = '#3b3f55'
  px(s, v, tops, cx, cy + 4)
  s.globalAlpha = 1
}

/** The hot-air balloon over the countryside, rising as it drifts: where it is and how much of it shows. */
export function balloonAt(v: View, t: number) {
  const run = slotOf('balloon', t)
  if (!run) return null
  const alpha = 0.8 * ends(run.p, 4) * along(trailAt(v), 0.09, 0.3) * byDay(v)
  if (alpha <= 0.01) return null
  return { x: v.W * (0.1 + 0.25 * hash(run.seed, 9)) + run.p * 26, y: v.horizon * (0.62 - 0.22 * run.p), alpha }
}

function balloon(s: CanvasRenderingContext2D, v: View, t: number, tops: Tops) {
  const at = balloonAt(v, t)
  if (!at) return
  const { x, y } = at
  s.globalAlpha = at.alpha
  const stripes = ['#e25b45', '#f2c14e', '#3b8be0']
  ;[1, 2, 2, 2, 1].forEach((half, r) => {
    for (let k = -half; k <= half; k++) {
      s.fillStyle = stripes[(k + 3) % 3]
      px(s, v, tops, x + k, y + r)
    }
  })
  s.fillStyle = 'rgba(60,64,80,0.6)'
  px(s, v, tops, x - 1, y + 5)
  px(s, v, tops, x + 1, y + 5)
  s.fillStyle = '#6b4a32'
  px(s, v, tops, x, y + 6)
  s.globalAlpha = 1
}

/**
 * Cable cars run up a couple of spots on the far range. They're fixed to it, so they slide into
 * view and out again with the mountains: from a station low on the slope up to the highest point
 * nearby.
 */
const CABLE_SPOTS = [300, 640]
const CABLE_SPAN = 90

/** Each line's top station (the highest point near its spot) and valley station, in the range's own coordinates. */
export const CABLE_LINES = CABLE_SPOTS.map((u) => {
  let top = u
  for (let x = u; x <= u + CABLE_SPAN; x++) if (midRidge(x) > midRidge(top)) top = x
  let low = -1
  for (let x = u; x <= u + CABLE_SPAN; x++) {
    const d = Math.abs(x - top)
    if (d >= 30 && d <= 80 && (low < 0 || midRidge(x) < midRidge(low))) low = x
  }
  return { u, top, low }
}).filter((line) => line.low >= 0)

/** The cable cars in view, whole or in part, fading out towards the ends of their stretch of trail. */
export function cableCarsAt(v: View, t: number) {
  const alpha = along(trailAt(v), 0.25, 0.8)
  if (alpha <= 0.01) return []
  const offset = Math.round(v.camX * MID_PARALLAX)
  return CABLE_LINES.flatMap(({ u, top, low }) => {
    const x0 = Math.min(low, top) - offset
    const x1 = Math.max(low, top) - offset
    if (x1 < 0 || x0 >= v.W) return []
    const valley = midRidgeY(v, low) + 6
    const summit = midRidgeY(v, top) - 1
    const [ya, yb] = low < top ? [valley, summit] : [summit, valley]
    const wire = (k: number) => Math.round(ya + (yb - ya) * k + Math.sin(k * Math.PI) * 2)
    const k = v.reducedMotion ? 0.5 : (Math.sin(t * 0.05 + u) + 1) / 2
    return [{ x0, x1, wire, cabin: { x: Math.round(x0 + (x1 - x0) * k), y: wire(k) + 1 }, alpha }]
  })
}

function cableCar(s: CanvasRenderingContext2D, v: View, t: number, tops: Tops) {
  for (const car of cableCarsAt(v, t)) {
    s.globalAlpha = car.alpha
    s.fillStyle = 'rgba(60,64,80,0.25)'
    for (let x = car.x0; x <= car.x1; x += 2) px(s, v, tops, x, car.wire((x - car.x0) / (car.x1 - car.x0)))
    s.fillStyle = 'rgba(200,62,52,0.85)'
    px(s, v, tops, car.cabin.x - 1, car.cabin.y, 3)
    px(s, v, tops, car.cabin.x - 1, car.cabin.y + 1, 3)
    s.fillStyle = 'rgba(60,64,80,0.5)'
    px(s, v, tops, car.cabin.x, car.cabin.y - 1)
  }
  s.globalAlpha = 1
}

/** A lighthouse on the island's headland. */
function lighthouseAt(v: View) {
  const i = 20
  const x = ISLAND.left(v) + i
  if (x < 1 || x >= v.W - 1 || !ISLAND.atSea(v, x)) return null
  const base = v.horizon - ISLAND.height(i)
  return { x, top: base - 4, base }
}

function lighthouse(s: CanvasRenderingContext2D, v: View, _t: number, tops: Tops) {
  const at = lighthouseAt(v)
  if (!at) return
  s.fillStyle = 'rgba(248,248,242,0.9)'
  for (let y = at.top; y < at.base; y++) px(s, v, tops, at.x, y)
  s.fillStyle = 'rgba(200,62,52,0.85)'
  px(s, v, tops, at.x, at.top + 2)
}

/** A ferry heading for the mainland, far out on the sea. */
export function ferryAt(v: View, t: number) {
  const run = slotOf('ferry', t)
  if (!run || v.reducedMotion) return null
  const dir = hash(run.seed, 14) < 0.5 ? 1 : -1
  const x = Math.round(dir > 0 ? -10 + run.p * (v.W * 0.6) : v.W * 0.7 - run.p * (v.W * 0.6))
  return { x, y: v.horizon + 1, dir, fade: ends(run.p, 8) }
}

/** Like px, but only out at sea: the ferry slips out of sight behind the coast rather than vanishing. */
function seaPx(s: CanvasRenderingContext2D, v: View, tops: Tops, x: number, y: number, w = 1) {
  for (let k = 0; k < w; k++) if (ISLAND.atSea(v, Math.round(x) + k)) px(s, v, tops, x + k, y)
}

function ferry(s: CanvasRenderingContext2D, v: View, t: number, tops: Tops) {
  const at = ferryAt(v, t)
  if (!at) return
  s.globalAlpha = at.fade
  s.fillStyle = 'rgba(244,244,238,0.9)'
  seaPx(s, v, tops, at.x, at.y, 7)
  seaPx(s, v, tops, at.x + (at.dir > 0 ? 1 : 3), at.y - 1, 3)
  s.fillStyle = 'rgba(40,46,66,0.7)'
  seaPx(s, v, tops, at.x + (at.dir > 0 ? 2 : 4), at.y - 2)
  s.globalAlpha = 1
}

/** Every detail by name, in drawing order (exported for tests and screenshots). */
export const SKY_DETAILS = { contrail, birds, shootingStar }
export const LAND_DETAILS = { paraglider, balloon, cableCar, lighthouse, ferry }

/** On the sky, before the landscape is laid over it. Only the moving ones, so none with reduced motion. */
export function drawSkyDetails(s: CanvasRenderingContext2D, v: View) {
  if (v.reducedMotion) return
  for (const draw of Object.values(SKY_DETAILS)) draw(s, v, v.time)
}

/** Over the backdrop's mountains and hills (darkened along with them at night). */
export function drawLandDetails(s: CanvasRenderingContext2D, v: View, tops: Tops) {
  const t = v.time
  if (!v.reducedMotion) {
    paraglider(s, v, t, tops)
    balloon(s, v, t, tops)
    ferry(s, v, t, tops)
  }
  cableCar(s, v, t, tops)
  lighthouse(s, v, t, tops)
}

/** Lamps that glow through dusk and night, drawn over the darkness: the cabins, the lighthouse, the ferry. */
export function drawDistantLights(s: CanvasRenderingContext2D, v: View, tops: Tops) {
  const glow = lamps(v)
  if (glow <= 0.01) return
  const t = v.time
  s.fillStyle = 'rgba(255,214,120,0.9)'
  for (const car of cableCarsAt(v, t)) {
    s.globalAlpha = glow * car.alpha
    px(s, v, tops, car.cabin.x - 1, car.cabin.y, 3)
  }
  s.globalAlpha = glow
  const lh = lighthouseAt(v)
  if (lh) {
    // The beam sweeps round: a bright flash every few seconds, a faint glow in between.
    const flash = !v.reducedMotion && (t * 0.3) % 1 < 0.08
    s.fillStyle = `rgba(255,236,170,${flash ? 0.95 : 0.4})`
    px(s, v, tops, lh.x, lh.top - 1)
    if (flash) {
      s.fillStyle = 'rgba(255,236,170,0.22)'
      for (let k = -7; k <= 7; k++) if (k) px(s, v, tops, lh.x + k, lh.top - 1)
    }
  }
  const boat = ferryAt(v, t)
  if (boat) {
    s.globalAlpha = glow * boat.fade
    s.fillStyle = 'rgba(255,214,120,0.9)'
    for (const k of [1, 3, 5]) seaPx(s, v, tops, boat.x + k, boat.y)
  }
  s.globalAlpha = 1
}
