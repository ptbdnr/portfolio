import type { SpeciesId } from '../../shared/species.ts'
import { SPECIES_BY_ID } from '../content/species.ts'
import { bakeText, textWidth } from './engine/font.ts'
import { hash } from './engine/math.ts'
import { FOX, HEDGEHOG, ROBIN, bake, spr, type Sprite } from './engine/sprites.ts'

const BUS = spr([
  '..rrrrrrrrrrrrrrrrrrrrrrrr.',
  '.rqqrqqrqqrqqrqqrqqrqqrqqr.',
  '.rqqrqqrqqrqqrqqrqqrqqrqqr.',
  '.rrrrrrrrrrrrrrrrrrrrrrrrr.',
  '.ryyyyyyyyyyyyyyyyyyyyyyyr.',
  '.rqqrqqrqqrqqrqqrqqrqqrqqr.',
  'rrqqrqqrqqrqqrqqrqqrqqrqqr.',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrr',
  'rrkkkrrrrrrrrrrrrrrrrkkkrrr',
  '..kGk................kGk...',
])

export const SCENE_W = 200
export const SCENE_H = 84

/*
 * The street at home, after London's late-Victorian terraces: handed pairs of two-storey
 * late-Victorian houses with canted bays, arched porches (two front doors where a house became two
 * flats), a pointed slate turret over every bay, chimney stacks full of clay pots on the party
 * walls, slate roofs with terracotta ridges and low front walls with tiled paths. Alexandra Palace
 * and its mast stand on the hill behind, between the turrets.
 */
const HOUSE_W = 26
const FIRST_X = -13
const HOUSE_COUNT = 9
const OUR_HOUSE = 4
const OUR_X = FIRST_X + OUR_HOUSE * HOUSE_W
const WALL_Y = 66
const PAVEMENT_Y = 69
const ROAD_Y = 73
const BUS_Y = 66
/** Façade rows, top to bottom. */
const Y = { ridge: 24, eaves: 31, upper: 33, band: 47, ground: 49, plinth: 64 } as const
const LAMP_X = 16
/** Alexandra Palace's centre, in the gap between two pairs of turrets; the mast is on its south-east tower. */
const PALACE_X = 118
const MAST = { x: PALACE_X + 13, top: 0 }
const MOON = { x: 22, y: 5 }

const C = {
  slate: '#5d6679',
  slateLight: '#727d93',
  slateDark: '#4a5264',
  slateScale: '#535b6d',
  slateLightScale: '#677189',
  slateDarkScale: '#41485a',
  ridge: '#a9573a',
  ridgeLight: '#c8714c',
  gutter: '#2b2f3c',
  lead: '#8d96a6',
  stucco: '#efe7d4',
  stuccoShade: '#c8bea6',
  glass: '#4d6a87',
  glassSide: '#3a5068',
  glassLight: '#86a3bd',
  frame: '#f4f0e6',
  porch: '#3b302d',
  step: '#d3cec4',
  tileDark: '#2a2a33',
  tileLight: '#e6e1d6',
  pot: '#c4683e',
  potDark: '#8a4128',
  hedge: '#3f7a3e',
  hedgeLight: '#5f9f50',
  hedgeDark: '#2c5a30',
  pavement: '#c0c4cc',
  joint: '#a6abb5',
  kerb: '#dadde3',
  road: '#4a4f5c',
  roadLight: '#575d6b',
  iron: '#1f2129',
  brass: '#e0c060',
  warm: '#ffd27a',
  warmDim: '#e3a955',
  warmRail: '#b08a50',
}

type Brick = { base: string; light: string; dark: string; band?: string }
const BRICKS: Brick[] = [
  // Yellow London stock with red-brick bands, red brick, and two painted fronts.
  { base: '#c9a66d', light: '#dcbd86', dark: '#a8875b', band: '#a9553c' },
  { base: '#a9523a', light: '#bf684b', dark: '#86402d' },
  { base: '#e6dbc3', light: '#f3ebd9', dark: '#cbbda1' },
  { base: '#b5c6cf', light: '#cad8df', dark: '#9aacb7' },
]

type House = { brick: number; doors: string[]; garden: 'hedge' | 'bin' | 'flowers' | 'magnolia'; bin?: string; gate?: boolean }
/** Left to right. Two doors mean two flats, upstairs and down; ours is number 4. */
const HOUSES: House[] = [
  { brick: 0, doors: ['#2f5a46'], garden: 'hedge' },
  { brick: 0, doors: ['#2a3566', '#b8312f'], garden: 'bin', bin: '#2b2f3a', gate: true },
  { brick: 1, doors: ['#1f2129'], garden: 'hedge', gate: true },
  { brick: 1, doors: ['#e2b23c', '#2f5a46'], garden: 'bin', bin: '#3e7d45' },
  { brick: 0, doors: ['#2f6f6a', '#5a3d7a'], garden: 'magnolia' },
  { brick: 2, doors: ['#b8312f'], garden: 'hedge', gate: true },
  { brick: 0, doors: ['#1f2129', '#e2b23c'], garden: 'bin', bin: '#3b5ea8' },
  { brick: 3, doors: ['#2a3566'], garden: 'flowers', gate: true },
  { brick: 1, doors: ['#2f5a46', '#1f2129'], garden: 'hedge' },
]

