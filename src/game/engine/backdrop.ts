import { css, hex, mix, shade } from './color.ts'
import { clamp, fbm, hash, ridged, rng, smoothstep } from './math.ts'
import type { View } from './view.ts'
import { WORLD_LEN } from './world.ts'

type Layer = {
  parallax: number
  vscale: number
  seed: number
  base: number
  amp: number
  scale: number
  octaves: number
  relative?: number
  haze: number
  color: 'far' | 'mid' | 'near'
  snow: boolean
  trees?: boolean
  /** Rounded, forested hills instead of sharp ridges. */
  rolling?: boolean
  /** Bare rock above the treeline and snow on the highest tops (for hills that are otherwise green). */
  alpine?: boolean
  /** Hanging glaciers spilling down from the snowfields. */
  glaciers?: boolean
}

/** How fast the mid range of mountains slides by, relative to the trail. */
export const MID_PARALLAX = 0.13

const LAYERS: Layer[] = [
  { parallax: 0.05, vscale: 0.026, seed: 11, base: 1900, amp: 3000, scale: 130, octaves: 3, haze: 0.5, color: 'far', snow: true },
  {
    parallax: MID_PARALLAX,
    vscale: 0.045,
    seed: 23,
    base: 1250,
    amp: 1500,
    scale: 90,
    octaves: 2,
    haze: 0.3,
    color: 'mid',
    snow: true,
    glaciers: true,
  },
  {
    parallax: 0.33,
    vscale: 0.1,
    seed: 37,
    base: -250,
    amp: 520,
    scale: 60,
    octaves: 3,
    relative: 0.85,
    haze: 0.12,
    color: 'near',
    snow: false,
    trees: true,
    rolling: true,
    alpine: true,
  },
]

const SEA_FAR = hex('#6fb7d9')
const SEA_NEAR = hex('#2c7fb8')
const SEA_GLINT = hex('#e8fbff')
const MED_HILL = hex('#7f8a4a')
const MED_HILL_DARK = hex('#5d6a3a')
const ICE_TONGUE = hex('#bfe6f5')

function layerRidge(layer: Layer, u: number, camAlt: number) {
  const base = layer.relative !== undefined ? camAlt * layer.relative + layer.base : layer.base
  if (layer.rolling) return base + layer.amp * (fbm(u / layer.scale, layer.seed, layer.octaves) * 0.5 + 0.5)
  return base + layer.amp * ridged(u / layer.scale, layer.seed, layer.octaves)
}

/** How far a layer sinks below the horizon: the Alps only rise once you're inland. */
function layerDrop(layer: Layer, fx: number, H: number) {
  if (layer.color === 'near') return (1 - smoothstep(0.045, 0.11, fx)) * H * 0.45
  return (1 - smoothstep(0.115, 0.215, fx)) * H * 0.75
}

/** Height of the mid range's ridge at `u`, a point fixed to the range (in its own sliding coordinates). */
export const midRidge = (u: number) => layerRidge(LAYERS[1], u, 0)

/** Screen y of the mid range's ridge at `u`, on screen or off it. */
export function midRidgeY(v: View, u: number) {
  const layer = LAYERS[1]
  const x = u - Math.round(v.camX * layer.parallax)
  return Math.round(v.horizon - (midRidge(u) - v.camAlt) * layer.vscale + layerDrop(layer, (v.camX + x) / WORLD_LEN, v.H))
}

/** Where the distant sea ends and the land begins (trail fraction under the column). */
export const SEA_END = 0.132

/** The little island on the sea's horizon: where it is on screen and how tall it is along its width. */
export const ISLAND = {
  width: 26,
  left: (v: View) => Math.round(v.W * 0.55 - v.camX * 0.04),
  height: (i: number) => Math.round(Math.sin((i / 25) * Math.PI) * 4 + hash(i, 4) * 0.8),
  /** Whether a screen column shows the sea (and so the island) rather than the coast. */
  atSea: (v: View, x: number) => (v.camX + x) / WORLD_LEN <= SEA_END - 0.01,
}
/**
 * Where the coastal plain on the horizon starts to dip out of sight, and where it's gone. The Alps
 * (see drop) are fully above the horizon by the time it dips below it.
 */
