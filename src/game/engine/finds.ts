import type { Rng } from './math.ts'
import { bake, spr, type Sprite } from './sprites.ts'
import type { View } from './view.ts'
import { LAGOON, LAGOON_HALF, WORLD_LEN, Z, type World } from './world.ts'

/**
 * Things buried in the ground, a few per visit and never in the same places twice: an amphora on
 * the sea bed, a message in a bottle in the beach sand, a Nuragic bronze in Sardinian soil,
 * fossils and crystals in the rock, an old ice axe frozen into the glacier…
 */
export type FindKind =
  | 'amphora'
  | 'anchor'
  | 'bottle'
  | 'chest'
  | 'bronzetto'
  | 'coins'
  | 'horseshoe'
  | 'ammonite'
  | 'trilobite'
  | 'fish'
  | 'bone'
  | 'crystals'
  | 'gold'
  | 'iceAxe'
  | 'ski'

type Where = 'sea' | 'sand' | 'soil' | 'rock' | 'ice'

/** `top`: how far below the ground surface the find's top row is, in pixels. */
export type Find = { kind: FindKind; x: number; top: number }

type Spec = { label: string; where: Where; range: [number, number]; sprite: Sprite }

const L = WORLD_LEN

export const FINDS: Record<FindKind, Spec> = {
  amphora: {
    label: 'Roman amphora',
    where: 'sea',
    range: [0.04, 0.049],
    sprite: spr(['...oooo.d...', '.oddddddddddN', 'dddddddddddN.', '.dddddddd.d..', '...dddd......']),
  },
  anchor: {
    label: 'Old anchor',
    where: 'sea',
    range: [0.04, 0.049],
    sprite: spr(['..GGG..', '..G.G..', '...G...', '.GGGGG.', '...G...', '...G...', 'G..G..G', 'GG.G.GG', '.GGGGG.']),
  },
  bottle: {
    label: 'Message in a bottle',
    where: 'sand',
    range: [Z.shore + 0.003, LAGOON - 0.012],
    sprite: spr(['.EEEEE..', 'EevvveEEt', '.EEEEE..']),
  },
  chest: {
    label: 'Pirate treasure!',
    where: 'sand',
    range: [Z.shore + 0.004, LAGOON - 0.012],
    sprite: spr(['.NNNNNNN...', 'NnnnnnnnN..', 'NNNNYNNNN..', 'NnnnnnnnN..', 'NnyYnnnnN.y', 'NNNNNNNNNyY']),
  },
  bronzetto: {
    label: 'Nuragic bronze',
    where: 'soil',
    range: [0.11, 0.175],
    sprite: spr(['A...A', '.AoA.', '..o..', 'AoooA', '..o..', '..o..', '.o.o.', '.A.A.']),
  },
  coins: {
    label: 'Roman coins',
    where: 'soil',
    range: [0.1, 0.2],
    sprite: spr(['.YY.....', 'YyyY..YY', 'YyyY.YyyY', '.YY..YyyY', '......YY.']),
  },
  horseshoe: {
    label: 'Lost horseshoe',
    where: 'soil',
    range: [0.34, 0.45],
    sprite: spr(['.MMMMM.', 'MM...MM', 'M.....M', 'M.....M', 'MM...MM']),
  },
  ammonite: {
    label: 'Ammonite fossil',
    where: 'rock',
    range: [0.47, 0.95],
    sprite: spr(['..aaaa..', '.aAAAAa.', 'aAaaaaAa', 'aAaAAaAa', 'aAaAaaAa', 'aAaaaAa.', '.aAAAa..', '..aaa...']),
  },
  trilobite: {
    label: 'Trilobite fossil',
    where: 'rock',
    range: [0.47, 0.95],
    sprite: spr(['.aaa.', 'aAaAa', 'AaaaA', 'aAaAa', 'AaaaA', 'aAaAa', '.aAa.', '..a..']),
  },
  fish: {
    label: 'Fossil fish',
    where: 'rock',
    range: [0.47, 0.95],
    sprite: spr(['a...A.A.A.aaa.', 'aa.aaaaaaaaaAa', 'a...A.A.A.aaa.']),
  },
  bone: {
    label: 'Dinosaur bone?',
    where: 'rock',
    range: [0.47, 0.95],
    sprite: spr(['uu.......uu', 'uuuuuuuuuuu', 'uu.......uu']),
  },
  crystals: {
    label: 'Alpine crystals',
    where: 'rock',
    range: [0.47, 0.95],
    sprite: spr(['...w....', '.c.wW.c.', '.cWwWWc.', 'cWWwWWwc', 'KKKKKKKK']),
  },
  gold: {
    label: 'A vein of gold',
    where: 'rock',
    range: [0.47, 0.95],
    sprite: spr(['Y......yY.', 'yYy..YyY.y', '..YyYy....', '....Y.....']),
  },
  iceAxe: {
    label: 'Vintage ice axe',
    where: 'ice',
    range: [0.77, 0.93],
    sprite: spr(['KK...........', 'KKKnnnnnnnnnnK', 'K.............']),
  },
  ski: {
    label: 'Old wooden ski',
    where: 'ice',
    range: [0.77, 0.93],
    sprite: spr(['.............NN', 'nnnnnnnnnnnnnN.', 'NNNNNNNNNNNNN..']),
  },
}

