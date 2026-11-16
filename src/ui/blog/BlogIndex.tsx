/** The hut's logbook: every blog post, newest first, with search and filters. */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LLMS_TXT } from '../../../shared/markdownAlternates.ts'
import { SCENE_BY_ID, type SceneId } from '../../content/trail.ts'
import { GRADE_NAMES, POSTS, allTags, formatDate, signTime } from '../../lib/logbook.ts'
import { useGame } from '../../lib/store.ts'
import { PLACEMENT, useDocumentTitle } from '../helpers.ts'
import { Panel } from '../Panel.tsx'

const PER_PAGE = 20

export function PostCard({ slug }: { slug: string }) {
  const post = POSTS.find((p) => p.slug === slug)!
  const read = useGame((s) => Boolean(s.progress.stamps[slug]))
  const place = SCENE_BY_ID.get(PLACEMENT.sceneOf.get(slug) as SceneId)
  return (
    <article className={`post-card${read ? ' is-read' : ''}`}>
      <p className="post-card__meta">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span aria-hidden="true"> · </span>
        <span title={`Reading time, like the walking times on Alpine signposts: ${post.minutes} min`}>{signTime(post.minutes)}</span>
        <span aria-hidden="true"> · </span>
        <span title={GRADE_NAMES[post.grade]}>{post.grade}</span>
        {place && (
          <>
            <span aria-hidden="true"> · </span>
            <span>{place.name}</span>
          </>
        )}
        {read && <span className="post-card__stamp">Read</span>}
      </p>
      <h3 className="post-card__title">
        <Link to={`/blog/${post.slug}`}>{post.title}</Link>
      </h3>
      {post.summary && <p className="post-card__summary">{post.summary}</p>}
      {post.tags.length > 0 && (
        <ul className="tags" aria-label="Tags">
          {post.tags.map((t) => (
            <li key={t}>
              <Link to={`/blog?tag=${encodeURIComponent(t)}`}>#{t}</Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function BlogIndex({ onClose, plain = false }: { onClose: () => void; plain?: boolean }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') ?? ''
  const tag = params.get('tag')
  const place = params.get('place') as SceneId | null
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  useDocumentTitle('Blog')

  // What's typed shows at once; the address follows a moment later (so typing is never held up by it).
  // A search that changes the address from elsewhere (back, forward, a link) replaces what's typed.
  const [query, setQuery] = useState(q)
  const [seen, setSeen] = useState(q)
  const [written, setWritten] = useState(q)
  if (q !== seen) {
    setSeen(q)
    if (q !== written) setQuery(q)
  }
  useEffect(() => {
    if (query === written) return
    const timer = setTimeout(() => {
      setWritten(query)
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (query) next.set('q', query)
          else next.delete('q')
          next.delete('page')
          return next
        },
        { replace: true },
      )
    }, 350)
    return () => clearTimeout(timer)
  }, [query, written, setParams])

  const tags = useMemo(() => allTags(POSTS), [])
  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return POSTS.filter((p) => {
      if (tag && !p.tags.includes(tag)) return false
      if (place && PLACEMENT.sceneOf.get(p.slug) !== place) return false
      const hay = `${p.title} ${p.summary} ${p.tags.join(' ')}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [query, tag, place])
  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE))
  const shown = results.slice((Math.min(page, pages) - 1) * PER_PAGE, Math.min(page, pages) * PER_PAGE)

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next, { replace: true })
  }

  const body = (
    <div className="blog-index">
      <p className="lead">
        Notes on applied AI, optimisation and uncertainty, and the odd day in the mountains. {POSTS.length} post{POSTS.length === 1 ? '' : 's'}, newest first.
        Each one is also pinned somewhere along the trail.
      </p>
      <div className="blog-filters">
        <label className="search">
          <span className="sr-only">Search the blog</span>
          <input type="search" placeholder="Search posts" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <ul className="tags tags--filter" aria-label="Filter by topic">
          {tags.map(([t, n]) => (
            <li key={t}>
              <button type="button" aria-pressed={tag === t} onClick={() => set('tag', tag === t ? null : t)}>
                #{t} <small>{n}</small>
              </button>
            </li>
          ))}
        </ul>
        {place && SCENE_BY_ID.get(place) && (
          <p className="blog-filters__place">
            Pinned at <b>{SCENE_BY_ID.get(place)!.name}</b>{' '}
            <button type="button" className="link-btn" onClick={() => set('place', null)}>
              show all
            </button>
          </p>
        )}
      </div>
      <p className="sr-only" role="status">
        {results.length} post{results.length === 1 ? '' : 's'} found
      </p>
      {shown.length ? (
        <div className="post-list">
          {shown.map((p) => (
            <PostCard key={p.slug} slug={p.slug} />
          ))}
        </div>
      ) : (
        <p className="empty">No posts match. Try another word or topic.</p>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-current={n === page ? 'page' : undefined}
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('page', String(n))
                navigate({ search: next.toString() })
              }}
            >
              {n}
            </button>
          ))}
        </nav>
      )}
      <p className="small blog-key">
        Time is the reading time, written like the walking times on Alpine signposts (0h07 = 7 minutes). Grades run like climbs, from F (an easy read) to ED (long,
        with code or maths). For AI tools there’s <a href={LLMS_TXT}>llms.txt</a>, and every post has a plain Markdown version.
      </p>
    </div>
  )

  if (plain) {
    return (
      <section className="plain-section" aria-labelledby="blog-title">
        <h1 id="blog-title">Blog</h1>
        {body}
      </section>
    )
  }
  return (
    <Panel id="blog" kicker="The hut’s logbook" title="Blog" onClose={onClose} layout="sheet" className="sheet--blog">
      {body}
    </Panel>
  )
}
