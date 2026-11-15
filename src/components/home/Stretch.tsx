import type { ReactNode } from 'react'

/**
 * A tall, empty stretch of page where the trail moves slowly from `from` to `to` — used for the
 * climb, the abseil and the crevasse so they get time on screen. When it isn't `pinned` (the lake
 * path, where there's no challenge), it's a shorter stretch the trail passes through at an even pace.
 */
export function Stretch({
  from,
  to,
  note,
  pinned = true,
  children,
}: {
  from: number
  to: number
  note?: string
  pinned?: boolean
  children?: ReactNode
}) {
  return (
    <div className={pinned ? 'stretch' : 'stretch stretch--open'}>
      {pinned && <span className="stretch__anchor stretch__anchor--from" data-stage={from} />}
      {note && (
        <p className="trail-gap__note" aria-hidden="true">
          {note}
        </p>
      )}
      {children}
      {pinned && <span className="stretch__anchor stretch__anchor--to" data-stage={to} />}
    </div>
  )
}
