import { useEffect, useRef } from 'react'
import { worldBus } from '../game/worldBus.ts'
import { game } from './store.ts'

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** ↑↑↓↓←→←→BA — the most famous cheat code of the era. */
export function useKonami() {
  const index = useRef(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      index.current = key === SEQUENCE[index.current] ? index.current + 1 : key === SEQUENCE[0] ? 1 : 0
      if (index.current === SEQUENCE.length) {
        index.current = 0
        worldBus.send({ type: 'yeti' })
        game.badge('yeti')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Peter Bodnar` : 'Peter Bodnar — a little journey from the sea to the summit'
  }, [title])
}

export { typing as isTypingTarget }
