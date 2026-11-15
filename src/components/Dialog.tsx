import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  id: string
  title: ReactNode
  kicker?: string
  onClose: () => void
  className?: string
  children: ReactNode
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Accessible modal: Escape and backdrop close it, focus stays inside and returns afterwards. */
export function Dialog({ id, title, kicker, onClose, className, children }: Props) {
  const ref = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    root?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      } else if (e.key === 'Tab' && root) {
        const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
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
      previous?.focus?.()
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        ref={ref}
        className={['modal', 'panel', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        data-solid
      >
        <div className="modal__head">
          <div>
            {kicker && <p className="kicker">{kicker}</p>}
            <h2 id={`${id}-title`} className="modal__title">
              {title}
            </h2>
          </div>
          <button type="button" className="btn btn--small btn--ghost" onClick={onClose} data-autofocus>
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
