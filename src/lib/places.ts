import type { ClimberMode } from '../game/engine/actors.ts'
import type { Biome } from '../game/engine/world.ts'

/** Plain names for where the climber is, shown in the top bar. */
export const PLACE: Record<Biome, string> = {
  sea: 'At sea, Sardinia',
  beach: 'Beach, Sardinia',
  country: 'Sardinian countryside',
  valley: 'Alpine village',
  forest: 'Forest',
  pasture: 'High pastures',
  crag: 'The rocks',
  lake: 'Mountain lake',
  larch: 'Larch valley',
  moraine: 'Moraine',
  glacier: 'Glacier',
  summit: 'Summit ridge',
}

export const DOING: Record<ClimberMode, string> = {
  surf: 'Windsurfing',
  snorkel: 'Snorkelling',
  beach: 'Strolling',
  bike: 'Cycling',
  hike: 'Hiking',
  climb: 'Climbing',
  scramble: 'Scrambling',
  abseil: 'Abseiling',
  ski: 'Ski touring',
  alpine: 'Mountaineering',
  leap: 'Jumping!',
  hang: 'Whoops!',
  victory: 'On the summit',
  hidden: 'In the hut',
}
