import { css, quant, type RGB } from './color.ts'
import type { ScenePalette } from './palettes.ts'

/**
 * Pixel art is written as character grids. Letters are fixed colours; digits and a few symbols are
 * "slots" resolved from the current season palette (so larches turn gold in autumn, etc.).
 */
export const FIXED: Record<string, string> = {
  k: '#1a1c2c',
  K: '#333c57',
  g: '#566c86',
  G: '#94b0c2',
  w: '#f4f4f4',
  W: '#c9d6e3',
  r: '#b13e53',
  R: '#ef7d57',
  y: '#ffcd75',
  Y: '#f9a31b',
  l: '#a7f070',
  e: '#38b764',
  E: '#257179',
  b: '#3b5dc9',
  B: '#41a6f6',
  c: '#73eff7',
  n: '#8a5a3b',
  N: '#5a3a22',
  t: '#c28b5c',
  s: '#f2c8a0',
  p: '#7b4f9d',
  P: '#e05fb0',
  o: '#d9a066',
  z: '#2a1e16',
  m: '#6e7681',
  M: '#c0c8d2',
  v: '#ece4d4',
  d: '#a8582e',
  i: '#8c7a62',
  I: '#5f5040',
  h: '#4a3c2c',
  H: '#b8a684',
  q: '#2f4866',
  // Coast, countryside & beach additions.
  f: '#f6a9c4',
  F: '#d9608e',
  j: '#cfb0a6',
  J: '#94766f',
  u: '#ecd6cc',
  x: '#9aa77a',
  X: '#6f7d55',
  a: '#efd9a2',
  A: '#c9ad73',
  D: '#6d8fae',
  U: '#ff3fa4',
}

type SlotDef = { color: keyof ScenePalette; alpha?: keyof ScenePalette }

export const SLOTS: Record<string, SlotDef> = {
  '1': { color: 'conifer' },
  '2': { color: 'coniferLight' },
  '3': { color: 'leaf', alpha: 'leafAlpha' },
  '4': { color: 'leafLight', alpha: 'leafAlpha' },
  '5': { color: 'larch', alpha: 'larchAlpha' },
  '6': { color: 'larchLight', alpha: 'larchAlpha' },
  '7': { color: 'blossom', alpha: 'blossomAlpha' },
  '8': { color: 'trunk' },
  '9': { color: 'snow', alpha: 'treeSnow' },
  '#': { color: 'rock' },
  '+': { color: 'rockLight' },
  '-': { color: 'rockDark' },
  '&': { color: 'flower1', alpha: 'flowerAlpha' },
  '*': { color: 'flower2', alpha: 'flowerAlpha' },
  $: { color: 'flower3', alpha: 'flowerAlpha' },
}

export type Sprite = { w: number; h: number; rows: string[]; slots: string[] }

export function spr(rows: string[]): Sprite {
  const w = Math.max(...rows.map((r) => r.length))
  const padded = rows.map((r) => r.padEnd(w, '.'))
  const slots = [...new Set(padded.join('').split(''))].filter((ch) => ch in SLOTS)
  return { w, h: rows.length, rows: padded, slots }
}

/** Snow caps: every opaque pixel whose upper neighbour is empty becomes snow. */
export function snowCap(base: Sprite, skip = ''): Sprite {
  const rows = base.rows.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch === '.' || skip.includes(ch)) return '.'
        const above = y > 0 ? base.rows[y - 1][x] : '.'
        return above === '.' ? '9' : '.'
      })
      .join(''),
  )
  return spr(rows)
}

/** Only the glass ('q') pixels, drawn as glowing windows at night. */
export function lightsOf(base: Sprite): Sprite {
  return spr(base.rows.map((row) => row.replace(/[^q]/g, '.').replace(/q/g, 'y')))
}

export function recolor(base: Sprite, map: Record<string, string>): Sprite {
  return spr(base.rows.map((row) => [...row].map((ch) => map[ch] ?? ch).join('')))
}

export function flipH(base: Sprite): Sprite {
  return spr(base.rows.map((row) => [...row].reverse().join('')))
}

const cache = new Map<string, HTMLCanvasElement>()
const ids = new WeakMap<Sprite, number>()
let nextId = 1

function slotKey(sprite: Sprite, palette: ScenePalette | null): string {
  if (!palette || !sprite.slots.length) return ''
  return sprite.slots
    .map((ch) => {
      const def = SLOTS[ch]
      const c = quant(palette[def.color] as RGB)
      const a = def.alpha ? Math.round((palette[def.alpha] as number) * 8) : 8
      return `${c.join(',')}/${a}`
    })
    .join(';')
}

/** Rasterise a sprite into a (cached) canvas. */
export function bake(sprite: Sprite, palette: ScenePalette | null = null, flip = false): HTMLCanvasElement {
  let id = ids.get(sprite)
  if (!id) {
    id = nextId++
    ids.set(sprite, id)
  }
  const key = `${id}|${flip ? 1 : 0}|${slotKey(sprite, palette)}`
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = sprite.w
  canvas.height = sprite.h
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < sprite.h; y++) {
    const row = sprite.rows[y]
    for (let x = 0; x < sprite.w; x++) {
      const ch = row[x]
      if (ch === '.') continue
      let fill = FIXED[ch]
      if (!fill) {
        const def = SLOTS[ch]
        if (!def || !palette) continue
        const alpha = def.alpha ? Math.round((palette[def.alpha] as number) * 8) / 8 : 1
        if (alpha <= 0) continue
        fill = css(quant(palette[def.color] as RGB), alpha)
      }
      ctx.fillStyle = fill
      ctx.fillRect(flip ? sprite.w - 1 - x : x, y, 1, 1)
    }
  }
  if (cache.size > 900) cache.clear()
  cache.set(key, canvas)
  return canvas
}

