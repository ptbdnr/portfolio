import type { SfxName } from '../../lib/sfx.ts'
import { clamp, fbm, type Rng } from './math.ts'
import type { Season } from './palettes.ts'
import { QUADS, quadHeight, type QuadPose } from './rig.ts'
import { BUTTERFLY, BUTTERFLY_HALF, CHOUGH, HARE, MARMOT, OWL, PTARMIGAN, SQUIRREL, YETI, type Sprite } from './sprites.ts'
import { WORLD_LEN, Z, type Biome, type World } from './world.ts'

export type Kind =
  | 'fox'
  | 'squirrel'
  | 'deer'
  | 'owl'
  | 'marmot'
  | 'cow'
  | 'butterfly'
  | 'eagle'
  | 'chamois'
  | 'ibex'
  | 'ptarmigan'
  | 'hare'
  | 'chough'
  | 'yeti'
  | 'flamingo'
  | 'gull'
  | 'dolphin'
  | 'sheep'

export type Pointer = {
  /** Over the world (not over a content panel or control). */
  active: boolean
  sx: number
  sy: number
  /** World x under the pointer. */
  wx: number
  /** Height of the pointer above the ground at wx, in pixels. */
  h: number
  /** Low-res pixels per second. */
  speed: number
  /** Seconds since the pointer last moved noticeably. */
  still: number
}

export type Crumb = { x: number; t: number }

export type AnimalCtx = {
  dt: number
  time: number
  pointer: Pointer
  groundY: (x: number) => number
  camX: number
  W: number
  H: number
  rng: Rng
  season: Season
  daylight: number
  sfx: (n: SfxName) => void
  world: World
  crumbs: Crumb[]
  climberX: number
  /** Screen x up to which the scene is never covered by the page's content cards (low-res pixels). */
  clearW?: number
}

const GRAVITY = 260

/** An eagle circles on a radius of SOAR_R pixels, SOAR_TURN radians a second. */
const SOAR_R = 26
const SOAR_TURN = 0.55
const SOAR_SPEED = SOAR_R * SOAR_TURN

/** Animals that walk. They never set foot in the sea or the lagoon (flamingos wade; birds fly). */
const LAND = new Set<Kind>(['fox', 'squirrel', 'deer', 'marmot', 'cow', 'chamois', 'ibex', 'ptarmigan', 'hare', 'yeti', 'sheep'])

/** Above this altitude only birds live: the glacier and the summit ridge are no place for mammals. */
export const MAX_MAMMAL_ALT = 3600

/** Mammals (the yeti is a legend and goes where it likes). */
const MAMMALS = new Set<Kind>(['fox', 'squirrel', 'deer', 'marmot', 'cow', 'chamois', 'ibex', 'hare', 'sheep'])

/** Mountain hares live high up: never below somewhere between these altitudes (it varies along the trail). */
export const HARE_MIN_ALT: [number, number] = [1200, 1600]

/** The lowest a mountain hare goes at world x. */
export function hareFloor(x: number) {
  const n = clamp(fbm(x / 260, 41, 2) * 0.5 + 0.5)
  return HARE_MIN_ALT[0] + (HARE_MIN_ALT[1] - HARE_MIN_ALT[0]) * n
}

/** Can this kind of animal live at world x? */
export function habitable(kind: Kind, x: number, w: World) {
  if (LAND.has(kind) && w.isWater(x)) return false
  if (MAMMALS.has(kind) && w.altAt(x) > MAX_MAMMAL_ALT) return false
  if (kind === 'hare' && w.altAt(x) < hareFloor(x)) return false
  return true
}

/** Turns a mammal back before it climbs too high (or a mountain hare before it runs too low). */
function keepAltitude(a: Animal, c: AnimalCtx) {
  const alt = c.world.altAt(a.x)
  const tooHigh = MAMMALS.has(a.kind) && alt > MAX_MAMMAL_ALT
  const tooLow = a.kind === 'hare' && alt < hareFloor(a.x)
  if (!tooHigh && !tooLow) return
  a.x = a.lastX
  a.vx = -Math.sign(a.vx || 1) * Math.max(Math.abs(a.vx), 12)
  a.vs = 0
  a.dir = a.vx > 0 ? 1 : -1
}

/** Turns a land animal back at the water's edge. */
function keepAshore(a: Animal, c: AnimalCtx) {
  const w = c.world
  if (!LAND.has(a.kind) || !w.isWater(a.x)) return
  const dry = w.dryLand(a.x)
  const away: 1 | -1 = dry > a.x ? 1 : -1
  a.x = w.isWater(a.lastX) ? dry : a.lastX
  a.vx = away * Math.max(Math.abs(a.vx), 12)
  a.vs = 0
  a.dir = away
  a.targetX = w.dryLand(a.targetX)
  a.anchor = w.dryLand(a.anchor)
}

export class Animal {
  uid: number
  kind: Kind
  x: number
  h = 0
  vx = 0
  /** Smoothed horizontal speed actually applied, so starts and stops ease in and out. */
  vs = 0
  vh = 0
  dir: 1 | -1 = 1
  state = 'idle'
  t = 0
  life: number
  anchor: number
  anchorH = 0
  bubble = ''
  bubbleT = 0
  cooldown = 0
  alpha = 1
  gone = false
  fixed = false
  visible = true
  phase: number
  gait = 0
  speed = 0
  pose: QuadPose = 'stand'
  sprite: Sprite | null = null
  flap = 0
  angle = 0
  wait = 0
  targetX = 0
  cx = 0
  ch = 0
  count = 0
  spotted = false
  lastX: number
  /** The partner it's courting (its uid), or 0. */
  mate = 0
  /** Courting, it waits where it is (looking up) while its partner comes over. */
  host = false

  constructor(uid: number, kind: Kind, x: number, rngValue: number) {
    this.uid = uid
    this.kind = kind
    this.x = x
    this.lastX = x
    this.anchor = x
    this.phase = rngValue * Math.PI * 2
    this.life = 30 + rngValue * 40
  }
}

const set = (a: Animal, state: string) => {
  a.state = state
  a.t = 0
}

/** A chough in the air (a short hop-flight, or swooping in to land) rather than hopping about. */
export const choughOnWing = (a: Animal) => a.kind === 'chough' && (a.state === 'fly' || a.state === 'arrive')

/** Fades an animal out of sight, and lets it go once it has. */
function fadeOut(a: Animal, c: AnimalCtx, perSecond: number) {
  a.alpha = Math.max(0, a.alpha - c.dt * perSecond)
  if (a.alpha <= 0) a.gone = true
}

const fadeIn = (a: Animal, c: AnimalCtx, perSecond: number) => {
  a.alpha = Math.min(1, a.alpha + c.dt * perSecond)
}

const say = (a: Animal, c: AnimalCtx, text: string, sound?: SfxName) => {
  a.bubble = text
  a.bubbleT = 1.8
  if (sound) c.sfx(sound)
}

/** Width and height of whatever the animal currently looks like. */
export function dims(a: Animal): [number, number] {
  const q = QUADS[a.kind]
  if (q) return [(a.pose === 'graze' && q.poses.graze ? q.poses.graze : q.poses.stand).w, quadHeight(q)]
  if (a.kind === 'eagle') return [21, 7]
  if (a.kind === 'gull') return [17, 6]
  if (choughOnWing(a)) return [11, 5]
  if (a.kind === 'dolphin') return [14, 9]
  if (a.kind === 'flamingo') return a.state === 'fly' || a.state === 'run' ? [23, 10] : [9, 17]
  return a.sprite ? [a.sprite.w, a.sprite.h] : [6, 4]
}

