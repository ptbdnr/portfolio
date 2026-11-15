import { describe, expect, it } from 'vitest'
import { PALETTES, paletteAround, seasonAround, seasonPosForDate } from './palettes.ts'

const on = (month: number, day: number) => new Date(2026, month - 1, day)

describe("simple view's season follows the calendar", () => {
  it('shows the season of the date', () => {
    expect(seasonAround(seasonPosForDate(on(1, 15)))).toBe('winter')
    expect(seasonAround(seasonPosForDate(on(4, 20)))).toBe('spring')
    expect(seasonAround(seasonPosForDate(on(7, 15)))).toBe('summer')
    expect(seasonAround(seasonPosForDate(on(10, 15)))).toBe('autumn')
    expect(seasonAround(seasonPosForDate(on(11, 11)))).toBe('autumn')
    expect(seasonAround(seasonPosForDate(on(12, 20)))).toBe('winter')
  })

  it('changes gradually from day to day, all the way round the year', () => {
    let prev = seasonPosForDate(on(12, 31))
    for (let d = 0; d < 365; d++) {
      const pos = seasonPosForDate(new Date(2026, 0, 1 + d))
      const step = Math.abs(((pos - prev + 6) % 4) - 2)
      expect(step).toBeLessThan(0.1)
      prev = pos
    }
  })

  it('blends winter back into spring', () => {
    const late = paletteAround(3.5)
    expect(late.groundSnow).toBeLessThan(PALETTES.winter.groundSnow)
    expect(late.groundSnow).toBeGreaterThan(PALETTES.spring.groundSnow)
  })
})
