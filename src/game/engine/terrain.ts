import { hex, mix, shade, type RGB } from './color.ts'
import { fbm, rng, smoothstep } from './math.ts'
import type { View } from './view.ts'
import { GLACIER, WORLD_LEN, Z } from './world.ts'

/** A crevasse (small or the big one with the ladder) or the bergschrund: a wedge-shaped slot. */
export type Crack = { x0: number; x1: number; depth: number; kind: 'small' | 'big' | 'berg' }

const N = (() => {
  const r = rng(4242)
  const a = new Uint8Array(65536)
  for (let i = 0; i < a.length; i++) a[i] = Math.floor(r.next() * 256)
  return a
})()
/** Stable texture noise (0–255), cheap enough to sample per pixel. */
const nz = (x: number, y: number) => N[((y & 255) << 8) | (x & 255)]

const pack = (c: RGB) => (0xff000000 | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0

const C = {
  sand: hex('#ecd7a6'),
  sandLight: hex('#f8ebc6'),
  sandShade: hex('#dcc08c'),
  sandWet: hex('#c9ab78'),
  sandDeep: hex('#b99a6c'),
  shell: hex('#f6dde6'),
  pebble: hex('#a59b92'),
  dry: hex('#bfae5f'),
  dryLight: hex('#dccb7c'),
  dryShade: hex('#a8954f'),
  macchia: hex('#7a8048'),
  macchiaDark: hex('#5c6238'),
  macchiaDeep: hex('#454b2c'),
  redSoil: hex('#8c5a3c'),
  sea: hex('#2d8fc4'),
  seaShallow: hex('#46c1c8'),
  seaDeep: hex('#123e70'),
  seaLight: hex('#a6e8f2'),
  foam: hex('#f4fbff'),
  slot: hex('#1d4f88'),
  slotDeep: hex('#060f22'),
  lichen: hex('#c9a640'),
  dirtyIce: hex('#7d93a6'),
  debris: hex('#5f5852'),
  granite: hex('#b89a8e'),
  graniteDark: hex('#6e5a55'),
  white: hex('#ffffff'),
}

/** Bedrock darkens with depth (every 16 px), so the eye stays on the surface. */
const DEPTHS = [1, 0.93, 0.86, 0.8, 0.75, 0.7]

/** Underwater colours: mix towards the deep sea. */
const wet = (c: RGB, tint: number): RGB => (tint > 0 ? mix(c, C.seaDeep, tint) : c)

/**
 * Paints the ground, one column at a time, as a stack of layers: water (at sea), snow, glacier
 * ice, sand, soil, scree and finally bedrock. Each layer's thickness comes from the world, and
 * because thicknesses change gradually, materials meet along sloping, natural-looking boundaries.
 */
export class TerrainPainter {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private img: ImageData | null = null
  private buf = new Uint32Array(0)

  constructor() {
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
  }

  resize(W: number, H: number) {
    this.canvas.width = W
    this.canvas.height = H
    this.img = this.ctx.createImageData(W, H)
    this.buf = new Uint32Array(this.img.data.buffer)
  }

  paint(v: View, cracks: Crack[], crackAt: Int16Array): HTMLCanvasElement {
    const { W, H, palette: p, world, time } = v
    const buf = this.buf
    if (!this.img || buf.length !== W * H) return this.canvas
    buf.fill(0)
    const L = WORLD_LEN
    const shoreX = Z.shore * L
    const altTop = v.camAltPx + v.ground0
    const tick = Math.floor(time * 4)
    const wash = (Math.sin(time * 1.3) * 0.5 + 0.5) * 8
    const layers = world.layers

    /* ------------------------------------------------ colours shared by the frame */
    const snow = pack(p.snow)
    const snowShade = pack(p.snowShade)
    const white = pack(C.white)
    const snowFace: RGB[] = [p.snow, mix(p.snow, p.snowShade, 0.35), mix(p.snow, p.snowShade, 0.7), p.snowShade]

    const iceLight = mix(p.ice, C.white, 0.45)
    const iceBands: RGB[] = [iceLight, p.ice, mix(p.ice, p.iceDeep, 0.35), p.ice]
    const iceClean = new Uint32Array(16)
    for (let k = 0; k < 4; k++) for (let b = 0; b < 4; b++) iceClean[k * 4 + b] = pack(mix(iceBands[b], p.iceDeep, k * 0.24))
    const dirtRGB = mix(C.dirtyIce, C.debris, 0.35)
    const iceTab = new Uint32Array(16)
    const bubble = pack(mix(iceLight, C.white, 0.6))
    const dirtyBand = pack(mix(C.dirtyIce, p.ice, 0.3))
    const iceWall = pack(iceLight)
    const iceSurface = pack(mix(iceLight, C.white, 0.25))
    const debris = pack(C.debris)
    const debrisDark = pack(shade(C.debris, 0.7))
    const gravel = pack(mix(C.debris, p.rockLight, 0.4))
    const slotTones = Array.from({ length: 8 }, (_, i) => pack(mix(C.slot, C.slotDeep, Math.pow(i / 7, 0.8))))
    const lipShadow = pack(mix(p.snowShade, C.slot, 0.45))
    const caveTones = [pack(mix(C.slot, iceLight, 0.25)), pack(C.slot), pack(mix(C.slot, C.slotDeep, 0.6)), pack(C.slotDeep)]
    const melt = pack(mix(p.water, iceLight, 0.35))
    const meltLight = pack(mix(p.waterLight, C.white, 0.3))
    const snoutX = GLACIER.snout * L
    const portalX = snoutX + 15

    const seaTables = [0, 1, 2, 3].map((s) => {
      const top = mix(C.sea, C.seaShallow, s / 3)
      return Array.from({ length: 8 }, (_, i) => pack(mix(top, C.seaDeep, (i / 7) * (1 - s * 0.18))))
    })
    const seaLight = pack(C.seaLight)
    const foam = pack(C.foam)

    const sandRGB: RGB[] = [C.sand, C.sandLight, C.sandShade, C.sandWet, C.sandDeep, C.shell, C.pebble]
    const sandTab = new Uint32Array(7)
    const flowers = [pack(p.flower1), pack(p.flower2), pack(p.flower3)]
    const lichen = pack(C.lichen)

    const screeRGB: RGB[] = [p.rock, mix(p.rock, p.rockLight, 0.45), mix(p.rock, p.rockDark, 0.4), mix(p.rockLight, C.white, 0.12)]
    const scree = screeRGB.map(pack)
    const screeGap = pack(shade(p.rockDark, 0.8))
    const screeHi = pack(p.rockLight)

    const water = pack(p.groundSnow > 0.6 ? p.ice : p.water)
    const waterLight = pack(p.groundSnow > 0.6 ? p.snow : p.waterLight)

    // Per-column colour tables, recomputed only when the column's look actually changes.
    const hill = new Uint32Array(4)
    const rockTab = new Uint32Array(DEPTHS.length * 3)
    let rockKey = -1
    let soilKey = -1
    let sandKey = -1
    let rockJoint = 0
    let rockTop = 0
    let weathered = 0
    let speck = 0
    let grit = 0
    let grass = 0
    let grassL = 0
    let tuft = 0
    let flowerOk = false
    let shrub = 0
    let shrubL = 0
    let stone = 0
    let stoneL = 0
    let speckSoil = 0
    let subsoil = 0
    let subsoilDark = 0

    for (let x = 0; x < W; x++) {
      const wx = v.camX + x
      const gy = v.groundY(wx)
      if (gy >= H) continue
      const y0 = Math.max(0, gy)
      const xi = wx < 0 ? 0 : wx > L ? L : wx
      const f = wx / L
      const sea = wx < shoreX

      /* ------------------------------------------------------- the layer stack */
      const bed = sea ? Math.round(1 + (shoreX - wx) * 0.7) : 0
      const seasonal = p.groundSnow * smoothstep(0.17, 0.23, f)
      const firn = smoothstep(0.79, 0.86, f)
      const iceT = layers.ice[xi]
      const sandT = layers.sand[xi]
      const soilT = layers.soil[xi]
      const screeT = layers.scree[xi]
      let snowT = sea ? 0 : Math.max(Math.round(Math.max(seasonal, firn) * 5), layers.firn[xi])
      // Snow doesn't settle on the steep ice front of the snout.
      const front = world.snoutFront(wx)
      if (front !== null && front < 0.85) snowT = Math.min(snowT, front < 0.15 ? 0 : 1)
      const zWater = bed
      const zSnow = zWater + snowT
      const zIce = zSnow + iceT
      const zSand = zIce + sandT
      const zSoil = zSand + soilT
      const zScree = zSoil + screeT
      const exposed = !sea && zScree === zSnow

      // Underwater, everything takes on the colour of the sea.
      const tint = sea ? smoothstep(0, 40, bed) * 0.55 : 0

      /* -------------------------------------------------------------- bedrock */
      // Warm Sardinian granite by the sea, the season's grey alpine rock inland; darker with depth.
      const granite = 1 - smoothstep(0.15, 0.24, f)
      const rKey = Math.round(granite * 48) * 64 + Math.round(tint * 48)
      if (rKey !== rockKey) {
        rockKey = rKey
        const rock = mix(p.rock, C.granite, granite)
        const rockLight = mix(p.rockLight, mix(C.granite, C.white, 0.3), granite)
        const rockDark = mix(p.rockDark, C.graniteDark, granite)
        const contrast = 1 - granite * 0.6
        const strata: RGB[] = [rock, mix(rock, rockDark, 0.22 * contrast), mix(rock, rockLight, 0.18 * contrast)]
        for (let k = 0; k < DEPTHS.length; k++) {
          for (let i = 0; i < 3; i++) rockTab[k * 3 + i] = pack(wet(shade(strata[i], DEPTHS[k]), tint))
        }
        rockJoint = pack(wet(shade(rockDark, 0.85), tint))
        rockTop = pack(rockLight)
        weathered = pack(wet(mix(rock, p.soilDark, 0.35), tint))
        speck = pack(wet(granite > 0.5 ? C.graniteDark : rockDark, tint))
        grit = pack(wet(shade(mix(p.rockDark, C.debris, 0.4), 0.8), tint))
      }

      /* ----------------------------------------------------------------- sand */
      if (sandT > 0) {
        const k = Math.round(tint * 64)
        if (k !== sandKey) {
          sandKey = k
          for (let i = 0; i < 7; i++) sandTab[i] = pack(wet(sandRGB[i], tint))
        }
      }

      /* ----------------------------------------------------------------- soil */
      const medW = world.coast(wx)
      const forest = smoothstep(0.215, 0.235, f) - smoothstep(0.32, 0.34, f)
      const sKey = Math.round(medW * 40) * 4096 + Math.round(forest * 40) * 64 + Math.round(seasonal * 40)
      if (soilT > 0 && sKey !== soilKey) {
        soilKey = sKey
        const s = seasonal
        const grassA = mix(p.grass, C.dry, medW)
        const grassLA = mix(p.grassLight, C.dryLight, medW)
        const floor = (c: RGB) => mix(c, shade(p.soil, 0.9), forest * 0.35)
        const greens: RGB[] = [
          floor(mix(mix(p.grass, p.grassDark, 0.3), C.dryShade, medW)),
          floor(mix(mix(p.grass, p.grassDark, 0.6), C.macchia, medW)),
          floor(mix(mix(p.grassDark, p.nearDark, 0.35), C.macchiaDark, medW)),
          floor(mix(mix(p.grassDark, p.nearDark, 0.7), C.macchiaDeep, medW)),
        ]
        for (let k = 0; k < 4; k++) hill[k] = pack(mix(greens[k], snowFace[k], s))
        grass = pack(mix(mix(grassA, shade(grassA, 0.9), 0.5), p.snow, s))
        grassL = pack(mix(grassLA, p.snow, s))
        tuft = pack(mix(mix(grassLA, p.grass, 0.3), p.snowShade, s))
        flowerOk = p.flowerAlpha > 0.3 && s < 0.3
        shrub = pack(mix(mix(mix(p.conifer, p.grassDark, 0.3), C.macchiaDeep, medW), p.snowShade, s * 0.5))
        shrubL = pack(mix(mix(mix(p.coniferLight, p.grass, 0.4), C.macchia, medW), p.snow, s * 0.6))
        stone = pack(mix(p.rock, p.grassDark, 0.25))
        stoneL = pack(p.rockLight)
        speckSoil = pack(mix(shade(mix(p.grassDark, C.macchiaDark, medW), 0.85), p.snowShade, s))
        const under = mix(mix(p.soilDark, C.redSoil, medW * 0.6), p.snowShade, s * 0.4)
        subsoil = pack(under)
        subsoilDark = pack(shade(under, 0.8))
      }

      /* ------------------------------------------------------------------ ice */
      const dirtK = iceT > 0 ? 1 - smoothstep(0.749, 0.79, f) : 0
      if (iceT > 0) {
        if (dirtK > 0.01) {
          for (let k = 0; k < 16; k++) {
            const b = k & 3
            iceTab[k] = pack(mix(mix(iceBands[b], p.iceDeep, (k >> 2) * 0.24), dirtRGB, dirtK * 0.5))
          }
        } else iceTab.set(iceClean)
      }

      /* ------------------------------------------------------------ crevasses */
      const crackIdx = crackAt[xi] ?? 0
      const found = crackIdx > 0 ? cracks[crackIdx - 1] : null
      const crack = found && (iceT > 0 || found.kind === 'berg') ? found : null
      // In winter some small crevasses are hidden under snow bridges: only a faint sag gives them away.
      const bridged = crack !== null && crack.kind === 'small' && seasonal > 0.6 && ((crack.x0 * 7919) & 255) < 102
      let slotDepth = -1
      let edgeL = 99
      let edgeR = 99
      if (crack && !bridged) {
        const c = (crack.x0 + crack.x1) / 2
        const half = (crack.x1 - crack.x0) / 2
        const reach = crack.kind === 'berg' ? crack.depth : zIce - 3
        slotDepth = Math.min(reach, crack.depth * (1 - Math.abs(Math.floor(wx) + 0.5 - c) / half))
        edgeL = Math.floor(wx) - crack.x0
        edgeR = crack.x1 - 1 - Math.floor(wx)
      }
      const edgeDist = Math.min(edgeL, edgeR)
      // Snow lips curl over the slot (the bergschrund's upper lip most of all), with icicles beneath.
      const lip = crack?.kind === 'berg' ? (edgeR < 3 ? 3 : edgeL < 1 ? 1 : 0) : edgeDist < (crack?.kind === 'big' ? 2 : 1) ? 2 : 0
      const icicle = 1 + (nz(wx, 5) & 3)
      const sag = bridged && edgeDist > 0

      /* ------------------------------------------------- the snout's ice cave */
      // Meltwater runs out of a cave at the foot of the ice front (frozen over in winter).
      const pdx = wx - portalX
      const cave = Math.abs(pdx) <= 5 ? Math.round(Math.min(world.iceCap[xi] - 2, 5.5 * Math.sqrt(Math.max(0, 1 - (pdx / 5.6) ** 2)))) : 0
      const stream = seasonal < 0.5 && wx > snoutX - 38 && wx < portalX + 3 && nz(wx >> 3, 21) > 30

      /* -------------------------------------------------------------- surface */
      const sandTop = snowT === 0 && iceT === 0 && sandT > 0
      const soilTop = snowT === 0 && iceT === 0 && sandT === 0 && soilT > 0
      const nearShore = !sea && wx < shoreX + 14
      const washed = !sea && wx - shoreX < wash
      let surf: number
      const shallow = sea ? smoothstep(shoreX - 90, shoreX, wx) * 3 : 0
      const table = seaTables[Math.min(3, Math.round(shallow))]
      if (sea) {
        const crest = nz(wx + Math.floor(time * 6), 3) > 226
        surf = crest ? foam : (wx + Math.floor(time * 3)) % 7 === 0 ? seaLight : table[0]
      } else if (snowT > 0) surf = sag ? snowShade : nz(wx, tick) > 250 ? white : snow
      else if (iceT > 0) surf = dirtK > 0.2 && nz(wx, 31) < dirtK * 110 ? gravel : iceSurface
      else if (sandT > 0) surf = washed ? foam : nearShore ? sandTab[3] : nz(wx, 1) < 90 ? sandTab[1] : sandTab[0]
      else if (soilT > 0) surf = nz(wx, 1) < 90 ? grassL : grass
      else if (screeT > 0) surf = nz(wx, 2) < 120 ? screeHi : scree[nz(wx, 3) & 3]
      else surf = rockTop

      // Dune grass on the sand, tufts and flowers on the fields.
      if (gy >= 2 && (sandTop || soilTop)) {
        const above = (gy - 1) * W + x
        if (sandTop) {
          if (f > 0.068 && nz(wx, 6) < 34) {
            buf[above] = pack(C.dry)
            if (nz(wx, 16) < 120) buf[above - W] = pack(C.dryLight)
          }
        } else {
          if (nz(wx, 6) < 56) buf[above] = tuft
          if (flowerOk && nz(wx, 7) < 18) buf[above] = flowers[nz(wx, 8) % 3]
        }
      }

      const wave = nz(wx >> 3, 50) >> 5
      const iceWave = iceT > 0 ? Math.round(fbm(wx / 23, 5, 2) * 3 + 3) : 0
      const dirtyRun = nz(wx >> 3, 90) > 110

      for (let y = y0; y < H; y++) {
        const d = y - gy
        const wy = altTop - y
        let c: number
        if (slotDepth > 0 && d <= slotDepth) {
          // Inside a crevasse: overhanging snow lips, icicles on the walls, then blue darkness.
          if (crack!.kind === 'berg' && d === 0) c = snow
          else if (d < lip) c = d === 0 ? snow : nz(wx, d) & 1 ? snow : snowShade
          else if (d === lip && lip > 0) c = lipShadow
          else if (d >= slotDepth - 1) c = iceWall
          else if (edgeDist <= 1 && d > lip && d <= lip + icicle) c = iceWall
          else c = slotTones[Math.min(7, Math.floor((d / (crack!.depth + 1)) * 8))]
        } else if (cave > 0 && d >= zIce - cave && d < zIce) {
          // The ice cave: a lighter rim, darkness inside; meltwater along its floor.
          const fromTop = d - (zIce - cave)
          if (fromTop === 0 || Math.abs(pdx) >= 5) c = iceWall
          else if (stream && d === zIce - 1) c = (wx + Math.floor(time * 3)) % 4 === 0 ? meltLight : melt
          else if (seasonal > 0.5 && fromTop <= 1 + (nz(wx, 9) & 1)) c = iceWall
          else c = caveTones[Math.min(3, fromTop >> 1)]
        } else if (d === 0) {
          c = stream && wx < snoutX ? ((wx + Math.floor(time * 3)) % 5 === 0 ? meltLight : melt) : surf
        } else if (d < zWater) {
          // Blend shallow and deep water by dithering between neighbouring shades.
          c = seaTables[Math.min(3, (shallow + nz(wx, d + 99) / 256) | 0)][Math.min(7, (d + (nz(wx + 7, d) >> 6)) >> 2)]
          if (d < 16 && nz(wx + Math.floor(time * 4), d * 7 + Math.floor(time * 2)) > 248) c = seaLight
        } else if (d < zSnow) {
          c = d === zSnow - 1 || (sag && d === 1) ? snowShade : snow
        } else if (d < zIce) {
          const dd = d - zSnow
          c = iceTab[(Math.min(3, (dd / 14) | 0) << 2) | ((((dd + iceWave) / 3) | 0) & 3)]
          if (zIce - d <= 2) c = nz(wx, wy) & 1 ? debrisDark : debris
          else if (nz(wx, wy) > 251) c = bubble
          else if (dirtyRun && (dd + iceWave) % 19 === 9) c = dirtyBand
          else if (dirtK > 0.05 && dd < 26 && nz(wx >> 1, wy >> 1) < dirtK * 7) c = (wy & 1) === 0 ? debris : gravel
        } else if (d < zSand) {
          const ds = d - zIce
          if (ds < 3) c = sea || nearShore ? sandTab[3] : sandTab[0]
          else if (ds >= 12) c = sandTab[4]
          else c = ((ds + ((wx >> 2) & 1)) >> 1) & 1 ? sandTab[0] : sandTab[2]
          if (zSand - d === 1 && soilT > 0) c = sandTab[4]
          else if (ds >= 1 && ds <= 4 && nz(wx, ds + 60) > 252) c = sandTab[5]
          else if (nz(wx >> 1, (ds >> 1) + 80) > 249) c = sandTab[6]
        } else if (d < zSoil) {
          const dl = d - zSand
          const rem = zSoil - d
          if (dl < 3 && zSand === zSnow) {
            c = dl === 1 && nz(wx, 41) < 70 ? grassL : grass
          } else if (rem <= 2) {
            // Where the soil meets the rock or scree below: darker, stonier earth.
            c = nz(wx, wy) & 1 ? subsoil : subsoilDark
          } else {
            const dd = Math.max(0, dl - 3)
            c = hill[Math.min(3, ((dd + wave) / 14) | 0)]
            if (nz(wx >> 2, (dd >> 2) + 40) > 241) c = (dd & 3) === 0 ? shrubL : shrub
            else if (nz(wx >> 2, (dd >> 2) + 100) > 248 || (rem < 8 && nz(wx >> 1, wy >> 1) > 236)) c = (dd & 3) === 0 ? stoneL : stone
            else if (nz(wx, dd + 20) > 249) c = tuft
            else if (nz(wx >> 1, (dd >> 1) + 33) > 249) c = speckSoil
            else if (dd < 14 && flowerOk && nz(wx, dd + 70) > 251) c = flowers[nz(wx, dd) % 3]
          }
        } else if (d < zScree) {
          // Loose rubble: rounded stones of different sizes, with dark grit in between.
          const yy = wy + 30000
          const cy = yy >> 2
          const ly = yy & 3
          const xx = wx + 30000 + (nz(cy, 77) % 5)
          const cx = (xx / 5) | 0
          const lx = xx - cx * 5
          const h = nz(cx, cy)
          const h2 = nz(cx + 101, cy + 37)
          const sw = 3 + (h & 1) + ((h >> 1) & 1)
          const sh = 2 + ((h >> 2) & 1) + (sw > 3 ? (h >> 3) & 1 : 0)
          const ix = lx - (h2 % (6 - sw))
          const iy = ly - ((h2 >> 4) % (5 - sh))
          if (ix < 0 || ix >= sw || iy < 0 || iy >= sh || (sw > 3 && (ix === 0 || ix === sw - 1) && (iy === 0 || iy === sh - 1))) {
            c = seasonal > 0.5 && d - zSoil < 10 && (h2 & 3) === 0 ? snowShade : grit
          } else if (iy === sh - 1) {
            c = seasonal > 0.5 && (h & 16) === 0 ? snow : screeHi
          } else c = iy === 0 ? screeGap : scree[(h >> 5) & 3]
        } else {
          const dr = d - zScree
          const yy = wy + 30000 + (nz(wx >> 3, 9) >> 5)
          const band = yy >> 2
          const base = Math.min(DEPTHS.length - 1, dr >> 4) * 3
          c = rockTab[base + (band % 3)]
          // Bedding planes (partial dark lines) and the odd vertical joint make blocks of rock.
          if ((yy & 3) === 0 && nz(wx >> 2, band) > 150) c = rockTab[Math.min(DEPTHS.length - 1, (dr >> 4) + 1) * 3 + 1]
          else if (nz(wx, band) < 9) c = rockJoint
          else if (exposed && seasonal > 0.6 && (yy & 3) === 1 && nz(wx >> 2, band) > 165) c = snow
          else if (exposed && dr < 8 && nz(wx + 3, wy) > 250) c = lichen
          else if (granite > 0.4 && nz(wx + 11, wy + 5) > 247) c = speck
          if (dr < 2 && !exposed) c = weathered
        }
        buf[y * W + x] = c
      }

      // Streams: water fills the little valley above the ground line.
      for (const st of world.streams) {
        if (Math.abs(wx - st) >= 7) continue
        const level = v.groundY(st - 8) + 2
        for (let y = Math.max(0, level); y < Math.min(gy + 1, H); y++) {
          buf[y * W + x] = y === level && nz(wx + Math.floor(time * 3), 11) < 52 ? waterLight : water
        }
      }
    }
    this.ctx.putImageData(this.img, 0, 0)
    return this.canvas
  }
}
