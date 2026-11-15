import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { STAGES } from '../game/engine/world.ts'
import { worldBus } from '../game/worldBus.ts'
import { useDocumentTitle } from '../lib/hooks.ts'

/** 404 — you fell into a crevasse. */
export default function NotFound() {
  useDocumentTitle('Lost in a crevasse')
  const [count, setCount] = useState(9)

  useEffect(() => worldBus.setTarget(STAGES.crevasseIn), [])
  useEffect(() => {
    if (count <= 0) return
    const id = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [count])

  return (
    <div className="page page--lost">
      <section className="panel lost" data-solid aria-labelledby="lost-title">
        <p className="kicker">Error 404</p>
        <h1 id="lost-title" className="pixel-title lost__title">
          GAME OVER
        </h1>
        <p>You stepped off the trail and into a crevasse. Happens to the best of us — this page doesn’t exist.</p>
        <p className="lost__continue" aria-live="polite">
          CONTINUE? <span className="lost__count">{count > 0 ? count : 'YES'}</span>
        </p>
        <div className="lost__actions">
          <Link className="btn" to="/">
            ▶ BACK TO THE TRAILHEAD
          </Link>
          <Link className="btn btn--ghost" to="/blog">
            Blog
          </Link>
        </div>
      </section>
    </div>
  )
}