export function box(a: Animal, c: Pick<AnimalCtx, 'camX' | 'groundY'>) {
  const [w, h] = dims(a)
  const sx = Math.round(a.x - c.camX - w / 2)
  const sy = Math.round(c.groundY(a.x) - a.h - h)
  return { sx, sy, w, h }
}

function pointerDist(a: Animal, c: AnimalCtx) {
  if (!c.pointer.active || !a.visible) return Infinity
  const b = box(a, c)
  return Math.hypot(c.pointer.sx - (b.sx + b.w / 2), c.pointer.sy - (b.sy + b.h / 2))
}

/** Ground movement with eased acceleration. */
function walk(a: Animal, c: AnimalCtx, ease = 7) {
  a.vs += (a.vx - a.vs) * Math.min(1, c.dt * ease)
  a.x += a.vs * c.dt
  if (Math.abs(a.vx) > 1) a.dir = a.vx > 0 ? 1 : -1
}

function airborne(a: Animal, c: AnimalCtx) {
  a.vh -= GRAVITY * c.dt
  a.h += a.vh * c.dt
  if (a.h <= 0) {
    a.h = 0
    a.vh = 0
    return true
  }
  return false
}

function leaveToward(a: Animal, c: AnimalCtx, speed: number) {
  a.vx = (a.x - c.camX < c.W / 2 ? -1 : 1) * speed
}

function offscreen(a: Animal, c: AnimalCtx, margin = 40) {
  const sx = a.x - c.camX
  return sx < -margin || sx > c.W + margin
}

function faceToward(a: Animal, x: number) {
  if (Math.abs(x - a.x) > 2) a.dir = x > a.x ? 1 : -1
}

/** Grazers wander a little, look up now and then, and turn towards a curious cursor. */
function graze(a: Animal, c: AnimalCtx, range: number, speed: number) {
  if (a.t > a.wait) {
    a.wait = a.t + 1.5 + c.rng.next() * 4
    const roll = c.rng.next()
    if (roll < 0.45) {
      a.pose = 'graze'
      a.vx = 0
    } else if (roll < 0.75) {
      a.pose = 'stand'
      a.vx = 0
    } else {
      a.pose = 'stand'
      a.vx = (c.rng.chance(0.5) ? 1 : -1) * speed
    }
  }
  if (Math.abs(a.x + a.vx * c.dt - a.anchor) > range) a.vx = 0
  walk(a, c, 4)
}

/* -------------------------------------------------------------------------- */

/** Flamingos wade where the lagoon is deep enough (on screen) to stand in at their distance from the path. */
export function canWade(a: Animal, w: World, x: number) {
  return w.lagoonDepth(x) >= a.anchorH + 3
}

function stayInLagoon(a: Animal, c: AnimalCtx) {
  if (canWade(a, c.world, a.x)) return
  a.x = canWade(a, c.world, a.lastX) ? a.lastX : a.anchor
  a.vx = -a.vx
  a.vs = 0
  if (a.state === 'wade') set(a, 'idle')
}

function takeOff(a: Animal, c: AnimalCtx, dir: 1 | -1) {
  set(a, 'run')
  a.dir = dir
  a.vx = 0
  a.vs = 0
  c.sfx('flutter')
}

/* -------------------------------------------------------------------------- */

type Behaviour = (a: Animal, c: AnimalCtx, d: number) => void

/** A little heart floating up from a courting pair. */
export type Heart = { x: number; h: number; t: number }

/**
 * Courtship, very occasionally: a calm animal is joined by another of its kind; they amble up to
 * each other, stand nose to nose for a moment (hearts float up) and wander off together. Only the
 * medium and large mammals that roam, so it's easy to see; how fast each kind ambles.
 */
export const COURTING: Partial<Record<Kind, { speed: number }>> = {
  deer: { speed: 10 },
  chamois: { speed: 10 },
  ibex: { speed: 8 },
  fox: { speed: 12 },
}
/** Chance per second for a calm animal in view, and the quiet spell before it can happen again. */
export const COURTSHIP = { rate: 0.004, cooldown: 120 }

/**
 * Every journey up the trail includes at least one courtship the visitor actually sees: from a
 * random point along the way (`due`, a trail fraction), the next time the visitor pauses where a
 * courting animal could live, a pair meets in view. It counts once the pair has stood nose to nose
 * on screen for `seen` seconds; until then it's tried again (`retry` seconds later). Back at the
 * beach, a new journey begins.
 */
export const JOURNEY = { due: [0.25, 0.7] as [number, number], pause: 0.8, seen: 1.2, retry: 8, start: 0.06 }
/** Settled on the ground and minding its own business (a fox sitting watching counts; an ibex up on a boulder doesn't). */
const calm = (a: Animal) => (a.state === 'idle' || a.state === 'graze' || a.state === 'watch') && a.h === 0

function court(a: Animal, b: Animal | undefined, c: AnimalCtx, d: number, hearts: Heart[]) {
  const spec = COURTING[a.kind]!
  if (!b || b.gone) {
    // The partner has wandered off already: follow it out, or (if they never met) carry on alone.
    if (a.state === 'together') {
      walk(a, c, 3)
      if (offscreen(a, c)) a.gone = true
      return
    }
    a.mate = 0
    a.host = false
    set(a, 'idle')
    return
  }
  // Too close for comfort: they forget each other and bolt.
  if (d < 26) {
    for (const x of [a, b]) {
      x.mate = 0
      x.host = false
      set(x, 'flee')
      x.pose = 'stand'
      x.vx = (c.pointer.wx > x.x ? -1 : 1) * 70
    }
    say(a, c, '!')
    return
  }
  switch (a.state) {
    case 'court': {
      a.pose = 'stand'
      // Something in the way (water, a cliff edge)? Never mind.
      if (a.t > 20) {
        for (const x of [a, b]) {
          x.mate = 0
          x.host = false
          set(x, 'idle')
        }
        return
      }
      const gap = b.x - a.x
      // Nose to nose: about a body length apart, centre to centre.
      const close = Math.max(5, dims(a)[0] + 4)
      // A newcomer hurries over (from the edge of the view, it hurries more) until it's close.
      const pace = Math.abs(gap) > 40 ? 2.5 : Math.abs(gap) > close + 6 ? 1.8 : 1
      if (Math.abs(gap) > close) a.vx = a.host ? 0 : Math.sign(gap) * spec.speed * pace
      else {
        a.vx = 0
        set(a, 'nuzzle')
        a.wait = 0.15
      }
      walk(a, c, 4)
      if (a.host) a.dir = gap > 0 ? 1 : -1
      // A partner that turned up nearby fades into view as it comes over.
      a.alpha = Math.min(1, a.alpha + c.dt * 1.6)
      break
    }
    case 'nuzzle':
      a.vx = 0
      walk(a, c, 6)
      a.dir = b.x > a.x ? 1 : -1
      a.pose = Math.floor(a.t * 1.6 + (a.uid % 2)) % 2 ? 'graze' : 'stand'
      if (a.uid < b.uid && a.t > a.wait) {
        hearts.push({ x: (a.x + b.x) / 2, h: dims(a)[1] + 1, t: 0 })
        a.wait = a.t + 0.9
      }
      if (a.t > 4.2) {
        // Off together, side by side, towards the nearer edge.
        set(a, 'together')
        a.vx = ((a.x + b.x) / 2 - c.camX < c.W / 2 ? -1 : 1) * spec.speed * 1.5
      }
      break
    case 'together':
      a.pose = 'stand'
      walk(a, c, 3)
      if (offscreen(a, c)) a.gone = true
      break
  }
}

