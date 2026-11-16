import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './icons.tsx'

type Props = {
  id: string
  title: ReactNode
  kicker?: ReactNode
  onClose: () => void
  /** 'side': a card on the right; 'sheet': a page over the whole view (the blog). */
  layout?: 'side' | 'sheet'
  className?: string
  children: ReactNode
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, audio[controls], video[controls], iframe, [tabindex]:not([tabindex="-1"])'

/** An accessible dialog: Escape closes it, focus stays inside and goes back where it was afterwards. */
export function Panel({ id, title, kicker, onClose, layout = 'side', className, children }: Props) {
  const ref = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    ;(root?.querySelector<HTMLElement>('[data-autofocus]') ?? root)?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      } else if (e.key === 'Tab' && root) {
        const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div
      className={`panel-backdrop panel-backdrop--${layout}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section ref={ref} className={['panel', `panel--${layout}`, className].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
        <header className="panel__head">
          <div>
            {kicker && <p className="kicker">{kicker}</p>}
            <h2 id={`${id}-title`} className="panel__title">
              {title}
            </h2>
          </div>
          <button type="button" className="icon-btn icon-btn--ghost" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <Icon.close />
          </button>
        </header>
        <div className="panel__body">{children}</div>
      </section>
    </div>
  )
}