type Glass = {
  x: number
  y: number
  w: number
  h: number
  rail: number
  house: number
  floor: 'ground' | 'upper' | 'fan' | 'attic'
  side: boolean
}
/** Who's in tonight: we always are, and a few of the neighbours. */
function isLit(g: Glass) {
  if (g.floor === 'attic') return g.house % 4 === 1
  if (g.floor === 'fan') return g.house === OUR_HOUSE || g.house === 7
  if (g.floor === 'ground') return g.house === OUR_HOUSE || (g.house * 7 + 3) % 4 === 0
  return (g.house * 5 + 1) % 3 === 0
}

type Fill = (x: number, y: number, w: number, h: number, c: string) => void
type Layer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

function layer(): Layer {
  const canvas = document.createElement('canvas')
  canvas.width = SCENE_W
  canvas.height = SCENE_H
  return { canvas, ctx: canvas.getContext('2d')! }
}

/** A fillRect that also remembers the highest thing drawn in each column (stars only show above it). */
function painter(ctx: CanvasRenderingContext2D, skyTop: Int16Array): Fill {
  return (x, y, w, h, c) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
    for (let k = Math.max(0, x); k < Math.min(SCENE_W, x + w); k++) if (y < skyTop[k]) skyTop[k] = y
  }
}

function dusk(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = 'rgba(12,16,44,0.56)'
  ctx.fillRect(0, 0, SCENE_W, SCENE_H)
  ctx.globalCompositeOperation = 'source-over'
}

/** Maps a house's own columns to the scene, mirroring every other house so the pairs are handed. */
function houseFrame(i: number, fill: Fill) {
  const x0 = FIRST_X + i * HOUSE_W
  const flip = i % 2 === 1
  const X = (lx: number, w: number) => (flip ? x0 + HOUSE_W - lx - w : x0 + lx)
  return { x0, X, R: (lx: number, y: number, w: number, h: number, c: string) => fill(X(lx, w), y, w, h, c) }
}

function paintRoof(fill: Fill) {
  // One continuous slate roof along the terrace, with a crested terracotta ridge.
  fill(0, Y.ridge, SCENE_W, Y.eaves - Y.ridge, C.slate)
  for (const y of [Y.ridge + 2, Y.ridge + 5]) fill(0, y, SCENE_W, 1, C.slateDark)
  for (let y = Y.ridge; y < Y.eaves; y++) {
    for (let x = 0; x < SCENE_W; x++) if (hash(x * 31 + y * 977, 3) < 0.1) fill(x, y, 1, 1, C.slateLight)
  }
  fill(0, Y.ridge - 1, SCENE_W, 1, C.ridge)
  for (let x = 1; x < SCENE_W; x += 4) fill(x, Y.ridge - 2, 1, 1, C.ridgeLight)
  fill(0, Y.eaves, SCENE_W, 1, C.gutter)
  for (let x = 0; x < SCENE_W; x++) fill(x, Y.eaves + 1, 1, 1, x % 2 ? C.stuccoShade : C.stucco)
}

