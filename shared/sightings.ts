/**
 * Things a visitor can spot in the photographs (the field guide in src/content/trail.ts). Shared with
 * the stats API, which only counts sightings of these.
 */
import { SCENES } from '../src/content/trail.ts'

export const SIGHTING_IDS: readonly string[] = SCENES.flatMap((s) => s.spots.map((spot) => spot.id))

const KNOWN = new Set(SIGHTING_IDS)

export function isSightingId(value: unknown): value is string {
  return typeof value === 'string' && KNOWN.has(value)
}

export type StatsSnapshot = {
  visitors: number
  /** How many visitors have spotted each thing. */
  sightings: Partial<Record<string, number>>
}
