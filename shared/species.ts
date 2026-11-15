/** Everything a visitor can "photograph" in the field guide. Shared with the stats API allowlist. */
export const SPECIES_IDS = [
  'fox',
  'squirrel',
  'deer',
  'owl',
  'marmot',
  'cow',
  'butterfly',
  'eagle',
  'chamois',
  'ibex',
  'ptarmigan',
  'hare',
  'chough',
  'edelweiss',
  'robin',
  'hedgehog',
  'flamingo',
  'gull',
  'dolphin',
  'sheep',
  'yeti',
] as const

export type SpeciesId = (typeof SPECIES_IDS)[number]

export function isSpeciesId(value: unknown): value is SpeciesId {
  return typeof value === 'string' && (SPECIES_IDS as readonly string[]).includes(value)
}

export type StatsSnapshot = {
  visitors: number
  sightings: Partial<Record<SpeciesId, number>>
}
