import { useEffect } from 'react'
import { game, useGame } from '../lib/store.ts'

function Toast({ id, title, body, icon }: { id: number; title: string; body?: string; icon?: string }) {
  useEffect(() => {
    const timer = setTimeout(() => game.dismissToast(id), body && body.length > 90 ? 9000 : 5500)
    return () => clearTimeout(timer)
  }, [id, body])
  return (
    <li className="toast">
      {icon && (
        <span className="toast__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>
        <b>{title}</b>
        {body && <small>{body}</small>}
      </span>
      <button type="button" className="toast__close" onClick={() => game.dismissToast(id)} aria-label="Dismiss">
        ×
      </button>
    </li>
  )
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <ul className="toasts" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </ul>
  )
}

/** Big words in the middle of the screen while travelling. */
export function Caption() {
  const caption = useGame((s) => s.caption)
  return (
    <p className={`caption${caption ? ' is-on' : ''}`} aria-live="polite">
      {caption}
    </p>
  )
}