function paintHouse(i: number, fill: Fill, windows: Glass[]) {
  const house = HOUSES[i]
  const b = BRICKS[house.brick]
  const { x0, X, R } = houseFrame(i, fill)
  const glass = (lx: number, y: number, w: number, h: number, floor: Glass['floor'], side = false) => {
    R(lx, y, w, h, side ? C.glassSide : C.glass)
    if (!side && w > 2) R(lx, y, 1, Math.min(3, h), C.glassLight)
    const rail = floor === 'fan' ? -1 : y + (h >> 1)
    if (rail >= 0) R(lx, rail, w, 1, C.frame)
    windows.push({ x: X(lx, w), y, w, h, rail, house: i, floor, side })
  }

  // Brick, lightly textured, with red bands on yellow stock brick and a darker plinth.
  R(0, Y.upper, HOUSE_W, Y.plinth + 2 - Y.upper, b.base)
  for (let y = Y.upper; y < Y.plinth; y++) {
    for (let x = x0; x < x0 + HOUSE_W; x++) {
      const n = hash(x * 97 + y * 7919, 5)
      if (n < 0.07) fill(x, y, 1, 1, b.dark)
      else if (n > 0.95) fill(x, y, 1, 1, b.light)
    }
  }
  if (b.band) for (const y of [Y.upper + 7, Y.ground + 8]) R(0, y, HOUSE_W, 1, b.band)
  R(0, Y.plinth, HOUSE_W, 2, b.dark)
  R(0, Y.band, HOUSE_W, 1, C.stucco)

  // The two-storey canted bay: sashes between stucco columns and a cornice between the floors.
  // Its turret is added once the chimney stacks are up (see paintTurret).
  for (const [top, h, floor] of [
    [Y.upper + 2, 9, 'upper'],
    [Y.ground + 3, 8, 'ground'],
  ] as const) {
    glass(4, top, 6, h, floor)
    glass(1, top, 2, h, floor, true)
    glass(11, top, 2, h, floor, true)
    R(3, top, 1, h, C.stucco)
    R(10, top, 1, h, C.stucco)
    R(0, top + h, 14, 1, C.stucco)
    R(1, top + h + 1, 12, 1, b.dark)
  }
  R(1, Y.upper, 12, 2, C.stucco)
  for (let lx = 1; lx < 13; lx += 2) R(lx, Y.upper + 1, 1, 1, C.stuccoShade)
  R(0, Y.band, 14, 1, C.stucco)
  R(0, Y.band + 1, 14, 1, C.stuccoShade)
  R(1, Y.ground, 12, 2, C.stucco)
  for (let lx = 2; lx < 12; lx += 3) R(lx, Y.ground + 1, 1, 1, C.stuccoShade)
  R(2, Y.ground + 2, 3, 1, C.stucco)
  R(9, Y.ground + 2, 3, 1, C.stucco)

  // The window over the porch.
  R(16, Y.upper, 7, 2, C.stucco)
  glass(17, Y.upper + 2, 5, 9, 'upper')
  R(16, Y.upper + 11, 7, 1, C.stucco)
  R(17, Y.upper + 12, 5, 1, b.dark)

  // The recessed, arched porch: keystone, stucco arch and imposts, the door(s) in the shade.
  R(16, Y.ground + 1, 7, 1, C.stucco)
  R(15, Y.ground + 2, 2, 1, C.stucco)
  R(22, Y.ground + 2, 2, 1, C.stucco)
  R(15, Y.ground + 3, 1, Y.plinth + 1 - (Y.ground + 3), C.stucco)
  R(23, Y.ground + 3, 1, Y.plinth + 1 - (Y.ground + 3), C.stucco)
  R(14, Y.ground + 4, 2, 1, C.stucco)
  R(23, Y.ground + 4, 2, 1, C.stucco)
  R(18, Y.ground, 3, 1, C.frame)
  R(19, Y.ground + 1, 1, 1, C.frame)
  R(17, Y.ground + 2, 5, 1, C.porch)
  R(16, Y.ground + 3, 7, Y.plinth + 1 - (Y.ground + 3), C.porch)
  const doorTop = Y.ground + 7
  if (house.doors.length === 2) {
    // Two front doors side by side: the house is two flats.
    house.doors.forEach((door, k) => {
      const lx = k === 0 ? 16 : 20
      glass(lx, Y.ground + 5, 3, 2, 'fan')
      R(lx, doorTop, 3, Y.plinth + 1 - doorTop, door)
      R(lx + 1, doorTop + 4, 1, 1, C.brass)
    })
  } else {
    glass(17, Y.ground + 5, 5, 2, 'fan')
    R(17, doorTop, 5, Y.plinth + 1 - doorTop, house.doors[0])
    R(18, doorTop + 1, 1, 2, C.porch)
    R(20, doorTop + 1, 1, 2, C.porch)
    R(19, doorTop + 4, 1, 1, C.brass)
  }
  R(16, Y.plinth + 1, 7, 1, C.step)
}

function paintStacks(fill: Fill) {
  // A stack on every party wall: the big ones between back-to-back bays serve the front rooms.
  for (let i = 1; i < HOUSE_COUNT; i++) {
    const big = i % 2 === 0
    const w = big ? 8 : 5
    const left = FIRST_X + i * HOUSE_W - (w >> 1)
    const top = big ? 16 : 18
    const b = BRICKS[HOUSES[i].brick > 1 ? 0 : HOUSES[i].brick]
    fill(left, top, w, Y.ridge - top, b.base)
    for (let y = top + 2; y < Y.ridge - 1; y++) {
      for (let x = left; x < left + w; x++) if (hash(x * 61 + y * 13, 8) < 0.12) fill(x, y, 1, 1, b.dark)
    }
    fill(left, top + 3, w, 1, b.dark)
    fill(left - 1, top, w + 2, 1, C.stucco)
    fill(left - 1, top + 1, w + 2, 1, C.stuccoShade)
    fill(left, Y.ridge - 1, w, 1, C.lead)
    for (let px = left; px + 1 < left + w; px += 3) {
      const ph = 2 + Math.floor(hash(px, 9) * 2)
      fill(px, top - ph, 2, ph, C.pot)
      fill(px, top - ph, 2, 1, C.potDark)
      fill(px + 1, top - ph + 1, 1, ph - 1, C.potDark)
    }
  }
}

