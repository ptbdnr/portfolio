import { describe, expect, it } from 'vitest'
import {
  Animal,
  COURTSHIP,
  HARE_MIN_ALT,
  JOURNEY,
  MAX_MAMMAL_ALT,
  Wildlife,
  box,
  canWade,
  habitable,
  hareFloor,
  type AnimalCtx,
  type Kind,
} from './animals.ts'
import { rng, type Rng } from './math.ts'
import { BRIDGE_HALF, LAGOON, LAGOON_HALF, WORLD_LEN, World, Z, type Route } from './world.ts'

const world = new World(1983, 'rocks')

function ctx(camX: number, time: number, pointer?: Partial<AnimalCtx['pointer']>): AnimalCtx {
  return {
    dt: 1 / 30,
    time,
    pointer: { active: false, sx: -999, sy: -999, wx: 0, h: 0, speed: 0, still: 0, ...pointer },
    groundY: () => 100,
    camX,
    W: 240,
    H: 160,
    rng: rng(7),
    season: 'summer',
    daylight: 1,
    sfx: () => {},
    world,
    crumbs: [],
    climberX: camX + 2000,
  }
}

/** Runs the wildlife for a few seconds and records every position the animal visits. */
function run(a: Animal, seconds: number, pointer?: Partial<AnimalCtx['pointer']>) {
  const wild = new Wildlife()
  wild.animals.push(a)
  const visited: number[] = []
  for (let i = 0; i < seconds * 30; i++) {
    wild.update(ctx(a.x - 120, i / 30, pointer), true)
    if (a.gone) break
    visited.push(a.x)
  }
  return visited
}

const shore = Z.shore * WORLD_LEN
const lagoon = LAGOON * WORLD_LEN

describe('the walking surface', () => {
  it('crosses the stream on the bridge deck, never down at the water', () => {
    const s = world.streams[0]
    const deck = Math.max(world.altAt(s - BRIDGE_HALF + 1), world.altAt(s + BRIDGE_HALF - 1))
    for (let x = s - BRIDGE_HALF; x <= s + BRIDGE_HALF; x++) {
      expect(world.walkAltAt(x)).toBeGreaterThanOrEqual(deck)
    }
    // The stream bed really is lower than the deck.
    expect(world.altAt(s)).toBeLessThan(deck - 10)
  })

  it('is just the ground away from bridges', () => {
    for (const f of [0.1, 0.3, 0.5, 0.8]) expect(world.walkAltAt(f * WORLD_LEN)).toBe(world.altAt(f * WORLD_LEN))
  })
})

describe('water', () => {
  it('treats the sea and the lagoon as water, and the beach and fields as dry land', () => {
    expect(world.isWater(shore - 20)).toBe(true)
    expect(world.isWater(lagoon)).toBe(true)
    expect(world.isWater(shore + 40)).toBe(false)
    expect(world.isWater(lagoon + LAGOON_HALF + 20)).toBe(false)
    expect(world.isWater(world.dryLand(shore - 50))).toBe(false)
    expect(world.isWater(world.dryLand(lagoon - 5))).toBe(false)
    expect(world.isWater(world.dryLand(lagoon + 5))).toBe(false)
  })
})

describe('land animals', () => {
  const cases: [Kind, string, number, number][] = [
    ['fox', 'leave', shore + 15, -60],
    ['deer', 'flee', shore + 20, -72],
    ['hare', 'flee', lagoon + LAGOON_HALF + 12, -70],
    ['sheep', 'idle', lagoon - LAGOON_HALF - 10, 18],
    ['fox', 'leave', lagoon - LAGOON_HALF - 12, 60],
  ]
  it.each(cases)('a %s (%s) heading for the water turns back at the shore', (kind, state, x, vx) => {
    const a = new Animal(1, kind, x, 0.3)
    a.state = state
    a.vx = vx
    a.vs = vx
    a.dir = vx > 0 ? 1 : -1
    const visited = run(a, 6)
    expect(visited.length).toBeGreaterThan(10)
    expect(visited.filter((p) => world.isWater(p))).toEqual([])
  })

  it('a pouncing fox never lands in the sea, even when the pointer is over it', () => {
    const a = new Animal(1, 'fox', shore + 30, 0.3)
    a.state = 'watch'
    const visited = run(a, 6, { active: true, wx: shore - 20, h: 2, still: 2, speed: 0 })
    expect(visited.filter((p) => world.isWater(p))).toEqual([])
  })
})

