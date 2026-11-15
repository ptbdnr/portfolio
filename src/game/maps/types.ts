export type PixelMap = {
  cols: number
  rows: number
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
  /** Reference latitude used to squash longitudes (equirectangular with cos(lat0)). */
  lat0: number
  /** Cell size in (scaled) degrees. */
  cell: number
  k: number
  /** '.' sea, '#' land, letters = highlighted countries (see scripts/build-maps.ts). */
  grid: string[]
}

/** Longitude/latitude → fractional grid coordinates. */
export function project(map: PixelMap, lon: number, lat: number) {
  return {
    x: ((lon - map.lonMin) * map.k) / map.cell,
    y: (map.latMax - lat) / map.cell,
  }
}