/* -------------------------------------------------------------------------- */
/* Climber — composed from head / body / legs so frames stay consistent.       */
/* -------------------------------------------------------------------------- */

const HEAD_BEANIE = [
  '......w.....',
  '.....rrrr...',
  '....rrrrrr..',
  '....wwwwww..',
  '....Nsssks..',
  '....Nssssss.',
  '.....ssss...',
]
const HEAD_HELMET = [
  '............',
  '.....YYYY...',
  '....YYYYYY..',
  '....YYYYYYY.',
  '....Nsssks..',
  '....Nssssss.',
  '.....ssss...',
]
const BODY = [
  '..YYY.bbb...',
  '.YYYYbbbbb..',
  '.YYYYbBbbb..',
  '.YYYYbbBbs..',
  '.YYYYbbbbb..',
  '..YYYnnnnn..',
]
const LEGS = {
  stand: ['.....nnnnn..', '.....nn.nn..', '.....rr.rr..', '.....rr.rr..', '.....kkk.kkk'],
  stride: ['.....nnnnn..', '....nn...nn.', '....rr...rr.', '...rr.....rr', '..kkk....kkk'],
  pass: ['.....nnnn...', '......nnn...', '......rrr...', '......rr....', '.....kkkk...'],
  skiA: ['.....nnnnn..', '.....nn..nn.', '.....rr..rr.', '.....rr...rr', '.....kk...kk'],
  skiB: ['.....nnnnn..', '....nn..nn..', '....rr..rr..', '...rr...rr..', '...kk...kk..'],
}

const climber = (head: string[], legs: string[], body = BODY) => spr([...head, ...body, ...legs])

const HEAD_CAP = [
  '............',
  '....YYYY....',
  '...YYYYYY...',
  '...YYYYYYYY.',
  '....Nsssks..',
  '....Nssssss.',
  '.....ssss...',
]
const BODY_TEE = [
  '.....BBB....',
  '....BBBBB...',
  '....BBBBB...',
  '....BBBBs...',
  '....BBBBB...',
  '....KKKKK...',
]
const bare = (rows: string[]) => rows.map((r) => r.replace(/[nr]/g, 's').replace(/k/g, 'N'))

export const CLIMBER = {
  walk: [
    climber(HEAD_BEANIE, LEGS.stand),
    climber(HEAD_BEANIE, LEGS.stride),
    climber(HEAD_BEANIE, LEGS.pass),
    climber(HEAD_BEANIE, LEGS.stride),
  ],
  idle: [climber(HEAD_BEANIE, LEGS.stand)],
  skin: [climber(HEAD_HELMET, LEGS.skiA), climber(HEAD_HELMET, LEGS.skiB)],
  skiIdle: [climber(HEAD_HELMET, LEGS.skiA)],
  alpine: [
    climber(HEAD_HELMET, LEGS.stand),
    climber(HEAD_HELMET, LEGS.stride),
    climber(HEAD_HELMET, LEGS.pass),
    climber(HEAD_HELMET, LEGS.stride),
  ],
  beach: [
    climber(HEAD_CAP, bare(LEGS.stand), BODY_TEE),
    climber(HEAD_CAP, bare(LEGS.stride), BODY_TEE),
    climber(HEAD_CAP, bare(LEGS.pass), BODY_TEE),
    climber(HEAD_CAP, bare(LEGS.stride), BODY_TEE),
  ],
  descend: spr([
    '............',
    '............',
    '.....YYYY...',
    '....YYYYYY..',
    '....YYYYYYY.',
    '....Nsssks..',
    '....Nssssss.',
    '..YYY.ssss..',
    '.YYYYbbbbbbs',
    '.YYYYbbbbb..',
    '.YYYYbbbbb..',
    '..YYnnnnnn..',
    '....nn..nn..',
    '...nn....nn.',
    '...rr....rr.',
    '..kkk...kkk.',
  ]),
  victory: spr([
    '..s.......s.',
    '..b..YYYY.b.',
    '..b.YYYYYYb.',
    '..bbYYYYYYYb',
    '...bNsssks..',
    '....Nssssss.',
    '.....ssss...',
    '..YYY.bbb...',
    '.YYYYbbbbb..',
    '.YYYYbbbbb..',
    '.YYYYbbbbb..',
    '.YYYYbbbbb..',
    '..YYYnnnnn..',
    ...LEGS.stand,
  ]),
}

/* -------------------------------------------------------------------------- */
/* Wildlife                                                                    */
/* -------------------------------------------------------------------------- */