describe('flamingos', () => {
  const flamingo = (x: number, depth: number) => {
    const a = new Animal(1, 'flamingo', x, 0.3)
    a.fixed = true
    a.anchor = x
    a.anchorH = depth
    a.h = depth
    return a
  }

  it('only ever wade where the lagoon is deep enough at their distance from the path', () => {
    for (const [x, depth] of [
      [lagoon - 38, 4],
      [lagoon - 6, 7],
      [lagoon + 38, 3],
    ] as const) {
      const a = flamingo(x, depth)
      expect(canWade(a, world, a.x)).toBe(true)
      const wild = new Wildlife()
      wild.animals.push(a)
      for (let i = 0; i < 30 * 20 && !a.gone; i++) {
        // Keep startling it with a fast pointer, from alternating sides.
        const side = Math.floor(i / 45) % 2 ? 12 : -12
        wild.update(ctx(a.x - 120, i / 30, { active: true, sx: 120 + side, sy: 90, wx: a.x + side, h: 6, speed: 200 }), true)
        if (a.state !== 'run' && a.state !== 'fly' && !a.gone) expect(canWade(a, world, a.x)).toBe(true)
      }
    }
  })

  it('sometimes take off and fly away', () => {
    let flew = 0
    for (let n = 0; n < 12; n++) {
      const a = flamingo(lagoon + (n % 3) * 10 - 10, 4)
      const wild = new Wildlife()
      wild.animals.push(a)
      let airborne = false
      for (let i = 0; i < 30 * 8 && !a.gone; i++) {
        const c = ctx(a.x - 120, i / 30 + n, { active: true, sx: 120, sy: 90, wx: a.x + 8, h: 6, speed: 220 })
        c.rng = rng(100 + n)
        wild.update(c, true)
        if (a.state === 'fly') airborne = true
      }
      if (airborne) {
        flew++
        expect(a.h).toBeGreaterThan(20)
      }
    }
    expect(flew).toBeGreaterThan(0)
    expect(flew).toBeLessThan(12)
  })
})