/** How far ahead of the point opposite the sun the moon rides (radians on the oval; π = 12 hours). */
const MOON_LEAD = 0.15 * Math.PI
const PLAIN_SINK = 0.192
const PLAIN_END = 0.236

export class Backdrop {
  /** Screen y of the top of each mountain layer in each column (for lake reflections, and to tell open sky). */
  readonly tops = { near: new Int16Array(1), mid: new Int16Array(1), far: new Int16Array(1) }
  private stars: { x: number; y: number; p: number }[] = []
  private starsW = 0

  resize(W: number, H: number) {
    this.tops.near = new Int16Array(W)
    this.tops.mid = new Int16Array(W)
    this.tops.far = new Int16Array(W)
    if (this.starsW !== W) {
      const r = rng(83)
      this.stars = Array.from({ length: Math.round((W * H) / 900) }, () => ({
        x: Math.floor(r.next() * W),
        y: Math.floor(r.next() * H * 0.62),
        p: r.next() * 10,
      }))
      this.starsW = W
    }
  }

  /**
   * The sun and the moon ride the same fixed oval across the sky: up from the left horizon, over
   * the top and down to the right. `angle` 0 is the left end of the oval, π the right; above the
   * horizon in between.
   */
  private orbit(v: View, angle: number) {
    const cx = v.W * 0.5
    const rx = v.W * 0.42
    const cy = v.horizon + 2
    const ry = v.horizon * 0.82
    return { x: Math.round(cx - rx * Math.cos(angle)), y: Math.round(cy - ry * Math.sin(angle)), elevation: Math.sin(angle) }
  }

  /** The sun's place on the oval and how visible it is (0 = set, or hidden by night). */
  sun(v: View) {
    const at = this.orbit(v, ((v.hour - 6) / 12) * Math.PI)
    const alpha = v.sky.daylight > 0.05 ? clamp(v.sky.daylight * 1.5) * smoothstep(-0.08, 0, v.sky.sunElevation) : 0
    return { x: at.x, y: at.y, alpha, warm: clamp(1 - at.elevation * 2.2) }
  }

  /**
   * The moon, on the same oval, opposite the sun but a little ahead of it: already rising when the
   * sun goes down, and set again shortly before dawn.
   */
  moon(v: View) {
    return this.orbit(v, ((v.hour - 6) / 12) * Math.PI - Math.PI + MOON_LEAD)
  }

  /** How visible the moon is: it fades out by day. */
  moonAlpha(v: View) {
    return this.moon(v).elevation > -0.2 ? clamp(1.25 - v.sky.daylight * 1.4) : 0
  }

  /** Whether a screen point shows open sky (nothing of the landscape drawn in front of it). */
  openSky(v: View, x: number, y: number) {
    const c = Math.round(x)
    if (c < 0 || c >= v.W || y >= v.horizon) return false
    return y < this.tops.far[c] && y < this.tops.mid[c] && y < this.tops.near[c] && y < v.groundY(v.camX + c)
  }

  drawSky(ctx: CanvasRenderingContext2D, v: View) {
    const { W, H, sky } = v
    const bands = 14
    const bandH = Math.ceil((v.horizon + 12) / bands)
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = css(mix(sky.top, sky.horizon, Math.pow(i / (bands - 1), 1.3)))
      ctx.fillRect(0, i * bandH, W, bandH + 1)
    }
    ctx.fillStyle = css(sky.horizon)
    ctx.fillRect(0, bands * bandH, W, H)