/**
 * The turret over each bay: a steep, canted slate spire (lit, front and shaded faces, with lead on
 * the hips and every other course of slates cut as fish scales), a little round window and an
 * iron finial. It stands in front of the main roof and the chimney stacks.
 */
function paintTurret(i: number, fill: Fill, windows: Glass[]) {
  const { X } = houseFrame(i, fill)
  const bay = X(0, 14)
  const left = X(0, 13)
  const base = Y.eaves - 1
  // The bay's own cornice runs across in front of the terrace's gutter.
  for (let k = 0; k < 14; k++) {
    fill(bay + k, Y.eaves, 1, 1, C.stucco)
    fill(bay + k, Y.eaves + 1, 1, 1, k % 2 ? C.stuccoShade : C.stucco)
  }
  fill(left - 1, base, 15, 1, C.gutter)
  const courses = 14
  for (let k = 0; k < courses; k++) {
    const y = base - 1 - k
    const w = 13 - 2 * (k >> 1)
    const x0 = left + ((13 - w) >> 1)
    const hip = Math.floor(w / 3)
    for (let j = 0; j < w; j++) {
      const t = (j + 0.5) / w
      const lit = t < 0.34
      const shaded = t > 0.66
      const scale = k % 2 === 1 && (x0 + j) % 2 === 0
      let c = lit ? (scale ? C.slateLightScale : C.slateLight) : shaded ? (scale ? C.slateDarkScale : C.slateDark) : scale ? C.slateScale : C.slate
      if (w >= 5 && (j === hip || j === w - 1 - hip)) c = C.lead
      fill(x0 + j, y, 1, 1, c)
    }
  }
  // A little round window lighting the attic.
  const cx = left + 6
  const wy = base - 6
  fill(cx - 1, wy - 1, 3, 3, C.stucco)
  fill(cx, wy, 1, 1, C.glass)
  windows.push({ x: cx, y: wy, w: 1, h: 1, rail: -1, house: i, floor: 'attic', side: false })
  // The finial: an iron spike with a lead collar.
  const apex = base - courses
  fill(cx, apex, 1, 1, C.lead)
  fill(cx, apex - 4, 1, 4, C.iron)
  fill(cx - 1, apex - 2, 1, 1, C.lead)
  fill(cx + 1, apex - 2, 1, 1, C.lead)
}

function paintMagnolia(fill: Fill) {
  // Our little front-garden tree, in bloom whenever you visit.
  const x = OUR_X + 1
  fill(x + 4, 59, 1, 7, '#6b4a32')
  fill(x + 3, 60, 1, 1, '#6b4a32')
  fill(x + 5, 61, 1, 1, '#6b4a32')
  for (const [y, dx, w] of [
    [54, 2, 5],
    [55, 1, 7],
    [56, 0, 9],
    [57, 0, 9],
    [58, 1, 7],
    [59, 2, 2],
    [59, 6, 2],
  ] as const) {
    for (let k = 0; k < w; k++) {
      const n = hash((x + dx + k) * 13 + y * 101, 21)
      fill(x + dx + k, y, 1, 1, n < 0.22 ? '#fbe6f0' : n < 0.78 ? '#f2bcd4' : '#d98fb2')
    }
  }
}

