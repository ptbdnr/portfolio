import { hex, mix, type RGB } from './color.ts'
import { clamp, smoothstep } from './math.ts'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']

export type WeatherParticle = 'petal' | 'seed' | 'leaf' | 'snow'

export type ScenePalette = {
  skyTop: RGB
  skyHorizon: RGB
  haze: RGB
  far: RGB
  mid: RGB
  near: RGB
  nearDark: RGB
  peakSnow: RGB
  grass: RGB
  grassLight: RGB
  grassDark: RGB
  soil: RGB
  soilDark: RGB
  rock: RGB
  rockLight: RGB
  rockDark: RGB
  snow: RGB
  snowShade: RGB
  ice: RGB
  iceDeep: RGB
  conifer: RGB
  coniferLight: RGB
  leaf: RGB
  leafLight: RGB
  larch: RGB
  larchLight: RGB
  blossom: RGB
  trunk: RGB
  water: RGB
  waterLight: RGB
  flower1: RGB
  flower2: RGB
  flower3: RGB
  leafAlpha: number
  larchAlpha: number
  blossomAlpha: number
  flowerAlpha: number
  groundSnow: number
  treeSnow: number
  iceExposure: number
  snowline: number
}

const P = (o: Record<string, string | number>) => {
  const out: Record<string, RGB | number> = {}
  for (const [k, v] of Object.entries(o)) out[k] = typeof v === 'string' ? hex(v) : v
  return out as unknown as ScenePalette
}

const common = {
  rock: '#8b8f99',
  rockLight: '#b9bdc6',
  rockDark: '#585d6b',
  snow: '#f4f8fb',
  snowShade: '#c3d5ea',
  ice: '#9fdcf2',
  iceDeep: '#3d78b5',
  peakSnow: '#f6f9fc',
  trunk: '#6b4a32',
  water: '#3f9be0',
  waterLight: '#a9e0f7',
  blossom: '#fbd0e4',
}

export const PALETTES: Record<Season, ScenePalette> = {
  spring: P({
    ...common,
    skyTop: '#5aa2e6',
    skyHorizon: '#cde7f7',
    haze: '#cfe2ef',
    far: '#93a9c8',
    mid: '#7190b0',
    near: '#4f8a68',
    nearDark: '#3c6c55',
    grass: '#68be48',
    grassLight: '#a8e374',
    grassDark: '#3f8f3a',
    soil: '#7a5a3a',
    soilDark: '#5a3f28',
    conifer: '#2d6a4a',
    coniferLight: '#4f9a5e',
    leaf: '#78cc56',
    leafLight: '#b8f07a',
    larch: '#96dc72',
    larchLight: '#c8f59a',
    flower1: '#f6f6f6',
    flower2: '#ffd84a',
    flower3: '#b46be0',
    leafAlpha: 1,
    larchAlpha: 0.85,
    blossomAlpha: 1,
    flowerAlpha: 1,
    groundSnow: 0,
    treeSnow: 0,
    iceExposure: 0.1,
    snowline: 2500,
  }),
  summer: P({
    ...common,
    skyTop: '#2f7dd8',
    skyHorizon: '#a6d3f5',
    haze: '#bcd7ec',
    far: '#8199bb',
    mid: '#5e80a1',
    near: '#3f7452',
    nearDark: '#2f5c42',
    grass: '#4ea83e',
    grassLight: '#8fd060',
    grassDark: '#2f7a30',
    soil: '#7a5636',
    soilDark: '#553b25',
    conifer: '#23563c',
    coniferLight: '#3d8a50',
    leaf: '#3e9a3a',
    leafLight: '#6fc04a',
    larch: '#5cae4a',
    larchLight: '#8fd06a',
    flower1: '#e8403a',
    flower2: '#3b6fd9',
    flower3: '#f6f6f6',
    leafAlpha: 1,
    larchAlpha: 1,
    blossomAlpha: 0,
    flowerAlpha: 1,
    groundSnow: 0,
    treeSnow: 0,
    iceExposure: 0.65,
    snowline: 3150,
  }),
  autumn: P({
    ...common,
    skyTop: '#4a8ccf',
    skyHorizon: '#f1d9b4',
    haze: '#e5d3bb',
    far: '#9c9ab6',
    mid: '#80809c',
    near: '#8c6c3c',
    nearDark: '#6a4c2c',
    grass: '#b3893a',
    grassLight: '#dab55c',
    grassDark: '#7c5a2a',
    soil: '#6a4a2e',
    soilDark: '#4c3420',
    conifer: '#28503a',
    coniferLight: '#3f704a',
    leaf: '#d8642a',
    leafLight: '#f2a63c',
    larch: '#e9a21e',
    larchLight: '#ffd552',
    flower1: '#b05ac8',
    flower2: '#e8c040',
    flower3: '#f0f0f0',
    leafAlpha: 1,
    larchAlpha: 1,
    blossomAlpha: 0,
    flowerAlpha: 0.45,
    groundSnow: 0,
    treeSnow: 0,
    iceExposure: 0.45,
    snowline: 2900,
  }),
  winter: P({
    ...common,
    skyTop: '#6c9ed2',
    skyHorizon: '#e3edf6',
    haze: '#dde7f0',
    far: '#c6d4e6',
    mid: '#a9bcd3',
    near: '#8ea3bb',
    nearDark: '#6d829b',
    grass: '#eef4f9',
    grassLight: '#ffffff',
    grassDark: '#c4d4e6',
    soil: '#d5e1ee',
    soilDark: '#b6c7da',
    conifer: '#1f4a3a',
    coniferLight: '#2f6a4a',
    leaf: '#8a6a4a',
    leafLight: '#a0805a',
    larch: '#b08a5a',
    larchLight: '#c8a070',
    flower1: '#ffffff',
    flower2: '#ffffff',
    flower3: '#ffffff',
    leafAlpha: 0,
    larchAlpha: 0.12,
    blossomAlpha: 0,
    flowerAlpha: 0,
    groundSnow: 1,
    treeSnow: 1,
    iceExposure: 0,
    snowline: 1300,
  }),
}