const BEHAVIOURS: Record<Kind, Behaviour> = {
  marmot(a, c, d) {
    const winter = c.season === 'winter'
    switch (a.state) {
      case 'idle':
      case 'hidden':
        a.visible = false
        a.sprite = null
        a.h = 0
        a.x = a.anchor
        if (winter) {
          if (a.t > 3 && c.rng.chance(c.dt * 0.25)) say(a, c, 'ZZZ')
          return
        }
        if (a.t > a.wait && d > 45) set(a, 'peek')
        break
      case 'peek':
        a.visible = true
        a.sprite = MARMOT.peek
        a.h = -1
        if (d < 30 && c.pointer.speed > 30) {
          set(a, 'hidden')
          a.wait = 2 + c.rng.next() * 4
        } else if (a.t > 1.4) set(a, c.rng.chance(0.5) ? 'graze' : 'alert')
        break
      case 'graze':
        a.visible = true
        a.sprite = MARMOT.graze
        a.h = Math.abs(a.vs) > 2 ? Math.abs(Math.sin(c.time * 14)) * 1.2 : 0
        if (a.t > a.wait) {
          a.vx = c.rng.chance(0.5) ? 0 : (c.rng.chance(0.5) ? -1 : 1) * 7
          a.wait = a.t + 1 + c.rng.next() * 2
        }
        if (Math.abs(a.x + a.vx * c.dt - a.anchor) >= 16) a.vx = 0
        walk(a, c)
        if (d < 50) {
          set(a, 'alert')
          if (a.cooldown <= 0) {
            say(a, c, 'FWEEET!', 'whistle')
            a.cooldown = 5
          }
        } else if (a.t > 7 && c.rng.chance(c.dt * 0.3)) set(a, 'alert')
        break
      case 'alert':
        a.visible = true
        a.sprite = MARMOT.stand
        a.h = 0
        if (c.pointer.active && d < 70) faceToward(a, c.pointer.wx)
        if (d < 22 && c.pointer.speed > 45) {
          if (a.cooldown <= 2) say(a, c, 'FWEEET!', 'whistle')
          set(a, 'dive')
        } else if (a.t > 4 && d > 60) set(a, 'graze')
        break
      case 'dive':
        a.sprite = MARMOT.graze
        a.vx = Math.sign(a.anchor - a.x) * 50
        walk(a, c, 14)
        a.h = Math.abs(Math.sin(c.time * 18)) * 1.5
        if (Math.abs(a.x - a.anchor) < 2) {
          set(a, 'hidden')
          a.wait = 3 + c.rng.next() * 5
        }
        break
    }
  },

  cow(a, c, d) {
    if (d < 30) {
      a.pose = 'stand'
      a.vx = 0
      walk(a, c)
      faceToward(a, c.pointer.wx)
      if (a.cooldown <= 0) {
        say(a, c, 'MUUU', 'cowbell')
        a.cooldown = 4
      }
      return
    }
    graze(a, c, 40, 4)
  },

  sheep(a, c, d) {
    if (d < 26) {
      a.pose = 'stand'
      faceToward(a, c.pointer.wx)
      if (a.cooldown <= 0) {
        say(a, c, 'BAAA', 'baa')
        a.cooldown = 4
      }
      if (c.pointer.speed > 120) a.vx = (c.pointer.wx > a.x ? -1 : 1) * 18
      walk(a, c)
      return
    }
    graze(a, c, 26, 5)
  },

  fox(a, c, d) {
    const p = c.pointer
    switch (a.state) {
      case 'idle':
        set(a, 'enter')
        a.targetX = c.world.dryLand(c.camX + c.W * (0.25 + c.rng.next() * 0.5))
        break
      case 'enter':
        a.vx = Math.sign(a.targetX - a.x) * 26
        walk(a, c)
        if (Math.abs(a.x - a.targetX) < 3) {
          a.vx = 0
          set(a, 'watch')
        }
        break
      case 'watch':
        a.vx = 0
        walk(a, c)
        if (p.active && Math.abs(p.wx - a.x) < 70) faceToward(a, p.wx)
        if (p.active && Math.abs(p.wx - a.x) < 55 && Math.abs(p.wx - a.x) > 6 && p.h < 28 && p.h > -8 && p.still > 0.6) {
          set(a, 'crouch')
          say(a, c, '!')
        } else if (d < 14 && p.speed > 90) {
          set(a, 'leave')
          leaveToward(a, c, 60)
        } else if (a.t > 10) {
          set(a, 'leave')
          leaveToward(a, c, 28)
        }
        break
      case 'crouch':
        a.h = 0
        if (a.t > 0.35) {
          set(a, 'pounce')
          a.vh = 95
          a.vx = clamp((c.world.dryLand(p.wx) - a.x) / 0.72, -90, 90)
          a.vs = a.vx
          c.sfx('jump')
        }
        break
      case 'pounce':
        a.x += a.vx * c.dt
        a.dir = a.vx >= 0 ? 1 : -1
        if (airborne(a, c)) {
          set(a, 'watch')
          a.vx = 0
          a.vs = 0
          if (p.active && Math.abs(p.wx - a.x) < 10) say(a, c, 'GOT IT?')
        }
        break
      case 'leave':
        walk(a, c)
        if (offscreen(a, c)) a.gone = true
        break
    }
  },

  squirrel(a, c, d) {
    const trees = ['beech', 'spruce', 'spruceSmall', 'orchard']
    switch (a.state) {
      case 'idle':
      case 'forage':
        a.sprite = Math.abs(a.vs) > 4 ? SQUIRREL.run : SQUIRREL.sit
        if (a.t > a.wait) {
          a.vx = a.vx ? 0 : (c.rng.chance(0.5) ? -1 : 1) * 30
          a.wait = a.t + (a.vx ? 0.3 + c.rng.next() * 0.5 : 0.6 + c.rng.next() * 1.6)
        }
        walk(a, c, 12)
        a.h = Math.abs(a.vs) > 4 ? Math.abs(Math.sin(c.time * 18)) * 2.5 : 0
        if (d < 36 || a.t > a.life) {
          set(a, 'flee')
          a.targetX = nearestTree(c.world, a.x, trees) ?? a.x + 60
          if (d < 36) say(a, c, '!', 'chirp')
        }
        break
      case 'flee':
        a.sprite = SQUIRREL.run
        a.vx = Math.sign(a.targetX - a.x) * 75
        walk(a, c, 14)
        a.h = Math.abs(Math.sin(c.time * 22)) * 3
        if (Math.abs(a.x - a.targetX) < 3) set(a, 'climb')
        break
      case 'climb':
        a.sprite = SQUIRREL.sit
        a.h += 30 * c.dt
        if (a.h > 16) a.alpha = Math.max(0, a.alpha - c.dt * 3)
        if (a.alpha <= 0) a.gone = true
        break
    }
  },

  deer(a, c, d) {
    const p = c.pointer
    switch (a.state) {
      case 'idle':
      case 'graze':
        graze(a, c, 18, 6)
        if (d < 64) {
          set(a, 'alert')
          a.pose = 'stand'
          a.vx = 0
          if (p.active) faceToward(a, p.wx)
        } else if (a.t > a.life) {
          set(a, 'flee')
          leaveToward(a, c, 40)
        }
        break
      case 'alert':
        a.pose = 'stand'
        walk(a, c)
        if (d < 34 || (d < 54 && p.speed > 60)) {
          set(a, 'flee')
          a.vx = (p.wx > a.x ? -1 : 1) * 72
          say(a, c, 'WOOF!', 'bark')
        } else if (a.t > 3 && d > 70) set(a, 'graze')
        break
      case 'flee':
        a.pose = 'stand'
        walk(a, c, 5)
        if (airborne(a, c) && Math.abs(a.vs) > 30) a.vh = 50
        if (offscreen(a, c)) a.gone = true
        break
    }
  },

  owl(a, c, d) {
    const p = c.pointer
    // Fades into view on its branch as night falls, and away again by day.
    if (c.daylight > 0.45) fadeOut(a, c, 1)
    else fadeIn(a, c, 0.8)
    a.h = a.anchorH
    const dx = p.active ? p.sx - (a.x - c.camX) : 0
    const blink = (c.time + a.phase) % 4 < 0.15
    a.sprite = blink ? OWL.blink : dx < -8 ? OWL.left : dx > 8 ? OWL.right : OWL.center
    if (d < 22 && a.cooldown <= 0) {
      say(a, c, 'HOO-HOO', 'hoot')
      a.cooldown = 5
    }
  },

  butterfly(a, c, d) {
    const p = c.pointer
    const f = Math.floor(c.time * 12 + a.phase) % 4
    a.sprite = f === 0 ? BUTTERFLY.open : f === 2 ? BUTTERFLY.closed : BUTTERFLY_HALF
    let tx = a.anchor + Math.sin(c.time * 0.7 + a.phase) * 30
    let th = a.anchorH + Math.sin(c.time * 1.3 + a.phase * 2) * 10 + Math.sin(c.time * 5.3 + a.phase) * 3
    if (p.active && d < 70 && p.speed < 50) {
      tx = p.wx + Math.cos(c.time * 3 + a.phase) * 6
      th = p.h + Math.sin(c.time * 4 + a.phase) * 4
    }
    if (p.active && d < 40 && p.speed > 140) a.state = 'scatter'
    if (a.state === 'scatter' || a.t > a.life) {
      // Up and away, fading as it goes.
      th = a.h + 30
      tx = a.x + (a.dir || 1) * 40
      if (offscreen(a, c)) a.gone = true
      else fadeOut(a, c, 0.6)
    } else fadeIn(a, c, 1.5)
    a.vx += (tx - a.x) * c.dt * 1.6 - a.vx * c.dt * 0.8
    a.vh += (th - a.h) * c.dt * 1.6 - a.vh * c.dt * 0.8
    a.x += a.vx * c.dt
    a.h = Math.max(3, a.h + a.vh * c.dt)
    a.dir = a.vx >= 0 ? 1 : -1
  },

  eagle(a, c) {
    const p = c.pointer
    switch (a.state) {
      case 'idle':
        // In from the side of the view, gliding over to a spot to circle above.
        a.cx = c.camX + c.W * (0.3 + c.rng.next() * 0.4)
        a.ch = a.anchorH
        set(a, 'arrive')
        break
      case 'arrive': {
        const way = a.cx >= a.x ? 1 : -1
        const dx = Math.abs(a.cx - a.x)
        // Slowing to circling speed as it gets there, at the height where the circle runs its way.
        a.x += way * Math.min(dx, (SOAR_SPEED + Math.min(30, dx * 0.4)) * c.dt)
        a.h += (a.ch - way * SOAR_R * 0.3 - a.h) * Math.min(1, c.dt * 1.5)
        a.flap = 0.15 + Math.sin(c.time * 2 + a.phase) * 0.08
        if (Math.abs(a.cx - a.x) < 0.5) {
          // Join the circle at the point where it's heading the same way, so there's no jump.
          a.phase = (way > 0 ? 1.5 : 0.5) * Math.PI - c.time * SOAR_TURN
          set(a, 'soar')
        }
        break
      }
      case 'soar': {
        if (p.active && p.h > 45 && p.still > 1.2) {
          a.cx += (p.wx - a.cx) * c.dt * 0.6
          a.ch += (p.h - a.ch) * c.dt * 0.6
          if (p.still > 4 && a.cooldown <= 0) {
            set(a, 'stoop')
            say(a, c, 'KYAAA', 'screech')
            a.cooldown = 8
          }
        } else {
          a.cx += Math.sin(c.time * 0.1 + a.phase) * c.dt * 6
        }
        const ang = c.time * SOAR_TURN + a.phase
        a.x = a.cx + Math.cos(ang) * SOAR_R
        a.h = a.ch + Math.sin(ang) * SOAR_R * 0.3
        // Mostly gliding with a slight wobble; a few slow beats now and then.
        const beating = Math.sin(c.time * 0.7 + a.phase) > 0.85
        a.flap = beating ? Math.sin(c.time * 9) : 0.15 + Math.sin(c.time * 2 + a.phase) * 0.08
        if (a.t > a.life) set(a, 'leave')
        break
      }
      case 'stoop':
        a.flap = -0.6
        a.x += (p.wx - a.x) * c.dt * 4
        a.h += (p.h - a.h) * c.dt * 4
        if (a.t > 0.9) set(a, 'climbout')
        break
      case 'climbout':
        a.flap = Math.sin(c.time * 10)
        a.h += 50 * c.dt
        if (a.h > a.ch) {
          set(a, 'soar')
          a.cx = a.x
        }
        break
      case 'leave':
        a.flap = Math.sin(c.time * 8)
        a.x += a.dir * 50 * c.dt
        a.h += 25 * c.dt
        if (offscreen(a, c, 60)) a.gone = true
        break
    }
  },

  gull(a, c, d) {
    const p = c.pointer
    switch (a.state) {
      case 'idle':
        set(a, 'glide')
        // Across the view from whichever side it came in.
        a.vx = (a.x - c.camX < c.W / 2 ? 1 : -1) * (18 + c.rng.next() * 12)
        break
      case 'glide': {
        a.x += a.vx * c.dt
        a.dir = a.vx > 0 ? 1 : -1
        a.h = a.anchorH + Math.sin(c.time * 0.9 + a.phase) * 8
        const bursts = Math.sin(c.time * 1.3 + a.phase * 3) > 0.6
        a.flap = bursts ? Math.sin(c.time * 12) : 0.25 + Math.sin(c.time * 3 + a.phase) * 0.1
        // Gulls know a picnic when they see one: a still cursor near the sand gets inspected.
        if (p.active && p.h < 40 && p.still > 1.5 && Math.abs(p.wx - a.x) < 120 && a.cooldown <= 0) {
          set(a, 'swoop')
          say(a, c, 'MINE!', 'gull')
          a.cooldown = 7
        }
        if (offscreen(a, c, 80)) a.gone = true
        // One the view has kept pace with for a long while fades away rather than vanishing.
        else if (a.t > a.life) fadeOut(a, c, 0.5)
        break
      }
      case 'swoop':
        a.flap = -0.4
        a.x += (p.wx - a.x) * c.dt * 3
        a.h += (p.h + 4 - a.h) * c.dt * 3
        a.dir = p.wx > a.x ? 1 : -1
        if (a.t > 1 || d < 6) set(a, 'climbout')
        break
      case 'climbout':
        a.flap = Math.sin(c.time * 12)
        a.h += 45 * c.dt
        a.x += a.dir * 20 * c.dt
        if (a.h > a.anchorH) set(a, 'glide')
        break
    }
  },

  dolphin(a, c) {
    switch (a.state) {
      case 'idle':
      case 'swim':
        a.visible = false
        a.h = -4
        a.x += a.dir * 30 * c.dt
        if (a.t > a.wait) {
          if (a.count >= 3 || a.x > Z.shore * WORLD_LEN - 30 || a.x < 20) {
            a.gone = true
            return
          }
          set(a, 'jump')
          a.visible = true
          a.h = 0
          a.vh = 78 + c.rng.next() * 18
          a.vx = a.dir * 38
          a.count++
          c.sfx('splash')
        }
        break
      case 'jump':
        a.x += a.vx * c.dt
        a.angle = Math.atan2(-a.vh, Math.abs(a.vx))
        if (airborne(a, c)) {
          set(a, 'swim')
          a.wait = 0.6 + c.rng.next() * 1.4
        }
        break
    }
  },

  flamingo(a, c, d) {
    const p = c.pointer
    if (a.state === 'run') {
      // Pattering across the water to get airborne.
      a.flap = Math.sin(c.time * 18 + a.phase)
      a.x += a.dir * 30 * c.dt
      if (a.t > 0.55 || !canWade(a, c.world, a.x)) {
        set(a, 'fly')
        a.vh = 16
      }
      return
    }
    if (a.state === 'fly') {
      a.flap = Math.sin(c.time * 8 + a.phase)
      a.x += a.dir * 44 * c.dt
      a.vh = Math.min(30, a.vh + 12 * c.dt)
      a.h += a.vh * c.dt
      if (offscreen(a, c, 60)) a.gone = true
      // Climbing away, it fades into the distance rather than vanishing in mid-air.
      else if (a.h > 110) fadeOut(a, c, 0.8)
      return
    }
    // Startled: most wade off a few steps, some take to the air.
    if (d < 30 && p.speed > 90 && a.state !== 'wade') {
      say(a, c, 'HONK', 'honk')
      if (c.rng.chance(0.4)) return takeOff(a, c, p.wx > a.x ? -1 : 1)
      set(a, 'wade')
      a.vx = (p.wx > a.x ? -1 : 1) * 14
    }
    // Now and then one simply leaves.
    if (a.state === 'idle' && a.t > 6 && c.rng.chance(c.dt * 0.005)) return takeOff(a, c, c.rng.chance(0.5) ? 1 : -1)
    if (a.state === 'wade') {
      a.pose = 'stand'
      walk(a, c, 4)
      stayInLagoon(a, c)
      if (a.t > 2.2 || Math.abs(a.x - a.anchor) > 40) {
        a.vx = 0
        set(a, 'idle')
      }
      return
    }
    if (a.t > a.wait) {
      a.wait = a.t + 2 + c.rng.next() * 4
      a.pose = c.rng.chance(0.55) ? 'graze' : 'stand'
      a.vx = c.rng.chance(0.3) ? (c.rng.chance(0.5) ? -1 : 1) * 5 : 0
    }
    if (Math.abs(a.x + a.vx * c.dt - a.anchor) > 24) a.vx = 0
    walk(a, c, 3)
    stayInLagoon(a, c)
  },

  chamois(a, c, d) {
    const p = c.pointer
    switch (a.state) {
      case 'idle':
      case 'graze':
        graze(a, c, 14, 5)
        if (d < 46) {
          set(a, 'flee')
          a.vx = 82
        } else if (a.t > a.life) {
          set(a, 'flee')
          a.vx = 60
        }
        break
      case 'flee':
        a.pose = 'stand'
        if (p.active && p.wx > a.x && Math.abs(p.wx - a.x) < 30) a.vx = -82
        walk(a, c, 6)
        if (airborne(a, c)) a.vh = 45
        if (offscreen(a, c)) a.gone = true
        break
    }
  },

  ibex(a, c, d) {
    const p = c.pointer
    switch (a.state) {
      case 'idle':
        a.pose = 'stand'
        a.h = a.anchorH
        if (p.active && d < 80) faceToward(a, p.wx)
        if (d < 30 && a.cooldown <= 0) {
          say(a, c, c.rng.pick(['...', 'BEH.', 'CIAO']))
          a.cooldown = 6
        }
        if (d < 14 && p.speed > 160) {
          set(a, 'hop')
          a.vh = 80
          a.vx = (c.rng.chance(0.5) ? 1 : -1) * 35
          c.sfx('jump')
        }
        if (a.t > a.life && d > 60 && c.rng.chance(c.dt * 0.05)) {
          set(a, 'hop')
          a.vh = 70
          a.vx = 40
        }
        break
      case 'hop':
        a.x += a.vx * c.dt
        a.vs = a.vx
        a.dir = a.vx >= 0 ? 1 : -1
        if (airborne(a, c)) {
          a.anchorH = 0
          a.vs = 0
          set(a, 'idle')
          if (offscreen(a, c, 10)) a.gone = true
        }
        break
    }
  },

  ptarmigan(a, c, d) {
    const p = c.pointer
    a.sprite = c.season === 'winter' || c.world.permanentSnow(a.x) > 0.5 ? PTARMIGAN.winter : PTARMIGAN.summer
    const target = d < 46 ? 1 : 0.22
    // Camouflaged until you come close (it fades up from nothing when it first turns up).
    if (a.state !== 'flush') a.alpha += (target - a.alpha) * Math.min(1, c.dt * 4)
    switch (a.state) {
      case 'idle':
        if (a.t > a.wait) {
          a.vx = a.vx ? 0 : (c.rng.chance(0.5) ? -1 : 1) * 5
          a.wait = a.t + 1 + c.rng.next() * 3
        }
        walk(a, c)
        if (d < 18) {
          set(a, 'flush')
          a.vx = (p.wx > a.x ? -1 : 1) * 70
          a.vh = 60
          say(a, c, 'BRRR', 'flutter')
        }
        break
      case 'flush':
        a.x += a.vx * c.dt
        a.h += a.vh * c.dt
        a.vh *= 0.98
        if (offscreen(a, c)) a.gone = true
        else if (a.h > 90) fadeOut(a, c, 1)
        break
    }
  },

  hare(a, c, d) {
    const p = c.pointer
    a.sprite = c.season === 'winter' || c.world.permanentSnow(a.x) > 0.5 ? HARE.winter : HARE.summer
    switch (a.state) {
      case 'idle':
        if (d < 40) {
          set(a, 'flee')
          a.vx = (p.wx > a.x ? -1 : 1) * 70
        } else if (a.t > a.life) {
          set(a, 'flee')
          leaveToward(a, c, 50)
        }
        break
      case 'flee':
        a.x += a.vx * c.dt
        a.dir = a.vx > 0 ? 1 : -1
        if (airborne(a, c)) a.vh = 50
        if (offscreen(a, c)) a.gone = true
        break
    }
  },

  chough(a, c) {
    const p = c.pointer
    const crumb = c.crumbs.find((cr) => Math.abs(cr.x - a.x) < 120)
    switch (a.state) {
      case 'idle':
      case 'hop': {
        let tx = a.anchor
        if (crumb) tx = crumb.x + ((a.uid % 5) - 2) * 3
        else if (p.active && p.h < 40 && Math.abs(p.wx - a.x) < 100) tx = p.wx + ((a.uid % 5) - 2) * 5
        const dx = tx - a.x
        if (Math.abs(dx) > 3 && a.h === 0 && a.t > a.wait) {
          a.vh = 40
          a.vx = clamp(dx * 2, -40, 40)
          a.wait = a.t + 0.25 + c.rng.next() * 0.4
        }
        if (a.h > 0 || a.vh > 0) {
          a.x += a.vx * c.dt
          if (a.vx) a.dir = a.vx > 0 ? 1 : -1
          if (airborne(a, c)) a.vx = 0
        }
        a.sprite = a.h > 0 ? CHOUGH.hop : CHOUGH.stand
        if (crumb && Math.abs(crumb.x - a.x) < 4 && a.cooldown <= 0) {
          say(a, c, 'KRRI!', 'chirp')
          a.cooldown = 2.5
        }
        if (!crumb && c.rng.chance(c.dt * 0.04)) {
          set(a, 'fly')
          a.targetX = a.anchor + (c.rng.next() - 0.5) * 120
          a.vh = 60
        }
        break
      }
      case 'arrive': {
        // Swooping in from off screen to land near the path, as choughs do around walkers: losing
        // height quickly at first, then flaring to touch down on the spot.
        a.sprite = CHOUGH.fly
        a.flap = Math.sin(c.time * 16 + a.phase)
        a.dir = a.targetX >= a.x ? 1 : -1
        a.x += a.dir * Math.min(Math.abs(a.targetX - a.x), 55 * c.dt)
        const togo = Math.min(1, Math.abs(a.targetX - a.x) / Math.max(1, a.ch))
        a.h = a.anchorH * togo * togo
        if (Math.abs(a.targetX - a.x) < 0.5) {
          a.h = 0
          a.anchor = a.x
          set(a, 'hop')
        }
        break
      }
      case 'fly':
        a.sprite = CHOUGH.fly
        a.flap = Math.sin(c.time * 16)
        a.vx = clamp((a.targetX - a.x) * 1.5, -60, 60)
        a.x += a.vx * c.dt
        a.dir = a.vx >= 0 ? 1 : -1
        a.vh -= 60 * c.dt
        a.h = Math.max(0, a.h + a.vh * c.dt)
        if (a.t > 0.6 && a.h <= 0) {
          a.anchor = a.x
          set(a, 'hop')
        }
        break
    }
  },

  yeti(a, c, d) {
    switch (a.state) {
      case 'idle':
        set(a, 'enter')
        break
      case 'enter':
        a.sprite = YETI.stand
        a.vx = Math.sign(c.climberX + 26 - a.x) * 22
        walk(a, c)
        a.h = Math.abs(Math.sin(c.time * 6)) * 1.5
        if (Math.abs(a.x - (c.climberX + 26)) < 4 || d < 20) {
          set(a, 'roar')
          say(a, c, 'RAWRR!', 'roar')
        }
        break
      case 'roar':
        a.sprite = YETI.roar
        a.h = 0
        a.dir = c.climberX < a.x ? -1 : 1
        if (a.t > 1.6) {
          set(a, 'friendly')
          say(a, c, 'JUST KIDDING')
        }
        break
      case 'friendly':
        a.sprite = YETI.stand
        if (a.t > 3) {
          set(a, 'leave')
          a.vx = 30
        }
        break
      case 'leave':
        a.sprite = YETI.stand
        walk(a, c)
        a.h = Math.abs(Math.sin(c.time * 6)) * 1.5
        if (offscreen(a, c)) a.gone = true
        break
    }
  },
}