function paintGarden(i: number, fill: Fill) {
  const house = HOUSES[i]
  const { x0, X, R } = houseFrame(i, fill)
  // Painted houses still have brick garden walls.
  const b = BRICKS[house.brick > 1 ? 1 : house.brick]
  if (house.garden === 'hedge') {
    R(0, WALL_Y - 5, 15, 5, C.hedge)
    for (let y = WALL_Y - 5; y < WALL_Y; y++) {
      for (let lx = 0; lx < 15; lx++) {
        const x = X(lx, 1)
        const n = hash(x * 41 + y * 7, 17)
        if (n < 0.18) fill(x, y, 1, 1, C.hedgeLight)
        else if (n > 0.85 || (y === WALL_Y - 5 && n < 0.4)) fill(x, y, 1, 1, y === WALL_Y - 5 ? C.hedge : C.hedgeDark)
      }
    }
  } else if (house.garden === 'bin') {
    // Wheelie bins: every London front garden has them.
    for (const [lx, c] of [
      [3, house.bin ?? '#2b2f3a'],
      [8, '#3b5ea8'],
    ] as const) {
      R(lx, WALL_Y - 5, 4, 5, c)
      R(lx - 1, WALL_Y - 6, 6, 1, c)
      R(lx, WALL_Y - 4, 4, 1, 'rgba(255,255,255,0.18)')
    }
  } else if (house.garden === 'flowers') {
    R(1, WALL_Y - 3, 13, 3, C.hedge)
    for (let lx = 1; lx < 14; lx++) if (hash(x0 + lx, 23) < 0.6) R(lx, WALL_Y - 3 - (lx % 2), 1, 1, ['#b48ad8', '#f2e27a', '#f08aa0'][lx % 3])
  } else paintMagnolia(fill)

  // A low front wall with stone coping, gate piers either side of the tiled path.
  R(0, WALL_Y, 15, 3, b.base)
  R(24, WALL_Y, 2, 3, b.base)
  R(0, WALL_Y, 15, 1, C.stuccoShade)
  R(24, WALL_Y, 2, 1, C.stuccoShade)
  for (let lx = 0; lx < 15; lx += 3) R(lx, WALL_Y + 2, 1, 1, b.dark)
  R(15, WALL_Y - 1, 1, 4, b.dark)
  R(23, WALL_Y - 1, 1, 4, b.dark)
  R(15, WALL_Y - 2, 1, 1, C.stucco)
  R(23, WALL_Y - 2, 1, 1, C.stucco)
  for (let lx = 16; lx < 23; lx++) {
    for (let y = WALL_Y; y < PAVEMENT_Y; y++) R(lx, y, 1, 1, (lx + y) % 2 ? C.tileDark : C.tileLight)
  }
  if (house.gate) {
    R(16, WALL_Y, 7, 1, C.iron)
    for (let lx = 16; lx < 23; lx += 2) R(lx, WALL_Y, 1, 2, C.iron)
  }
}

function paintStreet(fill: Fill) {
  fill(0, PAVEMENT_Y, SCENE_W, ROAD_Y - PAVEMENT_Y, C.pavement)
  for (let x = 4; x < SCENE_W; x += 9) fill(x, PAVEMENT_Y, 1, ROAD_Y - PAVEMENT_Y - 1, C.joint)
  fill(0, ROAD_Y - 1, SCENE_W, 1, C.kerb)
  fill(0, ROAD_Y, SCENE_W, SCENE_H - ROAD_Y, C.road)
  for (let y = ROAD_Y; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) if (hash(x * 7 + y * 211, 29) < 0.05) fill(x, y, 1, 1, C.roadLight)
  }
  for (let x = 6; x < SCENE_W; x += 16) fill(x, ROAD_Y + 6, 8, 1, '#e6e6dc')
}

function paintLamp(fill: Fill, night: boolean) {
  // A cast-iron London lamp post, with the bar the lamplighter leaned his ladder on.
  const x = LAMP_X
  fill(x - 1, PAVEMENT_Y - 1, 3, 2, C.iron)
  fill(x, 45, 1, PAVEMENT_Y - 45, C.iron)
  fill(x - 2, 49, 5, 1, C.iron)
  fill(x - 2, 44, 5, 1, C.iron)
  fill(x - 1, 41, 3, 3, night ? '#ffe9a0' : '#c0c8d2')
  fill(x - 2, 40, 5, 1, C.iron)
  fill(x, 39, 1, 1, C.iron)
}

function paintPlaneTree(fill: Fill) {
  // A London plane on the pavement: camouflage bark and a big, layered crown.
  const cx = 186
  for (let y = 44; y < PAVEMENT_Y; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      const n = hash(x * 53 + (y >> 1) * 17, 13)
      fill(x, y, 1, 1, n < 0.35 ? '#cfc9a2' : n < 0.72 ? '#9a9670' : '#6f6b52')
    }
  }
  fill(cx - 2, PAVEMENT_Y, 5, 1, '#5a4a3a')
  fill(cx - 4, 43, 3, 1, '#6f6b52')
  fill(cx + 2, 42, 3, 1, '#6f6b52')
  const lobes = [
    [cx, 35, 12, 8],
    [cx - 9, 40, 7, 5],
    [cx + 9, 39, 7, 6],
    [cx - 5, 30, 7, 5],
    [cx + 5, 29, 6, 5],
  ] as const
  for (let y = 22; y < 47; y++) {
    for (let x = cx - 17; x <= cx + 17; x++) {
      let best = 9
      let lit = 0
      for (const [lx, ly, rx, ry] of lobes) {
        const d = ((x - lx) / rx) ** 2 + ((y - ly) / ry) ** 2
        if (d < best) {
          best = d
          lit = (x - lx) / rx + (y - ly) / ry
        }
      }
      const n = hash(x * 29 + y * 131, 31)
      if (best > 1 || (best > 0.75 && n < 0.35)) continue
      const tone = lit + (n - 0.5) * 0.9
      fill(x, y, 1, 1, tone < -0.7 ? '#8cc46a' : tone < 0.1 ? '#5d9a48' : tone < 0.8 ? '#467d3a' : '#335f2f')
    }
  }
}