describe('altitude', () => {
  it('keeps mammals below the glacier heights, but lets birds fly up there', () => {
    let high = -1
    for (let x = 0; x <= WORLD_LEN; x += 4) {
      if (world.altAt(x) > MAX_MAMMAL_ALT + 50) {
        high = x
        break
      }
    }
    expect(high).toBeGreaterThan(0)
    for (const kind of ['ibex', 'chamois', 'hare', 'fox'] as Kind[]) expect(habitable(kind, high, world)).toBe(false)
    for (const kind of ['chough', 'eagle', 'ptarmigan'] as Kind[]) expect(habitable(kind, high, world)).toBe(true)
  })

  it('keeps mountain hares up high: never below 1,200–1,600 m', () => {
    for (let x = 0; x <= WORLD_LEN; x += 8) {
      const floor = hareFloor(x)
      expect(floor).toBeGreaterThanOrEqual(HARE_MIN_ALT[0])
      expect(floor).toBeLessThanOrEqual(HARE_MIN_ALT[1])
      if (world.altAt(x) < floor) expect(habitable('hare', x, world)).toBe(false)
    }
    expect(habitable('hare', 0.4 * WORLD_LEN, world)).toBe(true)
    // A startled hare bolting downhill turns back before it leaves its altitude.
    let edge = 0
    for (let x = 0.22 * WORLD_LEN; x < 0.4 * WORLD_LEN; x++) {
      if (world.altAt(x) >= hareFloor(x) + 15) {
        edge = x
        break
      }
    }
    const hare = new Animal(1, 'hare', edge, 0.5)
    hare.state = 'flee'
    hare.vx = -70
    for (const x of run(hare, 4)) expect(world.altAt(x)).toBeGreaterThanOrEqual(hareFloor(x) - 1)
  })

  it('never spawns a mountain hare in the low countryside or the valley woods', () => {
    const wild = new Wildlife()
    const r = rng(5)
    for (const f of [0.1, 0.15, 0.2, 0.24]) {
      const camX = f * WORLD_LEN - 120
      for (let i = 0; i < 30 * 90; i++) {
        const c = ctx(camX, i / 30)
        c.rng = r
        c.daylight = 0.2
        wild.update(c, true)
        for (const a of wild.animals) if (a.kind === 'hare') expect(world.altAt(a.x)).toBeGreaterThanOrEqual(HARE_MIN_ALT[0])
      }
    }
  })

  it('never spawns a mammal on the upper glacier or the summit ridge', () => {
    const wild = new Wildlife()
    const r = rng(3)
    for (const f of [0.9, 0.95, 0.985]) {
      const camX = f * WORLD_LEN - 120
      for (let i = 0; i < 30 * 120; i++) {
        const c = ctx(camX, i / 30)
        c.rng = r
        c.season = 'winter'
        wild.update(c, true)
        for (const a of wild.animals) {
          if (['ibex', 'chamois', 'hare', 'fox', 'deer'].includes(a.kind)) expect(world.altAt(a.x)).toBeLessThanOrEqual(MAX_MAMMAL_ALT)
        }
      }
    }
  })
})

/** The climber waits at the beach, before any journey's guaranteed courtship is due. */
const atBeach = (c: AnimalCtx) => ({ ...c, climberX: 0.03 * WORLD_LEN })

