import { useEffect } from 'react'
import { ICONS } from '../game/icons.ts'
import { SPECIES_SPRITES } from '../game/speciesSprites.ts'
import { game, useGame, type Toast } from '../lib/store.ts'
import { PixelSprite } from './PixelSprite.tsx'

function ToastItem({ toast }: { toast: Toast }) {
  useEffect(() => {
    const id = setTimeout(() => game.dismiss(toast.id), 5000)
    return () => clearTimeout(id)
  }, [toast.id])

  const icon = toast.species ? (
    <PixelSprite sprite={SPECIES_SPRITES[toast.species]} scale={SPECIES_SPRITES[toast.species].w > 14 ? 2 : 3} />
  ) : toast.icon ? (
    <span className="toast__emoji" aria-hidden="true">
      {toast.icon}
    </span>
  ) : (
    <PixelSprite sprite={ICONS.star} scale={5} />
  )

  return (
    <div className={`toast panel toast--${toast.kind}`} data-solid>
      <div className="toast__icon">{icon}</div>
      <div>
        <div className="toast__title">{toast.title}</div>
        {toast.body && <div className="toast__body">{toast.body}</div>}
      </div>
      <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => game.dismiss(toast.id)}>
        ×
      </button>
    </div>
  )
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