function paintBackground(fill: Fill, night: boolean) {
  // Alexandra Palace on its hill, the mast on its south-east tower.
  const hill = night ? '#17243a' : '#93b08e'
  const park = night ? '#132030' : '#7f9f7b'
  const body = night ? '#2e3a5e' : '#aebbcd'
  const roof = night ? '#26304f' : '#95a3b9'
  const dark = night ? '#1c2340' : '#8592a8'
  const glow = night ? '#e8c070' : '#8592a8'
  const glowDim = night ? '#a88a52' : '#9aa6ba'
  const P = PALACE_X
  for (let x = 0; x < SCENE_W; x++) {
    const crest = 20 + ((Math.max(0, Math.abs(x - P) - 30) / 70) ** 1.5) * 12
    fill(x, Math.round(crest), 1, 40, hill)
  }
  for (const [dx, w] of [
    [-27, 5],
    [-36, 6],
    [21, 5],
    [30, 6],
  ] as const) {
    const tx = P + dx
    const ty = Math.round(20 + ((Math.max(0, Math.abs(tx - P) - 30) / 70) ** 1.5) * 12) - 1
    fill(tx, ty, w, 3, park)
    fill(tx + 1, ty - 1, w - 2, 1, park)
  }
  // The long front, the great hall with its rose window in the middle, and a tower at each end.
  fill(P - 15, 15, 31, 6, body)
  fill(P - 15, 14, 31, 1, roof)
  for (let x = P - 13; x < P + 15; x += 3) fill(x, 17, 1, 1, (x * 7) % 5 === 1 ? glow : dark)
  fill(P - 8, 11, 17, 10, body)
  fill(P - 6, 10, 13, 1, roof)
  fill(P - 3, 9, 7, 1, roof)
  fill(P - 1, 13, 3, 3, glowDim)
  fill(P, 13, 1, 3, night ? glow : dark)
  fill(P - 1, 14, 3, 1, night ? glow : dark)
  fill(P - 15, 12, 6, 9, body)
  fill(P - 14, 11, 4, 1, roof)
  fill(P + 10, 12, 7, 9, body)
  fill(P + 10, 11, 7, 1, roof)
  fill(P + 12, 14, 1, 2, dark)
  fill(P + 15, 14, 1, 2, dark)
  // The lattice mast, with its aerial on top.
  const mast = night ? '#37426a' : '#7a8597'
  fill(MAST.x, MAST.top, 1, 4, mast)
  for (let y = MAST.top + 4; y < 11; y++) {
    fill(MAST.x - 1, y, 1, 1, mast)
    fill(MAST.x + 1, y, 1, 1, mast)
    if (y % 2 === 1) fill(MAST.x, y, 1, 1, mast)
  }
  fill(MAST.x - 2, 7, 5, 1, mast)

  // The next road up the Ladder: rooftops and chimneys stepping up the hill, and street trees.
  const roofs = night ? '#1b2342' : '#9caabd'
  const stacks = night ? '#161c36' : '#8a98ad'
  const trees = night ? '#162230' : '#86a281'
  for (let k = 0; k < 17; k++) {
    const x = k * 13 - 6
    const ry = 22 - (k >> 2)
    fill(x, ry, 13, 12, roofs)
    fill(x + 9, ry - 3, 3, 3, stacks)
    fill(x + 9, ry - 4, 1, 1, stacks)
    fill(x + 11, ry - 4, 1, 1, stacks)
  }
  for (const tx of [30, 58, 77, 160, 178]) {
    const ty = 20 - Math.floor(tx / 52)
    fill(tx - 3, ty, 7, 4, trees)
    fill(tx - 2, ty - 1, 5, 1, trees)
  }
}

function paintSky(fill: Fill, night: boolean) {
  const bands = night ? ['#0b1030', '#0f1638', '#141d43', '#1a254f', '#212e5b'] : ['#7fb8ec', '#92c3ef', '#a7cff2', '#bcdbf5', '#d2e7f7']
  bands.forEach((c, i) => fill(0, i * 6, SCENE_W, i === bands.length - 1 ? SCENE_H : 6, c))
  if (night) {
    fill(MOON.x + 1, MOON.y, 3, 1, '#f3f0dc')
    fill(MOON.x, MOON.y + 1, 5, 3, '#f3f0dc')
    fill(MOON.x + 1, MOON.y + 4, 3, 1, '#f3f0dc')
    fill(MOON.x + 1, MOON.y + 2, 1, 1, '#d8d4bc')
    fill(MOON.x + 3, MOON.y + 1, 1, 1, '#d8d4bc')
    return
  }
  for (const [cx, cy, w] of [
    [40, 7, 16],
    [104, 3, 12],
  ] as const) {
    fill(cx, cy, w, 2, '#f4f8fc')
    fill(cx + 3, cy - 1, w - 7, 1, '#f4f8fc')
    fill(cx + 1, cy + 2, w - 2, 1, '#dbe7f2')
  }
}

