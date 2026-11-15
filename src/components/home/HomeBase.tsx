import { useEffect, useRef, useState } from 'react'
import { profile } from '../../content/profile.ts'
import { SPECIES } from '../../content/species.ts'
import { STAGES } from '../../game/engine/world.ts'
import { LondonScene, SCENE_H, SCENE_W } from '../../game/london.ts'
import { api } from '../../lib/api.ts'
import { sfx } from '../../lib/sfx.ts'
import { game, isNight, useGame } from '../../lib/store.ts'

const YEAR = new Date().getFullYear()

function useVisitorCount() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    const key = 'hut2hut:visited'
    const seen = sessionStorage.getItem(key)
    const request = seen ? api.stats().then((s) => s?.visitors ?? null) : api.visit()
    void request.then((n) => {
      if (!alive || n === null) return
      sessionStorage.setItem(key, '1')
      setCount(n)
    })
    return () => {
      alive = false
    }
  }, [])
  return count
}

function LondonCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const night = useGame(isNight)
  const reduced = useGame((s) => s.reducedMotion)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scene = new LondonScene(canvas)
    scene.onSpot = (id) => game.spot(id)
    scene.isSpotted = (id) => Boolean(game.get().spotted[id])
    scene.onSound = (name) => sfx.play(name)
    scene.setNight(night)
    scene.draw()
    let raf = 0
    let last = performance.now()
    let visible = false
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (!visible) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      scene.update(reduced ? 0 : dt)
      scene.draw()
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      last = performance.now()
    })
    io.observe(canvas)
    raf = requestAnimationFrame(loop)
    const toLocal = (e: PointerEvent | MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      return [((e.clientX - r.left) / r.width) * SCENE_W, ((e.clientY - r.top) / r.height) * SCENE_H] as const
    }
    const onMove = (e: PointerEvent) => {
      const [x, y] = toLocal(e)
      scene.pointerMove(x, y)
      canvas.style.cursor = scene.hovering() ? 'pointer' : ''
    }
    const onLeave = () => scene.pointerLeave()
    const onClick = (e: MouseEvent) => {
      const [x, y] = toLocal(e)
      scene.click(x, y)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('click', onClick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('click', onClick)
    }
  }, [reduced, night])

  return (
    <canvas
      ref={ref}
      className="homebase__scene"
      role="img"
      aria-label="A street of Victorian terraced houses in London, with front gardens and a palace on a hill in the distance"
    />
  )
}

export function HomeBase() {
  const visitors = useVisitorCount()
  const spotted = useGame((s) => SPECIES.filter((sp) => !sp.secret && s.spotted[sp.id]).length)
  const badges = useGame((s) => Object.keys(s.badges).length)
  const total = SPECIES.filter((s) => !s.secret).length
  const links = profile.links.filter((l) => l.href)
  const reduced = useGame((s) => s.reducedMotion)

  return (
    <footer id="home-base" className="stage stage--footer" data-stage={STAGES.home} aria-labelledby="home-title">
      <div className="panel stage__panel homebase" data-solid>
        <p className="kicker">Back to base</p>
        <h2 id="home-title" className="pixel-title">
          Home: London
        </h2>
        <LondonCanvas />
        <p className="homebase__text">
          After every trip, the trail ends here: home, a kettle, and the neighbourhood foxes.
          Thank you for walking with me — it means a lot that you came all this way.
        </p>
        <div className="homebase__grid">
          <div className="homebase__score">
            <p className="kicker">Your trip</p>
            <p>
              {spotted} of {total} animals photographed · {badges} badge{badges === 1 ? '' : 's'}
            </p>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => game.openPanel('album')}>
              Photo album
            </button>
          </div>
          {visitors !== null && (
            <div className="homebase__counter">
              <p className="kicker">You are visitor</p>
              <p className="odometer" aria-label={`number ${visitors}`}>
                {String(visitors)
                  .padStart(7, '0')
                  .split('')
                  .map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
              </p>
            </div>
          )}
        </div>
        <div className="homebase__actions">
          <button
            type="button"
            className="btn"
            onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
          >
            ↑ Back to the beach
          </button>
          {links.map((l) => (
            <a key={l.label} className="btn btn--ghost" href={l.href} rel="me noopener" target="_blank">
              {l.label}
            </a>
          ))}
        </div>
        <p className="homebase__credits">
          © {YEAR} {profile.name}. Built with React &amp; TypeScript in London. Map data: Natural
          Earth (public domain). Fonts: Press Start 2P, VT323 &amp; IBM Plex Mono (SIL OFL). No cookies or analytics — just an
          anonymous visitor counter. Your photos and badges live in your browser.
        </p>
      </div>
    </footer>
  )
}