export const MARMOT = {
  stand: spr([
    '..NNN...',
    '.Nnnnn..',
    '.nnnnkw.',
    '.nnnnnwk',
    '..nnnn..',
    '.nnooon.',
    'nnnooonn',
    '.nnooon.',
    '.nnooon.',
    '.nnnnnn.',
    'NN...NN.',
  ]),
  graze: spr([
    '........NN.',
    '..nnnnnnnnn',
    '.nnnnnnnnkw',
    'nnooooonnnk',
    '.nnnnnnnn..',
    '.NN...NN...',
  ]),
  peek: spr(['.NNN..', 'nnnkw.', 'nnnnwk']),
}

export const COW = {
  stand: spr([
    '...............w.w.',
    '..............wddd.',
    '..ddwwwwddddddddkdd',
    '.dddwwwwwddddddddww',
    'd.ddwwwwddddwwwddkw',
    'd.dddwwdddddwwwdd..',
    '..dddddddddddddY...',
    '...dddddddddddd....',
    '...dd.dd....dd.dd..',
    '...dd.dd....dd.dd..',
    '...kk.kk....kk.kk..',
  ]),
  graze: spr([
    '...................',
    '...................',
    '..ddwwwwdddddddd...',
    '.dddwwwwwddddddddw.',
    'd.ddwwwwddddwwwdddw',
    'd.dddwwdddddwwwddkd',
    '..dddddddddddddddww',
    '...dddddddddddd.Ykw',
    '...dd.dd....dd.dd..',
    '...dd.dd....dd.dd..',
    '...kk.kk....kk.kk..',
  ]),
}

export const FOX = {
  stand: spr([
    '............kk..',
    '............RRk.',
    '...........RRkRR',
    '...RRRRRRRRRRwwk',
    '.RRRRRRRRRRRww..',
    'RRRR.RRRRRRRR...',
    'wR...kk....kk...',
    '.....k.k...k.k..',
  ]),
  trot: spr([
    '............kk..',
    '............RRk.',
    '...........RRkRR',
    '...RRRRRRRRRRwwk',
    '.RRRRRRRRRRRww..',
    'RRRR.RRRRRRRR...',
    'wR..kk.....k.k..',
    '...k...k..k...k.',
  ]),
}

export const SQUIRREL = {
  sit: spr([
    'RRR......',
    'RRRR..R.R',
    'R..R.RRRR',
    'R..R.RkRR',
    'RR.RRRRRw',
    '.RRRRwRR.',
    '..RRRwR..',
    '..RRRRR..',
    '..kk.kk..',
  ]),
  run: spr([
    'RR.......',
    'RRR...R.R',
    '.RRRRRRkR',
    '..RRRRRRw',
    '.RRRRRR..',
    '.k.k.k.k.',
  ]),
}

export const DEER = {
  alert: spr([
    '..........N.N.',
    '..........NNN.',
    '.........dddd.',
    '.........ddkdd',
    '.........ddddk',
    '..........dd..',
    '.wdddddddddd..',
    'wwdddddddddd..',
    '.wdddddddddd..',
    '..dd.d...dd.d.',
    '..d..d...d..d.',
    '..d..d...d..d.',
    '..k..k...k..k.',
  ]),
  graze: spr([
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '.wdddddddddd..',
    'wwddddddddddd.',
    '.wdddddddddddd',
    '..dd.d...dd.dd',
    '..d..d...d..dk',
    '..d..d...d....',
    '..k..k...k....',
  ]),
  run: spr([
    '..........N.N.',
    '..........NNN.',
    '.........dddd.',
    '.........ddkdd',
    '.........ddddk',
    '..........dd..',
    '.wdddddddddd..',
    'wwdddddddddd..',
    '.wdddddddddd..',
    '.dd.......dd..',
    'dd.........dd.',
    'k...........k.',
  ]),
}

export const IBEX = {
  stand: spr([
    '......hHhHh.....',
    '.....hH...hHh...',
    '....hh......hh..',
    '............iih.',
    '...........iiiki',
    '...........iiiiI',
    '..iiiiiiiiiiiI..',
    '.iiiiiiiiiiiIh..',
    'IiiiiiiiiiiiI...',
    '.iiiiiiiiiii....',
    '..ii.ii...ii.ii.',
    '..ii.ii...ii.ii.',
    '..kk.kk...kk.kk.',
  ]),
  hop: spr([
    '......hHhHh.....',
    '.....hH...hHh...',
    '....hh......hh..',
    '............iih.',
    '...........iiiki',
    '...........iiiiI',
    '..iiiiiiiiiiiI..',
    '.iiiiiiiiiiiIh..',
    'IiiiiiiiiiiiI...',
    '.iiiiiiiiiii....',
    '.ii........ii...',
    'ii..........ii..',
  ]),
}

export const CHAMOIS = {
  stand: spr([
    '..........k.k',
    '..........kk.',
    '.........wkw.',
    '.........wwkw',
    '..........ww.',
    '.NNNNNNNNNN..',
    'NNNNNNNNNNN..',
    '.NNNNNNNNNN..',
    '.NN.N...N.NN.',
    '.N..N...N..N.',
    '.k..k...k..k.',
  ]),
  run: spr([
    '..........k.k',
    '..........kk.',
    '.........wkw.',
    '.........wwkw',
    '..........ww.',
    '.NNNNNNNNNN..',
    'NNNNNNNNNNN..',
    '.NNNNNNNNNN..',
    'NN.......NN..',
    'k.........NN.',
  ]),
}