/** Places to keep clear: the challenges, the hut and the lagoon have enough going on. */
const BUSY: [number, number][] = [
  [Z.climb[0] - 0.006, Z.climb[1] + 0.006],
  [Z.abseil[0] - 0.006, Z.abseil[1] + 0.006],
  [Z.crevassePrompt, Z.crevasse[1] + 0.006],
  [Z.hut - 0.01, Z.hut + 0.01],
  [LAGOON - LAGOON_HALF / L - 0.006, LAGOON + LAGOON_HALF / L + 0.006],
]

/** How deep the sea is at world x (pixels down to the sea bed; see the terrain painter). */
export const seaBed = (x: number) => Math.round(1 + (Z.shore * L - x) * 0.7)

/**
 * How far below the surface the top of a find of this kind can be at x (pixels), or null if there's
 * no room for it there. Shallow enough to be seen on screen.
 */
export function depthRange(where: Where, w: World, x: number): [number, number] | null {
  const i = Math.max(0, Math.min(L, Math.round(x)))
  const { ice, sand, soil, scree } = w.layers
  // A few pixels of snow may lie on top in winter.
  const top = 6
  switch (where) {
    case 'sea': {
      // Lying on the sea bed, where it shelves up towards the beach (the caller lifts it by its own height).
      const bed = seaBed(x)
      return x < Z.shore * L - 10 && bed > 12 && bed < 40 ? [bed, bed] : null
    }
    case 'sand':
      return sand[i] > 16 && ice[i] === 0 ? [top, Math.min(26, sand[i] - 4)] : null
    case 'soil': {
      const from = ice[i] + sand[i] + top
      return soil[i] > 16 ? [from, Math.min(from + 20, ice[i] + sand[i] + soil[i] - 4)] : null
    }
    case 'rock': {
      const from = ice[i] + sand[i] + soil[i] + scree[i] + 4
      return ice[i] === 0 && from < 34 ? [from + 2, from + 22] : null
    }
    case 'ice':
      return ice[i] > 40 ? [10, Math.min(34, ice[i] - 8)] : null
  }
}

/** A handful of finds for this visit, each in a suitable spot, well apart from each other. */
export function placeFinds(w: World, r: Rng, count = r.int(5, 8)): Find[] {
  const kinds = Object.keys(FINDS) as FindKind[]
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1))
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  const finds: Find[] = []
  for (const kind of kinds) {
    if (finds.length >= count) break
    const spec = FINDS[kind]
    for (let tries = 0; tries < 40; tries++) {
      const f = r.range(spec.range[0], spec.range[1])
      const x = f * L
      if (BUSY.some(([a, b]) => f > a && f < b)) continue
      if (finds.some((o) => Math.abs(o.x - x) < 60)) continue
      const range = depthRange(spec.where, w, x)
      if (!range || range[1] < range[0]) continue
      const top = spec.where === 'sea' ? range[0] - spec.sprite.h : Math.round(r.range(range[0], range[1]))
      finds.push({ kind, x, top })
      break
    }
  }
  return finds.sort((a, b) => a.x - b.x)
}

/** What lies over a find softens its colours a little: water and ice most, earth and rock barely. */
const TINTS: Record<Where, string> = {
  sea: 'rgba(45,143,196,0.3)',
  ice: 'rgba(190,230,248,0.3)',
  sand: 'rgba(120,90,50,0.06)',
  soil: 'rgba(40,28,20,0.08)',
  rock: 'rgba(30,32,44,0.06)',
}
const baked = new Map<FindKind, HTMLCanvasElement>()

/** The find's sprite, coloured by what it lies in (seen through water or ice, or dulled by earth). */
function image(kind: FindKind) {
  let c = baked.get(kind)
  if (!c) {
    const spec = FINDS[kind]
    const src = bake(spec.sprite)
    c = document.createElement('canvas')
    c.width = src.width
    c.height = src.height
    const g = c.getContext('2d')!
    g.drawImage(src, 0, 0)
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = TINTS[spec.where]
    g.fillRect(0, 0, c.width, c.height)
    baked.set(kind, c)
  }
  return c
}

/** Where a find sits on screen. */
export function findBox(v: View, f: Find) {
  const { w, h } = FINDS[f.kind].sprite
  return { sx: Math.round(f.x - v.camX) - (w >> 1), sy: v.groundY(f.x) + f.top, w, h }
}

export function drawFinds(s: CanvasRenderingContext2D, v: View, finds: Find[]) {
  for (const f of finds) {
    const b = findBox(v, f)
    if (b.sx < -20 || b.sx > v.W + 20 || b.sy > v.H) continue
    s.drawImage(image(f.kind), b.sx, b.sy)
  }
}

/** The find under a screen point (with a little padding), if any. */
export function findAt(v: View, finds: Find[], sx: number, sy: number, pad = 3): Find | null {
  for (const f of finds) {
    const b = findBox(v, f)
    if (sx >= b.sx - pad && sx <= b.sx + b.w + pad && sy >= b.sy - pad && sy <= b.sy + b.h + pad) return f
  }
  return null
}
