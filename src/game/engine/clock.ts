import { monotoneSpline, smoothstep } from './math.ts'
import { Z } from './world.ts'

/**
 * Night mode's clock along the trail, as [trail fraction, local hour] (past 24 is after midnight).
 * A warm sunset over the sea, the beach and the bike ride, the sun just down as he gets off the
 * bike; dusk deepening through the village, late at the hut; then an alpine start — the rocks after
 * midnight, the glacier before dawn — with first light on the upper glacier and sunrise on the summit.
 */
const NIGHT_CLOCK: [number, number][] = [
  [0, 17.7],
  [0.075, 17.8],
  [0.12, 17.87],
  [0.155, 17.94],
  [Z.bikeEnd, 18],
  [0.21, 18.12],
  [0.23, 18.24],
  [0.25, 18.4],
  [0.3, 20.2],
  [0.425, 23],
  [0.6, 26],
  [0.75, 27.7],
  [0.88, 29.45],
  [0.985, 30.2],
  [1, 30.25],
]
const nightClock = monotoneSpline(
  NIGHT_CLOCK.map((k) => k[0]),
  NIGHT_CLOCK.map((k) => k[1]),
)

/**
 * Night mode isn't equally dark everywhere along the trail (see NIGHT_CLOCK): no head torch needed
 * by the sea or on the bike; darkness falls gradually once he gets off the bike and walks on through
 * the village, and lifts again from the upper glacier.
 * Returns the local hour (it can run past midnight, i.e. above 24) and how dark the land gets (0–1).
 */
export function nightAt(f: number) {
  const dusk = smoothstep(Z.bikeEnd - 0.002, Z.bikeEnd + 0.07, f)
  const dawn = smoothstep(0.895, 0.985, f)
  return { hour: nightClock(f), dark: dusk * (1 - 0.8 * dawn) }
}

/** The head torch goes on once it's dark enough to need it, and off again when dawn gives enough light. */
export const needsTorch = (dark: number, daylight: number) => dark > 0.06 && daylight < 0.3
