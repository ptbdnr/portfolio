import { Link } from 'react-router'
import { STAGES } from '../../game/engine/world.ts'
import { POSTS, formatDate, signTime } from '../../lib/logbook.ts'
import { game, useGame } from '../../lib/store.ts'
import { HutInterior } from './HutInterior.tsx'

export function Hut() {
  const choice = useGame((s) => s.choices.hut)
  const simple = useGame((s) => s.settings.simple)
  const reduced = useGame((s) => s.reducedMotion)
  const inside = choice === 'inside' || simple
  const latest = POSTS.slice(0, 3)

  const walkOn = () => {
    game.setChoice('hut', 'outside')
    document.getElementById('fork')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <section id="hut" className="stage" data-stage={STAGES.hut} aria-labelledby="hut-title">
      <div className={`panel stage__panel hut${inside ? ' is-inside' : ''}`} data-solid>
        <p className="kicker">Rifugio · 2,400 m</p>
        {!inside ? (
          <>
            <h2 id="hut-title" className="pixel-title">
              A mountain hut
            </h2>
            <p>
              Smoke from the chimney, soup on the stove, and a shelf of my notebooks — that’s where my blog lives. Fancy a
              break?
            </p>
            <div className="choice-row">
              <button type="button" className="btn" onClick={() => game.setChoice('hut', 'inside')}>
                Step inside
              </button>
              <button type="button" className="btn btn--ghost" onClick={walkOn}>
                Keep walking
              </button>
            </div>
            {choice === 'outside' && <p className="hut__later">No problem — the blog is always one click away in the top bar.</p>}
          </>
        ) : (
          <>
            <h2 id="hut-title" className="pixel-title">
              {simple ? 'My blog' : 'Inside the hut'}
            </h2>
            {!simple && <HutInterior />}
            <p>Warm soup, wooden bunks and my notebooks on the shelf. Here’s what I’ve been writing about lately:</p>
            <ul className="signs">
              {latest.map((p) => (
                <li key={p.slug}>
                  <Link className="sign" to={`/blog/${p.slug}`}>
                    <span className="sign__title">{p.title}</span>
                    <span className="sign__time">{signTime(p.minutes)}</span>
                    <span className="sign__meta">{formatDate(p.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="choice-row">
              <Link className="btn" to="/blog">
                All blog posts
              </Link>
              {!simple && (
                <button type="button" className="btn btn--ghost" onClick={walkOn}>
                  Head back outside
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