type Street = { canvas: HTMLCanvasElement; skyTop: Int16Array }
const streets: Partial<Record<'day' | 'night', Street>> = {}

/** Paints everything that doesn't move, once per day/night. */
function street(night: boolean): Street {
  const key = night ? 'night' : 'day'
  const cached = streets[key]
  if (cached) return cached
  const skyTop = new Int16Array(SCENE_W).fill(SCENE_H)
  const back = layer()
  paintBackground(painter(back.ctx, skyTop), night)
  const houses = layer()
  const windows: Glass[] = []
  const fillHouses = painter(houses.ctx, skyTop)
  paintRoof(fillHouses)
  for (let i = 0; i < HOUSE_COUNT; i++) paintHouse(i, fillHouses, windows)
  paintStacks(fillHouses)
  for (let i = 0; i < HOUSE_COUNT; i++) paintTurret(i, fillHouses, windows)
  const front = layer()
  const fillFront = painter(front.ctx, skyTop)
  for (let i = 0; i < HOUSE_COUNT; i++) paintGarden(i, fillFront)
  paintStreet(fillFront)
  paintLamp(fillFront, false)
  paintPlaneTree(fillFront)
  if (night) {
    // Dusk falls on the street; then the lights come on.
    dusk(houses.ctx)
    for (const g of windows) {
      if (!isLit(g)) continue
      fillHouses(g.x, g.y, g.w, g.h, g.side ? C.warmDim : C.warm)
      if (g.rail >= 0) fillHouses(g.x, g.rail, g.w, 1, C.warmRail)
    }
    dusk(front.ctx)
    paintLamp(fillFront, true)
    const ctx = front.ctx
    ctx.fillStyle = 'rgba(255,233,160,0.13)'
    ctx.beginPath()
    ctx.moveTo(LAMP_X, 44)
    ctx.lineTo(LAMP_X - 13, PAVEMENT_Y + 3)
    ctx.lineTo(LAMP_X + 14, PAVEMENT_Y + 3)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,233,160,0.22)'
    ctx.fillRect(LAMP_X - 3, 39, 7, 6)
  }
  const out = layer()
  paintSky(painter(out.ctx, new Int16Array(SCENE_W)), night)
  out.ctx.drawImage(back.canvas, 0, 0)
  out.ctx.drawImage(houses.canvas, 0, 0)
  out.ctx.drawImage(front.canvas, 0, 0)
  const result = { canvas: out.canvas, skyTop }
  streets[key] = result
  return result
}

type Critter = { id: SpeciesId; x: number; y: number; dir: 1 | -1; t: number; state: string; sprite: Sprite }