export const EAGLE = {
  glide: spr([
    'NN.................NN',
    '.NNNN...........NNNN.',
    '...NNNNN.yNy.NNNNN...',
    '.......NNNNNNN.......',
    '.........NnN.........',
  ]),
  up: spr([
    'NN.................NN',
    '.NN...............NN.',
    '..NN.............NN..',
    '...NNN...yNy...NNN...',
    '.....NNNNNNNNNNN.....',
    '.........NnN.........',
  ]),
  down: spr([
    '.........yNy.........',
    '....NNNNNNNNNNNNN....',
    '..NNN...........NNN..',
    '.NN...............NN.',
    'NN.................NN',
  ]),
}

export const CHOUGH = {
  stand: spr(['...kk..', '..kkkkY', '.kkkkk.', 'kkkkkk.', '.kkkk..', '..r.r..']),
  hop: spr(['...kk..', '..kkkkY', '.kkkkk.', 'kkkkkk.', '.kkkk..', '..rr...']),
  fly: spr(['.kk...kk.', '..kkkkkkY', '....kk...']),
}

export const PTARMIGAN = {
  winter: spr(['.....rk.', '....wwwk', '.k.wwwwk', 'kwwwwwww', '.wwwwwww', '..wwwww.', '...w.w..']),
  summer: spr(['.....rk.', '....ooon', '.k.onoon', 'konooono', '.ooonoow', '..wwwww.', '...w.w..']),
}

export const HARE = {
  winter: spr([
    '......kk..',
    '......ww..',
    '.......ww.',
    '......wwww',
    '..wwwwwwkw',
    '.wwwwwwwww',
    'wwwwwwwww.',
    '.ww...ww..',
  ]),
  summer: spr([
    '......kk..',
    '......oo..',
    '.......oo.',
    '......oooo',
    '..ooooookw',
    '.oooooooon',
    'woooooooo.',
    '.oo...oo..',
  ]),
}

export const BUTTERFLY = {
  open: spr(['w.k.w', 'wrkrw', 'wwkww', '.w.w.']),
  closed: spr(['..k..', '.wkw.', '.rkr.', '..k..']),
}

const owlRows = (eyes: string) => [
  'N.....N',
  'NnnnnnN',
  eyes,
  'nnnNnnn',
  'nooooon',
  'nonoonn',
  'nooooon',
  '.nooon.',
  '..k.k..',
]
export const OWL = {
  left: spr(owlRows('nkYnkYn')),
  center: spr(owlRows('nYknkYn')),
  right: spr(owlRows('nYknYkn')),
  blink: spr(owlRows('nNNnNNn')),
}

export const ROBIN = {
  stand: spr(['..nnn.', '.nRRkn', 'nnRRRk', 'nnRRR.', '.nnww.', '..k.k.']),
  hop: spr(['..nnn.', '.nRRkn', 'nnRRRk', 'nnRRR.', '.nnww.', '..kk..']),
}

export const HEDGEHOG = {
  walk: spr(['..NnNnN....', '.NnNnNnN...', 'NnNnNnNnto.', 'NNNNNNNtttk', '.k..k..k...']),
  ball: spr(['.NnNn..', 'NnNnNn.', 'nNnNnNn', '.NnNnN.', '..nNn..']),
}

export const YETI = {
  stand: spr([
    '....wwwww.....',
    '...wwwwwww....',
    '..wwGGGGGww...',
    '..wGkGGkGGw...',
    '..wGGGGGGGw...',
    '..wwGrrrGww...',
    '.wwwwwwwwwwww.',
    'wwwwwwwwwwwwww',
    'wwWwwwwwwwwWww',
    'ww.wwwwwwww.ww',
    'Gw.wwwwwwww.wG',
    '...wwwwwwww...',
    '...wwwWWwww...',
    '...www..www...',
    '...www..www...',
    '..GGGG..GGGG..',
  ]),
  roar: spr([
    'G...wwwww...G.',
    'w..wwwwwww..w.',
    'w.wwGGGGGww.w.',
    'wwwGkGGkGGwww.',
    '.wwGGGGGGGww..',
    '..wGrrrrrGw...',
    '.wwwGrrrGwwww.',
    '.wwwwwwwwwww..',
    '..wwwwwwwwww..',
    '...wwwwwwww...',
    '...wwwwwwww...',
    '...wwwwwwww...',
    '...wwwWWwww...',
    '...www..www...',
    '...www..www...',
    '..GGGG..GGGG..',
  ]),
}

export const EDELWEISS = spr(['...w...', '.w.w.w.', '..wyw..', 'wwyyyww', '..wyw..', '.w.e.w.', '...e...'])

/* -------------------------------------------------------------------------- */
/* Flora (palette slots)                                                       */
/* -------------------------------------------------------------------------- */

export const SPRUCE = spr([
  '.....1.....',
  '....121....',
  '....111....',
  '...12111...',
  '...11121...',
  '....111....',
  '...11111...',
  '..1121111..',
  '..1111121..',
  '...11111...',
  '..1111111..',
  '.112111211.',
  '.111111111.',
  '..1111111..',
  '.111111111.',
  '11121111211',
  '11111111111',
  '.111111111.',
  '11111111111',
  '12111121111',
  '11111111111',
  '.....8.....',
  '.....8.....',
  '....888....',
])