/** Whether the ground at world x is on screen (not hidden below a drop or off the top). */
const groundInView = (c: AnimalCtx, x: number) => {
  const y = c.groundY(x)
  return y > c.H * 0.25 && y < c.H - 12 && !c.world.isWater(x)
}

/** Somewhere in view, with the ground on screen, for a flock to land: by the walker if nowhere else. */
function landingSpot(c: AnimalCtx) {
  for (let tries = 0; tries < 8; tries++) {
    const x = c.camX + c.W * (0.2 + c.rng.next() * 0.6)
    if (groundInView(c, x - 16) && groundInView(c, x + 16)) return x
  }
  for (let dx = 20; dx < c.W / 2; dx += 10) {
    for (const x of [c.climberX - dx, c.climberX + dx]) if (groundInView(c, x - 16) && groundInView(c, x + 16)) return x
  }
  return c.climberX
}

function nearestTree(world: World, x: number, kinds: string[]) {
  let best: number | null = null
  for (const p of world.props) {
    if (!kinds.includes(p.kind) || Math.abs(p.x - x) > 90) continue
    if (best === null || Math.abs(p.x - x) < Math.abs(best - x)) best = p.x
  }
  return best
}

/* -------------------------------------------------------------------------- */
/* Spawning                                                                   */
/* -------------------------------------------------------------------------- */

