import { describe, expect, it } from 'vitest'
import { needsTorch, nightAt } from './clock.ts'
import { paletteAt, skyAt } from './palettes.ts'
import { Z } from './world.ts'

const daylight = (f: number) => skyAt(((nightAt(f).hour % 24) + 24) % 24, paletteAt(1), 0).daylight
const range = (from: number, to: number, step = 0.0025) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step)
const steepest = (fs: number[], value: (f: number) => number) =>
  Math.max(...fs.slice(1).map((f, i) => Math.abs(value(f) - value(fs[i]))))
const torch = (f: number) => needsTorch(nightAt(f).dark, daylight(f))

describe('night mode along the trail', () => {
  it('keeps the sea and the beach in a bright sunset', () => {
    for (const f of [0, 0.03, 0.06, 0.075]) {
      expect(nightAt(f).dark).toBeLessThan(0.01)
      expect(daylight(f)).toBeGreaterThan(0.4)
    }
  })

  it('stays in sunset light for the whole bike ride: no head torch on the bike', () => {
    for (const f of range(Z.bikeStart, Z.bikeEnd - 0.002)) {
      expect(nightAt(f).dark).toBeLessThan(0.01)
      expect(daylight(f)).toBeGreaterThan(0.2)
      expect(torch(f)).toBe(false)
    }
  })

  it('lets darkness fall once he gets off the bike and walks on, gradually', () => {
    const on = range(Z.bikeStart, 0.3, 0.0005).find(torch)!
    expect(on).toBeGreaterThanOrEqual(Z.bikeEnd)
    expect(on).toBeLessThan(Z.bikeEnd + 0.015)
    // From a tenth of the way dark to nine tenths takes a good stretch of the trail…
    const stretch = range(Z.bikeEnd - 0.01, 0.3, 0.0005)
    const tenth = stretch.find((f) => nightAt(f).dark > 0.1)!
    const most = stretch.find((f) => nightAt(f).dark > 0.9)!
    expect(most - tenth).toBeGreaterThan(0.03)
    // …with no sudden steps in the land or the sky.
    expect(steepest(range(0.07, 0.3), (f) => nightAt(f).dark)).toBeLessThan(0.06)
    expect(steepest(range(0.07, 0.3), daylight)).toBeLessThan(0.04)
    // Still some light in the sky well into the ride.
    expect(daylight(0.12)).toBeGreaterThan(0.35)
  })

  it('is properly dark from beyond the village up to the glacier', () => {
    for (const f of [0.26, 0.43, 0.6, 0.8, 0.88]) {
      expect(nightAt(f).dark).toBeGreaterThan(0.95)
      expect(daylight(f)).toBeLessThan(0.02)
      expect(torch(f)).toBe(true)
    }
  })

  it('brightens gradually from the upper glacier into sunrise on the summit', () => {
    const dawn = range(0.88, 0.985)
    expect(steepest(dawn, daylight)).toBeLessThan(0.04)
    for (let i = 1; i < dawn.length; i++) expect(daylight(dawn[i])).toBeGreaterThanOrEqual(daylight(dawn[i - 1]))
    expect(daylight(0.93)).toBeGreaterThan(0.05)
    expect(daylight(0.985)).toBeGreaterThan(0.35)
    expect(nightAt(0.985).dark).toBeLessThan(0.25)
  })

  it('only ever moves the clock forward', () => {
    const fs = range(0, 1, 0.005)
    for (let i = 1; i < fs.length; i++) expect(nightAt(fs[i]).hour).toBeGreaterThanOrEqual(nightAt(fs[i - 1]).hour)
  })
})
