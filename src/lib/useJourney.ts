import { useEffect, type RefObject } from 'react'
import { worldBus } from '../game/worldBus.ts'
import { game } from './store.ts'

type Anchor = { at: number; f: number }

/** Scroll position → trail position, interpolating between anchors. */
export function trailAt(anchors: Anchor[], y: number) {
  if (!anchors.length) return 0
  if (y <= anchors[0].at) return anchors[0].f
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    if (y <= b.at) {
      const t = b.at === a.at ? 1 : (y - a.at) / (b.at - a.at)
      return a.f + (b.f - a.f) * t
    }
  }
  return anchors[anchors.length - 1].f
}

/** Trail position → scroll position (the inverse of `trailAt`). */
export function scrollFor(anchors: Anchor[], f: number) {
  if (!anchors.length) return 0
  if (f <= anchors[0].f) return anchors[0].at
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    if (f <= b.f) {
      const t = b.f === a.f ? 1 : (f - a.f) / (b.f - a.f)
      return a.at + (b.at - a.at) * t
    }
  }
  return anchors[anchors.length - 1].at
}

/**
 * Maps the page scroll position to a position on the trail. Every element with `data-stage="0.43"`
 * pins that trail fraction to the scroll position where the element is centred in the viewport.
 */
export function useJourney(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    let anchors: Anchor[] = []
    let raf = 0

    const update = () => {
      raf = 0
      if (anchors.length) worldBus.setTarget(trailAt(anchors, window.scrollY))
    }

    const measure = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      anchors = [...el.querySelectorAll<HTMLElement>('[data-stage]')]
        .map((node) => {
          const r = node.getBoundingClientRect()
          const centre = r.top + window.scrollY + r.height / 2
          return { at: Math.min(maxScroll, Math.max(0, centre - window.innerHeight / 2)), f: Number(node.dataset.stage) }
        })
        .filter((a) => Number.isFinite(a.f))
        .sort((a, b) => a.at - b.at || a.f - b.f)
      update()
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    const offRequest = worldBus.onTrailRequest((f) => {
      measure()
      window.scrollTo({ top: scrollFor(anchors, f), behavior: game.get().reducedMotion ? 'auto' : 'smooth' })
    })

    measure()
    const resizer = new ResizeObserver(measure)
    resizer.observe(el)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      offRequest()
      resizer.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [root])
}