type Rule = {
  kind: Kind
  biomes: Biome[]
  max: number
  rate: number
  seasons?: Season[]
  time?: 'day' | 'night'
  nightBoost?: number
  group?: [number, number]
  enterFromEdge?: boolean
  flyer?: [number, number]
}

const RULES: Rule[] = [
  { kind: 'gull', biomes: ['sea', 'beach', 'country'], time: 'day', max: 3, rate: 0.12, flyer: [55, 95], enterFromEdge: true },
  { kind: 'dolphin', biomes: ['sea'], max: 1, rate: 0.12 },
  {
    kind: 'butterfly',
    biomes: ['beach', 'country', 'valley'],
    seasons: ['spring', 'summer'],
    time: 'day',
    max: 4,
    rate: 0.09,
    group: [2, 3],
    flyer: [8, 30],
  },
  { kind: 'fox', biomes: ['country', 'valley', 'forest', 'pasture'], max: 1, rate: 0.045, nightBoost: 2.5, enterFromEdge: true },
  { kind: 'squirrel', biomes: ['forest', 'valley'], max: 2, rate: 0.1, time: 'day' },
  { kind: 'deer', biomes: ['forest', 'valley', 'pasture', 'lake'], max: 2, rate: 0.045, nightBoost: 2.5 },
  {
    kind: 'eagle',
    biomes: ['pasture', 'crag', 'lake', 'larch', 'moraine', 'glacier'],
    time: 'day',
    max: 1,
    rate: 0.035,
    flyer: [80, 110],
    enterFromEdge: true,
  },
  { kind: 'chamois', biomes: ['crag', 'larch', 'moraine'], max: 3, rate: 0.05, group: [1, 3] },
  { kind: 'ibex', biomes: ['crag', 'moraine', 'glacier', 'summit'], max: 2, rate: 0.06 },
  { kind: 'ptarmigan', biomes: ['moraine', 'glacier'], max: 2, rate: 0.05 },
  { kind: 'hare', biomes: ['forest', 'pasture', 'larch', 'moraine', 'glacier'], max: 1, rate: 0.03, nightBoost: 2 },
  { kind: 'chough', biomes: ['crag', 'glacier', 'summit'], max: 6, rate: 0.12, group: [3, 5], enterFromEdge: true },
  { kind: 'owl', biomes: ['forest'], time: 'night', max: 1, rate: 0.12 },
]

