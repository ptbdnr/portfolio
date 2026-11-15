import { Link } from 'react-router'
import { game, useGame, type Settings } from '../lib/store.ts'
import { profile } from '../content/profile.ts'
import { Dialog } from './Dialog.tsx'

type Option<T extends string> = { value: T; label: string }

function Choice<T extends string>(props: {
  legend: string
  hint?: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="choice">
      <legend>{props.legend}</legend>
      {props.hint && <p className="choice__hint">{props.hint}</p>}
      <div className="segmented">
        {props.options.map((o) => (
          <button key={o.value} type="button" aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const onOff = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as Option<'on' | 'off'>[]

/** The menu: places to go, plus every setting in plain words. */
export function SettingsPanel() {
  const panel = useGame((s) => s.panel)
  const settings = useGame((s) => s.settings)
  if (panel !== 'settings') return null
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => game.setSetting(key, value)
  const close = () => game.openPanel(null)

  return (
    <Dialog id="menu" title="Menu" onClose={close} className="sheet">
      <nav className="menu-links" aria-label="Go to">
        <Link to="/#welcome" onClick={close}>
          Start of the trail
        </Link>
        <Link to="/#about" onClick={close}>
          About me
        </Link>
        <Link to="/blog" onClick={close}>
          Blog
        </Link>
        <button type="button" onClick={() => game.openPanel('album')}>
          Photo album &amp; badges
        </button>
        <Link to="/#contact" onClick={close}>
          Contact me
        </Link>
        <button type="button" onClick={() => game.openPanel('help')}>
          How this site works
        </button>
        {profile.links
          .filter((l) => l.href)
          .map((l) => (
            <a key={l.label} href={l.href} rel="me noopener" target="_blank">
              {l.label} <span aria-hidden="true">&nbsp;↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ))}
      </nav>

      <h3 className="menu-heading">Settings</h3>
      <Choice
        legend="Simple view"
        hint="A plain, easy-to-read page without the game."
        options={onOff}
        value={settings.simple ? 'on' : 'off'}
        onChange={(v) => set('simple', v === 'on')}
      />
      <Choice
        legend="Day or night"
        hint="At night your head torch follows the pointer."
        options={[
          { value: 'auto', label: 'Same as my device' },
          { value: 'day', label: 'Day' },
          { value: 'night', label: 'Night' },
        ]}
        value={settings.theme}
        onChange={(v) => {
          set('theme', v)
          if (v === 'night') game.badge('nightwalker')
        }}
      />
      <Choice legend="Sound" hint="Little 8-bit sound effects." options={onOff} value={settings.sound ? 'on' : 'off'} onChange={(v) => set('sound', v === 'on')} />
      <Choice
        legend="Season"
        hint="Automatic: the seasons change as you climb, and simple view shows today’s season."
        options={[
          { value: 'auto', label: 'Automatic' },
          { value: 'spring', label: 'Spring' },
          { value: 'summer', label: 'Summer' },
          { value: 'autumn', label: 'Autumn' },
          { value: 'winter', label: 'Winter' },
        ]}
        value={settings.season}
        onChange={(v) => set('season', v)}
      />
      <Choice
        legend="Animals & weather"
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off (calmer)' },
        ]}
        value={settings.wildlife ? 'on' : 'off'}
        onChange={(v) => set('wildlife', v === 'on')}
      />
      <Choice legend="Old TV effect" hint="Faint scan lines over the scenery." options={onOff} value={settings.crt ? 'on' : 'off'} onChange={(v) => set('crt', v === 'on')} />
      <p className="menu-note">Your settings, photos and badges are saved in this browser only — nothing is tracked.</p>
    </Dialog>
  )
}