describe('courtship', () => {
  const x0 = 0.3 * WORLD_LEN
  const pair = () => {
    const a = new Animal(1, 'deer', x0, 0.5)
    const b = new Animal(2, 'deer', x0 + 40, 0.5)
    for (const d of [a, b]) {
      d.life = 1e9
      d.state = 'graze'
    }
    return [a, b]
  }
  const forced = (body: () => void) => {
    const rate = COURTSHIP.rate
    COURTSHIP.rate = 1e3
    try {
      body()
    } finally {
      COURTSHIP.rate = rate
    }
  }

  it('two deer meet, stand nose to nose while hearts float up, then wander off together', () =>
    forced(() => {
      const wild = new Wildlife()
      const [a, b] = pair()
      wild.animals.push(a, b)
      let met = false
      let together = false
      let hearts = 0
      for (let i = 0; i < 30 * 30; i++) {
        wild.update(atBeach(ctx(x0 - 100, i / 30)), true)
        if (a.state === 'nuzzle' && b.state === 'nuzzle') {
          met = true
          expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(22)
          expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(10)
          expect(a.dir).toBe(-b.dir)
        }
        if (a.state === 'together' && b.state === 'together') {
          together = true
          expect(Math.sign(a.vx)).toBe(Math.sign(b.vx))
        }
        hearts = Math.max(hearts, wild.hearts.length)
      }
      expect(met).toBe(true)
      expect(together).toBe(true)
      expect(hearts).toBeGreaterThan(0)
    }))

  it('is shy: a pointer coming close sends both running', () =>
    forced(() => {
      const wild = new Wildlife()
      const [a, b] = pair()
      wild.animals.push(a, b)
      for (let i = 0; i < 30 && !a.mate; i++) wild.update(atBeach(ctx(x0 - 100, i / 30)), true)
      expect(a.mate).toBe(b.uid)
      const near = { active: true, sx: a.x - (x0 - 100), sy: 92, wx: a.x, h: 4, speed: 0, still: 1 }
      wild.update(atBeach(ctx(x0 - 100, 2, near)), true)
      expect([a.state, b.state]).toEqual(['flee', 'flee'])
      expect(a.mate + b.mate).toBe(0)
    }))

  it('is only for the medium and large mammals: small ones (hares, marmots, squirrels) never court', () =>
    forced(() => {
      for (const kind of ['hare', 'marmot', 'squirrel'] as Kind[]) {
        const wild = new Wildlife()
        const a = new Animal(1, kind, x0, 0.5)
        const b = new Animal(2, kind, x0 + 30, 0.5)
        for (const d of [a, b]) {
          d.life = 1e9
          d.state = 'idle'
          d.wait = 1e9
        }
        wild.animals.push(a, b)
        for (let i = 0; i < 30 * 5; i++) wild.update(atBeach(ctx(x0 - 100, i / 30)), true)
        expect(a.mate + b.mate).toBe(0)
        expect(wild.hearts.length).toBe(0)
      }
    }))

  it('foxes (sitting watching) and ibex court too', () =>
    forced(() => {
      for (const [kind, state] of [
        ['fox', 'watch'],
        ['ibex', 'idle'],
      ] as [Kind, string][]) {
        const wild = new Wildlife()
        const a = new Animal(1, kind, x0, 0.5)
        const b = new Animal(2, kind, x0 + 40, 0.5)
        for (const d of [a, b]) {
          d.life = 1e9
          d.state = state
        }
        wild.animals.push(a, b)
        let met = false
        for (let i = 0; i < 30 * 15 && !met; i++) {
          wild.update(atBeach(ctx(x0 - 100, i / 30)), true)
          met = a.state === 'nuzzle' && b.state === 'nuzzle'
        }
        expect(met).toBe(true)
      }
    }))

  it('only happens once in a while', () => {
    let courted = 0
    const trials = 120
    for (let seed = 1; seed <= trials; seed++) {
      const wild = new Wildlife()
      const [a] = pair()
      wild.animals.push(a)
      const r = rng(seed)
      for (let i = 0; i < 30 * 30 && !a.mate; i++) {
        const c = atBeach(ctx(x0 - 100, i / 30))
        c.rng = r
        wild.update(c, true)
      }
      if (a.mate) courted++
    }
    // Watching one calm deer for half a minute: a courtship now and then, but rarely.
    expect(courted / trials).toBeGreaterThan(0.02)
    expect(courted / trials).toBeLessThan(0.3)
  })
})