export const SPRUCE_SMALL = spr([
  '...1...',
  '..121..',
  '..111..',
  '.11211.',
  '..111..',
  '.11111.',
  '1121111',
  '.11111.',
  '1111121',
  '1211111',
  '1111111',
  '...8...',
  '...8...',
  '..888..',
])

export const BEECH_BRANCHES = spr([
  '.............',
  '....8....8...',
  '..8..8..8....',
  '...8.8.8..8..',
  '....8888.8...',
  '.8...888.8...',
  '..8..888.....',
  '...8.888.8...',
  '....8888.8...',
  '.....888.....',
  '.....888.....',
  '.....888.....',
  '.....888.....',
  '.....888.....',
  '.....888.....',
  '....88888....',
])
export const BEECH_CROWN = spr([
  '....33433....',
  '..334433443..',
  '.33443344333.',
  '3344334433433',
  '3443344334443',
  '3334433443343',
  '3433343334433',
  '.3343334433..',
  '..33333333...',
  '....3333.....',
])

export const LARCH_BRANCHES = spr([
  '...........',
  '.....8.....',
  '.....8.....',
  '....888....',
  '.....8.....',
  '...8.8.8...',
  '....888....',
  '.....8.....',
  '..8..8..8..',
  '...8.8.8...',
  '....888....',
  '.8...8...8.',
  '..8..8..8..',
  '...8888....',
  '.....8.....',
  '8....8....8',
  '.8...8...8.',
  '..8.888.8..',
  '.....8.....',
  '.....8.....',
  '.....8.....',
  '....888....',
])
export const LARCH_CROWN = spr([
  '.....5.....',
  '....565....',
  '....555....',
  '...55655...',
  '...56555...',
  '....555....',
  '..5556555..',
  '..5655565..',
  '...55555...',
  '.555655555.',
  '.556555655.',
  '..5555555..',
  '5556555565.',
  '5655556555.',
  '.55555555..',
  '55565556555',
  '56555655565',
  '.555555555.',
])

export const CEMBRA = spr([
  '...11......',
  '..1121..11.',
  '.11111.1121',
  '1121111111.',
  '.111.1211..',
  '..1..111...',
  '...1111.11.',
  '.112118.121',
  '11111.81111',
  '.1.1..8.11.',
  '.....88....',
  '.....8.....',
  '.....8.....',
  '....888....',
])

export const ORCHARD_BRANCHES = spr([
  '...........',
  '...8...8...',
  '..8.8.8....',
  '....888.8..',
  '.8..88.8...',
  '..8.88.....',
  '....88.....',
  '....88.....',
  '....88.....',
  '....88.....',
  '....88.....',
  '...8888....',
])
export const ORCHARD_CROWN = spr([
  '...3343....',
  '.33434433..',
  '3343343343.',
  '3434433434.',
  '.33433433..',
  '...3333....',
])
export const ORCHARD_BLOSSOM = spr([
  '...7..7....',
  '.7..7...7..',
  '7...7.7..7.',
  '.7.7...7.7.',
  '..7..7..7..',
  '....7......',
])

export const SHRUB = spr(['..1&12..', '.12111&1', '1&11211.', '11111111'])

export const ROCKS = {
  small: spr(['.++#..', '+####-', '##---.']),
  medium: spr(['...++#....', '.++####-..', '+#####---.', '######----', '.--------.']),
  boulder: spr([
    '.....+++##.....',
    '...++#####--...',
    '..+########--..',
    '.+##########--.',
    '+############--',
    '###########----',
    '#############--',
    '.-------------.',
  ]),
  marker: spr(['...++#....', '.++rwr#-..', '+##rwr#--.', '######----', '.--------.']),
}

export const BURROW = spr(['...nnn...', '..nzzzn..', '.nnzzznn.', 'nnnnnnnnn'])

/* -------------------------------------------------------------------------- */
/* Buildings                                                                   */
/* -------------------------------------------------------------------------- */

export const RIFUGIO = spr([
  '...............KK...............',
  '.............KKggKK.............',
  '...........KKggggggKK...........',
  '.........KKggggggggggKK....zz...',
  '.......KKggggggggggggggKK..mm...',
  '.....KKggggggggggggggggggKKmm...',
  '...KKggggggggggggggggggggggKK...',
  '.KKggggggggggggggggggggggggggKK.',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '..nnnnnnnnnnnnnnnnnnnnnnnnnnnn..',
  '..nNnnrqqrnnnnNnnnnnnrqqrnnnNn..',
  '..nNnnwqqwnnnnNnnnnnnwqqwnnnNn..',
  '..nNnnrqqrnnnnNnnnnnnrqqrnnnNn..',
  '..nnnnnnnnnnnnnnnnnnnnnnnnnnnn..',
  '..NNNNNNNNNNNNNNNNNNNNNNNNNNNN..',
  '..mMmmKmmMmmmKmmMmmmKmmmMmmKmm..',
  '..mmKmmmMmmKmmmmmmmmmmKmmMmmmm..',
  '..MmmmmrqqrmmmmNNNNmmmmMmmmKmm..',
  '..mmKmmwqqwmMmmNNNNmmmmmmKmmmM..',
  '..mMmmmrqqrmmmmNNyNmmMmmmmmmmm..',
  '..mmmKmmmmmmKmmNNNNmmmmKmmMmmm..',
  '..mMmmmmMmmmmmmNNNNmmMmmmmmmKm..',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
])

