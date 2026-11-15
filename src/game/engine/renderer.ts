import type { SpeciesId } from '../../../shared/species.ts'
import { SPECIES_BY_ID } from '../../content/species.ts'
import type { SfxName } from '../../lib/sfx.ts'
import { drawClimber, type ClimberMode } from './actors.ts'
import { Wildlife, box, choughOnWing, type Animal, type AnimalCtx, type Pointer } from './animals.ts'
import { Backdrop } from './backdrop.ts'
import { css, shade, type RGB } from './color.ts'
import { bakeText, textWidth } from './font.ts'
import { clamp, rng } from './math.ts'
import { needsTorch, nightAt } from './clock.ts'
import { drawDistantLights, drawLandDetails, drawSkyDetails } from './distant.ts'
import { FINDS, drawFinds, findAt, findBox, placeFinds, type Find } from './finds.ts'
import { Night, type Eye, type Torch } from './night.ts'
import {
  SEASONS,
  dominantSeason,
  paletteAround,
  paletteAt,
  particleFor,
  seasonAround,
  seasonPosForDate,
  skyAt,
  type ScenePalette,
  type Season,
  type SkyState,
} from './palettes.ts'
import { drawProps, type PropCtx } from './props.ts'
import { SeaSportChooser } from './seaSport.ts'
import { QUADS, drawDolphin, drawFlamingo, drawFlyingFlamingo, drawQuad, drawSpreadBird } from './rig.ts'
import { EDELWEISS, FARMHOUSE, HOUSE, RIFUGIO, bake } from './sprites.ts'
import { TerrainPainter, type Crack } from './terrain.ts'
import type { Glow, Light, View } from './view.ts'
import { Weather } from './weather.ts'
import { drawWaterBodies } from './waters.ts'
import { END_X, GLACIER, PX_PER_M, START_X, STAGES, SUMMIT_ALT, WORLD_LEN, World, Z, type Biome, type Route } from './world.ts'

export type EngineSettings = {
  season: 'auto' | Season
  /** Dark mode: the scene animates to night and the head torch comes on. */
  night: boolean
  wildlife: boolean
  reducedMotion: boolean
  route: Route
  /** The visitor chose to step inside the hut. */
  inHut: boolean
  /** Simple view: a calm, still scene of the hut behind the text (no climber, no animals, no clicks). */
  still: boolean
}

export type Zone = 'climb' | 'abseil' | 'crevasse' | null

export type SkyBody = 'sun' | 'moon'

export type EngineStatus = {
  altitude: number
  f: number
  season: Season
  biome: Biome
  daylight: number
  zone: Zone
  mode: ClimberMode
}

export type EngineEvent =
  | { type: 'hold'; done: number; total: number }
  | { type: 'bounce'; count: number }
  | { type: 'jump'; ok: boolean }

export type EngineHooks = {
  getTarget: () => number
  onSpot: (id: SpeciesId, edelweissIndex?: number) => void
  onStatus: (status: EngineStatus) => void
  onHover: (interactive: boolean) => void
  onEvent: (event: EngineEvent) => void
  /** Ask the page to scroll so the trail reaches `f` (used after a successful jump). */
  requestTrail: (f: number) => void
  /** The sun or the moon was clicked: switch between day and night. */
  onSky: (body: SkyBody) => void
  sfx: (name: SfxName) => void
  isSpotted: (id: SpeciesId) => boolean
}

type Act = {
  kind: 'jump' | 'slip'
  phase: 'approach' | 'crouch' | 'air' | 'land' | 'hold' | 'fall' | 'dangle' | 'pull'
  t: number
  x: number
  lift: number
  drop: number
}

/** Day mode is always early afternoon, with the sun high on the right of its oval. */
const DAY_HOUR = 14
const GREETINGS = ['SZIA!', 'CIAO!', 'HEJ!', 'HOI!', 'HIYA!', 'SERVUS!']
const HANDS_ON = 'HANDS ON!'

/** Below this CSS width, simple view shows the scene as a picture strip at the top (see home.css). */
const STILL_HERO_MAX_W = 700
const INK = '#1a1c2c'
const EYE_COLORS: Partial<Record<string, string>> = {
  fox: '#eaff7a',
  deer: '#c8ff9a',
  cow: '#9affd8',
  sheep: '#9affd8',
  chamois: '#fff2a8',
  ibex: '#fff2a8',
}
const AIR = new Set(['eagle', 'gull', 'butterfly', 'owl'])
const L = WORLD_LEN

