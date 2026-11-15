import { describe, expect, it } from 'vitest'
import { FINDS, placeFinds, seaBed, type FindKind } from './finds.ts'
import { rng } from './math.ts'
import { WORLD_LEN, World, Z } from './world.ts'

describe.each(['rocks', 'lake'] as const)('buried finds (%s route)', (route) => {
  const world = new World(1983, route)
  const { ice, sand, soil, scree } = world.layers

  it('puts a few finds in the ground each visit, each where it belongs and shallow enough to see', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const finds = placeFinds(world, rng(seed))
      expect(finds.length).toBeGreaterThanOrEqual(5)
      expect(finds.length).toBeLessThanOrEqual(8)
      expect(new Set(finds.map((f) => f.kind)).size).toBe(finds.length)
      for (let i = 1; i < finds.length; i++) expect(finds[i].x - finds[i - 1].x).toBeGreaterThanOrEqual(60)
      for (const f of finds) {
        const spec = FINDS[f.kind]
        const x = Math.round(f.x)
        const h = spec.sprite.h
        expect(f.x / WORLD_LEN).toBeGreaterThanOrEqual(spec.range[0])
        expect(f.x / WORLD_LEN).toBeLessThanOrEqual(spec.range[1])
        expect(f.top + h).toBeLessThan(70)
        switch (spec.where) {
          case 'sea':
            expect(f.x).toBeLessThan(Z.shore * WORLD_LEN)
            expect(f.top + h).toBe(seaBed(f.x))
            break
          case 'sand':
            expect(f.top + h).toBeLessThanOrEqual(sand[x] + 4)
            break
          case 'soil':
            expect(f.top).toBeGreaterThanOrEqual(ice[x] + sand[x])
            expect(f.top).toBeLessThanOrEqual(ice[x] + sand[x] + soil[x])
            break
          case 'rock':
            expect(ice[x]).toBe(0)
            expect(f.top).toBeGreaterThanOrEqual(sand[x] + soil[x] + scree[x])
            break
          case 'ice':
            expect(f.top).toBeGreaterThanOrEqual(8)
            expect(f.top + h).toBeLessThanOrEqual(ice[x])
            break
        }
      }
    }
  })

  it('turns up every kind of find, sooner or later', () => {
    const seen = new Set<FindKind>()
    for (let seed = 1; seed <= 200; seed++) for (const f of placeFinds(world, rng(seed))) seen.add(f.kind)
    expect([...seen].sort()).toEqual((Object.keys(FINDS) as FindKind[]).sort())
  })
})
