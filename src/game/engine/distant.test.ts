import { describe, expect, it } from 'vitest'
import { midRidge } from './backdrop.ts'
import { CABLE_LINES, LAND_DETAILS, SCHEDULE, balloonAt, ferryAt, paragliderAt, slotOf, type Mover } from './distant.ts'
import type { View } from './view.ts'
import { WORLD_LEN } from './world.ts'

const movers = Object.keys(SCHEDULE) as Mover[]
const hour = Array.from({ length: 3600 * 4 }, (_, i) => i / 4)

describe('quiet things in the background', () => {
  it('leaves the sky empty most of the time', () => {
    const busy = hour.filter((t) => slotOf('contrail', t) || slotOf('birds', t)).length / hour.length
    expect(busy).toBeLessThan(0.35)
  })

  it('brings each of them out now and then, never on a fixed beat', () => {
    for (const m of movers) {
      const runs = new Set(hour.map((t) => slotOf(m, t)?.from).filter((f) => f !== undefined))
      expect(runs.size).toBeGreaterThan(2)
      // Some turns are skipped, so the gaps between runs vary.
      const starts = [...runs].sort((a, b) => a! - b!) as number[]
      const gaps = new Set(starts.slice(1).map((s, i) => s - starts[i]))
      expect(gaps.size).toBeGreaterThan(1)
    }
  })

  it('moves each one smoothly through its run', () => {
    for (const m of movers) {
      const len = SCHEDULE[m].len
      const t = hour.find((x) => slotOf(m, x)?.p === 0 || (slotOf(m, x) && slotOf(m, x)!.p < 0.01))!
      const a = slotOf(m, t)!
      const b = slotOf(m, t + len / 2)!
      expect(b.from).toBe(a.from)
      expect(b.p - a.p).toBeCloseTo(0.5, 1)
      expect(slotOf(m, a.from + len + 0.01)?.from).not.toBe(a.from)
    }
  })
})

const W = 480
const H = 300
const view = (f: number, daylight = 1) =>
  ({
    W,
    H,
    horizon: 150,
    ground0: 228,
    camX: Math.round(f * WORLD_LEN),
    camAlt: 1500,
    sky: { daylight, stars: 1 - daylight },
    reducedMotion: false,
    groundY: () => H,
  }) as unknown as View
// Nothing in front: the near hills and the ground are all below the screen.
const tops = { near: new Int16Array(W).fill(H), mid: new Int16Array(W).fill(H), far: new Int16Array(W).fill(H) }

/** How much a detail shows: the pixels it draws, each weighted by how opaque it's drawn. */
function ink(draw: (s: CanvasRenderingContext2D) => void) {
  let sum = 0
  const s = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect() {
      sum += this.globalAlpha
    },
  }
  draw(s as unknown as CanvasRenderingContext2D)
  return sum
}

/** The biggest change between one sample and the next. */
const jump = (xs: number[]) => Math.max(...xs.slice(1).map((x, i) => Math.abs(x - xs[i])))

describe('coming and going gracefully', () => {
  it.each([
    ['paraglider', paragliderAt, 0.4],
    ['balloon', balloonAt, 0.2],
  ] as const)('the %s fades in and out: as time passes, as you walk on, and as night falls', (_, at, f) => {
    const alpha = (v: View, t: number) => at(v, t)?.alpha ?? 0
    const times = Array.from({ length: 20000 }, (_, i) => i * 0.1)
    const overTime = times.map((t) => alpha(view(f), t))
    expect(Math.max(...overTime)).toBeGreaterThan(0.75)
    expect(jump(overTime)).toBeLessThan(0.03)
    // At a moment when it's well out, walk the whole trail, then let night fall.
    const t = times.find((x) => alpha(view(f), x) > 0.75)!
    const walking = Array.from({ length: 2001 }, (_, i) => alpha(view(i / 2000), t))
    expect(Math.min(...walking)).toBe(0)
    expect(jump(walking)).toBeLessThan(0.05)
    const nightfall = Array.from({ length: 501 }, (_, i) => alpha(view(f, 1 - i / 500), t))
    expect(nightfall.at(-1)).toBe(0)
    expect(jump(nightfall)).toBeLessThan(0.05)
  })

  it('runs each cable car from a valley station up to a summit on the far range', () => {
    expect(CABLE_LINES).toHaveLength(2)
    for (const { top, low } of CABLE_LINES) {
      expect(Math.abs(top - low)).toBeGreaterThanOrEqual(30)
      expect(midRidge(top) - midRidge(low)).toBeGreaterThan(300)
    }
  })

  it('slides the cable cars into view and out again with the mountains, never popping', () => {
    const shown: number[] = []
    for (let x = 0.2 * WORLD_LEN; x <= 0.85 * WORLD_LEN; x++) {
      const v = view(x / WORLD_LEN)
      shown.push(ink((s) => LAND_DETAILS.cableCar(s, v, 30, tops)))
    }
    expect(Math.max(...shown)).toBeGreaterThan(20)
    expect(shown[0]).toBe(0)
    expect(shown.at(-1)).toBe(0)
    expect(jump(shown)).toBeLessThan(8)
  })

  it('lets the ferry slip out of sight behind the coast as you walk inland', () => {
    const t = Array.from({ length: 4000 }, (_, i) => i * 0.5).find((x) => (ferryAt(view(0.01), x)?.fade ?? 0) === 1)!
    const shown: number[] = []
    for (let x = 0; x <= 0.2 * WORLD_LEN; x++) {
      const v = view(x / WORLD_LEN)
      shown.push(ink((s) => LAND_DETAILS.ferry(s, v, t, tops)))
    }
    expect(Math.max(...shown)).toBeGreaterThan(8)
    expect(shown.at(-1)).toBe(0)
    expect(jump(shown)).toBeLessThanOrEqual(3)
  })
})