const INTRO: Partial<Record<Biome, Kind[]>> = {
  sea: ['dolphin', 'gull'],
  beach: ['gull'],
  country: ['butterfly', 'fox'],
  valley: ['butterfly', 'fox'],
  forest: ['squirrel', 'owl', 'deer'],
  pasture: ['eagle'],
  crag: ['ibex', 'chough'],
  lake: ['deer'],
  larch: ['chamois'],
  moraine: ['ibex'],
  glacier: ['ptarmigan'],
  summit: ['chough'],
}


/** Animals that live in fixed places (burrows, herds, the lagoon) rather than wandering in. */
const RESIDENTS: { kind: Kind; spots: number[]; when: (c: AnimalCtx) => boolean; depths?: number[] }[] = [
  { kind: 'cow', spots: [0.342, 0.372, 0.392, 0.448, 0.466], when: (c) => c.season !== 'winter' && c.daylight > 0.25 },
  { kind: 'sheep', spots: [0.114, 0.12, 0.127, 0.141, 0.147], when: (c) => c.season !== 'winter' },
  // Flamingos stand at different distances out in the lagoon (pixels above the path line).
  { kind: 'flamingo', spots: [0.092, 0.097, 0.104], depths: [4, 7, 3], when: () => true },
]

export class Wildlife {
  animals: Animal[] = []
  crumbs: Crumb[] = []
  hearts: Heart[] = []
  private courtNext = 0
  /** This journey's guaranteed courtship (see JOURNEY). */
  private journey = { due: -1, done: false, atStart: false, lastX: Number.NaN, dir: 1 as 1 | -1, still: 0, seen: 0, retry: 0 }
  private uid = 1
  private biome: Biome | null = null
  private introAt = 0
  private residents = new Map<string, Animal>()
  private marmots = new Map<number, Animal>()

