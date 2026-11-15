import { describe, expect, it } from 'vitest'
import { GLACIER, PX_PER_M, WORLD_LEN, World, Z, type Layers } from './world.ts'

const at = (f: number) => Math.round(f * WORLD_LEN)

describe.each(['rocks', 'lake'] as const)('ground layers (%s route)', (route) => {
  const world = new World(1983, route)
  const layers = world.layers

  it.each(['ice', 'sand', 'soil', 'scree'] as (keyof Layers)[])('%s changes thickness gradually, never in a vertical step', (key) => {
    const a = layers[key]
    // The one deliberate break: the glacier ends at the bergschrund, where a slot is drawn.
    const berg = at(GLACIER.bergschrund[0])
    let worst = 0
    for (let x = 0; x < WORLD_LEN; x++) if (key !== 'ice' || x + 1 !== berg) worst = Math.max(worst, Math.abs(a[x + 1] - a[x]))
    expect(worst).toBeLessThanOrEqual(4)
  })

  it('ends the glacier ice at the bergschrund, with firn plastered on the headwall above', () => {
    const [b0, b1] = GLACIER.bergschrund.map(at)
    expect(layers.ice[b0 - 1]).toBeGreaterThan(10)
    for (let x = b0; x <= WORLD_LEN; x++) expect(layers.ice[x]).toBe(0)
    // Snow-plastered, with a couple of rock bands showing through.
    const wall = Array.from(layers.firn.slice(b1 + 4, at(0.956)))
    expect(Math.max(...wall)).toBeGreaterThan(9)
    expect(wall.some((t) => t < 4)).toBe(true)
  })

  it('stands the snout up as a steep ice front over the moraine', () => {
    const snout = Math.ceil(GLACIER.snout * WORLD_LEN)
    expect(world.iceCap[snout - 1]).toBe(0)
    expect(world.iceCap[snout + GLACIER.front]).toBeCloseTo(GLACIER.height, 0)
    expect(world.snoutFront(snout + 5)).not.toBeNull()
    expect(world.snoutFront(snout - 5)).toBeNull()
  })

  it('puts sand under the sea and the beach, thinning out under the fields', () => {
    expect(layers.sand[at(Z.shore - 0.01)]).toBeGreaterThan(20)
    expect(layers.sand[at(0.07)]).toBeGreaterThan(20)
    expect(layers.sand[at(0.1)]).toBe(0)
    // Where the beach meets the countryside, soil and sand overlap rather than butting up.
    const x = at(0.08)
    expect(layers.sand[x]).toBeGreaterThan(0)
    expect(layers.soil[x]).toBeGreaterThan(0)
  })

  it('has deep soil under the forest and meadows', () => {
    for (const f of [0.25, 0.3, 0.4]) expect(layers.soil[at(f)]).toBeGreaterThan(80)
  })

  it('carries a glacier of thick ice, starting at a snout over the moraine', () => {
    expect(layers.ice[at(0.72)]).toBe(0)
    expect(layers.scree[at(0.72)]).toBeGreaterThan(10)
    // At the snout, thin ice lies on top of moraine rubble.
    const snout = at(0.757)
    expect(layers.ice[snout]).toBeGreaterThan(0)
    expect(layers.scree[snout]).toBeGreaterThan(0)
    expect(layers.ice[at(0.85)]).toBeGreaterThan(100)
    expect(layers.ice[at(0.97)]).toBe(0)
  })

  it('breaks the rock band into ledges and short steep steps for the scramble', () => {
    const [x0, x1] = [at(Z.scramble[0]), at(Z.scramble[1])]
    let ledge = 0
    let step = 0
    for (let x = x0 + 8; x < x1 - 8; x++) {
      const slope = Math.abs(world.alt[x + 1] - world.alt[x]) * PX_PER_M
      if (slope < 0.25) ledge++
      if (slope > 1) step++
    }
    expect(ledge).toBeGreaterThan(40)
    expect(step).toBeGreaterThan(20)
    expect(world.scrambleSteps.length).toBeGreaterThan(6)
    // It's a rock band: no soil from just above its foot.
    for (let x = x0 + 16; x <= x1; x++) expect(layers.soil[x]).toBe(0)
  })

  it('shows bare rock where the trail goes over the rocks, but keeps the lakeside green', () => {
    const crag = at(0.5)
    if (route === 'rocks') expect(layers.soil[crag]).toBe(0)
    else expect(layers.soil[crag]).toBeGreaterThan(80)
  })
})
