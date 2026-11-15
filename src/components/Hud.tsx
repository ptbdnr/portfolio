import { Link, useLocation } from 'react-router'
import { SPECIES } from '../content/species.ts'
import { ICONS } from '../game/icons.ts'
import { DOING, PLACE } from '../lib/places.ts'
import { game, isNight, useGame } from '../lib/store.ts'
import { PixelSprite } from './PixelSprite.tsx'

export function Hud() {
  const { pathname } = useLocation()
  const altitude = useGame((s) => s.live.altitude)
  const biome = useGame((s) => s.live.biome)
  const mode = useGame((s) => s.live.mode)
  const photos = useGame((s) => SPECIES.filter((sp) => !sp.secret && s.spotted[sp.id]).length)
  const panel = useGame((s) => s.panel)
  const night = useGame(isNight)
  const simple = useGame((s) => s.settings.simple)
  const onHome = pathname === '/'
  const blog = pathname.startsWith('/blog')

  return (
    <header className="hud" data-solid>
      <Link to="/" className="hud__brand">
        <span className="hud__logo" aria-hidden="true">
          PB
        </span>
        <span className="hud__name">Peter Bodnar</span>
      </Link>

      {onHome && !simple && (
        <p className="hud__where" title="Where you are on the trail">
          <span className="hud__doing">{DOING[mode]}</span>
          <span className="hud__place"> · {PLACE[biome]}</span>
          <span className="hud__alt"> · {Math.max(0, altitude).toLocaleString('en-GB')} m</span>
        </p>
      )}
      <span className="hud__spacer" />

      <nav className="hud__nav" aria-label="Main">
        <Link to="/blog" aria-current={blog ? 'page' : undefined}>
          <PixelSprite sprite={ICONS.book} scale={2} className="icon-mono" />
          Blog
        </Link>
        <Link to="/#contact">
          <PixelSprite sprite={ICONS.mail} scale={2} className="icon-mono" />
          Contact
        </Link>
      </nav>

      <div className="hud__actions">
        <button
          type="button"
          className="hud__btn hud__btn--photos"
          aria-haspopup="dialog"
          aria-expanded={panel === 'album'}
          onClick={() => game.openPanel(panel === 'album' ? null : 'album')}
        >
          <PixelSprite sprite={ICONS.camera} scale={2} className="icon-mono" />
          <span className="hud__label">Photos</span>
          <span className="hud__count" aria-label={`${photos} photographed`}>
            {photos}
          </span>
        </button>
        <button type="button" className="hud__btn hud__btn--theme" onClick={() => game.toggleNight()}>
          <PixelSprite sprite={night ? ICONS.sun : ICONS.moon} scale={2} />
          <span className="sr-only">Switch to </span>
          <span className="hud__label">{night ? 'Day' : 'Night'}</span>
        </button>
        <button
          type="button"
          className="hud__btn hud__btn--help"
          aria-haspopup="dialog"
          aria-expanded={panel === 'help'}
          onClick={() => game.openPanel(panel === 'help' ? null : 'help')}
        >
          <PixelSprite sprite={ICONS.help} scale={2} className="icon-mono" />
          <span className="hud__label">Help</span>
        </button>
        <button
          type="button"
          className="hud__btn hud__btn--menu"
          aria-haspopup="dialog"
          aria-expanded={panel === 'settings'}
          onClick={() => game.openPanel(panel === 'settings' ? null : 'settings')}
        >
          <PixelSprite sprite={ICONS.menu} scale={2} className="icon-mono" />
          <span className="hud__label">Menu</span>
        </button>
      </div>
    </header>
  )
}
