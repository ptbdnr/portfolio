import { css, hex, mix, shade, type RGB } from './color.ts'
import { fbm, hash, smoothstep } from './math.ts'
import type { View } from './view.ts'
import { LAGOON_HALF, type Prop } from './world.ts'

/** Screen y of the top of the hills behind, per column (for reflections). */
export type Tops = { near: Int16Array; mid: Int16Array }

type Style = {
  /** How fast it scrolls compared with the path: 1 = just behind the path, less = further away. */
  parallax: number
  /** How far above the path the water surface lies (screen px, at its centre). */
  rise: number
  /** The middle part of the far shore that runs straight (0 = a rounded lake, 0.7 = flat for 70%). */
  flat: number
  shore: 'meadow' | 'dunes'
}

const LAKE: Style = { parallax: 0.62, rise: 22, flat: 0, shore: 'meadow' }

/** How reflections are squashed vertically (we look at the water at a low angle). */
const SQUASH = 0.8

/** Mountain lakes and the flamingo lagoon: drawn behind the path, so the path's ground hides their near shore. */
export function drawWaterBodies(s: CanvasRenderingContext2D, v: View, tops: Tops, climberSX: number) {
  for (const p of v.world.props) {
    if (p.kind === 'lake') drawBody(s, v, p, LAKE, tops, climberSX)
    else if (p.kind === 'lagoon') drawLagoon(s, v, p)
  }
}

/**
 * The Sardinian lagoon (a "stagno"): shallow, sky-coloured water behind the path, with a sandy far
 * shore, reeds and tamarisk, their reflections, and ripples. Its shape comes from World.lagoonDepth,
 * which is also where the flamingos are allowed to wade.
 */
function drawLagoon(s: CanvasRenderingContext2D, v: View, prop: Prop) {
  const c = prop.x
  const x0 = Math.max(0, Math.floor(c - LAGOON_HALF - v.camX))
  const x1 = Math.min(v.W - 1, Math.ceil(c + LAGOON_HALF - v.camX))
  if (x1 < 0 || x0 >= v.W) return
  const sky = v.sky
  const haze = (col: RGB, k = 0.12) => mix(col, sky.haze, k)
  const far = mix(mix(sky.horizon, hex('#d8f2ef'), 0.35), hex('#8fd0cc'), 0.3)
  const near = mix(hex('#3e9c98'), sky.horizon, 0.18)
  const tones = [0, 1, 2, 3, 4].map((i) => css(mix(far, near, i / 4)))
  const col = {
    bank: css(haze(mix(hex('#c9b980'), v.palette.near, 0.35))),
    bankDark: css(haze(hex('#8f8456'))),
    grass: css(haze(hex('#9aa260'))),
    reed: css(haze(hex('#6f7d45'))),
    reedTip: css(haze(hex('#8a5a3b'))),
    tamarisk: css(haze(hex('#7f9070'))),
    tamariskLight: css(haze(hex('#a8b494'))),
    bankRef: css(mix(hex('#b49a68'), near, 0.55)),
    plantRef: css(mix(hex('#5a6a3c'), far, 0.5)),
    ripple: css(mix(sky.horizon, hex('#ffffff'), 0.55), 0.7),
    wet: css(mix(hex('#b49a68'), near, 0.35)),
  }
  const drift = v.reducedMotion ? 0 : Math.floor(v.time * 1.2)
  let runStyle = ''
  const put = (style: string, x: number, y: number, h = 1) => {
    if (h <= 0) return
    if (style !== runStyle) {
      s.fillStyle = style
      runStyle = style
    }
    s.fillRect(x, y, 1, h)
  }

  for (let x = x0; x <= x1; x++) {
    const wx = v.camX + x
    const depth = v.world.lagoonDepth(wx)
    if (depth < 1.5) continue
    const path = v.walkY(wx)
    // An irregular far shore: little bays and spits.
    const wobble = depth > 4 ? Math.round(fbm(wx / 7, 31, 2) * 1.4) : 0
    const top = Math.round(path - depth + wobble)
    const u = Math.round(wx)

    // The far bank: a low strip of dune grass, wet at the water's edge, with reeds and tamarisk.
    if (hash(u >> 1, 70) < 0.6) put(col.bank, x, top - 2)
    put(col.bankDark, x, top - 1)
    let plant = 0
    let tamarisk = false
    const clump = Math.floor(u / 9)
    if (hash(clump, 71) < 0.45) {
      const within = u - clump * 9
      if (within > 1 && within < 7 && hash(u, 72) < 0.75) plant = 2 + Math.floor(hash(u, 73) * 4)
    } else if (hash(clump, 74) < 0.25) {
      const within = u - clump * 9
      plant = [0, 2, 4, 5, 5, 4, 3, 1, 0][within]
      tamarisk = true
    }
    if (plant > 0) {
      if (tamarisk) {
        put(col.tamarisk, x, top - 2 - plant, plant)
        if (hash(u, 75) < 0.5) put(col.tamariskLight, x, top - 2 - plant)
      } else {
        put(col.reed, x, top - 2 - plant, plant)
        if (hash(u, 76) < 0.4) put(col.reedTip, x, top - 2 - plant)
      }
    } else if (hash(u, 77) < 0.3) put(col.grass, x, top - 3)

    // The water: sky reflected far away, deeper teal nearer the path, the bank and plants mirrored.
    const rows = path - top
    for (let r = 0; r < rows; r++) {
      const k = rows <= 1 ? 1 : r / (rows - 1)
      put(tones[Math.min(4, Math.round(Math.pow(k, 0.85) * 4))], x, top + r)
    }
    put(col.bankRef, x, top)
    if (plant > 0) put(col.plantRef, x, top + 1, Math.min(rows - 2, Math.ceil(plant * 0.6)))
    for (let r = 2; r < rows - 1; r += 2) {
      if (hash((u >> 2) + drift * (r % 4 ? 1 : -1), r) < 0.2) put(col.ripple, x, top + r)
    }
    // Wet sand where the water meets the path.
    if (rows > 2) put(col.wet, x, path - 1)
  }
}

