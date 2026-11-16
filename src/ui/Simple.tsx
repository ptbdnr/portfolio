/**
 * The simple view: everything on one plain page, no 3D. For anyone who prefers it, and for
 * browsers that can't show the walk.
 */
import { lazy, Suspense, useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { profile } from '../content/profile.ts'
import { SCENES } from '../content/trail.ts'
import { cardUrl } from '../engine/textures.ts'
import { POSTS, POSTS_BY_SLUG } from '../lib/logbook.ts'
import { game, useGame } from '../lib/store.ts'
import { BlogIndex, PostCard } from './blog/BlogIndex.tsx'
import { useDocumentTitle } from './helpers.ts'
import { SummitBook } from './blog/SummitBook.tsx'
import { NOTES } from './panels/notes.tsx'

const PostReader = lazy(() => import('./blog/PostReader.tsx'))

const SECTIONS = ['hello', 'places', 'work', 'rucksack', 'ideas'] as const
const OFF_THE_CLOCK = ['sardinia', 'windsurf', 'gravel', 'rock', 'ski'] as const

function Home() {
  useDocumentTitle('')
  return (
    <>
      <figure className="simple-hero">
        <img src={cardUrl('beach')} alt="A sandy beach with stone pines and a rocky headland, under a blue sky." />
      </figure>
      {SECTIONS.map((id) => (
        <section key={id} className="plain-section" aria-labelledby={`s-${id}`}>
          <p className="kicker">{NOTES[id].kicker}</p>
          <h2 id={`s-${id}`}>{NOTES[id].title}</h2>
          {NOTES[id].body()}
        </section>
      ))}
      <section className="plain-section" aria-labelledby="s-off">
        <p className="kicker">Off the clock</p>
        <h2 id="s-off">When I’m not working</h2>
        {OFF_THE_CLOCK.map((id) => (
          <div key={id}>
            <h3 className="note-sub">{NOTES[id].title}</h3>
            {NOTES[id].body()}
          </div>
        ))}
      </section>
      <section className="plain-section" aria-labelledby="s-summits">
        <p className="kicker">{NOTES.summits.kicker}</p>
        <h2 id="s-summits">{NOTES.summits.title}</h2>
        {NOTES.summits.body()}
      </section>
      <section className="plain-section" aria-labelledby="s-blog">
        <p className="kicker">The hut’s logbook</p>
        <h2 id="s-blog">Latest posts</h2>
        <div className="post-list">
          {POSTS.slice(0, 5).map((p) => (
            <PostCard key={p.slug} slug={p.slug} />
          ))}
        </div>
        <p>
          <Link to="/blog">All {POSTS.length} posts →</Link>
        </p>
      </section>
      <section className="plain-section" aria-labelledby="s-trail">
        <p className="kicker">The walk</p>
        <h2 id="s-trail">From the sea to the summit, and home</h2>
        <p>The full site is a walk through these places, in 360° photographs. Each stands in for part of the story.</p>
        <ul className="simple-trail">
          {SCENES.map((s) => (
            <li key={s.id}>
              <img src={cardUrl(s.id)} alt="" loading="lazy" />
              <b>{s.name}</b>
              <span>{s.blurb}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="plain-section" aria-labelledby="s-contact">
        <p className="kicker">Contact</p>
        <h2 id="s-contact">The summit book</h2>
        <SummitBook />
      </section>
    </>
  )
}

export function SimpleSite() {
  const { pathname } = useLocation()
  const noWebgl = useGame((s) => s.noWebgl)
  const slug = /^\/blog\/([^/]+)\/?$/.exec(pathname)?.[1]
  useEffect(() => {
    document.querySelector('.simple')?.scrollTo(0, 0)
  }, [pathname])
  let content
  if (slug && POSTS_BY_SLUG.has(slug)) {
    content = (
      <Suspense fallback={<p role="status">Opening the logbook…</p>}>
        <PostReader slug={slug} onClose={() => undefined} plain />
      </Suspense>
    )
  } else if (pathname.replace(/\/$/, '') === '/blog') content = <BlogIndex onClose={() => undefined} plain />
  else if (pathname === '/contact')
    content = (
      <section className="plain-section">
        <h1>The summit book</h1>
        <SummitBook />
      </section>
    )
  else content = <Home />
  return (
    <div className="simple">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="simple__head">
        <Link to="/" className="simple__name">
          {profile.name}
        </Link>
        <span className="simple__role">
          {profile.role}, {profile.home.split(',')[0]}
        </span>
        <nav aria-label="Site">
          <Link to="/">About</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/contact">Contact</Link>
          {!noWebgl && (
            <button type="button" className="link-btn" onClick={() => game.settings({ simple: false })}>
              Walk the trail (3D)
            </button>
          )}
        </nav>
      </header>
      {noWebgl && (
        <p className="simple__notice" role="status">
          This browser can’t show the 3D walk, so here is everything on one page.
        </p>
      )}
      <main id="main" className="simple__main" tabIndex={-1}>
        {content}
      </main>
      <footer className="simple__foot">
        <p>
          Photographs of real places from <a href="https://polyhaven.com">Poly Haven</a> (CC0). No cookies, no tracking.
        </p>
      </footer>
    </div>
  )
}
