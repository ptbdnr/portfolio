import { clamp, fbm, hash, lerp, monotoneSpline, rng, smoothstep } from './math.ts'

/**
 * The trail, left to right: windsurf on the sea → a Sardinian-style beach → bike through the
 * countryside → an Alpine village → forest → pastures and the hut → a fork (over the rocks with a
 * climb and an abseil, or round the lake) → golden larches → moraine → glacier → summit.
 * Seasons follow the journey: summer by the sea, autumn in the mountains, winter up high.
 */
export const WORLD_LEN = 6400
/** Main terrain vertical scale: screen pixels per metre of altitude. */
export const PX_PER_M = 0.3
export const START_X = 40
export const END_X = WORLD_LEN - 70
export const SUMMIT_ALT = 4061
export const BASE_ALT = 0

export type Route = 'rocks' | 'lake'

export type Biome =
  | 'sea'
  | 'beach'
  | 'country'
  | 'valley'
  | 'forest'
  | 'pasture'
  | 'crag'
  | 'lake'
  | 'larch'
  | 'moraine'
  | 'glacier'
  | 'summit'

/** Where things happen, as fractions of the trail. */
export const Z = {
  shore: 0.0505,
  bikeStart: 0.086,
  bikeEnd: 0.188,
  village: 0.2,
  hut: 0.425,
  fork: 0.463,
  forkEnd: 0.575,
  climb: [0.484, 0.4862] as const,
  abseil: [0.535, 0.5372] as const,
  stream: 0.605,
  /** The rock band at the head of the larch valley: a scramble on hands and feet, up broken ledges. */
  scramble: [0.632, 0.663] as const,
  bivacco: 0.725,
  crevassePrompt: 0.8085,
  crevasse: [0.8262, 0.829] as const,
  skiDepot: 0.942,
  cross: 0.985,
} as const

/**
 * The glacier: its tongue ends in a snout standing proud of the moraine; at the top a bergschrund
 * separates it from the firn slope below the summit ridge.
 */
export const GLACIER = {
  snout: 0.7505,
  /** Pixels over which the ice front rises, and how tall it stands above the moraine. */
  front: 26,
  height: 13,
  bergschrund: [0.9472, 0.9481] as const,
} as const

/** Content sections pin themselves to these trail positions (see useJourney). */
export const STAGES = {
  welcome: 0.022,
  about: 0.125,
  work: 0.362,
  hut: Z.hut + 0.002,
  fork: Z.fork,
  climbIn: Z.climb[0] - 0.0015,
  climbOut: Z.climb[1] + 0.0012,
  abseilIn: Z.abseil[0] - 0.0012,
  abseilOut: Z.abseil[1] + 0.0015,
  sideQuests: 0.615,
  places: 0.678,
  summits: 0.742,
  crevasseIn: Z.crevassePrompt + 0.004,
  crevasseOut: Z.crevasse[1] + 0.004,
  contact: 0.982,
  home: 1,
} as const

/** A Sardinian lagoon behind the dunes, where the flamingos live. */
export const LAGOON = 0.098
/** Half the lagoon's width in pixels. */
export const LAGOON_HALF = 60
/** How far the lagoon's water reaches up the screen behind the path, at its widest (pixels). */
export const LAGOON_DEPTH = 13
/** Roughly how long each ledge-and-step of the scramble is, in pixels. */
const SCRAMBLE_STEP = 15
/** Half the stream bridge's length in pixels. */
export const BRIDGE_HALF = 12
/** The lake on the lakeside path (trail fraction) and half its width in pixels. */
export const LAKE = 0.518
export const LAKE_HALF = 120

const BIOMES: { id: Biome; to: number }[] = [
  { id: 'sea', to: 0.05 },
  { id: 'beach', to: 0.085 },
  { id: 'country', to: 0.182 },
  { id: 'valley', to: 0.222 },
  { id: 'forest', to: 0.33 },
  { id: 'pasture', to: 0.47 },
  { id: 'crag', to: 0.575 },
  { id: 'larch', to: 0.665 },
  { id: 'moraine', to: 0.745 },
  { id: 'glacier', to: 0.945 },
  { id: 'summit', to: 1.01 },
]

const BEFORE_FORK: [number, number][] = [
  [0, -1],
  [0.05, 0],
  [0.056, 3],
  [0.085, 14],
  [0.11, 80],
  [0.14, 240],
  [0.165, 460],
  [0.183, 600],
  [0.19, 615],
  [0.212, 635],
  [0.232, 780],
  [0.28, 1320],
  [0.33, 1850],
  [0.37, 2120],
  [0.41, 2390],
  [0.44, 2400],
]

