import { HOW_TO } from '../content/howto.ts'
import { game, useGame } from '../lib/store.ts'
import { Dialog } from './Dialog.tsx'


export function HelpDialog() {
  const panel = useGame((s) => s.panel)
  const simple = useGame((s) => s.settings.simple)
  if (panel !== 'help') return null
  const close = () => game.openPanel(null)
  return (
    <Dialog id="help" kicker="Welcome" title="How this site works" onClose={close} className="help">
      <ol className="howto">
        {HOW_TO.map((h) => (
          <li key={h.title}>
            <span className="howto__icon" aria-hidden="true">
              {h.icon}
            </span>
            <div>
              <b>{h.title}</b>
              <p>{h.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="help__simple">
        Prefer to just read? <b>Simple view</b> shows everything as a normal, quiet page.
      </p>
      <div className="help__actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            game.setSetting('simple', !simple)
            close()
          }}
        >
          {simple ? 'Back to the journey' : 'Switch to simple view'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={close}>
          Got it
        </button>
      </div>
      <p className="menu-note">Keyboard: Tab moves between buttons, Enter presses them, Esc closes windows.</p>
    </Dialog>
  )
}
