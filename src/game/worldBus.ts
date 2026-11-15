/** Tiny bridge between React (scroll position, routes, buttons) and the canvas engine. */
type Command = { type: 'yeti' } | { type: 'bounce' } | { type: 'jump'; ok: boolean }

let target = 0.022
const listeners = new Set<(cmd: Command) => void>()
const trailListeners = new Set<(f: number) => void>()

export const worldBus = {
  getTarget: () => target,
  setTarget(f: number) {
    target = Math.min(1, Math.max(0, f))
  },
  send(cmd: Command) {
    for (const l of listeners) l(cmd)
  },
  on(listener: (cmd: Command) => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** The engine asks the page to scroll so the climber reaches trail position `f`. */
  requestTrail(f: number) {
    for (const l of trailListeners) l(f)
  },
  onTrailRequest(listener: (f: number) => void) {
    trailListeners.add(listener)
    return () => {
      trailListeners.delete(listener)
    }
  },
}