const ROUTES: Record<Route, [number, number][]> = {
  rocks: [
    [0.456, 2405],
    [0.472, 2430],
    [Z.climb[0], 2445],
    [Z.climb[1], 2580],
    [0.5, 2596],
    [0.514, 2625],
    [0.527, 2604],
    [Z.abseil[0], 2598],
    [Z.abseil[1], 2385],
    [0.555, 2290],
  ],
  lake: [
    [0.456, 2400],
    [0.476, 2345],
    [0.492, 2302],
    [0.506, 2292],
    [0.53, 2294],
    [0.548, 2268],
  ],
}

const AFTER_FORK: [number, number][] = [
  [Z.forkEnd, 2120],
  [0.6, 2060],
  [0.63, 2100],
  [0.665, 2440],
  [0.705, 2860],
  [0.72, 2950],
  [0.745, 2985],
  [0.79, 3200],
  [Z.crevasse[0], 3400],
  [Z.crevasse[1], 3412],
  [0.87, 3620],
  [0.93, 3905],
  [0.946, 3936],
  [0.959, 4026],
  [0.972, 4048],
  [0.985, 4061],
  [1, 4058],
]

export type PropKind =
  | 'spruce'
  | 'spruceSmall'
  | 'beech'
  | 'larch'
  | 'cembra'
  | 'orchard'
  | 'shrub'
  | 'rockSmall'
  | 'rockMedium'
  | 'boulder'
  | 'marker'
  | 'burrow'
  | 'house'
  | 'church'
  | 'rifugio'
  | 'bivacco'
  | 'cross'
  | 'bench'
  | 'sign'
  | 'flag'
  | 'serac'
  | 'crevasse'
  | 'skis'
  | 'stream'
  | 'umbrellaPine'
  | 'beachUmbrella'
  | 'granite'
  | 'board'
  | 'parkedBike'
  | 'lagoon'
  | 'olive'
  | 'cypress'
  | 'vines'
  | 'drywall'
  | 'nuraghe'
  | 'farmhouse'
  | 'bikeRack'
  | 'lake'
  | 'reeds'
  | 'anchor'
  | 'cairn'
  | 'ladder'
  | 'wand'
  | 'glacierTable'
  | 'blaze'
  | 'cornice'

export type Row = 'back' | 'mid' | 'front'

export type Prop = {
  x: number
  kind: PropKind
  row: Row
  flip?: boolean
  /** Extra vertical offset (pixels, +down). */
  dy?: number
  /** Size or variant parameter. */
  v?: number
  text?: string[]
}

/**
 * What lies under the surface, as layer thicknesses in screen pixels per world x. From the top:
 * glacier ice, sand, soil, scree — and then bedrock all the way down. Layers thin out gradually,
 * so where one material gives way to another the boundary slopes like real geology instead of
 * cutting a vertical seam through the ground.
 */
export type Layers = { ice: Uint8Array; sand: Uint8Array; soil: Uint8Array; scree: Uint8Array; firn: Uint8Array }

export class World {
  readonly route: Route
  readonly layers: Layers
  /** Pixels of glacier ice standing above the moraine's level (the tongue). */
  readonly iceCap: Float32Array
  readonly alt: Float32Array
  readonly props: Prop[] = []
  readonly burrows: number[] = []
  readonly edelweiss: number[] = []
  readonly streams: number[] = []
  readonly holds: { x: number; y: number }[] = []
  /** Smoothed altitude used by the camera so it doesn't bob on every bump. */
  readonly smoothAlt: Float32Array
  /** World x of the middle of each rock step on the scramble (where the paint marks go). */
  readonly scrambleSteps: number[]

