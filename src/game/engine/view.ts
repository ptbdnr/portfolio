import type { ScenePalette, Season, SkyState } from './palettes.ts'
import type { World } from './world.ts'

/** Everything the drawing modules need to know about the current frame. */
export type View = {
  W: number
  H: number
  horizon: number
  ground0: number
  camX: number
  camAlt: number
  camAltPx: number
  time: number
  palette: ScenePalette
  paletteBack: ScenePalette
  sky: SkyState
  season: Season
  world: World
  reducedMotion: boolean
  /** Screen y of the ground surface at world x. */
  groundY: (x: number) => number
  /** Screen y of what you walk on at world x (the ground, or a bridge deck). */
  walkY: (x: number) => number
  /** World x where the climber is drawn. */
  climberX: number
  /** 0 = day … 1 = night (animated). */
  nightT: number
  /** Local time of day for the sky, 0–24 (drives the sun and the moon). */
  hour: number
}

/** A pre-baked emissive image (lit windows) drawn on top of the night. */
export type Light = { c: HTMLCanvasElement; x: number; y: number }

/** A soft pool of light cut out of the darkness at night. */
export type Glow = { x: number; y: number; r: number; strength: number; warm?: boolean }
