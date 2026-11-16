/**
 * Looking around: drag (mouse, pen or finger) to turn, with a little momentum when you let go;
 * wheel or pinch to zoom; click or tap the ground towards an arrow to walk there.
 */
import type { Engine } from '../engine/engine.ts'
import { DEG } from '../engine/math.ts'

type Options = {
  /** A click or tap that wasn't a drag (CSS pixels within the element), with the direction under it. */
  onTap?: (x: number, y: number) => void
  /** Called on any interaction, to wake the interface up. */
  onActivity?: () => void
}

export function bindLook(el: HTMLElement, engine: Engine, { onTap, onActivity }: Options = {}) {
  const pointers = new Map<number, { x: number; y: number }>()
  let start: { x: number; y: number; time: number; moved: number } | null = null
  let pinch: { distance: number } | null = null
  let samples: { t: number; dx: number; dy: number }[] = []

  const degPerPx = () => {
    const cam = engine.camera
    const t = Math.tan((cam.fov * DEG) / 2)
    const tanX = cam.width >= cam.height ? t : (t * cam.width) / cam.height
    return (2 * Math.atan(tanX)) / DEG / cam.width
  }

  const local = (e: PointerEvent | WheelEvent) => {
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function down(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    el.setPointerCapture?.(e.pointerId)
    pointers.set(e.pointerId, local(e))
    onActivity?.()
    engine.stopSpin()
    if (pointers.size === 1) {
      start = { ...local(e), time: performance.now(), moved: 0 }
      samples = []
      el.classList.add('is-dragging')
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) }
      start = null
    }
  }

  function move(e: PointerEvent) {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const p = local(e)
    pointers.set(e.pointerId, p)
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 10) engine.zoomBy(pinch.distance / d)
      pinch.distance = d
      return
    }
    if (!start) return
    const dx = p.x - prev.x
    const dy = p.y - prev.y
    start.moved += Math.abs(dx) + Math.abs(dy)
    const k = degPerPx()
    engine.rotateBy(-dx * k, dy * k)
    const now = performance.now()
    samples.push({ t: now, dx: -dx * k, dy: dy * k })
    samples = samples.filter((s) => now - s.t < 90)
  }

  function up(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return
    pointers.delete(e.pointerId)
    el.releasePointerCapture?.(e.pointerId)
    if (pointers.size < 2) pinch = null
    if (!start || pointers.size) return
    el.classList.remove('is-dragging')
    const now = performance.now()
    const tap = start.moved < 6 && now - start.time < 500
    if (tap) {
      const p = local(e)
      onTap?.(p.x, p.y)
    } else {
      const recent = samples.filter((s) => now - s.t < 90)
      if (recent.length > 1) {
        const span = Math.max(16, now - recent[0].t) / 1000
        const vx = recent.reduce((n, s) => n + s.dx, 0) / span
        const vy = recent.reduce((n, s) => n + s.dy, 0) / span
        if (Math.hypot(vx, vy) > 20) engine.fling(vx, vy)
      }
    }
    start = null
  }

  function wheel(e: WheelEvent) {
    e.preventDefault()
    onActivity?.()
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    engine.zoomBy(Math.exp(delta * 0.0012))
  }

  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('wheel', wheel, { passive: false })
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    el.removeEventListener('wheel', wheel)
  }
}