export class LondonScene {
  private ctx: CanvasRenderingContext2D
  private time = 0
  private busX = -100
  private busT = 6
  private pointer = { x: -99, y: -99, active: false }
  private flash = 0
  private critters: Critter[] = []
  private night = false
  onSpot: (id: SpeciesId) => void = () => {}
  isSpotted: (id: SpeciesId) => boolean = () => false
  onSound: (name: 'chirp' | 'shutter' | 'pop') => void = () => {}

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = SCENE_W
    canvas.height = SCENE_H
    this.ctx = canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
  }

  setNight(night: boolean) {
    if (night === this.night && this.critters.length) return
    this.night = night
    this.critters = night
      ? [
          { id: 'hedgehog', x: OUR_X + 2, y: PAVEMENT_Y + 2, dir: 1, t: 0, state: 'walk', sprite: HEDGEHOG.walk },
          { id: 'fox', x: OUR_X + 46, y: WALL_Y, dir: -1, t: 0, state: 'sit', sprite: FOX.stand },
        ]
      : [{ id: 'robin', x: OUR_X + 8, y: WALL_Y, dir: 1, t: 0, state: 'perch', sprite: ROBIN.stand }]
  }

  pointerMove(x: number, y: number) {
    this.pointer = { x, y, active: true }
  }

  pointerLeave() {
    this.pointer.active = false
  }

  private hit(x: number, y: number) {
    return this.critters.find((c) => {
      const left = c.x - c.sprite.w / 2
      const top = c.y - c.sprite.h
      return x >= left - 3 && x <= left + c.sprite.w + 3 && y >= top - 3 && y <= c.y + 2
    })
  }

  click(x: number, y: number) {
    const c = this.hit(x, y)
    if (!c) return false
    this.flash = 0.7
    this.onSound('shutter')
    this.onSpot(c.id)
    if (c.id === 'hedgehog') c.state = 'ball'
    if (c.id === 'robin') c.state = 'hop'
    return true
  }

  hovering() {
    return this.pointer.active && Boolean(this.hit(this.pointer.x, this.pointer.y))
  }

  update(dt: number) {
    this.time += dt
    this.flash = Math.max(0, this.flash - dt * 3)
    this.busT -= dt
    if (this.busT <= 0 && this.busX < -60) {
      this.busX = SCENE_W + 10
      this.busT = 22 + Math.random() * 18
    }
    if (this.busX > -60) this.busX -= dt * 26

    const p = this.pointer
    for (const c of this.critters) {
      c.t += dt
      const near = p.active && Math.hypot(p.x - c.x, p.y - (c.y - c.sprite.h / 2)) < 18
      if (c.id === 'robin') {
        // Robins follow gardeners around — and cursors.
        if (near && c.state === 'perch' && c.t > 0.8) {
          c.state = 'hop'
          c.t = 0
          this.onSound('chirp')
        }
        if (c.state === 'hop') {
          c.sprite = ROBIN.hop
          c.x += c.dir * dt * 14
          if (c.t > 0.35) {
            c.state = 'perch'
            c.t = 0
            c.dir = p.active ? (p.x > c.x ? 1 : -1) : ((-c.dir) as 1 | -1)
          }
        } else c.sprite = ROBIN.stand
        // Along our wall and next door's, never out over a path.
        c.x = Math.min(OUR_X + 12, Math.max(OUR_X - 12, c.x))
      } else if (c.id === 'hedgehog') {
        if (near && c.state === 'walk') {
          c.state = 'ball'
          c.t = 0
        }
        if (c.state === 'ball') {
          c.sprite = HEDGEHOG.ball
          if (c.t > 2.5 && !near) c.state = 'walk'
        } else {
          c.sprite = HEDGEHOG.walk
          c.x += c.dir * dt * 4
          if (c.x > SCENE_W - 20 || c.x < 20) c.dir = (-c.dir) as 1 | -1
        }
      } else if (c.id === 'fox') {
        c.sprite = FOX.stand
        if (p.active) c.dir = p.x > c.x ? 1 : -1
      }
    }
  }

  draw() {
    const ctx = this.ctx
    const { canvas, skyTop } = street(this.night)
    ctx.drawImage(canvas, 0, 0)
    if (this.night) {
      for (let i = 0; i < 30; i++) {
        const x = (i * 53 + 7) % SCENE_W
        const y = (i * 17) % 26
        const nearMoon = Math.abs(x - MOON.x - 2) < 6 && Math.abs(y - MOON.y - 2) < 6
        if (y >= skyTop[x] - 1 || nearMoon || Math.sin(this.time * 2 + i) > 0.6) continue
        ctx.fillStyle = 'rgba(255,255,240,0.8)'
        ctx.fillRect(x, y, 1, 1)
      }
      // The warning light on top of the Ally Pally mast.
      if (Math.floor(this.time * 1.5) % 2 === 0) {
        ctx.fillStyle = '#ff5a4a'
        ctx.fillRect(MAST.x, MAST.top, 1, 1)
      }
    }

    // Critters.
    for (const c of this.critters) {
      ctx.drawImage(bake(c.sprite, null, c.dir < 0), Math.round(c.x - c.sprite.w / 2), Math.round(c.y - c.sprite.h))
    }

    // The bus.
    if (this.busX > -40) ctx.drawImage(bake(BUS), Math.round(this.busX), BUS_Y)

    // Label for whatever is under the cursor.
    const p = this.pointer
    const hovered = p.active ? this.hit(p.x, p.y) : undefined
    if (hovered) {
      const spotted = this.isSpotted(hovered.id)
      const text = spotted ? SPECIES_BY_ID[hovered.id].label : `${SPECIES_BY_ID[hovered.id].label} - SNAP!`
      const w = textWidth(text) + 4
      const x = Math.max(1, Math.min(SCENE_W - w - 1, Math.round(hovered.x - w / 2)))
      const y = Math.max(1, hovered.y - hovered.sprite.h - 11)
      ctx.fillStyle = 'rgba(16,18,32,0.85)'
      ctx.fillRect(x, y, w, 9)
      ctx.drawImage(bakeText(text, spotted ? '#f4f4f4' : '#ffcd75'), x + 2, y + 2)
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash.toFixed(2)})`
      ctx.fillRect(0, 0, SCENE_W, SCENE_H)
    }
  }
}