  clear() {
    this.animals = []
    this.residents.clear()
    this.marmots.clear()
    this.crumbs = []
    this.hearts = []
  }

  /** Very occasionally, a calm animal in view is joined by another of its kind (see COURTING). */
  private startCourtship(c: AnimalCtx) {
    if (c.time < this.courtNext) return
    for (const a of this.animals) {
      if (!COURTING[a.kind] || a.mate || a.gone || !a.visible || !calm(a) || offscreen(a, c, -12)) continue
      if (pointerDist(a, c) < 60 || !c.rng.chance(COURTSHIP.rate * c.dt)) continue
      const near = this.animals.find((b) => b !== a && b.kind === a.kind && !b.mate && calm(b) && Math.abs(b.x - a.x) < 90)
      const partner = near ?? this.newcomer(a, c)
      if (!partner) continue
      a.host = !near
      a.mate = partner.uid
      partner.mate = a.uid
      set(a, 'court')
      set(partner, 'court')
      this.courtNext = c.time + COURTSHIP.cooldown
      return
    }
  }

  /** Whether this journey's courtship has been seen yet. */
  get courtedThisJourney() {
    return this.journey.done
  }

  private trackJourney(c: AnimalCtx) {
    const j = this.journey
    const f = c.climberX / WORLD_LEN
    const atStart = f < JOURNEY.start
    if (j.due < 0 || (atStart && !j.atStart)) {
      j.due = c.rng.range(JOURNEY.due[0], JOURNEY.due[1])
      j.done = false
    }
    j.atStart = atStart
    const moved = Number.isNaN(j.lastX) ? 0 : c.climberX - j.lastX
    j.lastX = c.climberX
    if (Math.abs(moved) > 0.05) j.dir = moved > 0 ? 1 : -1
    j.still = c.dt > 0 && Math.abs(moved) / c.dt < 6 ? j.still + c.dt : 0

    // Seen: a pair nose to nose, both on screen, for a couple of seconds.
    const onScreen = (a: Animal) => a.x > c.camX + 4 && a.x < c.camX + c.W - 4
    const nuzzling = this.animals.some((a) => {
      if (!a.mate || a.state !== 'nuzzle' || !onScreen(a)) return false
      const b = this.animals.find((o) => o.uid === a.mate)
      return b !== undefined && b.state === 'nuzzle' && onScreen(b)
    })
    j.seen = nuzzling ? j.seen + c.dt : 0
    if (j.seen >= JOURNEY.seen) j.done = true

    if (j.done || f < j.due || j.still < JOURNEY.pause || c.time < j.retry) return
    if (this.animals.some((a) => a.mate)) return
    j.retry = c.time + (this.stageCourtship(c, j.dir) ? JOURNEY.retry : 2)
  }

  /**
   * Sets up a courtship where the visitor will see it: just ahead of the climber (in his head
   * torch's beam at night), within the part of the scene no content card covers — or else behind
   * him. Its partner turns up a little further on and comes over.
   */
  private stageCourtship(c: AnimalCtx, dir: 1 | -1) {
    const clear = c.camX + Math.min(c.W, c.clearW ?? c.W * 0.48)
    const spots: [number, 1 | -1][] = []
    if (c.daylight < 0.4) for (const d of [40, 48, 34, 56]) spots.push([c.climberX + dir * d, dir])
    for (let x = c.climberX + 30; x < clear - 18; x += 6) spots.push([x, 1])
    for (let x = c.climberX - 30; x > c.camX + 18; x -= 6) spots.push([x, -1])
    const p = c.pointer
    for (const [x, away] of spots) {
      const bx = x + away * 34
      if (x < c.camX + 14 || x > clear - 12 || Math.abs(x - c.climberX) < 26) continue
      if (bx < c.camX - 16 || bx > c.camX + c.W + 16) continue
      if (p.active && Math.abs(p.wx - x) < 60) continue
      // Somewhere with room for them: not right by a cow or anyone else on the ground.
      const lo = Math.min(x, bx) - 16
      const hi = Math.max(x, bx) + 16
      if (this.animals.some((o) => !o.gone && o.h < 12 && o.x > lo && o.x < hi)) continue
      const biome = c.world.biomeAt(x)
      const kinds = (Object.keys(COURTING) as Kind[]).filter((k) => {
        const rule = RULES.find((r) => r.kind === k)
        return rule !== undefined && rule.biomes.includes(biome) && this.allowed(rule, c) && habitable(k, x, c.world) && habitable(k, bx, c.world)
      })
      if (!kinds.length) continue
      const kind = c.rng.pick(kinds)
      const a = this.make(kind, x, c)
      a.state = 'graze'
      const b = this.make(kind, bx, c)
      b.dir = away > 0 ? -1 : 1
      b.alpha = 0
      a.host = true
      a.mate = b.uid
      b.mate = a.uid
      set(a, 'court')
      set(b, 'court')
      this.courtNext = c.time + COURTSHIP.cooldown
      return true
    }
    return false
  }

  /** Another of its kind, wandering in from just out of view on the nearer side (where it could live). */
  private newcomer(a: Animal, c: AnimalCtx) {
    const nearer = a.x - c.camX < c.W / 2 ? -1 : 1
    for (const side of [nearer, -nearer]) {
      const x = side < 0 ? c.camX - 14 : c.camX + c.W + 14
      if (x < 10 || x > WORLD_LEN - 10 || !habitable(a.kind, x, c.world)) continue
      const b = this.make(a.kind, x, c)
      b.dir = side > 0 ? -1 : 1
      return b
    }
    return null
  }

  private make(kind: Kind, x: number, c: AnimalCtx) {
    const a = new Animal(this.uid++, kind, x, c.rng.next())
    a.dir = c.rng.chance(0.5) ? 1 : -1
    a.wait = c.rng.next() * 2
    this.animals.push(a)
    return a
  }

  private allowed(rule: Rule, c: AnimalCtx) {
    if (rule.seasons && !rule.seasons.includes(c.season)) return false
    if (rule.time === 'day' && c.daylight < 0.4) return false
    if (rule.time === 'night' && c.daylight > 0.4) return false
    return true
  }