export const BIVACCO = spr([
  '.......rrrrrr.......',
  '.....rrRRRRRRrr.....',
  '...rrRRrrrrrrRRrr...',
  '..rRRrrrrrrrrrrRRr..',
  '.rRrrrrrrrrrrrrrrRr.',
  '.rRrrqqrrrrrrrrrrRr.',
  'rRrrrqqrrrrrNNNrrrRr',
  'rRrrrrrrrrrrNNNrrrRr',
  'rRrrrrrrrrrrNyNrrrRr',
  'rRrrrrrrrrrrNNNrrrRr',
  'KKKKKKKKKKKKKKKKKKKK',
])

export const HOUSE = spr([
  '..........KK..........',
  '........KKggKK........',
  '......KKggggggKK......',
  '....KKggggggggggKK....',
  '..KKggggggggggggggKK..',
  'KKKKKKKKKKKKKKKKKKKKKK',
  '..nnnnnnnnnnnnnnnnnn..',
  '..nnnrqqrnnnnrqqrnnn..',
  '..nnnwqqwnnnnwqqwnnn..',
  '..nnnrqqrnnnnrqqrnnn..',
  '.NNNNNNNNNNNNNNNNNNNN.',
  '.NrPrNrPrNrPrNrPrNrPN.',
  '.N.N.N.N.N.N.N.N.N.NN.',
  '..vvvvvvvvvvvvvvvvvv..',
  '..vvvrqqrvvvvvNNNvvv..',
  '..vvvwqqwvvvvvNNNvvv..',
  '..vvvrqqrvvvvvNyNvvv..',
  '..vvvvvvvvvvvvNNNvvv..',
  'KKKKKKKKKKKKKKKKKKKKKK',
])

export const CHURCH = spr([
  '......M......',
  '.....MMM.....',
  '......M......',
  '.....KgK.....',
  '.....KgK.....',
  '....KgggK....',
  '....KgggK....',
  '...KgggggK...',
  '...KgggggK...',
  '..KgggggggK..',
  '..KKKKKKKKK..',
  '..vvvvvvvvv..',
  '..vvkvvvkvv..',
  '..vvkvvvkvv..',
  '..vvvvvvvvv..',
  '..vvvvwvvvv..',
  '..vvvwkwvvv..',
  '..vvvvwvvvv..',
  '..vvvvvvvvv..',
  '..vvvvvvvvv..',
  '..vvvvqvvvv..',
  '..vvvvqvvvv..',
  '..vvvvvvvvv..',
  '..vvvvvvvvv..',
  '..vvvvNvvvv..',
  '..vvvNNNvvv..',
  '..vvvNNNvvv..',
  'KKKKKKKKKKKKK',
])

export const CROSS = spr([
  '....mMm....',
  '....mMm....',
  'mmmmmMmmmmm',
  'MMMMMMMMMMM',
  'mmmmmMmmmmm',
  '....mMm....',
  '....mMm....',
  '....mMm....',
  '....mMm....',
  '....mMm....',
  '....mMm....',
  '....mMm....',
  '....mMm....',
  '...KmMmK...',
  '..KKKKKKK..',
  '.KKKKKKKKK.',
])

export const BENCH = spr(['nnnnnnnn', 'NNNNNNNN', '.N....N.', '.N....N.'])

/** Sprites that receive automatic snow caps in winter. */
export const SNOW = new Map<Sprite, Sprite>()
export function snowFor(sprite: Sprite): Sprite {
  let s = SNOW.get(sprite)
  if (!s) {
    s = snowCap(sprite, '8qyrwRNnkzmM')
    SNOW.set(sprite, s)
  }
  return s
}

const LIGHTS = new Map<Sprite, Sprite>()
export function lightsFor(sprite: Sprite): Sprite {
  let s = LIGHTS.get(sprite)
  if (!s) {
    s = lightsOf(sprite)
    LIGHTS.set(sprite, s)
  }
  return s
}


/* -------------------------------------------------------------------------- */
/* Climber: extra modes                                                        */
/* -------------------------------------------------------------------------- */

/** Windsurfer leaning back, hands forward on the boom. Board and sail are drawn in code. */
export const SURFER = [
  spr([
    '...YYYY.....',
    '..YYYYYY....',
    '..YYYYYYYY..',
    '...Nsssks...',
    '...Nssssss..',
    '....ssss....',
    '...cBBBc....',
    '...BBBBBsss.',
    '...BBBBB..s.',
    '....KKKK....',
    '....KKKK....',
    '....ss.ss...',
    '...ss...ss..',
    '...ss...ss..',
    '..ss.....ss.',
  ]),
  spr([
    '...YYYY.....',
    '..YYYYYY....',
    '..YYYYYYYY..',
    '...Nsssks...',
    '...Nssssss..',
    '....ssss....',
    '...cBBBc....',
    '...BBBBBss..',
    '...BBBBB.ss.',
    '....KKKK....',
    '....KKKK....',
    '....ss.ss...',
    '....ss.ss...',
    '...ss...ss..',
    '..ss.....ss.',
  ]),
]