describe('a courtship on every journey', () => {
  const W = 240
  /**
   * Walks the climber from `from` to `to` (trail fractions): 300 px at a time, then a pause to read,
   * like a visitor scrolling through the sections. Returns whether a courtship was seen.
   */
  function journey(wild: Wildlife, w: World, r: Rng, clock: { t: number }, from: number, to: number, daylight: number) {
    const step = 1 / 30
    let x = from * WORLD_LEN
    let next = x + 300
    const tick = () => {
      const c = ctx(x - W * 0.34, clock.t)
      wild.update({ ...c, W, world: w, rng: r, daylight, climberX: x }, true)
      clock.t += step
    }
    while (x < to * WORLD_LEN) {
      if (x >= next) {
        // A quick reader: five seconds per stop.
        for (let i = 0; i < 5 * 30; i++) tick()
        next = x + 300
      } else {
        x += 90 * step
        tick()
      }
    }
    return wild.courtedThisJourney
  }

  it.each([
    ['rocks', 1],
    ['lake', 1],
    ['rocks', 0.1],
    ['lake', 0.1],
  ] as [Route, number][])('shows one on the %s route (daylight %s), whatever the seed', (route, daylight) => {
    const w = new World(1983, route)
    for (const seed of [1, 2, 3, 4, 5]) {
      const wild = new Wildlife()
      expect(journey(wild, w, rng(seed), { t: 0 }, 0.02, 0.97, daylight)).toBe(true)
    }
  })

  it('always with medium or large mammals', () => {
    const big = ['deer', 'chamois', 'ibex', 'fox']
    for (const route of ['rocks', 'lake'] as Route[]) {
      const w = new World(1983, route)
      for (const seed of [11, 12, 13, 14, 15, 16]) {
        const wild = new Wildlife()
        const courting = new Set<string>()
        const orig = wild.update.bind(wild)
        wild.update = (c, on) => {
          orig(c, on)
          for (const a of wild.animals) if (a.mate) courting.add(a.kind)
        }
        expect(journey(wild, w, rng(seed), { t: 0 }, 0.02, 0.97, seed % 2 ? 1 : 0.1)).toBe(true)
        for (const kind of courting) expect(big).toContain(kind)
      }
    }
  })

  it('starts over when the visitor goes back to the beach for another journey', () => {
    const w = new World(1983, 'rocks')
    const wild = new Wildlife()
    const r = rng(9)
    const clock = { t: 0 }
    expect(journey(wild, w, r, clock, 0.02, 0.97, 1)).toBe(true)
    // Back at the beach: the next journey hasn't had its courtship yet…
    journey(wild, w, r, clock, 0.02, 0.025, 1)
    expect(wild.courtedThisJourney).toBe(false)
    // …and gets one of its own on the way up.
    expect(journey(wild, w, r, clock, 0.025, 0.97, 1)).toBe(true)
  })

  it('counts only once a pair has been seen nose to nose on screen', () => {
    expect(JOURNEY.seen).toBeGreaterThanOrEqual(1)
    const w = new World(1983, 'rocks')
    const wild = new Wildlife()
    // Never pausing, the visitor rushes past: nothing is staged, so nothing is seen.
    const clock = { t: 0 }
    const r = rng(4)
    let x = 0.02 * WORLD_LEN
    while (x < 0.97 * WORLD_LEN) {
      x += 400 / 30
      const c = ctx(x - W * 0.34, clock.t)
      wild.update({ ...c, W, world: w, rng: r, climberX: x }, true)
      clock.t += 1 / 30
    }
    expect(wild.courtedThisJourney).toBe(false)
  })
})

