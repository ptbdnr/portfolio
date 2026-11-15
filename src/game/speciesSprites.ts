import type { SpeciesId } from '../../shared/species.ts'
import {
  BUTTERFLY,
  CHAMOIS,
  CHOUGH,
  COW,
  DEER,
  EAGLE,
  EDELWEISS,
  FOX,
  HARE,
  HEDGEHOG,
  IBEX,
  MARMOT,
  OWL,
  PTARMIGAN,
  ROBIN,
  SQUIRREL,
  YETI,
  spr,
  type Sprite,
} from './engine/sprites.ts'

/* Album portraits for animals that are animated procedurally in the scene. */
const SHEEP = spr([
  '..wWwWwWw....',
  '.wWwWwWwWwvk.',
  'wWwWwWwWwWvvv',
  'wwWwWwWwWwWv.',
  '.wWwWwWwWw...',
  '..G.G...G.G..',
  '..G.G...G.G..',
  '..K.K...K.K..',
])
const FLAMINGO = spr([
  '......ff.',
  '.....fkwk',
  '.....f...',
  '....f....',
  '.....f...',
  '......f..',
  '.fffffff.',
  'FfffffFf.',
  '.FFFFFF..',
  '....F....',
  '....FFF..',
  '....F.F..',
  '....F....',
  '....F....',
  '....F....',
  '...FF....',
])
const GULL = spr([
  '...........ww...',
  '..........wwkY..',
  '.........wwww...',
  'kGGGGGGGwwwww...',
  '.kkGGGGGwwww....',
  '...kwwwwwww.....',
  '.......Y.Y......',
  '......YY.YY.....',
])
const DOLPHIN = spr([
  '.......D......',
  '......DD......',
  '...DDDDDDD....',
  '.DDDDDDDDDDD..',
  'DDDWWWWWWDDDDk',
  '.D..WWWW...DD.',
  'D.............',
])

export const SPECIES_SPRITES: Record<SpeciesId, Sprite> = {
  fox: FOX.stand,
  squirrel: SQUIRREL.sit,
  deer: DEER.alert,
  owl: OWL.center,
  marmot: MARMOT.stand,
  cow: COW.stand,
  butterfly: BUTTERFLY.open,
  eagle: EAGLE.glide,
  chamois: CHAMOIS.stand,
  ibex: IBEX.stand,
  ptarmigan: PTARMIGAN.winter,
  hare: HARE.summer,
  chough: CHOUGH.stand,
  edelweiss: EDELWEISS,
  robin: ROBIN.stand,
  hedgehog: HEDGEHOG.walk,
  flamingo: FLAMINGO,
  gull: GULL,
  dolphin: DOLPHIN,
  sheep: SHEEP,
  yeti: YETI.stand,
}

const silhouettes = new Map<Sprite, Sprite>()

/** "Not yet seen" version of a sprite, like an unfilled Pokédex entry. */
export function silhouette(sprite: Sprite): Sprite {
  let s = silhouettes.get(sprite)
  if (!s) {
    s = spr(sprite.rows.map((row) => row.replace(/[^.]/g, 'K')))
    silhouettes.set(sprite, s)
  }
  return s
}
