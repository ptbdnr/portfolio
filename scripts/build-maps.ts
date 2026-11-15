/**
 * Rasterises Natural Earth (public domain, naturalearthdata.com) country polygons into the tiny
 * character grids used by the pixel maps. Run with `npm run maps`; the output is committed.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Position = [number, number]
type Ring = Position[]
type Polygon = Ring[]
type Geometry = { type: 'Polygon'; coordinates: Polygon } | { type: 'MultiPolygon'; coordinates: Polygon[] }
type Feature = { properties: Record<string, unknown>; geometry: Geometry | null }

type Shape = { code: string; polygons: { rings: Ring[]; bbox: [number, number, number, number] }[] }

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const CACHE = path.resolve('node_modules/.cache/natural-earth')
const OUT = path.resolve('src/game/maps')

/** ADM0_A3 code → grid character. Everything else on land is '#', sea is '.'. */
const HIGHLIGHT: Record<string, string> = {
  HUN: 'H',
  ITA: 'I',
  DNK: 'D',
  NLD: 'N',
  GBR: 'U',
  FRA: 'F',
  JPN: 'J',
  TZA: 'T',
  BOL: 'B',
}

async function load(resolution: '50m' | '110m'): Promise<Feature[]> {
  const file = path.join(CACHE, `countries-${resolution}.geojson`)
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch {
    const url = `${BASE}/ne_${resolution}_admin_0_countries.geojson`
    console.log(`downloading ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download failed: ${res.status}`)
    text = await res.text()
    await mkdir(CACHE, { recursive: true })
    await writeFile(file, text)
  }
  return (JSON.parse(text) as { features: Feature[] }).features
}

function toShapes(features: Feature[]): Shape[] {
  return features
    .filter((f) => f.geometry)
    .map((f) => {
      const geometry = f.geometry as Geometry
      const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
      return {
        code: String(f.properties.ADM0_A3 ?? f.properties.ISO_A3 ?? ''),
        polygons: polys.map((rings) => {
          let minX = Infinity
          let minY = Infinity
          let maxX = -Infinity
          let maxY = -Infinity
          for (const [x, y] of rings[0]) {
            minX = Math.min(minX, x)
            maxX = Math.max(maxX, x)
            minY = Math.min(minY, y)
            maxY = Math.max(maxY, y)
          }
          return { rings, bbox: [minX, minY, maxX, maxY] as [number, number, number, number] }
        }),
      }
    })
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function countryAt(shapes: Shape[], lon: number, lat: number): string | null {
  for (const shape of shapes) {
    for (const poly of shape.polygons) {
      const [minX, minY, maxX, maxY] = poly.bbox
      if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue
      if (!inRing(lon, lat, poly.rings[0])) continue
      if (poly.rings.slice(1).some((hole) => inRing(lon, lat, hole))) continue
      return shape.code
    }
  }
  return null
}

type GridSpec = {
  name: string
  exportName: string
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
  lat0: number
  cols: number
}

function rasterise(shapes: Shape[], spec: GridSpec) {
  const k = Math.cos((spec.lat0 * Math.PI) / 180)
  const cell = ((spec.lonMax - spec.lonMin) * k) / spec.cols
  const rows = Math.round((spec.latMax - spec.latMin) / cell)
  const grid: string[] = []
  const SS = 3
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let c = 0; c < spec.cols; c++) {
      const votes = new Map<string, number>()
      let land = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const lon = spec.lonMin + ((c + (sx + 0.5) / SS) * cell) / k
          const lat = spec.latMax - (r + (sy + 0.5) / SS) * cell
          const code = countryAt(shapes, lon, lat)
          if (!code) continue
          land++
          const ch = HIGHLIGHT[code] ?? '#'
          votes.set(ch, (votes.get(ch) ?? 0) + 1)
        }
      }
      if (land < 4) {
        line += '.'
        continue
      }
      // Prefer a highlighted country when it covers a fair share of the cell.
      const best = [...votes.entries()].sort((a, b) => b[1] - a[1] || (a[0] === '#' ? 1 : -1))[0][0]
      line += best
    }
    grid.push(line)
  }
  return { ...spec, rows, cell: Number(cell.toFixed(6)), k: Number(k.toFixed(6)), grid }
}

async function main() {
  const europeShapes = toShapes(await load('50m'))
  const worldShapes = toShapes(await load('110m'))

  const europe = rasterise(europeShapes, {
    name: 'europe',
    exportName: 'EUROPE_MAP',
    lonMin: -11,
    lonMax: 31,
    latMin: 35,
    latMax: 61,
    lat0: 48,
    cols: 100,
  })
  const world = rasterise(worldShapes, {
    name: 'world',
    exportName: 'WORLD_MAP',
    lonMin: -180,
    lonMax: 180,
    latMin: -56,
    latMax: 78,
    lat0: 0,
    cols: 144,
  })

  await mkdir(OUT, { recursive: true })
  for (const map of [europe, world]) {
    const { grid, exportName, name, ...meta } = map
    const body = [
      '// Generated by scripts/build-maps.ts from Natural Earth (public domain). Do not edit by hand.',
      "import type { PixelMap } from './types.ts'",
      '',
      `export const ${exportName}: PixelMap = {`,
      ...Object.entries(meta).map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`),
      '  grid: [',
      ...grid.map((line) => `    '${line}',`),
      '  ],',
      '}',
      '',
    ].join('\n')
    await writeFile(path.join(OUT, `${name}.ts`), body)
    console.log(`wrote ${name}.ts (${map.cols}x${map.rows})`)
  }
}

await main()