  private spawnRule(rule: Rule, c: AnimalCtx, existing = 0) {
    const count = Math.min(rule.max - existing, rule.group ? c.rng.int(rule.group[0], rule.group[1]) : 1)
    let x = -1
    for (let tries = 0; tries < 8 && x < 0; tries++) {
      const candidate = rule.enterFromEdge
        ? c.camX + (c.rng.chance(0.5) ? -16 : c.W + 16)
        : c.camX + 16 + c.rng.next() * (c.W - 32)
      if (candidate < 10 || candidate > WORLD_LEN - 10) continue
      if (!rule.biomes.includes(c.world.biomeAt(candidate))) continue
      if (!habitable(rule.kind, candidate, c.world)) continue
      if (Math.abs(candidate - c.climberX) < 14) continue
      x = candidate
    }
    if (x < 0) return
    // A group coming in from the side strings out behind the first, all of it out of sight at first.
    const out = x < c.camX ? -1 : 1
    const land = rule.kind === 'chough' ? landingSpot(c) : 0
    for (let i = 0; i < count; i++) {
      const ax = rule.enterFromEdge ? x + out * i * 9 : x + (i - count / 2) * 9
      if (!habitable(rule.kind, ax, c.world)) continue
      const a = this.make(rule.kind, ax, c)
      if (rule.flyer) {
        a.anchorH = c.rng.range(rule.flyer[0], rule.flyer[1])
        // Butterflies flutter up out of the grass; the others fly in at their height.
        a.h = rule.kind === 'butterfly' ? 2 : a.anchorH
      }
      // Whatever turns up in place, rather than coming in from the side, fades into view.
      if (rule.kind === 'butterfly' || rule.kind === 'ptarmigan' || rule.kind === 'owl') a.alpha = 0
      if (rule.kind === 'chough') {
        // The flock swoops in together to land somewhere in view (see the 'arrive' state).
        a.state = 'arrive'
        a.anchorH = c.rng.range(40, 70)
        a.h = a.anchorH
        const spot = land + (i - count / 2) * 8 + c.rng.range(-3, 3)
        a.targetX = groundInView(c, spot) ? spot : land
        a.ch = Math.abs(a.targetX - a.x)
      }
      if (rule.kind === 'owl') {
        const tree = nearestTree(c.world, x, ['spruce', 'beech'])
        if (tree === null) {
          a.gone = true
          continue
        }
        a.x = tree
        a.anchor = tree
        a.anchorH = 14
      }
      if (rule.kind === 'ibex') {
        const rock = c.world.props.find((p) => p.kind === 'boulder' && Math.abs(p.x - x) < 60)
        if (rock) {
          a.x = rock.x
          a.anchorH = 7
          a.h = 7
        }
      }
      if (rule.kind === 'dolphin') {
        a.state = 'swim'
        a.visible = false
        a.wait = 0.3
        a.dir = c.rng.chance(0.7) ? 1 : -1
      }
      if (rule.kind === 'butterfly') a.anchor = a.x
    }
  }

  update(c: AnimalCtx, enabled: boolean) {
    if (!enabled) {
      if (this.animals.length) this.clear()
      return
    }

    const viewL = c.camX - 140
    const viewR = c.camX + c.W + 140

    for (const bx of c.world.burrows) {
      const inView = bx > viewL && bx < viewR
      const existing = this.marmots.get(bx)
      if (inView && !existing) {
        const m = this.make('marmot', bx, c)
        m.fixed = true
        m.state = 'hidden'
        m.visible = false
        m.wait = 0.8 + c.rng.next() * 3
        this.marmots.set(bx, m)
      } else if (!inView && existing) {
        existing.gone = true
        this.marmots.delete(bx)
      }
    }
    for (const r of RESIDENTS) {
      for (const [i, f] of r.spots.entries()) {
        const x = f * WORLD_LEN
        const key = `${r.kind}:${f}`
        const inView = x > viewL && x < viewR && r.when(c)
        const existing = this.residents.get(key)
        if (inView && !existing) {
          const a = this.make(r.kind, x, c)
          a.fixed = true
          a.pose = c.rng.chance(0.5) ? 'graze' : 'stand'
          a.wait = c.rng.next() * 4
          if (r.depths) {
            a.anchorH = r.depths[i]
            a.h = a.anchorH
          }
          this.residents.set(key, a)
        } else if (!inView && existing) {
          existing.gone = true
          this.residents.delete(key)
        }
      }
    }

    // A guaranteed, early encounter whenever the trail enters a new zone.
    const biome = c.world.biomeAt(c.climberX)
    if (biome !== this.biome) {
      this.biome = biome
      this.introAt = c.time + 1.2
    }
    if (this.introAt && c.time > this.introAt) {
      this.introAt = 0
      const kinds = INTRO[biome] ?? []
      const rule = kinds.map((k) => RULES.find((r) => r.kind === k)!).find((r) => r && this.allowed(r, c))
      if (rule && !this.animals.some((a) => a.kind === rule.kind)) this.spawnRule(rule, c, 0)
    }

    for (const rule of RULES) {
      if (!this.allowed(rule, c)) continue
      const n = this.animals.filter((a) => a.kind === rule.kind).length
      if (n >= rule.max) continue
      const boost = rule.nightBoost && c.daylight < 0.4 ? rule.nightBoost : 1
      if (c.rng.chance(rule.rate * boost * c.dt)) this.spawnRule(rule, c, n)
    }

    for (const a of this.animals) {
      a.t += c.dt
      a.cooldown -= c.dt
      a.bubbleT -= c.dt
      a.lastX = a.x
      if (a.mate) court(a, this.animals.find((b) => b.uid === a.mate), c, pointerDist(a, c), this.hearts)
      else BEHAVIOURS[a.kind](a, c, pointerDist(a, c))
      keepAshore(a, c)
      keepAltitude(a, c)
      const moved = Math.abs(a.x - a.lastX)
      a.speed = c.dt > 0 ? moved / c.dt : 0
      a.gait += (moved / 6) * Math.PI * 2
      if (!a.fixed && (a.x < viewL - 200 || a.x > viewR + 200)) a.gone = true
    }
    this.animals = this.animals.filter((a) => !a.gone)
    this.crumbs = this.crumbs.filter((cr) => (cr.t -= c.dt) > 0)
    this.startCourtship(c)
    this.trackJourney(c)
    for (const h of this.hearts) {
      h.t += c.dt
      h.h += 7 * c.dt
    }
    this.hearts = this.hearts.filter((h) => h.t < 2.2)
  }

  /** The animal under a screen position (with a little padding), nearest first. */
  hit(c: Pick<AnimalCtx, 'camX' | 'groundY'>, sx: number, sy: number, pad = 4): Animal | null {
    let best: Animal | null = null
    let bestD = Infinity
    for (const a of this.animals) {
      if (!a.visible || a.alpha < 0.15) continue
      if (!QUADS[a.kind] && !a.sprite && !['eagle', 'gull', 'dolphin', 'flamingo'].includes(a.kind)) continue
      const b = box(a, c)
      if (sx < b.sx - pad || sx > b.sx + b.w + pad || sy < b.sy - pad || sy > b.sy + b.h + pad) continue
      const d = Math.hypot(sx - (b.sx + b.w / 2), sy - (b.sy + b.h / 2))
      if (d < bestD) {
        best = a
        bestD = d
      }
    }
    return best
  }

  /** React to being photographed. */
  snapped(a: Animal, c: AnimalCtx) {
    a.spotted = true
    if (a.kind === 'marmot' && a.state !== 'hidden') set(a, 'dive')
    if ((a.kind === 'deer' || a.kind === 'chamois' || a.kind === 'hare') && a.state !== 'flee') {
      set(a, 'flee')
      a.vx = (c.pointer.wx > a.x ? -1 : 1) * 70
    }
    if (a.kind === 'squirrel' && a.state !== 'climb') {
      set(a, 'flee')
      a.targetX = nearestTree(c.world, a.x, ['beech', 'spruce', 'spruceSmall', 'orchard']) ?? a.x + 60
    }
    if (a.kind === 'flamingo' && (a.state === 'idle' || a.state === 'wade') && c.rng.chance(0.5)) {
      takeOff(a, c, c.pointer.wx > a.x ? -1 : 1)
    }
  }

  dropCrumb(x: number) {
    this.crumbs.push({ x, t: 4 })
  }

  spawnYeti(c: AnimalCtx) {
    if (this.animals.some((a) => a.kind === 'yeti')) return
    const y = this.make('yeti', c.camX + c.W + 20, c)
    y.state = 'idle'
    y.dir = -1
  }
}