    if (sky.stars > 0.02) {
      for (const st of this.stars) {
        const tw = 0.55 + 0.45 * Math.sin(v.time * (1 + (st.p % 2)) + st.p)
        ctx.fillStyle = `rgba(255,255,240,${(sky.stars * tw).toFixed(2)})`
        ctx.fillRect(st.x, st.y, 1, 1)
      }
    }
    const moon = this.moon(v)
    const moonAlpha = this.moonAlpha(v)
    if (moonAlpha > 0.02) this.drawMoon(ctx, moon.x, moon.y, moonAlpha)
    const sun = this.sun(v)
    if (sun.alpha > 0.01) {
      ctx.globalAlpha = sun.alpha
      disc(ctx, sun.x, sun.y, 8, css(mix(hex('#fff8d6'), hex('#ffb070'), sun.warm), 0.25))
      disc(ctx, sun.x, sun.y, 5, css(mix(hex('#fffbe8'), hex('#ffd08a'), sun.warm)))
      ctx.globalAlpha = 1
    }
  }

  private drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number, alpha: number) {
    ctx.globalAlpha = alpha
    disc(ctx, cx, cy, 8, 'rgba(243,240,220,0.08)')
    disc(ctx, cx, cy, 5, '#f3f0dc')
    ctx.fillStyle = '#d6d0b4'
    ctx.fillRect(cx - 2, cy - 1, 2, 2)
    ctx.fillRect(cx + 1, cy + 2, 1, 1)
    ctx.fillRect(cx + 2, cy - 3, 1, 1)
    ctx.globalAlpha = 1
  }

  drawClouds(s: CanvasRenderingContext2D, v: View) {
    const { W } = v
    const col = css(mix(hex('#ffffff'), v.sky.horizon, 0.25), 0.9)
    const shadow = css(mix(hex('#c8d6e6'), v.sky.horizon, 0.3), 0.9)
    const span = W + 140
    for (let i = 0; i < 6; i++) {
      const speed = 2 + (i % 3)
      const x = ((((i * 197 - v.camX * 0.07 + v.time * speed) % span) + span) % span) - 70
      const y = 10 + ((i * 53) % Math.max(20, Math.round(v.horizon * 0.55)))
      const w = 18 + ((i * 37) % 26)
      s.fillStyle = col
      s.fillRect(Math.round(x), y, w, 4)
      s.fillRect(Math.round(x) + 4, y - 3, w - 10, 3)
      s.fillRect(Math.round(x) + 8, y - 5, Math.max(4, w - 22), 2)
      s.fillStyle = shadow
      s.fillRect(Math.round(x) + 2, y + 4, w - 4, 1)
    }
  }

  /** Far and mid Alps, the distant sea, the cloud sea and the near hills. */
  drawLayers(s: CanvasRenderingContext2D, v: View) {
    this.tops.near.fill(v.H)
    this.tops.mid.fill(v.H)
    this.tops.far.fill(v.H)
    this.drawLayer(s, v, LAYERS[0])
    this.drawLayer(s, v, LAYERS[1])
    this.drawCloudSea(s, v)
    this.drawSea(s, v)
    this.drawLayer(s, v, LAYERS[2])
  }

  /** Low-frequency slope of a layer: flanks rising to the right face away from the sun (shadow). */
  private flankShadow(layer: Layer, u: number) {
    const f = (x: number) => (layer.rolling ? fbm(x / layer.scale, layer.seed, 1) : ridged(x / layer.scale, layer.seed, 1))
    return f(u + 3) - f(u - 3) > 0.004
  }

  private drawLayer(s: CanvasRenderingContext2D, v: View, layer: Layer) {
    const { W, H, palette, sky } = v
    const steps = layer.color === 'near' ? 18 : 1
    // Near hills turn Mediterranean (olive scrub) towards the coast; pre-mix a few tones.
    const tones = Array.from({ length: steps }, (_, i) => {
      const med = steps === 1 ? 0 : i / (steps - 1)
      const baseC = mix(mix(palette[layer.color], MED_HILL, med * 0.75), sky.haze, layer.haze)
      const dark = mix(shade(baseC, 0.82), hex('#3a4a7a'), 0.1)
      const hazeC = mix(baseC, sky.haze, 0.12)
      const tree = mix(mix(palette.nearDark, MED_HILL_DARK, med * 0.6), sky.haze, layer.haze)
      return { base: css(baseC), dark: css(dark), haze: css(hazeC), tree: css(tree) }
    })
    const snowC = mix(palette.peakSnow, sky.haze, layer.haze * 0.6)
    const snowShadeC = mix(mix(snowC, hex('#9fb4dc'), 0.4), mix(palette[layer.color], sky.haze, layer.haze), 0.1)
    const snowCss = css(snowC)
    const snowShadeCss = css(snowShadeC)
    const iceCss = css(mix(ICE_TONGUE, sky.haze, layer.haze))
    const iceDarkCss = css(mix(mix(ICE_TONGUE, hex('#6aa6cf'), 0.45), sky.haze, layer.haze))
    const treeSnowCss = css(mix(palette.snow, sky.haze, 0.2))
    const rockC = mix(mix(palette.rock, palette[layer.color], 0.3), sky.haze, layer.haze)
    const rockCss = css(rockC)
    const rockDarkCss = css(mix(shade(rockC, 0.8), hex('#3a4a7a'), 0.1))
    const offset = Math.round(v.camX * layer.parallax)
    const band = layer.color === 'far' ? 34 : layer.color === 'mid' ? 30 : 140
    const lean = 0.55
    const pad = Math.ceil(band * lean) + 2
    const shadow = new Uint8Array(W + pad * 2)
    for (let i = 0; i < shadow.length; i++) shadow[i] = this.flankShadow(layer, offset + i - pad) ? 1 : 0
    // The ridge line a few columns ahead too, to spot crests with a steep lee side.
    const ridge = new Float32Array(W + 4)
    const ys = new Int16Array(W + 4)
    for (let x = 0; x < W + 4; x++) {
      ridge[x] = layerRidge(layer, offset + x, v.camAlt)
      ys[x] = Math.round(v.horizon - (ridge[x] - v.camAlt) * layer.vscale + layerDrop(layer, (v.camX + x) / WORLD_LEN, H))
    }

    for (let x = 0; x < W; x++) {
      const u = offset + x
      const fx = (v.camX + x) / WORLD_LEN
      const drop = layerDrop(layer, fx, H)
      const R = ridge[x]
      const y = ys[x]
      if (y >= H) continue
      this.tops[layer.color][x] = y
      // Dithered between neighbouring tones, so the change of colour never draws a vertical seam.
      const med = clamp(1 - smoothstep(0.15, 0.2, fx)) * (steps - 1)
      const tone = tones[steps === 1 ? 0 : Math.min(steps - 1, Math.floor(med + hash(u, 91)))]
      const styles = [tone.base, tone.dark, snowCss, snowShadeCss, rockCss, rockDarkCss]
      s.fillStyle = tone.base
      s.fillRect(x, y, 1, H - y)
      if (y + band < H) {
        s.fillStyle = tone.haze
        s.fillRect(x, y + band, 1, H - y - band)
      }
      const toY = (alt: number) => Math.round(v.horizon - (alt - v.camAlt) * layer.vscale + drop)
      let snowEnd = y
      let rockEnd = y
      if (layer.snow) {
        const line = palette.snowline + fbm(u / 9, layer.seed + 5, 2) * 180
        if (R > line) snowEnd = toY(line)
      } else if (layer.alpine) {
        // Up by the glacier the near hills turn to rock, with snow on the highest tops.
        const line = Math.max(palette.snowline, 2700) + fbm(u / 9, layer.seed + 5, 2) * 150
        if (R > line) snowEnd = toY(line)
        const rockLine = 2350 + fbm(u / 13, layer.seed + 7, 2) * 140
        if (R > rockLine) rockEnd = toY(rockLine)
      }
      // Walk down the band, batching runs of the same colour.
      let runColor = -1
      let runStart = y
      const end = Math.min(H, y + band)
      for (let yy = y; yy <= end; yy++) {
        let c = -1
        if (yy < end) {
          const sh = shadow[x + pad + Math.round((yy - y) * lean)] === 1
          if (yy < snowEnd) c = sh ? 3 : 2
          else if (yy < rockEnd) c = sh ? 5 : 4
          else c = sh ? 1 : 0
        }
        if (c !== runColor) {
          if (runColor > 0) {
            s.fillStyle = styles[runColor]
            s.fillRect(x, runStart, 1, yy - runStart)
          }
          runColor = c
          runStart = yy
        }
      }
      if (snowEnd > end) {
        s.fillStyle = snowCss
        s.fillRect(x, end, 1, snowEnd - end)
      }
      if (rockEnd > Math.max(end, snowEnd)) {
        s.fillStyle = rockCss
        s.fillRect(x, Math.max(end, snowEnd), 1, rockEnd - Math.max(end, snowEnd))
      }
      // Cornices: wind-blown snow curling out over the lee side of sharp, snowy crests.
      if (snowEnd > y + 1 && x > 0 && ys[x - 1] >= y && ys[x + 3] - y >= 5 && hash(u, layer.seed) < 0.7) {
        const n = layer.color === 'far' ? 2 : 3
        for (let k = 1; k <= n; k++) {
          const cy = y + (k === n ? 1 : 0)
          if (ys[x + k] <= cy) break
          s.fillStyle = snowCss
          s.fillRect(x + k, cy, 1, 1)
          s.fillStyle = snowShadeCss
          s.fillRect(x + k, cy + 1, 1, 1)
        }
      }
      if (layer.glaciers && snowEnd > y + 2) {
        const g = fbm(u / 11, layer.seed + 3, 2)
        if (g > 0.18) {
          const len = Math.round((g - 0.18) * 46)
          s.fillStyle = iceCss
          s.fillRect(x, snowEnd, 1, len)
          s.fillStyle = iceDarkCss
          for (let k = 2; k < len; k += 3) s.fillRect(x, snowEnd + k + (u & 1), 1, 1)
        }
      }
      if (layer.trees && R < 2250 && fx > 0.075) {
        const cell = Math.floor(u / 5)
        const within = u - cell * 5
        const th = Math.round([1, 3, 4, 3, 1][within] * (0.5 + hash(cell, 77) * 0.8))
        if (hash(cell, 78) < 0.75 && th > 0) {
          s.fillStyle = tone.tree
          s.fillRect(x, y - th, 1, th + 2)
          if (palette.treeSnow > 0.5 && fx > 0.2) {
            s.fillStyle = treeSnowCss
            s.fillRect(x, y - th, 1, 1)
          }
        }
      }
    }
  }

  /** The distant sea seen from the coast, with a sun (or moon) glitter path and a few sails. */
  private drawSea(s: CanvasRenderingContext2D, v: View) {
    const { W, H, horizon, sky } = v
    const startF = v.camX / WORLD_LEN
    if (startF > PLAIN_END) return
    const far = mix(SEA_FAR, sky.haze, 0.45)
    const rows = 7
    const tones = Array.from({ length: rows }, (_, i) => css(mix(far, SEA_NEAR, i / (rows - 1))))
    const glint = css(mix(SEA_GLINT, sky.horizon, 0.2), 0.8)
    const night = sky.daylight < 0.4
    const glitterX = night ? this.moon(v).x : this.sun(v).x
    const step = 5
    // The plain turns from dry Mediterranean scrub to hazy green farmland towards the mountains.
    const steps = 14
    const lands = Array.from({ length: steps }, (_, i) => {
      const k = i / (steps - 1)
      const land = mix(mix(MED_HILL, v.palette.near, k * 0.6), sky.haze, 0.5 - k * 0.08)
      const dark = mix(mix(MED_HILL_DARK, v.palette.nearDark, k * 0.6), sky.haze, 0.45 - k * 0.08)
      return { land: css(mix(land, v.palette.far, 0.15)), dark: css(mix(dark, v.palette.far, 0.15)) }
    })
    for (let x = 0; x < W; x++) {
      const wx = v.camX + x
      const fx = wx / WORLD_LEN
      const edge = SEA_END + fbm(wx / 40, 3, 2) * 0.006
      if (fx > edge) {
        // Low, hazy countryside beyond the coast. It hides the foot of the Alps while they're still
        // rising over the horizon, then dips gently out of sight behind the near hills — only once
        // every ridge is clear of the horizon, so no sky ever shows below it.
        const sink = smoothstep(PLAIN_SINK, PLAIN_END, fx)
        if (sink >= 1) continue
        const rise = smoothstep(edge, edge + 0.03, fx)
        const hl = Math.round(2 + rise * 6 + fbm(wx / 30, 9, 3) * 6 * (1 - sink) - sink * sink * 70)
        const tone = lands[Math.min(steps - 1, Math.floor(smoothstep(0.15, 0.21, fx) * (steps - 1) + hash(wx, 92)))]
        s.fillStyle = tone.land
        s.fillRect(x, horizon - hl, 1, H - horizon + hl)
        if (fbm(wx / 9, 4, 2) > 0.25) {
          s.fillStyle = tone.dark
          s.fillRect(x, horizon - hl, 1, 1)
        }
        continue
      }
      for (let i = 0; i < rows; i++) {
        s.fillStyle = tones[i]
        const y0 = horizon + (i === 0 ? 0 : 1 + (i - 1) * step)
        s.fillRect(x, y0, 1, i === rows - 1 ? H - y0 : i === 0 ? 1 : step)
      }
      // Glints on the water under the sun (or the moon).
      const off = Math.abs(x - glitterX)
      if (off < 16) {
        for (let y = horizon + 2; y < horizon + 40; y += 3) {
          if (off > 2 + (y - horizon) * 0.35) continue
          if (hash(x * 31 + y, Math.floor(v.time * 2.5)) < (night ? 0.1 : 0.16)) {
            s.fillStyle = glint
            s.fillRect(x, y, 2, 1)
          }
        }
      }
      // The land rises gently where the sea ends.
      const head = smoothstep(edge - 0.01, edge, fx)
      if (head > 0) {
        const hh = Math.round(head * 2 + fbm(wx / 7, 9, 2))
        if (hh > 0) {
          s.fillStyle = lands[0].land
          s.fillRect(x, horizon - hh, 1, hh + 1)
        }
      }
    }
    // An island on the horizon and a couple of sails.
    const isl = ISLAND.left(v)
    s.fillStyle = css(mix(MED_HILL, sky.haze, 0.62))
    for (let i = 0; i < ISLAND.width; i++) {
      if (isl + i < 0 || isl + i >= W || !ISLAND.atSea(v, isl + i)) continue
      const h = ISLAND.height(i)
      s.fillRect(isl + i, horizon - h, 1, h)
    }
    if (!night) {
      for (let k = 0; k < 2; k++) {
        const sx = Math.round(((k * 157 + v.time * (1.5 + k) - v.camX * 0.06) % (W + 60) + W + 60) % (W + 60)) - 30
        const fx = (v.camX + sx) / WORLD_LEN
        if (fx > SEA_END - 0.005) continue
        const sy = horizon + 3 + k * 4
        s.fillStyle = '#f4f4f4'
        s.fillRect(sx, sy - 3, 1, 3)
        s.fillRect(sx + 1, sy - 2, 1, 2)
        s.fillStyle = css(mix(far, hex('#ffffff'), 0.3))
        s.fillRect(sx - 1, sy, 4, 1)
      }
    }
  }

  private drawCloudSea(s: CanvasRenderingContext2D, v: View) {
    const { W, H } = v
    const fade = clamp((v.camAlt - 2050) / 700)
    if (fade <= 0) return
    const y0 = Math.round(v.horizon - (2550 - v.camAlt) * 0.04)
    if (y0 > H + 10 || y0 < -30) return
    const a = Math.min(1, fade * 1.8)
    const top = css(mix(hex('#ffffff'), v.sky.haze, 0.2), 0.95 * a)
    const body = css(mix(hex('#e8eef6'), v.sky.haze, 0.35), 0.9 * a)
    const off = v.camX * 0.18 + v.time * 1.2
    for (let x = 0; x < W; x++) {
      const u = off + x
      const t = Math.round(fbm(u / 26, 5, 3) * 6 + fbm(u / 7, 6, 2) * 2)
      const thick = 8 + Math.round((fbm(u / 40, 7, 2) + 1) * 6)
      s.fillStyle = top
      s.fillRect(x, y0 + t, 1, 1)
      s.fillStyle = body
      s.fillRect(x, y0 + t + 1, 1, thick)
    }
  }
}

export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  ctx.fillStyle = fill
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.6))
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1)
  }
}

