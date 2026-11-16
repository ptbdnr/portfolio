/** The interactive parts of some notes: the places map and timeline, ideas, the hut. */
import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { chapters, haunts, ideas, profile } from '../../content/profile.ts'
import { POSTS } from '../../lib/logbook.ts'
import { game } from '../../lib/store.ts'
import { useEngine } from '../engineContext.ts'

const PlacesMap = lazy(() => import('./PlacesMap.tsx'))

export function Links() {
  const links = profile.links.filter((l) => l.href)
  if (!links.length) return null
  return (
    <p className="note-links">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
          {l.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
    </p>
  )
}

export function Places() {
  const [active, setActive] = useState<string | null>(chapters[0].id)
  const chapter = chapters.find((c) => c.id === active)
  return (
    <>
      <p className="lead">Six chapters in five countries so far. Click a number on the map, or read down the list.</p>
      <Suspense fallback={<div className="places-map places-map--loading" />}>
        <PlacesMap active={active} onPick={setActive} />
      </Suspense>
      {chapter && (
        <p className="places-greeting" aria-live="polite">
          <b>{chapter.greeting}</b> {chapter.place}, {chapter.when.toLowerCase()}
        </p>
      )}
      <ol className="timeline">
        {chapters.map((c) => (
          <li key={c.id} className={c.id === active ? 'is-active' : ''}>
            <button type="button" onClick={() => setActive(c.id)}>
              <span className="timeline__when">{c.when}</span>
              <span className="timeline__title">{c.title}</span>
            </button>
            <p>{c.text}</p>
          </li>
        ))}
      </ol>
      <h3 className="note-sub">Places I keep going back to</h3>
      <ul className="plain-list">
        {haunts.map((h) => (
          <li key={h.id}>
            <b>{h.label}.</b> {h.note}
          </li>
        ))}
      </ul>
    </>
  )
}

export function Ideas() {
  return (
    <>
      <p className="lead">Threads that run through most of what I write. Each one leads to the posts about it.</p>
      <ul className="idea-list">
        {ideas.map((idea) => {
          const count = POSTS.filter((p) => p.tags.includes(idea.tag)).length
          return (
            <li key={idea.tag}>
              <Link to={`/blog?tag=${encodeURIComponent(idea.tag)}`}>
                <span>{idea.title}</span>
                <small>
                  #{idea.tag} · {count} post{count === 1 ? '' : 's'}
                </small>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function HutNote() {
  const engine = useEngine()
  const navigate = useNavigate()
  return (
    <>
      <p className="lead">Every mountain hut has a logbook by the door. Mine is inside, on the long table: every blog post I’ve written.</p>
      <p>
        Past the hut, the path forks. <b>Over the rocks</b> is a scramble with a view of two lakes; <b>round the lake</b> is gentler, past ice and snowy peaks. Both
        reach the summit.
      </p>
      <div className="note-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            game.close()
            engine?.walkTo('inside')
          }}
        >
          Step inside
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/blog')}>
          Open the logbook
        </button>
      </div>
    </>
  )
}

