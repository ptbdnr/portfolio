import { useEffect, useState } from 'react'
import type { StatsSnapshot } from '../../shared/species.ts'
import { BADGES } from '../content/badges.ts'
import { EDELWEISS_TOTAL, SPECIES } from '../content/species.ts'
import { SPECIES_SPRITES, silhouette } from '../game/speciesSprites.ts'
import { api } from '../lib/api.ts'
import { game, useGame } from '../lib/store.ts'
import { Dialog } from './Dialog.tsx'
import { PixelSprite } from './PixelSprite.tsx'

export function PhotoAlbum() {
  const panel = useGame((s) => s.panel)
  const spotted = useGame((s) => s.spotted)
  const edelweiss = useGame((s) => s.edelweiss)
  const badges = useGame((s) => s.badges)
  const [stats, setStats] = useState<StatsSnapshot | null>(null)
  const open = panel === 'album'

  useEffect(() => {
    if (!open) return
    let alive = true
    void api.stats().then((s) => alive && setStats(s))
    return () => {
      alive = false
    }
  }, [open])

  if (!open) return null
  const close = () => game.openPanel(null)
  const visible = SPECIES.filter((s) => !s.secret || spotted[s.id])
  const seenCount = SPECIES.filter((s) => !s.secret && spotted[s.id]).length
  const total = SPECIES.filter((s) => !s.secret).length
  const shownBadges = BADGES.filter((b) => !b.secret || badges[b.id])
  const earned = BADGES.filter((b) => badges[b.id]).length

  return (
    <Dialog id="album" kicker="Your photo album" title={`${seenCount} of ${total} photographed`} onClose={close} className="album">
      <p className="album__intro">
        Animals come and go along the trail. Move close and they react — tap or click one to take its photo. Some are shy,
        some only come out at night, some only in certain seasons.
      </p>
      <ul className="album-grid">
        {visible.map((s) => {
          const seen = Boolean(spotted[s.id])
          const sprite = SPECIES_SPRITES[s.id]
          const others = stats?.sightings[s.id]
          return (
            <li key={s.id} className={`album-card${seen ? ' is-seen' : ''}`}>
              <div className="album-card__photo">
                <PixelSprite sprite={seen ? sprite : silhouette(sprite)} scale={sprite.w > 16 ? 3 : 4} />
              </div>
              <h3 className="album-card__name">{seen ? s.name : `${s.name}?`}</h3>
              <p className="album-card__local">
                {s.local} · <i>{s.latin}</i>
              </p>
              {seen ? (
                <p className="album-card__text">{s.fact}</p>
              ) : (
                <p className="album-card__text album-card__hint">
                  <b>{s.where}.</b> {s.hint}
                </p>
              )}
              {s.id === 'edelweiss' && (
                <p className="album-card__meta">
                  {edelweiss.length} of {EDELWEISS_TOTAL} found
                </p>
              )}
              {seen && others ? <p className="album-card__meta">Photographed by {others.toLocaleString('en-GB')} visitors</p> : null}
            </li>
          )
        })}
      </ul>

      <h3 className="album__subtitle">
        Badges <small>({earned} earned)</small>
      </h3>
      <ul className="badge-grid">
        {shownBadges.map((b) => {
          const got = Boolean(badges[b.id])
          return (
            <li key={b.id} className={`badge${got ? ' is-earned' : ''}`}>
              <span className="badge__icon" aria-hidden="true">
                {b.icon}
              </span>
              <div>
                <b>{b.title}</b>
                <p>{got ? b.done : b.hint}</p>
              </div>
              <span className="sr-only">{got ? 'Earned' : 'Not yet earned'}</span>
            </li>
          )
        })}
      </ul>

      <div className="album__footer">
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => {
            if (window.confirm('Start again? This clears your photos, badges and choices in this browser.')) game.resetProgress()
          }}
        >
          Start again
        </button>
      </div>
    </Dialog>
  )
}
