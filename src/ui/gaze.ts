/** Which unfound spot you're looking near, so the interface can whisper "zoom in". */
import { useSyncExternalStore } from 'react'

let near: string | null = null
const listeners = new Set<() => void>()

export function setNear(id: string, isNear: boolean) {
  const next = isNear ? id : near === id ? null : near
  if (next === near) return
  near = next
  listeners.forEach((l) => l())
}

export function useNearSpot() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    () => near,
    () => null,
  )
}
