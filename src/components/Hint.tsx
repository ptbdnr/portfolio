import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** Peeking: opened by hovering or keyboard focus, so it closes on leaving. Pinned: kept open by a click or tap. */
type Mode = 'closed' | 'peek' | 'pinned'

const OPEN_DELAY = 120
const CLOSE_DELAY = 250
/** How close the note may come to the edges of the screen, and how far it sits from the word. */
const EDGE = 12
const GAP = 10

/**
 * A word with a short note explaining it, shown on hover, keyboard focus or a tap. (A native `title`
 * tooltip only appears after a long pause with a mouse, and never on a phone or from the keyboard.)
 */
export function Hint({ children, note }: { children: ReactNode; note: ReactNode }) {
  const noteId = useId()
  const [mode, setMode] = useState<Mode>('closed')
  const [place, setPlace] = useState({ shift: 0, above: false })
  const rootRef = useRef<HTMLSpanElement>(null)
  const noteRef = useRef<HTMLSpanElement>(null)
  const hovering = useRef(false)
  const timer = useRef(0)
  const open = mode !== 'closed'

  const go = (next: Mode, delay = 0) => {
    window.clearTimeout(timer.current)
    if (delay) timer.current = window.setTimeout(() => setMode(next), delay)
    else setMode(next)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Keep the note on screen: nudge it sideways, and put it above the word if there's no room below.
  useLayoutEffect(() => {
    const root = rootRef.current
    const box = noteRef.current
    if (!open || !root || !box) return
    const r = root.getBoundingClientRect()
    const left = r.left + r.width / 2 - box.offsetWidth / 2
    const right = left + box.offsetWidth
    const shift = Math.max(EDGE - left, Math.min(0, document.documentElement.clientWidth - EDGE - right))
    const above = r.bottom + GAP + box.offsetHeight > window.innerHeight - EDGE && r.top - GAP - box.offsetHeight > EDGE
    setPlace({ shift: Math.round(shift), above })
  }, [open])

  // While it's open, Escape closes it, and so does a click or tap anywhere else.
  useEffect(() => {
    if (!open) return
    const close = () => {
      window.clearTimeout(timer.current)
      setMode('closed')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [open])

  return (
    <span
      ref={rootRef}
      className={`hint${open ? ' is-open' : ''}${place.above ? ' hint--above' : ''}`}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return
        hovering.current = true
        if (mode === 'closed') go('peek', OPEN_DELAY)
        else window.clearTimeout(timer.current)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return
        hovering.current = false
        if (mode !== 'pinned') go('closed', CLOSE_DELAY)
      }}
    >
      <button
        type="button"
        className="hint__term"
        aria-expanded={open}
        aria-controls={noteId}
        onClick={() => go(mode === 'pinned' ? 'closed' : 'pinned')}
        onFocus={(e) => {
          if (mode === 'closed' && e.currentTarget.matches(':focus-visible')) go('peek')
        }}
        onBlur={() => {
          if (!hovering.current) go('closed')
        }}
      >
        {children}
      </button>
      <span
        ref={noteRef}
        id={noteId}
        role="note"
        className="hint__note"
        hidden={!open}
        style={{ '--shift': `${place.shift}px` } as CSSProperties}
      >
        {note}
      </span>
    </span>
  )
}
