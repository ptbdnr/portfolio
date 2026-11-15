import { useEffect, useRef } from 'react'
import { game, isNight, type GameState } from '../lib/store.ts'
import { sfx } from '../lib/sfx.ts'
import { Engine, type EngineSettings } from './engine/renderer.ts'
import { worldBus } from './worldBus.ts'

/** Elements that "own" the pointer; everything else lets it through to the world behind. */
const SOLID = 'a, button, input, textarea, select, label, summary, [role="button"], [data-solid]'

const overWorld = (target: EventTarget | null) => !(target instanceof Element && target.closest(SOLID))

const toEngine = (s: GameState): EngineSettings => ({
  season: s.settings.season,
  night: isNight(s),
  wildlife: s.settings.wildlife && !s.settings.simple,
  reducedMotion: s.reducedMotion,
  route: s.choices.route,
  inHut: s.choices.hut === 'inside',
  still: s.settings.simple,
})

const engineKey = (s: GameState) => JSON.stringify(toEngine(s))

export function WorldCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const engine = new Engine(
      canvas,
      {
        getTarget: worldBus.getTarget,
        onSpot: (id, index) => {
          game.spot(id, index)
        },
        onStatus: (status) => game.setLive(status),
        onHover: (interactive) => {
          document.documentElement.classList.toggle('world-hover', interactive)
          game.setHover(interactive)
        },
        onEvent: (e) => {
          if (e.type === 'hold') {
            game.setProgress({ holds: e.done, holdsTotal: e.total })
            if (e.done >= e.total) game.badge('climb')
          } else if (e.type === 'bounce') {
            game.setProgress({ bounces: e.count })
            if (e.count >= 3) game.badge('abseil')
          } else {
            game.setProgress({ jump: e.ok ? 'done' : 'failed' })
            if (e.ok) game.badge('crevasse')
          }
        },
        requestTrail: (f) => worldBus.requestTrail(f),
        // The sun sets at a click; the moon gives way to the day (and a low sun at dusk or dawn brings it back).
        onSky: () => game.toggleNight(),
        sfx: (name) => sfx.play(name),
        isSpotted: (id) => Boolean(game.get().spotted[id]),
      },
      toEngine(game.get()),
    )
    engine.setCollected(game.get().edelweiss)
    engine.start()
    if (import.meta.env.DEV) Object.assign(window, { __world: engine, __game: game })

    let prev = game.get()
    let prevKey = engineKey(prev)
    const unsubscribe = game.subscribe(() => {
      const next = game.get()
      const key = engineKey(next)
      const before = prev
      prev = next
      if (key !== prevKey) {
        prevKey = key
        engine.setSettings(toEngine(next))
        // Side effects last: they notify subscribers (including this one) synchronously.
        if (next.choices.route !== before.choices.route) game.setProgress({ holds: 0, bounces: 0 })
      }
      if (next.edelweiss !== before.edelweiss) engine.setCollected(next.edelweiss)
    })
    const offBus = worldBus.on((cmd) => {
      if (cmd.type === 'yeti') engine.yeti()
      else if (cmd.type === 'bounce') engine.bounce()
      else if (cmd.type === 'jump') engine.jump(cmd.ok)
    })

    let touchTimer: ReturnType<typeof setTimeout> | undefined
    const onMove = (e: PointerEvent) => engine.pointerMove(e.clientX, e.clientY, overWorld(e.target))
    const onClick = (e: MouseEvent) => {
      if (!overWorld(e.target)) return
      engine.pointerMove(e.clientX, e.clientY, true)
      engine.click(e.clientX, e.clientY)
    }
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) engine.pointerLeave()
    }
    const onTouchEnd = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        clearTimeout(touchTimer)
        touchTimer = setTimeout(() => engine.pointerLeave(), 900)
      }
    }
    const onVisibility = () => (document.hidden ? engine.stop() : engine.start())
    const resizer = new ResizeObserver(() => engine.resize())
    resizer.observe(canvas)

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    window.addEventListener('pointerout', onOut, { passive: true })
    window.addEventListener('pointerup', onTouchEnd, { passive: true })
    window.addEventListener('pointercancel', onTouchEnd, { passive: true })
    window.addEventListener('click', onClick)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      engine.destroy()
      unsubscribe()
      offBus()
      resizer.disconnect()
      clearTimeout(touchTimer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      window.removeEventListener('pointerout', onOut)
      window.removeEventListener('pointerup', onTouchEnd)
      window.removeEventListener('pointercancel', onTouchEnd)
      window.removeEventListener('click', onClick)
      document.removeEventListener('visibilitychange', onVisibility)
      document.documentElement.classList.remove('world-hover')
    }
  }, [])

  return <canvas ref={ref} className="world-canvas" aria-hidden="true" />
}