/** Cyclist upper body; the bike and pedalling legs are drawn in code. Hip at (2, 9), hands at (10, 7). */
export const BIKER = spr([
  '....RRRR...',
  '...RRRRRR..',
  '...RkRRRRR.',
  '....Nssks..',
  '.....sssss.',
  '..UUUUU....',
  '.UUUUUUUU..',
  '.UUUUUUUUss',
  '.UUUUUU....',
  '.kkkk......',
])

/**
 * Climbing, head and body only (the arms and legs are drawn in code, reaching for holds): facing
 * the rock on the right, rucksack on his back. Shoulder at (5, 5), hip at (4, 9).
 */
export const CLIMB_TORSO = spr([
  '...rrr...',
  '..rrrrr..',
  '..wwwww..',
  '..Nsssk..',
  '...sss...',
  '.YYbbbb..',
  '.YYbbbbb.',
  '.YYbbbb..',
  '..Ybbbb..',
  '...nnn...',
])

/** Abseiling: facing the rock (on the left), leaning out, feet on the wall. */
export const ABSEIL = [
  spr([
    '.....rrrr....',
    '....rrrrrr...',
    '....wwwwww...',
    '....skssN....',
    '...ssssssN...',
    '....ssss.YY..',
    '.....bbbbYYY.',
    '...sbbbbbYYY.',
    '.....bbbbYYY.',
    '.....nnnnYY..',
    '..nnnnnn.....',
    'kknn.........',
    'kk...........',
  ]),
  spr([
    '.....rrrr....',
    '....rrrrrr...',
    '....wwwwww...',
    '....skssN....',
    '...ssssssN...',
    '....ssss.YY..',
    '.....bbbbYYY.',
    '....sbbbbYYY.',
    '.....bbbbYYY.',
    '.....nnnnYY..',
    '...nnnnnn....',
    '.kknnn.......',
    '.kk..........',
  ]),
]

/** Mid-air leap and a rather undignified dangle on the rope. */
export const LEAP = spr([
  '..s.......s.',
  '..b..YYYY.b.',
  '..b.YYYYYYb.',
  '..bbYYYYYYYb',
  '...bNsssks..',
  '....Nssssss.',
  '.....ssss...',
  '..YYY.bbb...',
  '.YYYYbbbbb..',
  '.YYYYbbbbb..',
  '.YYYYbbbbb..',
  '..YYYnnnnn..',
  '....nn...nn.',
  '...nn.....nn',
  '..rr.......r',
  '.kk.........',
])
export const HANG = spr([
  '.....ss.....',
  '.....bb.....',
  '....bYYY....',
  '...YYYYYY...',
  '...YNsssk...',
  '....Nssss...',
  '..YYYbbb....',
  '.YYYYbbbbb..',
  '.YYYYbbbbb..',
  '..YYYnnnnn..',
  '.....nn.nn..',
  '.....nn.nn..',
  '.....rr.rr..',
  '.....kk.kk..',
])

/**
 * Scrambling: helmet on, leaning into the rock (on the right), rucksack on his back. The arms and
 * legs are drawn in code so hands and boots land on the rock steps. Hip at (3, 8), shoulder (6, 5).
 */
export const SCRAMBLER = spr([
  '.......YYY.',
  '......YYYYY',
  '..YYY.YYYYY',
  '.YYYYbNssks',
  '.YYYYbbsss.',
  'YYYYbbbbb..',
  '.YYbbbbBb..',
  '..bbbbbb...',
  '.nnnnn.....',
])

/* -------------------------------------------------------------------------- */
/* Coast & countryside                                                         */
/* -------------------------------------------------------------------------- */

export const UMBRELLA_PINE = spr([
  '....1121112121......',
  '..112121211121121...',
  '.11211211121121121..',
  '1121112111211121121.',
  '.111211112111211211.',
  '...11.1111.111.11...',
  '.........8..........',
  '........88..........',
  '........8...........',
  '.......88...........',
  '.......8............',
  '.......8............',
  '......88............',
  '......8.............',
  '......8.............',
  '......8.............',
  '.....888............',
])

const UMBRELLA_ROWS = [
  '.....rww.....',
  '...rrwwrrw...',
  '..rrwwrrwwr..',
  '.rrwwrrwwrrw.',
  'rrwwrrwwrrwwr',
  '......M......',
  '......M......',
  '......M......',
  '......M......',
  '......M......',
  '......M......',
  '......M......',
]
export const BEACH_UMBRELLAS = [
  spr(UMBRELLA_ROWS),
  spr(UMBRELLA_ROWS.map((r) => r.replace(/r/g, 'b'))),
  spr(UMBRELLA_ROWS.map((r) => r.replace(/r/g, 'Y').replace(/w/g, 'B'))),
]

export const GRANITE = spr([
  '.....uuujj......',
  '...uuujjjjjJ....',
  '..uujjjjjjjjJ...',
  '.ujjjjjjjjjjJJ..',
  'ujjjjjjJjjjjjJJ.',
  'jjjjjjjjjjjjjJJJ',
  'jjjjJjjjjjjjJJJJ',
  '.JJJJJJJJJJJJJJ.',
])
export const GRANITE_SMALL = spr(['..uujj..', '.ujjjjJ.', 'ujjjjjJJ', 'jjjJjJJJ', '.JJJJJJ.'])

export const OLIVE = spr([
  '...xxXxx.....',
  '.xxXxxxXxxx..',
  'xXxxXxxXxxXx.',
  'xxXxxxXxxxXxx',
  '.xxxXxxxXxx..',
  '...xx.Nxx....',
  '.....NN......',
  '....N.N......',
  '....NNN......',
  '.....NN......',
  '....NNNN.....',
])

