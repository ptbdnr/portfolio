import { describe, expect, it } from 'vitest'
import { SeaSportChooser } from './seaSport.ts'
import { WORLD_LEN, Z } from './world.ts'

const shore = Z.shore * WORLD_LEN
const atSea = shore - 100
const onBeach = shore + 80

describe('windsurfing or snorkelling', () => {
  it('starts the journey windsurfing, until he reaches the shore', () => {
    const chooser = new SeaSportChooser()
    for (const x of [40, 120, atSea, 60, shore - 1]) expect(chooser.update(x)).toBe('surf')
  })

  it('swaps every time he comes back from the beach: snorkelling first', () => {
    const chooser = new SeaSportChooser()
    chooser.update(atSea)
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      chooser.update(onBeach)
      seen.push(chooser.update(atSea))
    }
    expect(seen).toEqual(['snorkel', 'surf', 'snorkel', 'surf'])
  })

  it("doesn't change while dithering at the water's edge", () => {
    const chooser = new SeaSportChooser()
    for (let i = 0; i < 10; i++) {
      chooser.update(shore + 10)
      chooser.update(shore - 5)
    }
    expect(chooser.sport).toBe('surf')
  })
})
