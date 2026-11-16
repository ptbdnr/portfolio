/**
 * The view: a canvas the engine draws on, the hotspots laid over it, and the wiring between the
 * engine, the sound and the rest of the site (where you are, the address bar, captions, badges).
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { SCENE_BY_ID, type SceneId } from '../content/trail.ts'
import { createEngine, type Engine } from '../engine/engine.ts'
import { angleBetween, type Dir } from '../engine/math.ts'
import { game, reducedMotion, useGame } from '../lib/store.ts'
import { isTypingTarget, sound } from './engineContext.ts'
import { ambienceOf, discover, spotsHere } from './helpers.ts'
import { bindLook } from './input.ts'

const CAPTIONS: Partial<Record<SceneId, string>> = {
  home: 'A bus, a plane, a train… home to London.',
  beach: 'And back to the sea.',
}

type Props = {
  start: { scene: SceneId; view?: Dir & { fov?: number } }
  onReady: (engine: Engine | null) => void
  /** 0–1: how much the view is blurred behind what you're reading. */
  backdrop: number
  /** The title screen is up: drift slowly, no input. */
  attract: boolean
  /** Keyboard and pointer control (off while a panel has focus). */
  interactive: boolean
  children?: ReactNode
}

export function Stage({ start, onReady, backdrop, attract, interactive, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const path = useRef(pathname)
  path.current = pathname
  const nav = useRef(navigate)
  nav.current = navigate
  const reduced = useGame(reducedMotion)
  const interactiveRef = useRef(interactive)
  interactiveRef.current = interactive

  useEffect(() => {
    const canvas = canvasRef.current!
    let engine: Engine
    try {
      engine = createEngine(canvas, { motion: reduced ? 'reduced' : 'full' })
    } catch {
      game.noWebgl()
      onReady(null)
      return
    }
    engineRef.current = engine
    const off = engine.on((e) => {
      switch (e.type) {
        case 'arrive': {
          const scene = SCENE_BY_ID.get(e.scene)!
          game.arrive(e.scene, e.variant)
          if (e.via === 'walk') sound.settle()
          else sound.setScene(ambienceOf(scene, e.variant), { fade: e.via === 'start' ? 2 : 1.2 })
          if (e.via === 'travel') setTimeout(() => game.setCaption(null), 1400)
          if (path.current === '/' || path.current.startsWith('/trail/')) nav.current(`/trail/${e.scene}`, { replace: true })
          break
        }
        case 'depart': {
          game.setMoving(true)
          const to = SCENE_BY_ID.get(e.to)!
          if (e.kind === 'walk' || e.kind === 'door') sound.setScene(ambienceOf(to, e.variant), { fade: e.seconds, frame: -e.delta })
          if (e.kind === 'travel') game.setCaption(CAPTIONS[e.to] ?? to.name)
          break
        }
        case 'light': {
          const scene = SCENE_BY_ID.get(e.scene)!
          if (e.seconds > 0) sound.setScene(ambienceOf(scene, e.variant), { fade: e.seconds })
          else game.setVariant(e.variant)
          game.setMoving(e.seconds > 0)
          break
        }
        case 'step':
          sound.step(e.ground, e.side, e.strength)
          break
        case 'error':
          game.toast({ title: 'Something didn’t load', body: e.message, icon: '⚠️' })
          game.setMoving(false)
          break
      }
    })
    const offFrame = engine.onFrame((f) => sound.listen(f.cam.yaw, f.cam.pitch))
    const unbind = bindLook(canvas, engine, {
      onTap(x, y) {
        if (!interactiveRef.current) return
        const dir = engine.click(x, y)
        const scene = engine.scene
        if (!scene || engine.camera.fov > 75) return
        const variant = engine.variant?.key ?? null
        const hit = spotsHere(scene, variant).find((s) => angleBetween(dir, s.at) < s.radius)
        if (hit) discover(scene, hit.id)
      },
    })
    void engine.start(start.scene, start.view)
    onReady(engine)
    return () => {
      off()
      offFrame()
      unbind()
      engine.dispose()
      engineRef.current = null
      onReady(null)
    }
    // The engine lives as long as the page; the starting place only matters the first time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    engineRef.current?.setMotion(reduced ? 'reduced' : 'full')
  }, [reduced])
  useEffect(() => {
    engineRef.current?.setBackdrop(backdrop)
  }, [backdrop])
  useEffect(() => {
    engineRef.current?.setAttract(attract)
  }, [attract])

  // Keyboard: look with the arrow keys or WASD, walk with ↑/W, zoom with + and −.
  useEffect(() => {
    if (!interactive) return
    const held = new Set<string>()
    const apply = () => {
      const e = engineRef.current
      if (!e) return
      const has = (...k: string[]) => k.some((x) => held.has(x))
      e.setKeys({
        yaw: (has('ArrowRight', 'd') ? 1 : 0) - (has('ArrowLeft', 'a') ? 1 : 0),
        pitch: (has('PageUp', 'q') ? 1 : 0) - (has('PageDown', 'e') ? 1 : 0),
        zoom: (has('+', '=') ? 1 : 0) - (has('-', '_') ? 1 : 0),
      })
    }
    const down = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || isTypingTarget(ev.target)) return
      if (ev.target instanceof HTMLElement && ev.target.closest('[role="dialog"]')) return
      const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key
      const e = engineRef.current
      if (!e) return
      if (key === 'ArrowUp' || key === 'w') {
        ev.preventDefault()
        if (!ev.repeat) e.walkForward()
        return
      }
      if (key === 'ArrowDown' || key === 's') {
        ev.preventDefault()
        if (!ev.repeat) e.turnAround()
        return
      }
      if (key === 'r' && !ev.repeat) {
        e.lookAt({ yaw: e.camera.yaw, pitch: 0, fov: 80 })
        return
      }
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'PageUp', 'PageDown', 'q', 'e', '+', '=', '-', '_'].includes(key)) {
        if (key.startsWith('Arrow') || key.startsWith('Page')) ev.preventDefault()
        held.add(key)
        apply()
      }
    }
    const up = (ev: KeyboardEvent) => {
      const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key
      if (held.delete(key)) apply()
    }
    const blur = () => {
      held.clear()
      apply()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      blur()
    }
  }, [interactive])

  return (
    <div className={`stage${interactive ? '' : ' is-passive'}`}>
      <canvas ref={canvasRef} className="stage__canvas" aria-hidden="true" />
      <div className="stage__overlay">{children}</div>
    </div>
  )
}
