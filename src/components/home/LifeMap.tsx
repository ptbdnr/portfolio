import { useEffect, useRef, useState } from 'react'
import { chapters, haunts } from '../../content/profile.ts'
import { bakeText } from '../../game/engine/font.ts'
import { CLIMBER, bake } from '../../game/engine/sprites.ts'
import { STAGES } from '../../game/engine/world.ts'
import { EUROPE_MAP } from '../../game/maps/europe.ts'
import { project } from '../../game/maps/types.ts'
import { useGame } from '../../lib/store.ts'

const CELL = 3
const COUNTRY_OF: Record<string, string> = {
  hungary: 'H',
  italy: 'I',
  'hungary-again': 'H',
  aarhus: 'D',
  delft: 'N',
  london: 'U',
}

/** Route through the chapters; after Delft the PhD continued in Aarhus before the move to London. */
function routePoints() {
  const pts = chapters.map((c) => ({ ...project(EUROPE_MAP, c.lon, c.lat), chapter: chapters.indexOf(c) }))
  const aarhus = pts[3]
  return [...pts.slice(0, 5), { ...aarhus, chapter: 4.5 }, pts[5]]
}

function draw(ctx: CanvasRenderingContext2D, active: number, t: number) {
  const { cols, rows, grid } = EUROPE_MAP
  const W = cols * CELL
  const H = rows * CELL
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#1b2650'
  ctx.fillRect(0, 0, W, H)
  const visited = new Set(chapters.slice(0, active + 1).map((c) => COUNTRY_OF[c.id]))
  const current = COUNTRY_OF[chapters[active].id]
  const blink = Math.floor(t * 2) % 2 === 0

  for (let y = 0; y < rows; y++) {
    const row = grid[y]
    for (let x = 0; x < cols; x++) {
      const ch = row[x]
      if (ch === '.') {
        // Gentle animated swell on the sea.
        if ((x * 7 + y * 13 + Math.floor(t * 3)) % 23 === 0) {
          ctx.fillStyle = '#2b3a78'
          ctx.fillRect(x * CELL, y * CELL + 1, CELL, 1)
        }
        continue
      }
      let fill = '#3d6b47'
      if (ch === current) fill = blink ? '#f2d14b' : '#e0b93a'
      else if (visited.has(ch)) fill = '#b58a2e'
      else if (ch === 'F') fill = '#4b7651'
      ctx.fillStyle = fill
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      // Coastline highlight on the north-west edges.
      if (y > 0 && grid[y - 1][x] === '.') {
        ctx.fillStyle = 'rgba(255,255,255,0.22)'
        ctx.fillRect(x * CELL, y * CELL, CELL, 1)
      }
    }
  }

  // Dotted route, revealed up to the active chapter.
  const pts = routePoints()
  ctx.fillStyle = '#f4ecd8'
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].chapter > active) break
    const a = pts[i - 1]
    const b = pts[i]
    const ax = a.x * CELL
    const ay = a.y * CELL
    const bx = b.x * CELL
    const by = b.y * CELL
    const len = Math.hypot(bx - ax, by - ay)
    for (let d = 0; d < len; d += 4) {
      const k = d / len
      ctx.fillRect(Math.round(ax + (bx - ax) * k), Math.round(ay + (by - ay) * k), 2, 2)
    }
  }

  // Places I keep going back to.
  for (const h of haunts) {
    const p = project(EUROPE_MAP, h.lon, h.lat)
    const on = Math.floor(t * 3 + h.lon) % 3 !== 0
    ctx.fillStyle = on ? '#ffffff' : '#73eff7'
    const x = Math.round(p.x * CELL)
    const y = Math.round(p.y * CELL)
    ctx.fillRect(x - 1, y, 3, 1)
    ctx.fillRect(x, y - 1, 1, 3)
  }

  // Chapter markers and the little climber.
  chapters.forEach((c, i) => {
    if (i > active) return
    const p = project(EUROPE_MAP, c.lon, c.lat)
    const x = Math.round(p.x * CELL)
    const y = Math.round(p.y * CELL)
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(x - 2, y - 2, 5, 5)
    ctx.fillStyle = i === active ? '#d7263d' : '#f4ecd8'
    ctx.fillRect(x - 1, y - 1, 3, 3)
  })
  const cur = project(EUROPE_MAP, chapters[active].lon, chapters[active].lat)
  const frame = CLIMBER.walk[Math.floor(t * 4) % 4]
  ctx.drawImage(bake(frame), Math.round(cur.x * CELL) - 6, Math.round(cur.y * CELL) - frame.h - 3)
  const label = bakeText(chapters[active].place, '#ffffff', '#1a1c2c')
  const lx = Math.min(W - label.width - 2, Math.max(2, Math.round(cur.x * CELL) - label.width / 2))
  ctx.drawImage(label, lx, Math.round(cur.y * CELL) + 5)
}

export function LifeMap() {
  const [active, setActive] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = useGame((s) => s.reducedMotion)
  const chapter = chapters[active]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let visible = false
    let last = 0
    const start = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (!visible || now - last < 120) return
      last = now
      draw(ctx, active, (now - start) / 1000)
    }
    draw(ctx, active, 0)
    if (reduced) return
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(canvas)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [active, reduced])

  const go = (i: number) => setActive((i + chapters.length) % chapters.length)

  return (
    <section id="places" className="stage stage--wide" data-stage={STAGES.places} aria-labelledby="places-title">
      <div className="panel stage__panel lifemap" data-solid>
        <div className="lifemap__map">
          <canvas
            ref={canvasRef}
            width={EUROPE_MAP.cols * CELL}
            height={EUROPE_MAP.rows * CELL}
            className="lifemap__canvas"
            role="img"
            aria-label={`Map of Europe showing the route so far: ${chapters
              .slice(0, active + 1)
              .map((c) => c.place)
              .join(' → ')}`}
          />
          <p className="lifemap__legend">
            <span className="lifemap__key lifemap__key--lived" /> lived here{' '}
            <span className="lifemap__key lifemap__key--star">✦</span> keep going back
          </p>
        </div>
        <div className="lifemap__story">
          <p className="kicker">
            Places that shaped me · {active + 1}/{chapters.length}
          </p>
          <h2 id="places-title" className="pixel-title">
            {chapter.place}
          </h2>
          <p className="lifemap__when">
            <span className="bubble">{chapter.greeting}</span> {chapter.when}
          </p>
          <p aria-live="polite">{chapter.text}</p>
          <div className="lifemap__controls">
            <button type="button" className="btn btn--small btn--ghost" onClick={() => go(active - 1)}>
              <span aria-hidden="true">◀</span> PREV<span className="sr-only">ious place</span>
            </button>
            <button type="button" className="btn btn--small" onClick={() => go(active + 1)}>
              NEXT<span className="sr-only"> place</span> <span aria-hidden="true">▶</span>
            </button>
          </div>
          <ol className="lifemap__list">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <button type="button" aria-current={i === active ? 'step' : undefined} onClick={() => setActive(i)}>
                  {c.when} — {c.place}
                </button>
              </li>
            ))}
          </ol>
          <ul className="lifemap__haunts">
            {haunts.map((h) => (
              <li key={h.id}>
                <b>✦ {h.label}</b> {h.note}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