export class Engine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scene: HTMLCanvasElement
  private sctx: CanvasRenderingContext2D
  private hooks: EngineHooks
  private settings: EngineSettings
  private world: World
  private wildlife = new Wildlife()
  private weather = new Weather()
  private backdrop = new Backdrop()
  private terrain = new TerrainPainter()
  private night = new Night()
  private rnd = rng(Date.now() & 0xffff)
  /** Windsurfing, then snorkelling and windsurfing in turn each time he comes back to the sea. */
  private seaSport = new SeaSportChooser()

  private S = 3
  private W = 320
  private H = 200
  private horizon = 100
  private ground0 = 140
  private climberSX = 100

  private f: number
  private camX = 0
  private camAlt = 0
  private camAltPx = 0
  private prevCamX = 0
  private time = 0
  private last = 0
  private raf = 0
  private running = false
  private nightT: number
  private hour = DAY_HOUR
  /** How dark night mode gets where the climber is (see nightAt). */
  private placeDark = 1

  private palette: ScenePalette = paletteAt(1)
  private paletteBack: ScenePalette = paletteAt(1)
  private season: Season = 'summer'
  private sky: SkyState = skyAt(DAY_HOUR, paletteAt(1), 0)

  private pointer: Pointer & {
    cssX: number
    cssY: number
    lastSX: number
    lastSY: number
    vx: number
    vy: number
    seenAt: number
  } = {
    active: false,
    sx: -999,
    sy: -999,
    wx: 0,
    h: 0,
    speed: 0,
    still: 0,
    cssX: -999,
    cssY: -999,
    lastSX: -999,
    lastSY: -999,
    vx: 0,
    vy: 0,
    seenAt: -99,
  }
  private hoverInteractive = false

  private climber = {
    x: START_X,
    cx: START_X,
    dist: 0,
    dir: 1 as 1 | -1,
    idle: 0,
    moving: false,
    wave: 0,
    bubble: '',
    bubbleT: 0,
    summitT: 0,
    mode: 'surf' as ClimberMode,
  }
  private act: Act | null = null
  private bounceT = 0
  private bounces = 0
  private holdsDone: boolean[] = []
  private tracks: { x: number; t: number; ski: boolean }[] = []
  private lastTrackX = 0
  private smoke: { x: number; y: number; age: number }[] = []
  private smokeT = 0
  private sparkles: { x: number; y: number; t: number }[] = []
  private flash = 0
  private collected = new Set<number>()
  /** Treasures and fossils in the ground: a different few each visit. */
  private finds: Find[] = []
  private cracks: Crack[] = []
  private crackAt = new Int16Array(L + 1)
  private statusT = 0
  private lastStatus = ''
  private zone: Zone = null
  private head: [number, number] | null = null
  private view: View

  constructor(canvas: HTMLCanvasElement, hooks: EngineHooks, settings: EngineSettings) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.scene = document.createElement('canvas')
    this.sctx = this.scene.getContext('2d')!
    this.hooks = hooks
    this.settings = settings
    this.world = new World(1983, settings.route)
    this.nightT = settings.night ? 1 : 0
    this.f = clamp(hooks.getTarget())
    this.climber.cx = this.climber.x = clamp(this.f * L, START_X, END_X)
    this.view = {
      W: 0,
      H: 0,
      horizon: 0,
      ground0: 0,
      camX: 0,
      camAlt: 0,
      camAltPx: 0,
      time: 0,
      palette: this.palette,
      paletteBack: this.paletteBack,
      sky: this.sky,
      season: this.season,
      world: this.world,
      reducedMotion: settings.reducedMotion,
      groundY: this.groundY,
      walkY: this.walkY,
      climberX: this.climber.x,
      nightT: this.nightT,
      hour: this.hour,
    }
    this.rebuildWorldExtras()
    this.resize()
  }

  /* ------------------------------------------------------------------ API */

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  destroy() {
    this.stop()
  }

  resize() {
    const cssW = Math.max(1, this.canvas.clientWidth || window.innerWidth)
    const cssH = Math.max(1, this.canvas.clientHeight || window.innerHeight)
    // Phones get a slightly finer pixel so there's room to see the scenery.
    this.S = cssW < 640 ? 2 : Math.max(2, Math.floor(cssH / 250))
    this.W = Math.ceil(cssW / this.S)
    this.H = Math.ceil(cssH / this.S)
    this.canvas.width = this.W
    this.canvas.height = this.H
    this.scene.width = this.W
    this.scene.height = this.H
    this.ctx.imageSmoothingEnabled = false
    this.sctx.imageSmoothingEnabled = false
    this.layout()
    this.backdrop.resize(this.W, this.H)
    this.terrain.resize(this.W, this.H)
    this.night.resize(this.W, this.H)
    if (!this.running) this.renderOnce()
  }

  /** Where the horizon and the ground line sit on screen. */
  private layout() {
    const cssW = this.W * this.S
    const portrait = this.H > this.W * 1.25
    if (this.settings.still && cssW < STILL_HERO_MAX_W) {
      // Simple view on a phone: the scene sits in a picture strip at the top, above the first card.
      this.horizon = Math.round(this.H * 0.17)
      this.ground0 = Math.round(this.H * 0.32)
    } else {
      // Portrait phones: lift the action to mid-screen so cards at the bottom never cover it.
      this.horizon = Math.round(this.H * (portrait ? 0.48 : 0.5))
      this.ground0 = Math.round(this.H * (portrait ? 0.7 : 0.76))
    }
    this.climberSX = Math.round(this.W * (this.W < 260 ? 0.42 : 0.34))
  }

  setSettings(settings: EngineSettings) {
    const routeChanged = settings.route !== this.settings.route
    const stillChanged = settings.still !== this.settings.still
    this.settings = settings
    if (stillChanged) this.layout()
    if (routeChanged) {
      this.world = new World(1983, settings.route)
      this.view.world = this.world
      this.wildlife.clear()
      this.tracks = []
      this.rebuildWorldExtras()
    }
    if (!this.running) this.renderOnce()
  }

  setCollected(indices: number[]) {
    this.collected = new Set(indices)
  }

  pointerMove(cssX: number, cssY: number, overWorld: boolean) {
    this.pointer.cssX = cssX
    this.pointer.cssY = cssY
    this.pointer.active = overWorld
    if (overWorld) this.pointer.seenAt = this.time
  }

  pointerLeave() {
    this.pointer.active = false
  }

  yeti() {
    this.wildlife.spawnYeti(this.animalCtx(0))
  }

  /** Abseil challenge: push off the wall. Returns false when not abseiling right now. */
  bounce() {
    if (this.climber.mode !== 'abseil' || this.bounceT > 0) return false
    this.bounceT = 0.8
    this.bounces++
    this.hooks.sfx('boing')
    this.hooks.onEvent({ type: 'bounce', count: this.bounces })
    return true
  }

  /** Crevasse challenge: jump (ok) or slip (not ok). Returns false when it can't start. */
  jump(ok: boolean) {
    if (this.act || this.zone !== 'crevasse' || this.climber.x > Z.crevasse[0] * L) return false
    this.act = { kind: ok ? 'jump' : 'slip', phase: 'approach', t: 0, x: this.climber.x, lift: 0, drop: 0 }
    return true
  }

  /** Dev/test helper: where clickable things are on screen, in CSS pixels. */
  debugTargets() {
    const c = { camX: this.camX, groundY: this.walkY }
    const S = this.S
    return {
      zone: this.zone,
      mode: this.climber.mode,
      nightT: this.nightT,
      climber: { x: (this.climber.x - this.camX) * S, y: this.walkY(this.climber.x) * S },
      animals: this.wildlife.animals
        .filter((a) => a.visible && a.alpha > 0.5)
        .map((a) => {
          const b = box(a, c)
          return { kind: a.kind, state: a.state, x: (b.sx + b.w / 2) * S, y: (b.sy + b.h / 2) * S }
        }),
      edelweiss: this.world.edelweiss.map((x, i) => ({
        i,
        visible: this.edelweissVisible(i),
        x: (x - this.camX) * S,
        y: (this.groundY(x) - 4) * S,
      })),
      holds: this.world.holds.map((h, i) => ({
        i,
        done: this.holdsDone[i],
        x: (h.x - this.camX) * S,
        y: (this.groundY(h.x) + 2) * S,
      })),
      finds: this.finds.map((f) => {
        const b = findBox(this.view, f)
        return { kind: f.kind, label: FINDS[f.kind].label, x: (b.sx + b.w / 2) * S, y: (b.sy + b.h / 2) * S }
      }),
      sky: (['sun', 'moon'] as const).map((body) => {
        const at = body === 'sun' ? this.backdrop.sun(this.view) : this.backdrop.moon(this.view)
        return { body, x: at.x * S, y: at.y * S, clickable: this.skyBodyAt(at.x, at.y) === body }
      }),
    }
  }

  /** Returns true when the click hit something in the world. */
  click(cssX: number, cssY: number): boolean {
    if (this.settings.still) return false
    const sx = cssX / this.S
    const sy = cssY / this.S
    const c = this.animalCtx(0)
    const hold = this.holdAt(sx, sy)
    if (hold >= 0) {
      this.holdsDone[hold] = true
      const h = this.world.holds[hold]
      for (let i = 0; i < 8; i++) this.sparkles.push({ x: h.x, y: this.groundY(h.x) + 1, t: 0.5 + Math.random() * 0.4 })
      const done = this.holdsDone.filter(Boolean).length
      this.hooks.sfx(done === this.holdsDone.length ? 'coin' : 'clink')
      if (done === this.holdsDone.length) this.say('ALLEZ!')
      this.hooks.onEvent({ type: 'hold', done, total: this.holdsDone.length })
      return true
    }
    const a = this.wildlife.hit(c, sx, sy, 5)
    if (a) {
      this.snap()
      this.wildlife.snapped(a, c)
      this.hooks.onSpot(a.kind)
      return true
    }
    const ew = this.edelweissAt(sx, sy)
    if (ew >= 0) {
      this.snap()
      this.collected.add(ew)
      const p = this.world.edelweiss[ew]
      for (let i = 0; i < 10; i++) this.sparkles.push({ x: p, y: this.groundY(p) - 4, t: 0.6 + Math.random() * 0.5 })
      this.hooks.onSpot('edelweiss', ew)
      return true
    }
    if (this.head && Math.abs(sx - this.head[0]) < 9 && sy > this.head[1] - 6 && sy < this.head[1] + 18) {
      this.climber.wave = 1.6
      this.say(GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
      this.hooks.sfx(this.climber.mode === 'bike' ? 'bell' : 'pop')
      return true
    }
    const find = findAt(this.view, this.finds, sx, sy)
    if (find) {
      const b = findBox(this.view, find)
      for (let i = 0; i < 8; i++) {
        this.sparkles.push({ x: find.x - b.w / 2 + Math.random() * b.w, y: this.groundY(find.x) + find.top + 2, t: 0.5 + Math.random() * 0.4 })
      }
      this.hooks.sfx('coin')
      this.say('OOH!')
      return true
    }
    const body = this.skyBodyAt(sx, sy)
    if (body) {
      this.hooks.sfx('select')
      this.hooks.onSky(body)
      return true
    }
    const wx = this.camX + sx
    const biome = this.world.biomeAt(wx)
    const h = this.groundY(wx) - sy
    if ((biome === 'glacier' || biome === 'summit' || biome === 'crag') && h > -12 && h < 30 && this.settings.wildlife) {
      this.wildlife.dropCrumb(wx)
      this.hooks.sfx('pop')
      return true
    }
    return false
  }

  /* ------------------------------------------------------------ helpers */

  private rebuildWorldExtras() {
    this.finds = placeFinds(this.world, rng(Date.now() & 0xffff))
    this.cracks = []
    this.crackAt = new Int16Array(L + 1)
    const add = (x0: number, x1: number, depth: number, kind: Crack['kind']) => {
      this.cracks.push({ x0, x1, depth, kind })
      for (let x = Math.max(0, x0); x < Math.min(L, x1); x++) this.crackAt[x] = this.cracks.length
    }
    for (const p of this.world.props) {
      if (p.kind !== 'crevasse') continue
      const w = p.v ?? 4
      add(Math.round(p.x), Math.round(p.x) + w + 1, w * 3 + 4, 'small')
    }
    add(Math.round(Z.crevasse[0] * L), Math.round(Z.crevasse[1] * L), 70, 'big')
    const [b0, b1] = GLACIER.bergschrund
    add(Math.round(b0 * L), Math.round(b1 * L) + 1, 30, 'berg')
    this.holdsDone = this.world.holds.map(() => false)
    this.bounces = 0
  }

  private say(text: string) {
    this.climber.bubble = text
    this.climber.bubbleT = 1.8
  }

  private snap() {
    this.flash = this.settings.reducedMotion ? 0.2 : 0.75
    this.hooks.sfx('shutter')
  }

  private groundY = (x: number) => Math.round(this.ground0 - (this.world.altAt(x) * PX_PER_M - this.camAltPx))

  /** Where feet go: the ground, or the bridge deck over the stream. */
  private walkY = (x: number) => Math.round(this.ground0 - (this.world.walkAltAt(x) * PX_PER_M - this.camAltPx))

  private animalCtx(dt: number): AnimalCtx {
    return {
      dt,
      time: this.time,
      pointer: this.pointer,
      groundY: this.walkY,
      camX: this.camX,
      W: this.W,
      H: this.H,
      rng: this.rnd,
      season: this.season,
      daylight: this.sky.daylight,
      sfx: this.hooks.sfx,
      world: this.world,
      crumbs: this.wildlife.crumbs,
      climberX: this.climber.x,
      // Content cards sit on the right half of wide screens, and below the scene on phones.
      clearW: this.W * this.S < 700 ? this.W : this.W * 0.48,
    }
  }

  private edelweissVisible(i: number) {
    const x = this.world.edelweiss[i]
    return this.palette.groundSnow < 0.5 && this.world.permanentSnow(x) < 0.5 && x > this.camX - 10 && x < this.camX + this.W + 10
  }

  private edelweissAt(sx: number, sy: number, radius = 7) {
    for (let i = 0; i < this.world.edelweiss.length; i++) {
      if (!this.edelweissVisible(i)) continue
      const x = this.world.edelweiss[i]
      if (Math.hypot(sx - (x - this.camX), sy - (this.groundY(x) - 4)) < radius) return i
    }
    return -1
  }

  private holdAt(sx: number, sy: number, radius = 7) {
    // The holds only glow (and count) while he's on his way up the climb.
    if (this.zone !== 'climb') return -1
    for (let i = 0; i < this.world.holds.length; i++) {
      if (this.holdsDone[i]) continue
      const h = this.world.holds[i]
      if (Math.hypot(sx - (h.x - this.camX), sy - (this.groundY(h.x) + 2)) < radius) return i
    }
    return -1
  }

  /** The sun or the moon under a screen point, when it's showing in open sky (a generous target for fingers). */
  private skyBodyAt(sx: number, sy: number): SkyBody | null {
    if (this.settings.still || !this.backdrop.openSky(this.view, sx, sy)) return null
    const r = Math.max(8, 22 / this.S)
    const sun = this.backdrop.sun(this.view)
    if (sun.alpha > 0.35 && Math.hypot(sx - sun.x, sy - sun.y) <= r) return 'sun'
    const moon = this.backdrop.moon(this.view)
    if (this.backdrop.moonAlpha(this.view) > 0.35 && Math.hypot(sx - moon.x, sy - moon.y) <= r) return 'moon'
    return null
  }

  private insideHut(x: number) {
    return this.settings.inHut && Math.abs(x - Z.hut * L) < 30
  }

  /**
   * The crag's two cliffs: the climb rises to the right, the abseil drops to the right. `wall` is
   * the side the rock is on when you're on the face (the way up).
   */
  private cliffAt(x: number): { top: number; bottom: number; wall: 1 | -1 } | null {
    if (this.world.route !== 'rocks') return null
    const f = x / L
    if (f >= Z.climb[0] && f <= Z.climb[1]) return { top: Z.climb[1] * L, bottom: Z.climb[0] * L, wall: 1 }
    if (f >= Z.abseil[0] && f <= Z.abseil[1]) return { top: Z.abseil[0] * L, bottom: Z.abseil[1] * L, wall: -1 }
    return null
  }

  private modeAt(x: number): ClimberMode {
    const f = x / L
    if (this.insideHut(x)) return 'hidden'
    if (f < Z.shore) return this.seaSport.sport
    if (f < Z.bikeStart) return 'beach'
    if (f < Z.bikeEnd) return 'bike'
    if (f >= Z.scramble[0] && f <= Z.scramble[1]) return 'scramble'
    // Up a cliff is always a climb and down it always an abseil, whichever way the visitor scrolls.
    const cliff = this.cliffAt(x)
    if (cliff) return this.climber.dir === cliff.wall ? 'climb' : 'abseil'
    if (f > 0.975 && this.climber.summitT > 0 && !this.climber.moving) return 'victory'
    if (f >= Z.skiDepot) return 'alpine'
    if (f > Z.crevassePrompt - 0.004 && f < Z.crevasse[1] + 0.004) return 'alpine'
    if (f >= 0.665) {
      const snowy = Math.max(this.palette.groundSnow, this.world.permanentSnow(x)) > 0.6
      return snowy ? 'ski' : 'alpine'
    }
    return 'hike'
  }

  private zoneAt(x: number): Zone {
    const f = x / L
    // The climb and abseil challenges are for the way forward; heading back, they keep out of the way.
    if (this.world.route === 'rocks' && this.climber.dir > 0) {
      if (f > Z.climb[0] - 0.006 && f < Z.climb[1] + 0.002) return 'climb'
      if (f > Z.abseil[0] - 0.003 && f < Z.abseil[1] + 0.002) return 'abseil'
    }
    if (f > Z.crevassePrompt && f < Z.crevasse[1] + 0.002) return 'crevasse'
    return null
  }

  /* --------------------------------------------------------------- loop */

  private loop = (t: number) => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    // The still scene only needs a few frames a second (drifting clouds, chimney smoke), unless day is turning to night.
    const settled = Math.abs((this.settings.night ? 1 : 0) - this.nightT) < 1e-4
    if (this.settings.still && settled && t - this.last < 125) return
    const dt = Math.min(0.05, Math.max(0.001, (t - this.last) / 1000))
    this.last = t
    this.time += dt
    this.update(dt)
    this.render(dt)
  }

  private renderOnce() {
    this.update(0)
    this.render(0)
  }

  private stepAct(dt: number) {
    const a = this.act!
    const lip = Z.crevasse[0] * L - 4
    const far = Z.crevasse[1] * L + 5
    a.t += dt
    switch (a.phase) {
      case 'approach': {
        const d = lip - a.x
        const step = Math.sign(d) * Math.min(Math.abs(d), dt * 45)
        a.x += step
        this.climber.dist += Math.abs(step)
        if (step) this.climber.dir = step > 0 ? 1 : -1
        if (Math.abs(lip - a.x) < 0.5) {
          a.x = lip
          a.phase = 'crouch'
          a.t = 0
        }
        break
      }
      case 'crouch':
        if (a.t > 0.25) {
          a.phase = 'air'
          a.t = 0
          this.climber.dir = 1
          this.hooks.sfx('jump')
        }
        break
      case 'air': {
        const ok = a.kind === 'jump'
        const k = Math.min(1, a.t / (ok ? 0.75 : 0.45))
        const to = ok ? far : lip + 8
        a.x = lip + (to - lip) * k
        a.lift = (ok ? 16 : 7) * 4 * k * (1 - k)
        if (k >= 1) {
          a.lift = 0
          a.t = 0
          if (ok) {
            a.phase = 'land'
            this.say('YES!')
            this.hooks.sfx('coin')
            this.hooks.onEvent({ type: 'jump', ok: true })
            this.hooks.requestTrail(STAGES.crevasseOut)
          } else {
            a.phase = 'fall'
            this.say('WHOA!')
            this.hooks.sfx('slip')
            this.hooks.onEvent({ type: 'jump', ok: false })
          }
        }
        break
      }
      case 'land':
        if (a.t > 0.35) {
          a.phase = 'hold'
          a.t = 0
        }
        break
      case 'hold':
        if (this.climber.cx >= far - 3 || a.t > 2.5) this.act = null
        break
      case 'fall':
        a.drop = Math.min(18, a.t * 70)
        if (a.t > 0.35) {
          a.phase = 'dangle'
          a.t = 0
        }
        break
      case 'dangle':
        a.x = lip + 8 + (this.settings.reducedMotion ? 0 : Math.sin(a.t * 4) * 1.5)
        if (a.t > 1.6) {
          a.phase = 'pull'
          a.t = 0
          this.say('PHEW')
        }
        break
      case 'pull': {
        const k = Math.min(1, a.t / 0.9)
        a.drop = 18 * (1 - k)
        a.x = lip + 8 * (1 - k)
        if (k >= 1) this.act = null
        break
      }
    }
  }

  private update(dt: number) {
    const still = this.settings.still
    // The still scene frames the hut towards the right, with the high pastures behind the text.
    const stillX = clamp(Z.hut * L - this.W * 0.84 + this.climberSX, START_X, END_X)
    const target = still ? stillX / L : clamp(this.hooks.getTarget())
    const gap = Math.abs(target - this.f)
    const k = this.settings.reducedMotion || dt === 0 || still ? 1 : 1 - Math.exp(-dt * (gap > 0.12 ? 3 : 7))
    this.f += (target - this.f) * k
    if (Math.abs(target - this.f) < 1e-5) this.f = target

    // Where the scroll puts the climber, and where we actually draw him (acts can override).
    const c = this.climber
    const cx = still ? stillX : clamp(this.f * L, START_X, END_X)
    const prevX = c.x
    c.cx = cx
    if (still) this.act = null
    if (this.act && dt > 0) this.stepAct(dt)
    if (this.act) c.x = this.act.x
    else if (!still && Math.abs(c.x - cx) > 0.5 && dt > 0 && !this.settings.reducedMotion) c.x += (cx - c.x) * (1 - Math.exp(-dt * 6))
    else c.x = cx
    const moved = c.x - prevX
    c.moving = Math.abs(moved) > 0.03 || (this.act?.phase === 'approach' && dt > 0)
    if (Math.abs(moved) > 0.03) {
      if (!this.act) c.dist += Math.abs(moved)
      c.dir = moved > 0 ? 1 : -1
      c.idle = 0
    } else c.idle += dt
    c.wave = Math.max(0, c.wave - dt)
    c.bubbleT -= dt
    this.bounceT = Math.max(0, this.bounceT - dt)

    this.prevCamX = this.camX
    this.camX = Math.round(c.x - this.climberSX)
    this.camAlt = this.world.smoothAltAt(c.x)
    this.camAltPx = Math.round(this.camAlt * PX_PER_M)

    // Day ↔ night: a short sunset (or sunrise) whenever the theme flips.
    const nightTarget = this.settings.night ? 1 : 0
    if (dt === 0 && !this.running) this.nightT = nightTarget
    else {
      const speed = this.settings.reducedMotion ? 2.5 : 0.42
      this.nightT += clamp(nightTarget - this.nightT, -dt * speed, dt * speed)
    }
    // The journey runs through the seasons as you climb; simple view's picture shows today's season.
    if (still && this.settings.season === 'auto') {
      const today = seasonPosForDate(new Date())
      this.palette = paletteAround(today)
      this.season = seasonAround(today)
    } else {
      const seasonPos = this.settings.season === 'auto' ? this.world.seasonPosAt(c.x) : SEASONS.indexOf(this.settings.season)
      this.palette = paletteAt(seasonPos)
      this.season = dominantSeason(seasonPos)
    }
    this.paletteBack = shadeTrees(this.palette, 0.8)
    // Day is always early afternoon; night depends on where you are (see nightAt). Dawn hours are
    // reached by winding back from noon, so the sun sinks (and the moon climbs) rather than racing through a night.
    const place = nightAt(c.x / L)
    const nightHour = place.hour >= 27 ? place.hour - 24 : place.hour
    this.hour = DAY_HOUR + (nightHour - DAY_HOUR) * this.nightT
    this.placeDark = place.dark
    this.sky = skyAt(((this.hour % 24) + 24) % 24, this.palette, clamp(this.camAlt / SUMMIT_ALT))

    if (!still) this.seaSport.update(c.x)
    const mode = this.act
      ? this.act.phase === 'air'
        ? 'leap'
        : this.act.phase === 'fall' || this.act.phase === 'dangle' || this.act.phase === 'pull'
          ? 'hang'
          : 'alpine'
      : still
        ? 'hidden'
        : this.modeAt(c.x)
    if (mode === 'bike' && c.mode !== 'bike' && dt > 0) this.hooks.sfx('bell')
    // Only when the visitor has stopped at the scramble, not while racing past it on a long scroll.
    const atScramble = target >= Z.scramble[0] && target <= Z.scramble[1]
    if (mode === 'scramble' && c.mode !== 'scramble' && dt > 0 && atScramble) this.say(HANDS_ON)
    if (mode !== 'scramble' && c.bubble === HANDS_ON) c.bubbleT = 0
    c.mode = mode
    this.zone = this.zoneAt(c.x)

    // Pointer kinematics in low-res pixels.
    const p = this.pointer
    p.sx = p.cssX / this.S
    p.sy = p.cssY / this.S
    p.wx = this.camX + p.sx
    p.h = this.walkY(p.wx) - p.sy
    if (dt > 0) {
      const ivx = p.lastSX < -900 ? 0 : (p.sx - p.lastSX) / dt
      const ivy = p.lastSY < -900 ? 0 : (p.sy - p.lastSY) / dt
      p.vx += (ivx - p.vx) * Math.min(1, dt * 12)
      p.vy += (ivy - p.vy) * Math.min(1, dt * 12)
      p.speed = Math.hypot(p.vx, p.vy)
      p.still = p.speed < 8 ? p.still + dt : 0
    }
    p.lastSX = p.sx
    p.lastSY = p.sy

    this.syncView()
    if (dt > 0) {
      this.wildlife.update(this.animalCtx(dt), this.settings.wildlife)
      const intensity = this.settings.reducedMotion || !this.settings.wildlife || still ? 0 : this.season === 'winter' ? 1.25 : 1
      const coastal = c.x / L < 0.2
      this.weather.update(dt, this.W, this.H, this.camX - this.prevCamX, particleFor(this.season), coastal ? intensity * 0.4 : intensity, {
        sx: p.sx,
        sy: p.sy,
        vx: p.vx,
        vy: p.vy,
        active: p.active,
      })
      this.updateTracks()
      this.updateSmoke(dt)
      this.flash = Math.max(0, this.flash - dt * 3.2)
      for (const s of this.sparkles) s.t -= dt
      this.sparkles = this.sparkles.filter((s) => s.t > 0)
      if (this.f > 0.975 && c.idle > 0.4 && c.summitT === 0) c.summitT = 3
      if (this.f < 0.97) c.summitT = 0
      if (c.summitT > 0) c.summitT = Math.max(0.0001, c.summitT - dt)
    }

    const interactive =
      !still &&
      p.active &&
      (this.wildlife.hit(this.animalCtx(0), p.sx, p.sy, 6) !== null ||
        this.edelweissAt(p.sx, p.sy, 9) >= 0 ||
        this.holdAt(p.sx, p.sy, 8) >= 0 ||
        this.skyBodyAt(p.sx, p.sy) !== null ||
        findAt(this.view, this.finds, p.sx, p.sy) !== null)
    if (interactive !== this.hoverInteractive) {
      this.hoverInteractive = interactive
      this.hooks.onHover(interactive)
    }

    this.statusT -= dt
    const alt = Math.round(this.world.altAt(c.x))
    if (!still && (this.statusT <= 0 || dt === 0)) {
      this.statusT = 0.12
      const key = `${alt}|${this.season}|${Math.round(this.sky.daylight * 20)}|${this.zone}|${mode}`
      if (key !== this.lastStatus || dt === 0) {
        this.lastStatus = key
        this.hooks.onStatus({
          altitude: alt,
          f: this.f,
          season: this.season,
          biome: this.world.biomeAt(c.x),
          daylight: this.sky.daylight,
          zone: this.zone,
          mode,
        })
      }
    }
  }

  private syncView() {
    const v = this.view
    v.W = this.W
    v.H = this.H
    v.horizon = this.horizon
    v.ground0 = this.ground0
    v.camX = this.camX
    v.camAlt = this.camAlt
    v.camAltPx = this.camAltPx
    v.time = this.time
    v.palette = this.palette
    v.paletteBack = this.paletteBack
    v.sky = this.sky
    v.season = this.season
    v.world = this.world
    v.reducedMotion = this.settings.reducedMotion
    v.climberX = this.climber.x
    v.nightT = this.nightT
    v.hour = ((this.hour % 24) + 24) % 24
  }

  private updateTracks() {
    const x = this.climber.x
    const snowy = Math.max(this.palette.groundSnow, this.world.permanentSnow(x)) > 0.6
    if (snowy && Math.abs(x - this.lastTrackX) >= 3 && this.climber.mode !== 'hang' && this.climber.mode !== 'leap') {
      this.tracks.push({ x, t: this.time, ski: this.climber.mode === 'ski' })
      this.lastTrackX = x
      if (this.tracks.length > 500) this.tracks.shift()
    }
    this.tracks = this.tracks.filter((t) => this.time - t.t < 45)
  }

  private updateSmoke(dt: number) {
    this.smokeT -= dt
    if (this.smokeT <= 0 && !this.settings.reducedMotion) {
      this.smokeT = 0.45
      for (const p of this.world.props) {
        if (p.kind !== 'rifugio' && p.kind !== 'house' && p.kind !== 'farmhouse') continue
        if (Math.abs(p.x - this.climber.x) > this.W) continue
        const off = p.kind === 'rifugio' ? 11 : 4
        const top = p.kind === 'rifugio' ? RIFUGIO.h - 1 : p.kind === 'farmhouse' ? FARMHOUSE.h - 1 : HOUSE.h - 2
        this.smoke.push({ x: p.x + off, y: top, age: 0 })
      }
    }
    for (const s of this.smoke) s.age += dt
    this.smoke = this.smoke.filter((s) => s.age < 4)
  }

  /* ------------------------------------------------------------- render */

  private render(dt: number) {
    const ctx = this.ctx
    const s = this.sctx
    const v = this.view
    const { W, H } = this
    this.syncView()

    this.backdrop.drawSky(ctx, v)
    if (!this.settings.still) drawSkyDetails(ctx, v)
    s.clearRect(0, 0, W, H)
    this.backdrop.drawClouds(s, v)
    this.backdrop.drawLayers(s, v)
    if (!this.settings.still) drawLandDetails(s, v, this.backdrop.tops)
    drawWaterBodies(s, v, this.backdrop.tops, this.climberSX)
    s.drawImage(this.terrain.paint(v, this.cracks, this.crackAt), 0, 0)
    if (!this.settings.still) drawFinds(s, v, this.finds)

    const lights: Light[] = []
    const glows: Glow[] = []
    const holds = this.world.holds.map((h, i) => ({ x: h.x, done: this.holdsDone[i] }))
    const pc: PropCtx = {
      lights,
      glows,
      f: this.climber.x / L,
      boardAshore: this.climber.x / L > Z.shore + 0.0008 || this.seaSport.sport === 'snorkel',
      inHut: this.climber.mode === 'hidden' && (this.settings.inHut || this.settings.still),
      holds,
      showHolds: this.zone === 'climb',
    }
    const eyes: Eye[] = []
    drawProps(s, v, 'back', pc)
    this.drawAnimals(s, 'back', eyes)
    this.drawTracks(s)
    drawProps(s, v, 'mid', pc)
    this.drawEdelweiss(s)
    this.drawSmoke(s)
    this.drawAnimals(s, 'ground', eyes)
    this.head = this.drawClimber(s)
    drawProps(s, v, 'front', pc)
    this.drawAnimals(s, 'air', eyes)
    this.weather.draw(s, this.palette)

    if (this.sky.tintAlpha > 0.01) {
      s.globalCompositeOperation = 'source-atop'
      s.fillStyle = css(this.sky.tint, this.sky.tintAlpha)
      s.fillRect(0, 0, W, H)
      s.globalCompositeOperation = 'source-over'
    }
    const fall = clamp((this.nightT - 0.5) / 0.5)
    const darkness = fall * fall * (3 - 2 * fall) * this.placeDark
    const dark = darkness
    // The head torch goes on at dusk and off again once dawn gives enough light to see by.
    const torch = needsTorch(dark, this.sky.daylight) ? this.torch() : null
    if (dark > 0.01) this.night.darken(s, v, darkness, torch, glows)
    ctx.drawImage(this.scene, 0, 0)

    if (dark > 0.01) {
      for (const e of eyes) e.lit = Night.inBeam(torch, e.x, e.y)
      this.night.light(ctx, v, darkness, torch, glows, lights, eyes)
      if (this.season === 'summer' && this.settings.wildlife && !this.settings.reducedMotion) {
        const biome = this.world.biomeAt(this.climber.x)
        if (biome === 'country' || biome === 'valley' || biome === 'forest' || biome === 'pasture' || biome === 'lake') {
          this.weather.fireflies(ctx, dt, W, H, (sx) => this.groundY(this.camX + sx), 14)
        }
      }
    } else if (this.sky.daylight < 0.75) {
      ctx.globalAlpha = clamp((0.75 - this.sky.daylight) * 2)
      for (const l of lights) ctx.drawImage(l.c, l.x, l.y)
      ctx.globalAlpha = 1
    }
    if (!this.settings.still) {
      drawDistantLights(ctx, v, this.backdrop.tops)
      this.drawOverlayUI(ctx)
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash.toFixed(2)})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  /** The head torch points at the pointer (or the last tap); otherwise a little way ahead. */
  private torch(): Torch | null {
    if (!this.head) return null
    const [hx, hy] = this.head
    const p = this.pointer
    const recent = p.active || this.time - p.seenAt < 4
    if (recent && p.sx > -900) return { hx, hy, tx: p.sx, ty: p.sy }
    const dir = this.climber.dir
    return { hx, hy, tx: hx + dir * 48, ty: this.walkY(this.climber.x + dir * 48) - 2 }
  }

  private drawClimber(s: CanvasRenderingContext2D) {
    const c = this.climber
    const x = c.x
    let y = this.walkY(x)
    let anchor: [number, number] | null = null
    let tail: [number, number] | null = null
    if (c.mode === 'leap' && this.act) y -= Math.round(this.act.lift)
    if (c.mode === 'hang' && this.act) {
      const lip = Z.crevasse[0] * L - 4
      y = this.groundY(lip) + Math.round(this.act.drop) - 2
      anchor = [Math.round(lip - this.camX) + 1, this.groundY(lip) - 1]
    }
    // On a cliff: climbing trails the rope down to its foot; abseiling hangs from the anchor at the top.
    const cliff = this.cliffAt(x)
    const wall = cliff?.wall ?? 1
    if (cliff && c.mode === 'climb') {
      const base = cliff.bottom - 5 * wall
      tail = [Math.round(base - this.camX), this.groundY(base)]
    }
    if (cliff && c.mode === 'abseil') {
      const ax = cliff.top + 3 * wall
      anchor = [Math.round(ax - this.camX) - wall, this.groundY(ax) + 1]
      const bx = cliff.bottom - 6 * wall
      tail = [Math.round(x - this.camX) - 4 * wall, this.groundY(bx)]
    }
    if (c.mode === 'hidden') return null
    const head = drawClimber(s, this.view, {
      mode: c.mode,
      x,
      y,
      dir: c.dir,
      dist: c.dist,
      moving: c.moving,
      wave: c.wave,
      bounce: this.bounceT > 0 ? 1 - this.bounceT / 0.8 : 0,
      anchor,
      tail,
      wall,
      cliff: cliff && c.mode === 'climb' ? { bottom: cliff.bottom, top: cliff.top } : null,
      pointer: this.pointer.active ? [this.pointer.sx, this.pointer.sy] : null,
    })
    return head
  }

  private drawTracks(s: CanvasRenderingContext2D) {
    if (!this.tracks.length) return
    s.fillStyle = css(shade(this.palette.snowShade, 0.92))
    for (const t of this.tracks) {
      const sx = Math.round(t.x - this.camX)
      if (sx < 0 || sx >= this.W || this.world.isCrevasse(t.x)) continue
      const gy = this.groundY(t.x)
      if (t.ski) s.fillRect(sx - 1, gy, 3, 1)
      else s.fillRect(sx, gy, 1, 1)
    }
  }

  private drawEdelweiss(s: CanvasRenderingContext2D) {
    for (let i = 0; i < this.world.edelweiss.length; i++) {
      if (!this.edelweissVisible(i)) continue
      const x = this.world.edelweiss[i]
      const sx = Math.round(x - this.camX)
      const gy = this.groundY(x)
      s.drawImage(bake(EDELWEISS, null), Math.round(sx - EDELWEISS.w / 2), gy - EDELWEISS.h + 1)
      const near = this.pointer.active && Math.hypot(this.pointer.sx - sx, this.pointer.sy - (gy - 4)) < 34
      if (!this.collected.has(i) && (near || Math.sin(this.time * 2 + i) > 0.97)) {
        const t = this.time * 6 + i
        s.fillStyle = '#ffffff'
        s.fillRect(sx + Math.round(Math.cos(t) * 5), gy - 4 + Math.round(Math.sin(t * 1.3) * 4), 1, 1)
        s.fillRect(sx + Math.round(Math.cos(t + 2) * 4), gy - 5 + Math.round(Math.sin(t * 1.1 + 1) * 4), 1, 1)
      }
    }
    for (const sp of this.sparkles) {
      const sx = Math.round(sp.x - this.camX + Math.cos(sp.t * 20 + sp.y) * (1.1 - sp.t) * 10)
      const sy = Math.round(sp.y - (1.1 - sp.t) * 12)
      s.fillStyle = '#fffbe0'
      s.fillRect(sx, sy, 1, 1)
    }
  }

  private drawSmoke(s: CanvasRenderingContext2D) {
    for (const p of this.smoke) {
      const sx = Math.round(p.x - this.camX + p.age * 3 + Math.sin(p.age * 2) * 1.5)
      const sy = Math.round(this.groundY(p.x) - p.y - p.age * 6)
      s.fillStyle = `rgba(220,226,234,${(0.7 * (1 - p.age / 4)).toFixed(2)})`
      const size = p.age > 1.5 ? 2 : 1
      s.fillRect(sx, sy, size, size)
    }
  }

  private passOf(a: Animal): 'back' | 'ground' | 'air' {
    if (a.kind === 'flamingo') return a.state === 'fly' ? 'air' : 'back'
    if (AIR.has(a.kind) || choughOnWing(a)) return 'air'
    return 'ground'
  }

  private drawAnimals(s: CanvasRenderingContext2D, pass: 'back' | 'ground' | 'air', eyes: Eye[]) {
    const c = { camX: this.camX, groundY: this.walkY }
    for (const a of this.wildlife.animals) {
      if (this.passOf(a) !== pass) continue
      const sx = a.x - this.camX
      if (sx < -30 || sx > this.W + 30) continue
      if (a.kind === 'dolphin' && !a.visible) {
        // A fin cutting the surface between jumps.
        if (a.state === 'swim' && Math.floor(this.time * 3 + a.phase) % 4 !== 0) {
          s.fillStyle = '#4c6f91'
          const fx = Math.round(sx)
          const gy = this.groundY(a.x)
          s.fillRect(fx, gy - 2, 1, 2)
          s.fillRect(fx - a.dir, gy - 1, 1, 1)
        }
        continue
      }
      if (!a.visible) continue
      s.globalAlpha = clamp(a.alpha)
      const q = QUADS[a.kind]
      if (q) {
        const eye = drawQuad(s, q, { pose: a.pose, phase: a.gait, speed: a.speed }, sx, this.walkY(a.x), a.dir, Math.round(a.h))
        if (eye) eyes.push({ x: eye[0], y: eye[1], lit: false, color: EYE_COLORS[a.kind] ?? '#eaff7a' })
      } else if (a.kind === 'eagle' || a.kind === 'gull' || choughOnWing(a)) {
        const b = box(a, c)
        drawSpreadBird(s, a.kind === 'eagle' || a.kind === 'gull' ? a.kind : 'chough', b.sx + b.w / 2, b.sy + b.h / 2, a.flap)
        if (a.kind === 'eagle' && a.h > 20) {
          s.fillStyle = 'rgba(0,0,0,0.18)'
          s.fillRect(Math.round(sx) - 5, this.walkY(a.x) - 1, 10, 1)
        }
      } else if (a.kind === 'dolphin') {
        const gy = this.groundY(a.x)
        drawDolphin(s, sx, gy - a.h - 2, a.angle, a.dir)
        if (a.h < 4) {
          s.fillStyle = '#f4fbff'
          for (let i = -3; i <= 3; i += 2) s.fillRect(Math.round(sx) + i, gy - 1 - ((i + 3) % 3), 1, 1)
        }
      } else if (a.kind === 'flamingo') {
        const path = this.walkY(a.x)
        const feet = path - Math.round(a.h)
        if (a.state === 'fly') {
          drawFlyingFlamingo(s, sx, feet - 5, a.dir, a.flap)
        } else if (a.state === 'run') {
          drawFlyingFlamingo(s, sx, feet - 6, a.dir, a.flap, true, this.time * 22)
          s.fillStyle = 'rgba(240,252,252,0.85)'
          for (const dx of [-3, 1, 3]) if ((Math.floor(this.time * 12) + dx) % 2) s.fillRect(Math.round(sx) + dx, feet - 1, 1, 1)
        } else {
          const leg = drawFlamingo(s, a.pose === 'graze' ? 'feed' : 'stand', a.gait, a.speed > 1.5, sx, feet, a.dir)
          // Standing in shallow water: a ripple where the legs go in, and a soft pink reflection below.
          s.fillStyle = 'rgba(236,250,250,0.8)'
          s.fillRect(leg - 2, feet - 1, 5, 1)
          const below = Math.min(4, path - feet - 1)
          if (below > 0) {
            s.fillStyle = 'rgba(217,96,142,0.35)'
            s.fillRect(leg, feet, 1, below)
          }
        }
      } else if (a.sprite) {
        const b = box(a, c)
        if (a.kind === 'marmot' && a.state === 'peek') {
          s.save()
          s.beginPath()
          s.rect(b.sx - 2, b.sy - 4, b.w + 4, this.walkY(a.x) - b.sy + 3)
          s.clip()
          s.drawImage(bake(a.sprite, null, a.dir < 0), b.sx, b.sy + 2)
          s.restore()
        } else {
          s.drawImage(bake(a.sprite, null, a.dir < 0), b.sx, b.sy)
        }
        if (a.kind === 'owl') eyes.push({ x: b.sx + Math.floor(b.w / 2) - 1, y: b.sy + 2, lit: false, color: '#ffe25a' })
      }
      s.globalAlpha = 1
    }
    if (pass === 'ground') {
      for (const cr of this.wildlife.crumbs) {
        s.fillStyle = '#c28b5c'
        s.fillRect(Math.round(cr.x - this.camX), this.walkY(cr.x) - 1, 1, 1)
      }
    }
  }

  /** Little hearts rising from a courting pair, fading as they go (drawn over the night, so they show in the dark too). */
  private drawHearts(ctx: CanvasRenderingContext2D) {
    for (const h of this.wildlife.hearts) {
      const hx = Math.round(h.x - this.camX)
      const hy = Math.round(this.walkY(h.x) - h.h) - 4
      ctx.globalAlpha = clamp(1.2 - h.t / 1.8)
      ctx.fillStyle = '#ff6f9c'
      ctx.fillRect(hx - 2, hy, 2, 1)
      ctx.fillRect(hx + 1, hy, 2, 1)
      ctx.fillRect(hx - 2, hy + 1, 5, 1)
      ctx.fillRect(hx - 1, hy + 2, 3, 1)
      ctx.fillRect(hx, hy + 3, 1, 1)
      ctx.fillStyle = '#ffd1e0'
      ctx.fillRect(hx - 1, hy, 1, 1)
      ctx.globalAlpha = 1
    }
  }

  private drawOverlayUI(ctx: CanvasRenderingContext2D) {
    this.drawHearts(ctx)
    const p = this.pointer
    const c = { camX: this.camX, groundY: this.walkY }
    if (p.active) {
      const a = this.wildlife.hit(c, p.sx, p.sy, 10)
      if (a) {
        const b = box(a, c)
        const info = SPECIES_BY_ID[a.kind]
        this.label(ctx, info.label, b.sx + b.w / 2, b.sy - 3, !this.hooks.isSpotted(a.kind))
      } else {
        const ew = this.edelweissAt(p.sx, p.sy, 12)
        const body = ew < 0 ? this.skyBodyAt(p.sx, p.sy) : null
        const find = ew < 0 && !body ? findAt(this.view, this.finds, p.sx, p.sy) : null
        if (find) {
          const b = findBox(this.view, find)
          this.label(ctx, FINDS[find.kind].label, b.sx + b.w / 2, b.sy - 2, false, false)
        } else if (ew >= 0) {
          const x = this.world.edelweiss[ew]
          this.label(ctx, 'Edelweiss', x - this.camX, this.groundY(x) - 9, !this.collected.has(ew))
        } else if (body) {
          const at = body === 'sun' ? this.backdrop.sun(this.view) : this.backdrop.moon(this.view)
          this.label(ctx, this.settings.night ? 'Make it day' : 'Make it night', at.x, at.y + 19, false, false)
        }
      }
    }
    // Point at the next hold so it's obvious what to tap.
    if (this.zone === 'climb' && this.climber.mode !== 'abseil') {
      const next = this.holdsDone.findIndex((d) => !d)
      if (next >= 0) {
        const h = this.world.holds[next]
        const x = Math.round(h.x - this.camX) + 6
        const bob = this.settings.reducedMotion ? 0 : Math.round(Math.sin(this.time * 6))
        const y = this.groundY(h.x) + 1 + bob
        ctx.fillStyle = INK
        ctx.fillRect(x, y, 11, 7)
        ctx.drawImage(bakeText('TAP', '#ffcd75'), x + 2, y + 1)
        ctx.fillStyle = '#ffcd75'
        ctx.fillRect(x - 2, y + 3, 2, 1)
        ctx.fillRect(x - 1, y + 2, 1, 3)
      }
    }
    for (const a of this.wildlife.animals) {
      if (a.bubbleT <= 0 || !a.bubble || !a.visible) continue
      const b = box(a, c)
      this.bubble(ctx, a.bubble, b.sx + b.w / 2, b.sy - 12)
    }
    if (this.climber.bubbleT > 0 && this.head) this.bubble(ctx, this.climber.bubble, this.head[0], this.head[1] - 12)
  }

  private label(ctx: CanvasRenderingContext2D, text: string, cx: number, bottom: number, snapHint: boolean, tick = true) {
    const t = snapHint ? `${text} - SNAP!` : text
    const w = textWidth(t) + 4 + (snapHint || !tick ? 0 : 5)
    const x = Math.round(clamp(cx - w / 2, 1, this.W - w - 1))
    const y = Math.round(Math.max(1, bottom - 8))
    ctx.fillStyle = 'rgba(16,18,32,0.82)'
    ctx.fillRect(x, y, w, 9)
    ctx.drawImage(bakeText(t, snapHint ? '#ffcd75' : '#f4f4f4'), x + 2, y + 2)
    if (!snapHint && tick) {
      ctx.fillStyle = '#a7f070'
      const cx2 = x + w - 6
      ctx.fillRect(cx2, y + 5, 1, 1)
      ctx.fillRect(cx2 + 1, y + 6, 1, 1)
      ctx.fillRect(cx2 + 2, y + 5, 1, 1)
      ctx.fillRect(cx2 + 3, y + 4, 1, 1)
      ctx.fillRect(cx2 + 4, y + 3, 1, 1)
    }
  }

  private bubble(ctx: CanvasRenderingContext2D, text: string, cx: number, bottom: number) {
    const w = textWidth(text) + 6
    const x = Math.round(clamp(cx - w / 2, 1, this.W - w - 1))
    const y = Math.round(Math.max(1, bottom - 9))
    ctx.fillStyle = INK
    ctx.fillRect(x - 1, y - 1, w + 2, 11)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, w, 9)
    ctx.fillRect(Math.round(cx) - 1, y + 9, 3, 1)
    ctx.fillRect(Math.round(cx), y + 10, 1, 1)
    ctx.drawImage(bakeText(text, INK), x + 3, y + 2)
  }
}

function shadeTrees(p: ScenePalette, k: number): ScenePalette {
  const sh = (c: RGB) => shade(c, k)
  return {
    ...p,
    conifer: sh(p.conifer),
    coniferLight: sh(p.coniferLight),
    leaf: sh(p.leaf),
    leafLight: sh(p.leafLight),
    larch: sh(p.larch),
    larchLight: sh(p.larchLight),
    trunk: sh(p.trunk),
    rock: sh(p.rock),
    rockLight: sh(p.rockLight),
    rockDark: sh(p.rockDark),
  }
}