export const CYPRESS = spr([
  '..1..',
  '.121.',
  '.111.',
  '.112.',
  '11211',
  '11121',
  '12111',
  '11211',
  '11111',
  '12111',
  '11121',
  '11111',
  '.111.',
  '..8..',
])

export const NURAGHE = spr([
  '...gGgGgGg....',
  '...GgGgGgG....',
  '..gGgGgGgGg...',
  '..GgGgGgGgG...',
  '..gGgGgGgGg...',
  '.gGgGgGgGgGg..',
  '.GgGgGgGgGgG..',
  '.gGgGgGgGgGg..',
  'gGgGgGgGgGgGg.',
  'GgGgGkkGgGgGg.',
  'gGgGgkkgGgGgG.',
  'GgGgGkkGgGgGg.',
])

export const FARMHOUSE = spr([
  '....dddddddddd....',
  '..dddddddddddddd..',
  'dddddddddddddddddd',
  '.vvvvvvvvvvvvvvvv.',
  '.vvqqvvvvvvvvqqvv.',
  '.veqqevvvvvveqqev.',
  '.vvvvvvvNNvvvvvvv.',
  '.vvvvvvvNNvvvvvvv.',
  '.vvvvvvvNNvvvvvvv.',
  'KKKKKKKKKKKKKKKKKK',
])

export const CAIRN = spr(['...g...', '..gGg..', '..ggg..', '.gGggg.', '.ggGgg.', 'gggggGg', 'GgggGgg'])

export const REEDS = spr(['.n..n...', '.1.n1..n', '.1.11.n1', '11.1.111', '1.11.1.1', '1111111.', '.1.1.1..'])

/* -------------------------------------------------------------------------- */
/* Animals with procedural legs: bodies only (facing right)                   */
/* -------------------------------------------------------------------------- */

export const Q = {
  fox: spr([
    '............k..k.',
    '............RR.R.',
    '...........RRRRR.',
    '..R........RRkRRk',
    'RRRRRRRRRRRRRwwww',
    'wRRRRRRRRRRRRw...',
    '.RRRRRRRRRRRw....',
    '...RRRRRRRR......',
  ]),
  deer: spr([
    '..........N.N.',
    '..........NNN.',
    '.........dddd.',
    '.........ddkdd',
    '.........ddddk',
    '.........wdd..',
    '.wdddddddddd..',
    'wwddddddddddd.',
    '.wdddddddddd..',
    '..ooooooooo...',
  ]),
  deerGraze: spr([
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '.wdddddddddd..',
    'wwddddddddddd.',
    '.wddddddddddd.',
    '..oooooooooddd',
    '...........ddd',
    '...........ddd',
    '............dk',
  ]),
  chamois: spr([
    '..........k.k',
    '..........kk.',
    '.........wkkw',
    '.........wwkw',
    '..........ww.',
    '.NNNNNNNNNNN.',
    'NNNNNNNNNNNN.',
    '.NNNNNNNNNN..',
    '..nnnnnnnn...',
  ]),
  ibex: spr([
    '.......hHhH.....',
    '.....hH....hh...',
    '....hh.......h..',
    '...h.........ih.',
    '............iiki',
    '............iiiI',
    '..iiiiiiiiiiiI..',
    '.iiiiiiiiiiiIh..',
    'IiiiiiiiiiiiI...',
    '.iiiiiiiiiii....',
    '..IIIIIIIII.....',
  ]),
  cow: spr([
    '...............w.w.',
    '..............wddd.',
    '..ddwwwwddddddddkdd',
    '.dddwwwwwddddddddww',
    'd.ddwwwwddddwwwddkw',
    'd.dddwwdddddwwwdd..',
    '..dddddddddddddY...',
    '...ddddddddddddd...',
  ]),
  cowGraze: spr([
    '...................',
    '...................',
    '..ddwwwwdddddddd...',
    '.dddwwwwwddddddddw.',
    'd.ddwwwwddddwwwdddw',
    'd.dddwwdddddwwwddkd',
    '..dddddddddddddddww',
    '...dddddddddddd.Ykw',
  ]),
  sheep: spr([
    '..wWwWwWw....',
    '.wWwWwWwWwvk.',
    'wWwWwWwWwWvvv',
    'wwWwWwWwWwWv.',
    '.wWwWwWwWw...',
  ]),
  sheepGraze: spr([
    '..wWwWwWw....',
    '.wWwWwWwWw...',
    'wWwWwWwWwWw..',
    'wwWwWwWwWwWv.',
    '.wWwWwWwWwvvk',
    '..........vv.',
  ]),
}

export const FLAMINGO = {
  stand: spr([
    '......ff.',
    '.....fkwk',
    '.....f...',
    '....f....',
    '.....f...',
    '......f..',
    '.fffffff.',
    'FfffffFf.',
    '.FFFFFF..',
  ]),
  feed: spr([
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.fffffff.',
    'FfffffFff',
    '.FFFFFF.f',
    '........f',
    '........f',
    '.......kw',
  ]),
}

export const BUTTERFLY_HALF = spr(['.w.w.', 'wrkrw', '.wkw.', '..w..'])