  constructor(seed = 1983, route: Route = 'rocks') {
    this.route = route
    const L = WORLD_LEN
    const points = [...BEFORE_FORK, ...ROUTES[route], ...AFTER_FORK]
    const spline = monotoneSpline(
      points.map((p) => p[0] * L),
      points.map((p) => p[1]),
    )
    const flats: { x: number; half: number }[] = [
      { x: LAGOON * L, half: 50 },
      { x: 0.2 * L, half: 70 },
      { x: Z.hut * L, half: 48 },
      { x: Z.fork * L, half: 22 },
      { x: Z.bivacco * L, half: 26 },
      { x: Z.cross * L, half: 22 },
    ]
    const cliffs: [number, number][] =
      route === 'rocks'
        ? [
            [Z.climb[0] * L - 6, Z.climb[1] * L + 6],
            [Z.abseil[0] * L - 6, Z.abseil[1] * L + 6],
          ]
        : []
    this.alt = new Float32Array(L + 1)
    for (let x = 0; x <= L; x++) {
      const f = x / L
      let amp = bumpAmplitude(f)
      if (cliffs.some(([a, b]) => x > a - 10 && x < b + 10)) amp *= 0.2
      if (f > Z.scramble[0] - 0.004 && f < Z.scramble[1] + 0.004) amp *= 0.25
      let a = spline(x) + fbm(x / 70, seed, 3) * amp + fbm(x / 13, seed + 9, 2) * amp * 0.25
      for (const flat of flats) {
        const d = Math.abs(x - flat.x)
        if (d < flat.half * 2) {
          const t = smoothstep(flat.half * 2, flat.half, d)
          a = a * (1 - t) + spline(flat.x) * t
        }
      }
      if (f < Z.shore) a = Math.min(a, -0.5)
      this.alt[x] = a
    }
    // A stream in the larch valley.
    const streamX = Math.round(Z.stream * L)
    this.streams.push(streamX)
    for (let x = streamX - 10; x <= streamX + 10; x++) {
      const t = 1 - Math.abs(x - streamX) / 10
      this.alt[x] -= 22 * smoothstep(0, 1, t)
    }
    // The crevasse: a deep slot the ladder (or a brave jump) crosses.
    const [c0, c1] = [Math.round(Z.crevasse[0] * L), Math.round(Z.crevasse[1] * L)]
    const lip = (this.alt[c0 - 1] + this.alt[c1 + 1]) / 2
    for (let x = c0 - 3; x <= c1 + 3; x++) this.alt[x] = lip
    this.scrambleSteps = this.shapeScramble(seed)
    // The glacier tongue stands proud of the moraine: a steep, rounded ice front at the snout,
    // merging into the gentler upper basin.
    this.iceCap = new Float32Array(L + 1)
    const snoutX = GLACIER.snout * L
    for (let x = Math.ceil(snoutX); x <= L; x++) {
      const t = clamp((x - snoutX) / GLACIER.front)
      const cap = GLACIER.height * (1 - Math.pow(1 - t, 2.4)) * (1 - smoothstep(0.86, 0.93, x / L))
      this.iceCap[x] = cap
      this.alt[x] += cap / PX_PER_M
    }
    this.smoothAlt = new Float32Array(L + 1)
    const R = 50
    let acc = 0
    for (let x = -R; x <= R; x++) acc += this.alt[clampX(x)]
    for (let x = 0; x <= L; x++) {
      this.smoothAlt[x] = acc / (2 * R + 1)
      acc += this.alt[clampX(x + R + 1)] - this.alt[clampX(x - R)]
    }

    this.layers = this.buildLayers(seed)
    this.placeProps(seed)
  }