function waterColor(v: View, shore: Style['shore']): RGB {
  return shore === 'meadow' ? mix(v.palette.water, hex('#1f5f86'), 0.45) : mix(v.palette.water, hex('#3f9f9a'), 0.4)
}

function drawBody(s: CanvasRenderingContext2D, v: View, prop: Prop, st: Style, tops: Tops, climberSX: number) {
  const half = (prop.v ?? 120) / 2
  const cx = (prop.x - v.camX - climberSX) * st.parallax + climberSX
  if (cx + half < 0 || cx - half > v.W) return
  const level = Math.round(v.ground0 + (v.groundY(prop.x) - v.ground0) * st.parallax - st.rise)
  if (level >= v.H) return
  const pal = v.palette
  const sky = v.sky
  const meadow = st.shore === 'meadow'

  const water = waterColor(v, st.shore)
  const bank: RGB = meadow ? mix(mix(pal.grass, pal.grassDark, 0.45), sky.haze, 0.15) : hex('#d9c28e')
  const bankDark = shade(bank, 0.78)
  const tree: RGB = meadow ? mix(pal.conifer, sky.haze, 0.15) : mix(hex('#6f7d55'), sky.haze, 0.1)
  const larch: RGB = mix(mix(pal.larch, pal.conifer, 1 - pal.larchAlpha), sky.haze, 0.15)
  const refl = (c: RGB, k: number) => css(mix(c, water, k))
  const colors = {
    bank: css(bank),
    bankDark: css(bankDark),
    tree: css(tree),
    larch: css(larch),
    rock: css(mix(pal.rock, sky.haze, 0.2)),
    bankRef: refl(shade(bank, 0.7), 0.55),
    treeRef: refl(shade(tree, 0.8), 0.5),
    nearRef: refl(mix(pal.near, sky.haze, 0.12), 0.45),
    midRef: refl(mix(pal.mid, sky.haze, 0.3), 0.4),
    skyRef: refl(sky.horizon, 0.35),
    deep: css(shade(water, 0.85)),
    shine: css(mix(sky.horizon, hex('#ffffff'), 0.55)),
    ripple: css(mix(sky.horizon, hex('#ffffff'), 0.3), 0.55),
  }
  const seed = Math.round(prop.x)
  const drift = v.reducedMotion ? 0 : Math.floor(v.time * 1.5)
  const x0 = Math.max(0, Math.floor(cx - half))
  const x1 = Math.min(v.W - 1, Math.ceil(cx + half))

  for (let x = x0; x <= x1; x++) {
    const t = (x - cx) / half
    // The far shore curves towards us at both ends, where it dips out of sight behind the path.
    const a = Math.abs(t)
    const curve = st.flat > 0 ? smoothstep(st.flat, 1, a) : 1 - Math.sqrt(Math.max(0, 1 - a * a))
    const top = level + Math.round(curve * (st.rise + 10))
    if (top >= v.H) continue
    const u = Math.round(x - cx) + seed
    // The far bank, with small trees (or reeds by the lagoon) standing on it.
    const bankH = 2 + (hash(u >> 2, 3) < 0.4 ? 1 : 0)
    let plant = 0
    let golden = false
    if (meadow) {
      // Little pines and larches: a pointed silhouette every few pixels.
      const cell = Math.floor(u / 6)
      if (hash(cell, 11) < 0.5 && Math.abs(t) < 0.92) {
        const within = u - cell * 6
        plant = [0, 2, 5, 3, 1, 0][within] * (hash(cell, 12) < 0.5 ? 1 : 0.7)
        golden = hash(cell, 16) < 0.45
      }
    } else if (hash(u, 13) < 0.35 && Math.abs(t) < 0.95) {
      plant = 2 + Math.floor(hash(u, 14) * 3)
    }
    plant = Math.round(plant)
    s.fillStyle = colors.bank
    s.fillRect(x, top - bankH, 1, bankH)
    s.fillStyle = colors.bankDark
    s.fillRect(x, top - 1, 1, 1)
    if (meadow && hash(u, 15) < 0.06) {
      s.fillStyle = colors.rock
      s.fillRect(x, top - bankH - 1, 1, 2)
    }
    if (plant > 0) {
      s.fillStyle = golden ? colors.larch : colors.tree
      s.fillRect(x, top - bankH - plant, 1, plant)
    }

    // The mirror image: bank and plants, then the hills, the mountains and the sky.
    const above = top - bankH - plant
    const nearY = tops.near[x]
    const midY = tops.mid[x]
    const rPlant = Math.round(plant / SQUASH)
    const rBank = rPlant + Math.max(1, Math.round(bankH / SQUASH))
    const rNear = nearY < above ? rBank + Math.round((above - nearY) / SQUASH) : rBank
    const rMid = midY < Math.min(nearY, above) ? rNear + Math.round((Math.min(nearY, above) - midY) / SQUASH) : rNear
    const run = (style: string, from: number, to: number) => {
      const a = top + from
      const b = Math.min(v.H, top + to)
      if (b > a) {
        s.fillStyle = style
        s.fillRect(x, a, 1, b - a)
      }
    }
    run(colors.bankRef, 1, 1 + rBank - rPlant)
    run(colors.treeRef, 1 + rBank - rPlant, 1 + rBank)
    run(colors.nearRef, 1 + rBank, 1 + rNear)
    run(colors.midRef, 1 + rNear, 1 + rMid)
    run(colors.skyRef, 1 + rMid, 30)
    run(colors.deep, 30, v.H - top)
    s.fillStyle = colors.shine
    s.fillRect(x, top, 1, 1)
    // Ripples drifting across the surface.
    s.fillStyle = colors.ripple
    for (let r = 3; r < 30 && top + r < v.H; r += 3) {
      if (hash((u + drift * (r % 2 ? 1 : -1)) >> 2, r) < 0.28) s.fillRect(x, top + r, 1, 1)
    }
  }
}
