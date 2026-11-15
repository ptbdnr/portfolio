import { useEffect, useRef, useState } from 'react'
import { skiLines, summits } from '../../content/profile.ts'
import { bakeText } from '../../game/engine/font.ts'
import { hash } from '../../game/engine/math.ts'
import { STAGES } from '../../game/engine/world.ts'
import { HOBBIES } from '../../game/icons.ts'
import { WORLD_MAP } from '../../game/maps/world.ts'
import { project } from '../../game/maps/types.ts'
import { useGame } from '../../lib/store.ts'
import { PixelSprite } from '../PixelSprite.tsx'

const ordered = [...summits].sort((a, b) => a.lon - b.lon)
const MAX = 6200
const SW = 230
const SH = 92
const BASE = 86
const PEAK = 70

function drawSkyline(ctx: CanvasRenderingContext2D, youAlt: number, hover: number) {
  ctx.fillStyle = '#10142c'
  ctx.fillRect(0, 0, SW, SH)
  const spacing = SW / ordered.length
  const heights = new Float32Array(SW)
  const owner = new Int8Array(SW).fill(-1)
  ordered.forEach((s, i) => {
    const cx = Math.round(spacing * (i + 0.5))
    const h = (s.height / MAX) * PEAK
    const half = spacing * 0.62
    for (let x = Math.max(0, Math.floor(cx - half)); x < Math.min(SW, Math.ceil(cx + half)); x++) {
      const k = 1 - Math.abs(x - cx) / half
      const col = h * Math.pow(Math.max(0, k), 1.15) + (hash(x, i) - 0.5) * 2
      if (col > heights[x]) {
        heights[x] = col
        owner[x] = i
      }
    }
  })
  for (let x = 0; x < SW; x++) {
    const i = owner[x]
    if (i < 0) continue
    const cx = Math.round(spacing * (i + 0.5))
    const top = Math.round(BASE - heights[x])
    const shadow = x > cx
    const lit = hover === i
    ctx.fillStyle = shadow ? (lit ? '#5a6f95' : '#3f4f6a') : lit ? '#8ea6cf' : '#66799a'
    ctx.fillRect(x, top, 1, BASE - top)
    const cap = Math.max(1, Math.round(heights[x] * 0.24))
    ctx.fillStyle = shadow ? '#c3d5ea' : '#f4f8fb'
    ctx.fillRect(x, top, 1, cap)
  }
  ctx.fillStyle = '#2b3a78'
  ctx.fillRect(0, BASE, SW, SH - BASE)
  ordered.forEach((s, i) => {
    const cx = Math.round(spacing * (i + 0.5))
    const top = Math.round(BASE - (s.height / MAX) * PEAK)
    ctx.fillStyle = '#c0c8d2'
    ctx.fillRect(cx, top - 6, 1, 6)
    ctx.fillStyle = hover === i ? '#f2d14b' : '#d7263d'
    ctx.fillRect(cx + 1, top - 6, 3, 2)
  })
  // Where the visitor is on the trail right now.
  const yy = Math.round(BASE - (youAlt / MAX) * PEAK)
  ctx.fillStyle = '#f2d14b'
  for (let x = 0; x < SW; x += 4) ctx.fillRect(x, yy, 2, 1)
  const label = bakeText(`YOU ${youAlt.toLocaleString('en-GB')} M`, '#f2d14b', '#1a1c2c')
  ctx.drawImage(label, 2, Math.max(1, yy - 7))
}

const MAP_CELL = 3

function drawWorld(ctx: CanvasRenderingContext2D, hover: number, t: number) {
  const { cols, rows, grid } = WORLD_MAP
  ctx.fillStyle = '#1b2650'
  ctx.fillRect(0, 0, cols * MAP_CELL, rows * MAP_CELL)
  const summitCountries = new Set(['J', 'T', 'B', 'F', 'I'])
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = grid[y][x]
      if (ch === '.') continue
      ctx.fillStyle = summitCountries.has(ch) ? '#6f8f4f' : '#3d6b47'
      ctx.fillRect(x * MAP_CELL, y * MAP_CELL, MAP_CELL, MAP_CELL)
    }
  }
  ordered.forEach((s, i) => {
    const p = project(WORLD_MAP, s.lon, s.lat)
    const x = Math.round(p.x * MAP_CELL)
    const y = Math.round(p.y * MAP_CELL)
    const on = hover === i && Math.floor(t * 4) % 2 === 0
    ctx.fillStyle = '#f4ecd8'
    ctx.fillRect(x, y - 8, 1, 9)
    ctx.fillStyle = on || hover === i ? '#f2d14b' : '#d7263d'
    ctx.fillRect(x + 1, y - 8, 4, 3)
    if (hover === i) {
      const label = bakeText(s.name, '#ffffff', '#1a1c2c')
      ctx.drawImage(label, Math.min(cols * MAP_CELL - label.width - 1, Math.max(1, x - label.width / 2)), y + 3)
    }
  })
}

export function SummitLog() {
  const altitude = useGame((s) => s.live.altitude)
  const reduced = useGame((s) => s.reducedMotion)
  const [hover, setHover] = useState(-1)
  const skyRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = skyRef.current?.getContext('2d')
    if (ctx) drawSkyline(ctx, altitude, hover)
  }, [altitude, hover])

  useEffect(() => {
    const ctx = mapRef.current?.getContext('2d')
    if (!ctx) return
    drawWorld(ctx, hover, 0)
    if (reduced || hover < 0) return
    const start = performance.now()
    const id = setInterval(() => drawWorld(ctx, hover, (performance.now() - start) / 1000), 125)
    return () => clearInterval(id)
  }, [hover, reduced])

  return (
    <section id="summits" className="stage stage--wide" data-stage={STAGES.summits} aria-labelledby="summits-title">
      <div className="panel stage__panel summitlog" data-solid>
        <p className="kicker">Summit log</p>
        <h2 id="summits-title" className="pixel-title">
          Some good days out
        </h2>
        <p>Not conquests — just days when the weather, the legs and the company all lined up. West to east:</p>
        <canvas
          ref={skyRef}
          width={SW}
          height={SH}
          className="summitlog__skyline"
          role="img"
          aria-label={`Skyline of summits: ${ordered.map((s) => `${s.name} ${s.height} m`).join(', ')}. The dashed line is your altitude on this trail.`}
        />
        <ul className="summit-list">
          {ordered.map((s, i) => (
            <li key={s.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}>
              <button type="button" onFocus={() => setHover(i)} onBlur={() => setHover(-1)}>
                <b>{s.name}</b>
                <span>{s.height.toLocaleString('en-GB')} m</span>
                <small>
                  {s.where}, {s.country}
                </small>
              </button>
            </li>
          ))}
        </ul>
        <canvas
          ref={mapRef}
          width={WORLD_MAP.cols * MAP_CELL}
          height={WORLD_MAP.rows * MAP_CELL}
          className="summitlog__map"
          role="img"
          aria-label="World map with a flag on each summit"
        />
        <h3 className="pixel-title section-sub">On skis</h3>
        <ul className="ski-list">
          {skiLines.map((s) => (
            <li key={s.name}>
              <PixelSprite sprite={HOBBIES.ski} scale={3} />
              <div>
                <b>{s.name}</b> <small>· {s.where}</small>
                <p>{s.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
