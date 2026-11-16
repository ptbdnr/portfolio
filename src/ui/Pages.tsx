/** Pages with their own address, opened over the trail: about me, contact, and "off the trail". */
import { Link, useLocation } from 'react-router'
import { SCENES } from '../content/trail.ts'
import { useEngine } from './engineContext.ts'
import { SummitBook } from './blog/SummitBook.tsx'
import { useDocumentTitle } from './helpers.ts'
import { NOTES } from './panels/notes.tsx'
import { Panel } from './Panel.tsx'

export function AboutPanel({ onClose }: { onClose: () => void }) {
  useDocumentTitle('About')
  const engine = useEngine()
  const stops = SCENES.filter((s) => s.notes.some((n) => n.id !== 'logbook' && n.id !== 'summit-book'))
  return (
    <Panel id="about" kicker="About me" title={NOTES.hello.title} onClose={onClose} className="note">
      {NOTES.hello.body()}
      <h3 className="note-sub">More along the trail</h3>
      <ul className="plain-list">
        {stops.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                onClose()
                engine?.jump(s.id)
              }}
            >
              {s.name}
            </button>
            : {s.notes.map((n) => n.label).join(', ')}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function ContactPanel({ onClose }: { onClose: () => void }) {
  useDocumentTitle('Contact')
  return (
    <Panel id="contact" kicker="Contact" title="The summit book" onClose={onClose} className="note">
      <SummitBook />
    </Panel>
  )
}

export function NotFoundPanel({ onClose }: { onClose: () => void }) {
  const { pathname } = useLocation()
  useDocumentTitle('Off the trail')
  return (
    <Panel id="not-found" kicker="404" title="Off the trail" onClose={onClose}>
      <p className="lead">There’s nothing at {pathname}. It happens to the best navigators.</p>
      <p>
        <button type="button" className="btn" onClick={onClose}>
          Back to the trail
        </button>{' '}
        <Link className="btn btn--ghost" to="/blog">
          The blog
        </Link>
      </p>
    </Panel>
  )
}