describe('birds coming and going', () => {
  const BIRDS: Kind[] = ['gull', 'eagle', 'butterfly', 'chough', 'flamingo', 'ptarmigan', 'owl']
  // A desktop-sized view, so anything vanishing in mid-air would be in plain sight.
  const view = (camX: number, time: number, r: Rng, daylight: number): AnimalCtx => ({
    ...ctx(camX, time),
    W: 480,
    H: 300,
    groundY: () => 228,
    rng: r,
    daylight,
    climberX: camX + 160,
  })

  /** How much of an animal shows: its opacity times the share of it inside the screen. */
  function showing(a: Animal, c: AnimalCtx) {
    if (!a.visible) return 0
    const b = box(a, c)
    const w = Math.max(0, Math.min(b.sx + b.w, c.W) - Math.max(b.sx, 0))
    const h = Math.max(0, Math.min(b.sy + b.h, c.H) - Math.max(b.sy, 0))
    return Math.max(0, Math.min(1, a.alpha)) * ((w * h) / (b.w * b.h))
  }

  it('fly or fade in and out of sight, never popping up or vanishing in plain view', () => {
    const seen = new Set<string>()
    const places: [number, number][] = [
      [0.03, 1],
      [0.07, 1],
      [LAGOON, 1],
      [0.13, 1],
      [0.2, 1],
      [0.28, 0.2],
      [0.4, 1],
      [0.52, 1],
      [0.7, 1],
      [0.85, 1],
      [0.97, 1],
    ]
    for (const [f, daylight] of places) {
      const wild = new Wildlife()
      const camX = f * WORLD_LEN - 160
      const r = rng(Math.round(f * 1000))
      const last = new Map<number, { a: Animal; v: number; alpha: number; state: string }>()
      for (let i = 0; i < 30 * 150; i++) {
        const c = view(camX, i / 30, r, daylight)
        wild.update(c, true)
        const now = new Set<number>()
        for (const a of wild.animals) {
          if (!BIRDS.includes(a.kind)) continue
          now.add(a.uid)
          const v = showing(a, c)
          const before = last.get(a.uid)
          // Residents (the lagoon's flamingos) are part of the place and slide into view with it.
          if (!before && !a.fixed) expect(v, `${a.kind} turning up (${a.state})`).toBeLessThanOrEqual(0.1)
          // On screen, it only ever fades gradually (sliding in or out past the edge is fine).
          if (before) expect(Math.abs(a.alpha - before.alpha), `${a.kind} (${before.state} → ${a.state})`).toBeLessThanOrEqual(0.1)
          // A flock flying in lands in view.
          if (before?.state === 'arrive' && a.kind === 'chough' && a.state !== 'arrive') {
            expect(a.h).toBe(0)
            expect(a.x - camX).toBeGreaterThan(0)
            expect(a.x - camX).toBeLessThan(c.W)
          }
          last.set(a.uid, { a, v, alpha: a.alpha, state: a.state })
          seen.add(`${a.kind}:${a.state}`)
        }
        for (const [uid, { a, v, state }] of last) {
          if (now.has(uid)) continue
          expect(v, `${a.kind} going (${state})`).toBeLessThanOrEqual(0.1)
          last.delete(uid)
        }
      }
    }
    // It really did watch them come and go: in from the side, fading up, flying off, landing.
    for (const s of ['gull:glide', 'eagle:arrive', 'eagle:soar', 'chough:arrive', 'chough:hop', 'butterfly:idle', 'flamingo:fly', 'ptarmigan:idle', 'owl:idle']) {
      expect(seen).toContain(s)
    }
  })

  it('a chough flock lands where the ground is in view, not down a drop off the screen', () => {
    const camX = 0.52 * WORLD_LEN - 160
    const wild = new Wildlife()
    const r = rng(11)
    let landed = 0
    for (let i = 0; i < 30 * 300 && landed < 8; i++) {
      // Just past the walker the crag falls away, and the ground there is below the bottom of the screen.
      const c: AnimalCtx = { ...view(camX, i / 30, r, 1), groundY: (x) => (x - camX > 175 ? 420 : 228) }
      const before = new Map(wild.animals.map((a) => [a.uid, a.state]))
      wild.update(c, true)
      for (const a of wild.animals) {
        if (a.kind !== 'chough' || before.get(a.uid) !== 'arrive' || a.state === 'arrive') continue
        expect(c.groundY(a.x)).toBeLessThan(c.H)
        landed++
      }
    }
    expect(landed).toBeGreaterThan(2)
  })

  it('a gull the view keeps pace with fades away when its time is up, rather than vanishing', () => {
    const a = new Animal(1, 'gull', 0.05 * WORLD_LEN, 0.5)
    a.anchorH = 70
    a.h = 70
    const wild = new Wildlife()
    wild.animals.push(a)
    let alpha = 1
    for (let i = 0; i < 30 * 120 && !a.gone; i++) {
      wild.update({ ...ctx(a.x - 240, i / 30), W: 480, H: 300, groundY: () => 228 }, true)
      if (a.gone) break
      expect(alpha - a.alpha).toBeLessThan(0.05)
      alpha = a.alpha
    }
    expect(a.gone).toBe(true)
    expect(alpha).toBeLessThan(0.05)
  })

  it('an eagle glides in from the side and slips into its circle without a jump', () => {
    const camX = 0.4 * WORLD_LEN
    const a = new Animal(1, 'eagle', camX - 16, 0.6)
    a.anchorH = 95
    a.h = 95
    const wild = new Wildlife()
    wild.animals.push(a)
    const states = new Set<string>()
    let prev = { x: a.x, h: a.h }
    for (let i = 0; i < 30 * 25; i++) {
      wild.update({ ...ctx(camX, i / 30), climberX: camX + 160 }, true)
      states.add(a.state)
      expect(Math.abs(a.x - prev.x)).toBeLessThan(1.6)
      expect(Math.abs(a.h - prev.h)).toBeLessThan(1)
      prev = { x: a.x, h: a.h }
    }
    expect([...states]).toEqual(['arrive', 'soar'])
  })
})