  /**
   * Breaks the rock band into a scramble: short level ledges between steep little rock steps,
   * growing out of the slope at either end. Returns the middle of each step.
   */
  private shapeScramble(seed: number) {
    const [x0, x1] = [Math.round(Z.scramble[0] * WORLD_LEN), Math.round(Z.scramble[1] * WORLD_LEN)]
    const a0 = this.alt[x0]
    const n = Math.max(1, Math.round((x1 - x0) / SCRAMBLE_STEP))
    const p = (x1 - x0) / n
    const rise = (this.alt[x1] - a0) / n
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / p
      const k = Math.min(n - 1, Math.floor(u))
      const stair = a0 + (k + smoothstep(0.55, 0.95, u - k)) * rise + fbm(x / 6, seed + 71, 2) * 2
      const w = smoothstep(x0, x0 + p * 0.6, x) * (1 - smoothstep(x1 - p * 0.6, x1, x))
      this.alt[x] = this.alt[x] * (1 - w) + stair * w
    }
    return Array.from({ length: n }, (_, k) => x0 + (k + 0.75) * p)
  }

  private buildLayers(seed: number): Layers {
    const L = WORLD_LEN
    const raw = {
      ice: new Float32Array(L + 1),
      sand: new Float32Array(L + 1),
      soil: new Float32Array(L + 1),
      scree: new Float32Array(L + 1),
      firn: new Float32Array(L + 1),
    }
    const snout = GLACIER.snout
    const [b0, b1] = GLACIER.bergschrund
    for (let x = 0; x <= L; x++) {
      const f = x / L
      const slope = (Math.abs(this.alt[Math.min(L, x + 3)] - this.alt[Math.max(0, x - 3)]) / 6) * PX_PER_M
      const steep = smoothstep(0.9, 1.6, slope)
      const n = (k: number, scale: number) => fbm(x / scale, seed + k, 2)
      // Beach sand: carpets the sea floor and the beach, then thins out inland over the soil.
      raw.sand[x] = (1 - smoothstep(0.072, 0.094, f)) * (30 + n(41, 29) * 6)
      // Soil under fields, meadows and forests. It pinches out where rock comes to the surface.
      const crag = this.route === 'rocks' ? smoothstep(0.46, 0.481, f) * (1 - smoothstep(0.546, 0.572, f)) : 0
      // …and it's all bare rock from the scramble's rock band up.
      const bare = Math.max(crag, smoothstep(0.616, Z.scramble[0] + 0.002, f), steep)
      const depth = lerp(58, 118, smoothstep(0.17, 0.23, f))
      raw.soil[x] = smoothstep(0.064, 0.092, f) * (1 - bare) * (depth + n(43, 37) * 14)
      // Scree: the moraine's rubble (running on under the glacier's snout), boulders on the crag, the summit ridge.
      const moraine = smoothstep(0.62, 0.666, f) * (1 - smoothstep(0.772, 0.8, f))
      raw.scree[x] = (moraine * (22 + n(47, 19) * 6) + crag * 9 + smoothstep(0.956, 0.968, f) * 8) * (1 - steep)
      // Glacier ice: the tongue standing on the moraine, deepening up-glacier, thinning again towards
      // the bergschrund where it ends.
      const deep = smoothstep(snout + 0.003, snout + 0.03, f) * (1 - 0.8 * smoothstep(0.885, b0, f)) * (128 + n(53, 31) * 14)
      raw.ice[x] = this.iceCap[x] + deep
      // Firn: wind-packed snow plastered on the headwall above the bergschrund, thinner on the ridge,
      // with a couple of rock bands showing through.
      const wall = smoothstep(b1 - 0.0005, b1 + 0.002, f) * (1 - smoothstep(0.958, 0.966, f))
      const band = Math.abs(f - 0.9515) < 0.0009 || Math.abs(f - 0.9552) < 0.0006 ? 0.15 : 1
      raw.firn[x] = wall * band * (10 + n(59, 11) * 3) + smoothstep(0.958, 0.966, f) * 2 + smoothstep(0.99, 1, f) * 3
    }
    // A light blur keeps every layer boundary a gentle slope, never a step.
    const smooth = (a: Float32Array) => {
      const out = new Uint8Array(L + 1)
      const R = 3
      for (let x = 0; x <= L; x++) {
        let sum = 0
        for (let k = -R; k <= R; k++) sum += a[Math.min(L, Math.max(0, x + k))]
        out[x] = Math.max(0, Math.min(255, Math.round(sum / (2 * R + 1))))
      }
      return out
    }
    const ice = smooth(raw.ice)
    // The ice ends cleanly at the bergschrund, a deep slot the painter draws there.
    for (let x = Math.round(b0 * L); x <= L; x++) ice[x] = 0
    return { ice, sand: smooth(raw.sand), soil: smooth(raw.soil), scree: smooth(raw.scree), firn: smooth(raw.firn) }
  }

  altAt(x: number) {
    if (x <= 0) return this.alt[0]
    // Beyond the summit the ridge breaks off in a steep north face (under a cornice, see props).
    if (x >= WORLD_LEN) return this.alt[WORLD_LEN] - (x - WORLD_LEN) * 7 - fbm(x / 5, 77, 2) * 8
    const i = Math.floor(x)
    const t = x - i
    return this.alt[i] * (1 - t) + this.alt[i + 1] * t
  }

  smoothAltAt(x: number) {
    return this.smoothAlt[clampX(Math.round(x))]
  }

  biomeAt(x: number): Biome {
    const f = x / WORLD_LEN
    for (const b of BIOMES) {
      if (f < b.to) return b.id === 'crag' && this.route === 'lake' ? 'lake' : b.id
    }
    return 'summit'
  }

  /** 1 summer → 2 autumn → 3 winter (0 is spring, used at home and via options). */
  seasonPosAt(x: number) {
    const f = x / WORLD_LEN
    return 1 + smoothstep(0.29, 0.345, f) + smoothstep(0.645, 0.7, f)
  }

  /** The glacier proper (where there's ice under the surface). */
  isGlacier(x: number) {
    return this.layers.ice[Math.max(0, Math.min(WORLD_LEN, Math.round(x)))] > 0
  }

  /** 0..1 up the snout's ice front (null when x isn't on it): steep, so snow doesn't settle there. */
  snoutFront(x: number): number | null {
    const t = (x - GLACIER.snout * WORLD_LEN) / GLACIER.front
    return t >= 0 && t < 1 ? t : null
  }

  /** How glaciated / snow-bound the ground is regardless of season (0..1). */
  permanentSnow(x: number) {
    return smoothstep(0.745, 0.775, x / WORLD_LEN)
  }

  /** Rockiness of the ground (crag, moraine, summit rocks). */
  rockiness(x: number) {
    const f = x / WORLD_LEN
    const crag = this.route === 'rocks' ? smoothstep(0.476, 0.484, f) - smoothstep(0.54, 0.552, f) : 0
    return clamp(
      crag * 0.85 + smoothstep(0.63, 0.67, f) - smoothstep(0.75, 0.78, f) + smoothstep(0.955, 0.975, f) * 0.6,
    )
  }

  /** 0 = sand/sea, 1 = Mediterranean dry grass, used to colour the coast and countryside. */
  coast(x: number) {
    return 1 - smoothstep(0.17, 0.2, x / WORLD_LEN)
  }

  /**
   * The lagoon lies just behind the path. Seen from the side, its surface shows as a band above the
   * path line: this is how tall that band is at x (0 where there's no water). Lens-shaped, so the
   * far shore curves down to meet the path at both ends.
   */
  lagoonDepth(x: number) {
    const t = (x - LAGOON * WORLD_LEN) / LAGOON_HALF
    return Math.abs(t) >= 1 ? 0 : LAGOON_DEPTH * Math.pow(1 - t * t, 0.55)
  }

  /** Where land animals must never go: the sea, and the lagoon where only the flamingos wade. */
  isWater(x: number) {
    return x < Z.shore * WORLD_LEN + 3 || Math.abs(x - LAGOON * WORLD_LEN) < LAGOON_HALF + 4
  }

  /** Nearest point on dry land, for animals heading towards the water. */
  dryLand(x: number) {
    if (x < Z.shore * WORLD_LEN + 3) return Z.shore * WORLD_LEN + 6
    const c = LAGOON * WORLD_LEN
    if (Math.abs(x - c) < LAGOON_HALF + 4) return x < c ? c - LAGOON_HALF - 7 : c + LAGOON_HALF + 7
    return x
  }

  /** The bridge deck over a stream (altitude), or null when x isn't on a bridge. */
  bridgeAt(x: number): number | null {
    for (const s of this.streams) {
      if (Math.abs(x - s) <= BRIDGE_HALF) return Math.max(this.altAt(s - BRIDGE_HALF + 1), this.altAt(s + BRIDGE_HALF - 1))
    }
    return null
  }

  /** What people and animals walk on: the ground, or the bridge deck over a stream. */
  walkAltAt(x: number) {
    const deck = this.bridgeAt(x)
    return deck === null ? this.altAt(x) : Math.max(deck, this.altAt(x))
  }

  isCrevasse(x: number) {
    const f = x / WORLD_LEN
    return f >= Z.crevasse[0] && f <= Z.crevasse[1]
  }

  private placeProps(seed: number) {
    const r = rng(seed)
    const L = WORLD_LEN
    const add = (p: Prop) => this.props.push(p)
    const scatter = (from: number, to: number, spacing: [number, number], pick: (x: number) => Prop | null) => {
      let x = from * L + r.range(0, spacing[0])
      while (x < to * L) {
        const p = pick(x)
        if (p) add(p)
        x += r.range(spacing[0], spacing[1])
      }
    }
    const keepClear = [Z.bikeStart, Z.bikeEnd, 0.2, Z.hut, Z.fork, Z.bivacco, Z.cross, ...Z.climb, ...Z.abseil]
    const nearStructure = (x: number) =>
      keepClear.some((f) => Math.abs(x - f * L) < 34) || this.streams.some((s) => Math.abs(x - s) < 14)

    // Beach: umbrellas, granite boulders, a lagoon behind the dunes with flamingos.
    add({ x: Z.shore * L + 8, kind: 'board', row: 'mid' })
    add({ x: 0.054 * L, kind: 'sign', row: 'mid', text: ['SPIAGGIA', 'SARDEGNA'] })
    for (const [f, v] of [
      [0.06, 0],
      [0.0675, 1],
      [0.0765, 2],
    ] as const) {
      add({ x: f * L, kind: 'beachUmbrella', row: 'mid', v })
    }
    for (const f of [0.0575, 0.072, 0.0825]) add({ x: f * L, kind: 'granite', row: r.chance(0.5) ? 'mid' : 'back', v: r.int(0, 1) })
    add({ x: LAGOON * L, kind: 'lagoon', row: 'back', v: LAGOON_HALF * 2 })
    for (const dx of [-54, -47, 44, 52]) add({ x: LAGOON * L + dx, kind: 'reeds', row: 'mid', flip: dx > 0 })
    const inLagoon = (x: number) => Math.abs(x - LAGOON * L) < LAGOON_HALF + 12
    scatter(0.058, 0.13, [26, 60], (x) =>
      nearStructure(x) || inLagoon(x)
        ? null
        : { x, kind: r.chance(0.55) ? 'umbrellaPine' : 'shrub', row: 'back', flip: r.chance(0.5) },
    )
    add({ x: Z.bikeStart * L - 2, kind: 'parkedBike', row: 'mid' })

    // Countryside: olive groves, vines, cypresses, dry-stone walls, a nuraghe.
    scatter(0.088, 0.18, [16, 34], (x) => {
      if (nearStructure(x) || inLagoon(x)) return null
      const roll = r.next()
      if (roll < 0.4) return { x, kind: 'olive', row: r.chance(0.6) ? 'back' : 'mid', flip: r.chance(0.5) }
      if (roll < 0.58) return { x, kind: 'cypress', row: 'back' }
      if (roll < 0.78) return { x, kind: 'vines', row: 'back', v: r.int(14, 26) }
      return { x, kind: 'shrub', row: 'mid' }
    })
    scatter(0.09, 0.178, [40, 90], (x) =>
      nearStructure(x) || inLagoon(x) ? null : { x, kind: 'drywall', row: 'mid', v: r.int(10, 22) },
    )
    add({ x: 0.127 * L, kind: 'nuraghe', row: 'back' })
    add({ x: 0.156 * L, kind: 'farmhouse', row: 'back' })

    // Alpine valley: the village, trailhead and bike rack.
    add({ x: Z.bikeEnd * L + 6, kind: 'bikeRack', row: 'mid' })
    add({ x: 0.191 * L, kind: 'house', row: 'back' })
    add({ x: 0.2 * L, kind: 'church', row: 'back' })
    add({ x: 0.208 * L, kind: 'house', row: 'back', flip: true })
    add({ x: 0.214 * L, kind: 'sign', row: 'mid', text: ['RIFUGIO 3H', 'VETTA 8H'] })
    scatter(0.183, 0.225, [16, 34], (x) => {
      if (nearStructure(x) && r.chance(0.8)) return null
      return { x, kind: r.chance(0.6) ? 'orchard' : 'beech', row: r.chance(0.7) ? 'back' : 'mid', flip: r.chance(0.5) }
    })

    // Forest: beech → mixed → spruce.
    scatter(0.222, 0.33, [7, 15], (x) => {
      const coniferChance = smoothstep(0.24, 0.3, x / L)
      const kind: PropKind = r.chance(coniferChance) ? (r.chance(0.3) ? 'spruceSmall' : 'spruce') : 'beech'
      return { x, kind, row: r.chance(0.6) ? 'back' : 'mid', flip: r.chance(0.5), dy: r.int(0, 1) }
    })
    scatter(0.23, 0.325, [70, 140], (x) => ({
      x,
      kind: r.chance(smoothstep(0.25, 0.3, x / L)) ? 'spruce' : 'beech',
      row: 'front',
      flip: r.chance(0.5),
    }))
    scatter(0.225, 0.33, [60, 130], (x) => ({ x, kind: r.chance(0.5) ? 'rockSmall' : 'rockMedium', row: 'mid' }))
    add({ x: 0.27 * L, kind: 'marker', row: 'mid' })

    // Pasture: treeline pines, alpenrose, marmot burrows, the hut.
    scatter(0.33, 0.36, [20, 40], (x) => ({ x, kind: 'cembra', row: r.chance(0.6) ? 'back' : 'mid', flip: r.chance(0.5) }))
    scatter(0.33, 0.47, [22, 50], (x) => {
      if (nearStructure(x)) return null
      const roll = r.next()
      if (roll < 0.45) return { x, kind: 'shrub', row: 'mid' }
      if (roll < 0.7) return { x, kind: 'rockMedium', row: 'mid' }
      if (roll < 0.85) return { x, kind: 'boulder', row: 'back' }
      return { x, kind: 'rockSmall', row: 'mid' }
    })
    for (const f of [0.365, 0.382, 0.398, 0.445, 0.458]) {
      this.burrows.push(f * L)
      add({ x: f * L, kind: 'burrow', row: 'mid' })
    }
    add({ x: Z.hut * L, kind: 'rifugio', row: 'back' })
    add({ x: Z.hut * L - 26, kind: 'flag', row: 'back' })
    add({ x: Z.hut * L + 22, kind: 'bench', row: 'mid' })
    add({ x: 0.41 * L, kind: 'sign', row: 'mid', text: ['RIFUGIO', '2400 M'] })
    add({
      x: Z.fork * L,
      kind: 'sign',
      row: 'mid',
      text: this.route === 'rocks' ? ['VIA THE ROCKS', 'VIA THE LAKE'] : ['VIA THE LAKE', 'VIA THE ROCKS'],
    })

    // The fork: rocks (climb + abseil) or round the lake.
    if (this.route === 'rocks') {
      scatter(0.476, 0.55, [12, 26], (x) => {
        if (nearStructure(x)) return null
        return { x, kind: r.chance(0.5) ? 'boulder' : 'rockMedium', row: r.chance(0.5) ? 'back' : 'mid', flip: r.chance(0.5) }
      })
      add({ x: 0.514 * L, kind: 'cairn', row: 'mid' })
      add({ x: Z.abseil[0] * L - 3, kind: 'anchor', row: 'mid' })
      // A lower-off at the top of the climb, for abseiling back down it.
      add({ x: Z.climb[1] * L + 3, kind: 'anchor', row: 'mid' })
      const [w0, w1] = [Z.climb[0] * L, Z.climb[1] * L]
      for (const t of [0.22, 0.52, 0.8]) {
        const x = w0 + (w1 - w0) * t
        this.holds.push({ x, y: 0 })
      }
    } else {
      add({ x: LAKE * L, kind: 'lake', row: 'back', v: LAKE_HALF * 2 })
      add({ x: 0.499 * L, kind: 'reeds', row: 'mid' })
      add({ x: 0.538 * L, kind: 'reeds', row: 'mid', flip: true })
      add({ x: 0.523 * L, kind: 'bench', row: 'mid' })
      // Trees grow round the lake, not in it.
      scatter(0.47, 0.56, [24, 50], (x) =>
        nearStructure(x) || Math.abs(x - LAKE * L) < LAKE_HALF + 6
          ? null
          : { x, kind: r.chance(0.6) ? 'cembra' : 'larch', row: 'back', flip: r.chance(0.5) },
      )
    }

    // Larch valley (autumn gold), stream with a bridge.
    const onScramble = (x: number, pad = 0) => x > Z.scramble[0] * L - pad && x < Z.scramble[1] * L + pad
    scatter(0.56, 0.665, [7, 15], (x) => {
      if (this.streams.some((s) => Math.abs(x - s) < 12)) return null
      // Only the odd stone pine clings to the rock steps.
      if (onScramble(x) && !r.chance(0.3)) return null
      const kind: PropKind = onScramble(x) || (x / L > 0.645 && r.chance(0.5)) ? 'cembra' : 'larch'
      return { x, kind, row: onScramble(x) || r.chance(0.65) ? 'back' : 'mid', flip: r.chance(0.5), dy: r.int(0, 1) }
    })
    scatter(0.57, 0.65, [80, 150], (x) =>
      this.streams.some((s) => Math.abs(x - s) < 20) || onScramble(x, 40) ? null : { x, kind: 'larch', row: 'front', flip: r.chance(0.5) },
    )
    for (const s of this.streams) add({ x: s, kind: 'stream', row: 'mid' })
    add({ x: Z.scramble[0] * L - 10, kind: 'marker', row: 'mid' })
    // Red-white-red trail paint on the rock steps shows the way up the scramble.
    this.scrambleSteps.forEach((x, k) => {
      if (k % 2 === 1) add({ x, kind: 'blaze', row: 'mid' })
    })

    // Moraine: boulders, the red bivouac.
    scatter(0.66, 0.765, [12, 28], (x) => {
      if (nearStructure(x)) return null
      const roll = r.next()
      if (roll < 0.35) return { x, kind: 'boulder', row: r.chance(0.5) ? 'back' : 'mid', flip: r.chance(0.5) }
      if (roll < 0.7) return { x, kind: 'rockMedium', row: 'mid', flip: r.chance(0.5) }
      return { x, kind: 'rockSmall', row: 'mid' }
    })
    add({ x: 0.69 * L, kind: 'marker', row: 'mid' })
    add({ x: Z.bivacco * L, kind: 'bivacco', row: 'back' })
    add({ x: Z.bivacco * L - 18, kind: 'sign', row: 'mid', text: ['BIVACCO', '2950 M'] })

    // Glacier: seracs behind, small crevasses underfoot, the big crevasse with its ladder.
    // Seracs start as small ice blocks near the snout and grow into towers higher up.
    scatter(0.772, 0.935, [22, 52], (x) => ({
      x,
      kind: 'serac',
      row: 'back',
      v: Math.round(lerp(5, r.int(10, 26), smoothstep(0.772, 0.815, x / L))),
    }))
    // The rope-up sign stands on the moraine, clear of the snout's ice front and its cave.
    add({ x: GLACIER.snout * L - 54, kind: 'sign', row: 'mid', text: ['GHIACCIAIO', 'ROPE UP!'] })
    // Glacier tables: boulders left standing on pedestals of ice that they shade from the sun.
    for (const [f, v] of [
      [0.7665, 1],
      [0.7935, 0],
      [0.853, 1],
    ] as const) {
      add({ x: f * L, kind: 'glacierTable', row: 'mid', v, flip: f > 0.8 })
    }
    // Bamboo marker wands showing the safe line across the glacier.
    scatter(0.776, 0.94, [58, 96], (x) =>
      Math.abs(x / L - (Z.crevasse[0] + Z.crevasse[1]) / 2) < 0.006 || Math.abs(x / L - Z.skiDepot) < 0.004
        ? null
        : { x, kind: 'wand', row: 'mid', v: r.int(0, 1) },
    )
    scatter(0.78, 0.935, [34, 80], (x) =>
      Math.abs(x / L - (Z.crevasse[0] + Z.crevasse[1]) / 2) < 0.012 ? null : { x, kind: 'crevasse', row: 'mid', v: r.int(3, 6) },
    )
    add({ x: Z.crevasse[0] * L, kind: 'ladder', row: 'mid', v: (Z.crevasse[1] - Z.crevasse[0]) * L })
    add({ x: Z.skiDepot * L, kind: 'skis', row: 'mid' })

    // Summit: rocks and the cross.
    scatter(0.955, 1, [14, 30], (x) =>
      nearStructure(x) ? null : { x, kind: r.chance(0.5) ? 'rockMedium' : 'rockSmall', row: 'mid' },
    )
    add({ x: Z.cross * L, kind: 'cross', row: 'back' })
    // A wind-sculpted cornice overhanging the north face, just beyond the top.
    add({ x: L, kind: 'cornice', row: 'mid', v: 22 })

    // Hidden edelweiss (pastures and rocks, never under snow on the auto trail).
    const edelweissSpots =
      this.route === 'rocks'
        ? [0.352, 0.388, 0.452, 0.506, 0.523, 0.588, 0.652]
        : [0.352, 0.388, 0.452, 0.484, 0.545, 0.588, 0.652]
    for (const f of edelweissSpots) this.edelweiss.push(Math.round(f * L))

    const order: Record<Row, number> = { back: 0, mid: 1, front: 2 }
    this.props.sort((a, b) => order[a.row] - order[b.row] || a.x - b.x)
  }
}

function clampX(x: number) {
  return x < 0 ? 0 : x > WORLD_LEN ? WORLD_LEN : x
}

function bumpAmplitude(f: number) {
  if (f < 0.05) return 0
  if (f < 0.085) return 1.5
  if (f < 0.182) return 10
  if (f < 0.222) return 5
  if (f < 0.33) return 20
  if (f < 0.47) return 14
  if (f < 0.575) return 12
  if (f < 0.665) return 16
  if (f < 0.745) return 30
  if (f < 0.945) return 9
  return 10
}

/** Stable per-position random for ground textures. */
export const groundHash = (x: number, k: number) => hash(Math.floor(x) * 7 + k, 991)
