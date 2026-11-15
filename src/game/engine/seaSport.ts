import { WORLD_LEN, Z } from './world.ts'

export type SeaSport = 'surf' | 'snorkel'

/** How far up the beach (pixels) counts as having properly left the water. */
const ASHORE = 24

/**
 * What the climber does at sea: the journey starts with windsurfing, then each time he comes back
 * from the beach he swaps — snorkelling first, then windsurfing again, and so on. He has to have
 * gone properly ashore first, so dithering at the water's edge doesn't keep changing it.
 */
export class SeaSportChooser {
  sport: SeaSport = 'surf'
  private ashore = false

  update(x: number): SeaSport {
    const shore = Z.shore * WORLD_LEN
    if (x > shore + ASHORE) this.ashore = true
    else if (x < shore && this.ashore) {
      this.ashore = false
      this.sport = this.sport === 'surf' ? 'snorkel' : 'surf'
    }
    return this.sport
  }
}