export function blendPalettes(a: ScenePalette, b: ScenePalette, t: number): ScenePalette {
  if (t <= 0) return a
  if (t >= 1) return b
  const out: Record<string, RGB | number> = {}
  for (const key of Object.keys(a) as (keyof ScenePalette)[]) {
    const va = a[key]
    const vb = b[key]
    out[key] = typeof va === 'number' ? va + ((vb as number) - va) * t : mix(va, vb as RGB, t)
  }
  return out as unknown as ScenePalette
}

/** Continuous season position: 0 spring, 1 summer, 2 autumn, 3 winter. */
export function paletteAt(seasonPos: number): ScenePalette {
  const p = clamp(seasonPos, 0, 3)
  const i = Math.min(2, Math.floor(p))
  return blendPalettes(PALETTES[SEASONS[i]], PALETTES[SEASONS[i + 1]], p - i)
}

export function dominantSeason(seasonPos: number): Season {
  return SEASONS[Math.round(clamp(seasonPos, 0, 3))]
}

/**
 * The calendar as a position on the season wheel (0 spring, 1 summer, 2 autumn, 3 winter, and on to
 * 4 = spring again): each season holds for a couple of months, with a few weeks' blend into the next.
 */
const YEAR: [number, number][] = [
  [0, 3],
  [56, 3],
  [84, 4],
  [145, 4],
  [166, 5],
  [243, 5],
  [268, 6],
  [314, 6],
  [344, 7],
  [366, 7],
]

/** Where a date falls in the seasons (0..4, wrapping). Used for simple view's picture of the hut. */
export function seasonPosForDate(date: Date): number {
  const y = date.getFullYear()
  const day = (Date.UTC(y, date.getMonth(), date.getDate()) - Date.UTC(y, 0, 1)) / 86_400_000
  for (let i = 1; i < YEAR.length; i++) {
    const [d0, p0] = YEAR[i - 1]
    const [d1, p1] = YEAR[i]
    if (day <= d1) return (p0 + (p1 - p0) * smoothstep(d0, d1, day)) % 4
  }
  return 3
}

/** Like paletteAt, but round the year: from winter (3) it blends back into spring (4). */
export function paletteAround(seasonPos: number): ScenePalette {
  const p = ((seasonPos % 4) + 4) % 4
  const i = Math.floor(p)
  return blendPalettes(PALETTES[SEASONS[i]], PALETTES[SEASONS[(i + 1) % 4]], p - i)
}

/** The season a position on the wheel is closest to. */
export function seasonAround(seasonPos: number): Season {
  return SEASONS[((Math.round(seasonPos) % 4) + 4) % 4]
}

export function particleFor(season: Season): WeatherParticle {
  return season === 'spring' ? 'petal' : season === 'summer' ? 'seed' : season === 'autumn' ? 'leaf' : 'snow'
}

export type SkyState = {
  top: RGB
  horizon: RGB
  haze: RGB
  tint: RGB
  tintAlpha: number
  stars: number
  /** 0 night … 1 full day */
  daylight: number
  /** Sun elevation in [-1, 1]; position helpers for the renderer. */
  sunElevation: number
  morning: boolean
}

const NIGHT = { top: hex('#0a0f2c'), horizon: hex('#24305c'), haze: hex('#1f2a52'), tint: hex('#0b1236') }
const DAWN = { top: hex('#4a64ad'), horizon: hex('#f7b19e'), tint: hex('#ff9c8a') }
const DUSK = { top: hex('#3a4497'), horizon: hex('#f79a58'), tint: hex('#ff7a3a') }
const HIGH_SKY = hex('#1d5fc4')

/** Sky colours from local time-of-day (hours, 0–24), season palette and altitude (0–1). */
export function skyAt(hour: number, palette: ScenePalette, altitude01: number): SkyState {
  const elevation = Math.sin(((hour - 6) / 12) * Math.PI)
  const morning = hour < 12
  const daylight = smoothstep(-0.12, 0.22, elevation)
  const twilight = clamp(1 - Math.abs(daylight * 2 - 1)) * 0.85
  const tw = morning ? DAWN : DUSK

  const dayTop = mix(palette.skyTop, HIGH_SKY, altitude01 * 0.45)
  let top = mix(NIGHT.top, dayTop, daylight)
  let horizon = mix(NIGHT.horizon, palette.skyHorizon, daylight)
  top = mix(top, tw.top, twilight * 0.6)
  horizon = mix(horizon, tw.horizon, twilight)
  const haze = mix(mix(NIGHT.haze, palette.haze, daylight), tw.horizon, twilight * 0.5)

  // Warm at sunset and sunrise, blending into the cool blue of night (no sudden switch between them).
  const tint = mix(NIGHT.tint, tw.tint, smoothstep(0.15, 0.45, twilight))
  const tintAlpha = Math.max((1 - daylight) * 0.58, twilight * 0.16)
  return {
    top,
    horizon,
    haze,
    tint,
    tintAlpha,
    stars: clamp(1 - daylight * 1.6),
    daylight,
    sunElevation: elevation,
    morning,
  }
}
