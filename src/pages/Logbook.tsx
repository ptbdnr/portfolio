import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { bakeText } from '../game/engine/font.ts'
import { STAGES } from '../game/engine/world.ts'
import { worldBus } from '../game/worldBus.ts'
import { isTypingTarget, useDocumentTitle } from '../lib/hooks.ts'
import { POSTS, POSTS_BY_PAGE, allTags, formatDate, signTime } from '../lib/logbook.ts'
import { sfx } from '../lib/sfx.ts'
import { useGame } from '../lib/store.ts'

const FASTEXT = ['red', 'green', 'yellow', 'cyan'] as const
/** Posts per page of the list. */
const PER_PAGE = 20
const ROW_COLORS = ['#ff4d4d', '#ffd84d', '#4dff88', '#4dd8ff', '#ff6df0', '#ffffff']

/** Big chunky teletext-style mosaic heading. */
function Mosaic({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const glyphs = bakeText(text, '#ffffff')
    const g = glyphs.getContext('2d')!.getImageData(0, 0, glyphs.width, glyphs.height).data
    const B = 6
    canvas.width = glyphs.width * B
    canvas.height = glyphs.height * B
    const ctx = canvas.getContext('2d')!
    for (let y = 0; y < glyphs.height; y++) {
      for (let x = 0; x < glyphs.width; x++) {
        if (g[(y * glyphs.width + x) * 4 + 3] < 128) continue
        ctx.fillStyle = ROW_COLORS[y % ROW_COLORS.length]
        ctx.fillRect(x * B, y * B, B - 1, B - 1)
      }
    }
  }, [text])
  return <canvas ref={ref} className="teletext__mosaic" role="img" aria-label={text} />
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function Logbook() {
  useDocumentTitle('Blog')
  const now = useClock()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const reduced = useGame((s) => s.reducedMotion)
  const tag = params.get('tag') ?? ''
  const query = params.get('q') ?? ''
  const [entry, setEntry] = useState('')
  const [status, setStatus] = useState('')
  const [counter, setCounter] = useState(reduced ? 200 : 100)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => worldBus.setTarget(STAGES.hut), [])

  // Teletext "searching for page" counter on arrival.
  useEffect(() => {
    if (counter >= 200) return
    const id = setTimeout(() => setCounter((c) => Math.min(200, c + 7)), 18)
    return () => clearTimeout(id)
  }, [counter])

  const tags = useMemo(() => allTags(POSTS), [])
  const fastext = [...tags.slice(0, 3).map(([t]) => t), '']

  const posts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return POSTS.filter(
      (p) =>
        (!tag || p.tags.includes(tag)) &&
        (!q || `${p.title} ${p.summary} ${p.tags.join(' ')}`.toLowerCase().includes(q)),
    )
  }, [tag, query])

  // A page at a time, so the list stays quick to scan however many posts there are.
  const pages = Math.max(1, Math.ceil(posts.length / PER_PAGE))
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.get('page'))) || 1))
  const shown = posts.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const setFilter = (key: 'tag' | 'q', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next, { replace: true })
  }

  const goTo = (to: number) => {
    const next = new URLSearchParams(params)
    if (to > 1) next.set('page', String(to))
    else next.delete('page')
    setParams(next)
    sfx.play('blip')
    listRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
  }

  // Type a page number anywhere on the page, like on a real teletext remote.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) {
        sfx.play('blip')
        setEntry((prev) => {
          const next = (prev + e.key).slice(-3)
          if (next.length === 3) {
            const page = Number(next)
            const post = POSTS_BY_PAGE.get(page)
            if (post) setTimeout(() => navigate(`/blog/${post.slug}`), 250)
            else if (page === 200) setStatus('')
            else {
              setStatus(`P${next} NOT IN SERVICE`)
              setTimeout(() => setStatus(''), 1800)
            }
            setTimeout(() => setEntry(''), 600)
          }
          return next
        })
      }
      const colorKey = { r: 0, g: 1, y: 2, c: 3 }[e.key.toLowerCase()]
      if (colorKey !== undefined) setFilter('tag', fastext[colorKey])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const time = now.toLocaleTimeString('en-GB', { hour12: false })
  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
  const pageLabel = entry ? `P${entry.padEnd(3, '-')}` : `P${counter}`

  return (
    <div className="page page--logbook">
      <div className="tv" data-solid>
        <div className="tv__screen teletext">
          <header className="teletext__header" aria-label="Teletext header">
            <span className="tt-white">{pageLabel}</span>
            <span className="tt-cyan">HUT2HUT</span>
            <span className="tt-yellow">200</span>
            <span className="tt-white teletext__clock">
              {date} {time}
            </span>
          </header>
          {status && <p className="teletext__status tt-red">{status}</p>}
          <h1 className="teletext__title">
            <Mosaic text="THE BLOG" />
          </h1>
          <p className="teletext__bar">
            <span className="tt-yellow">NOTES ON AI, WORK &amp; MOUNTAINS</span>
          </p>
          <p className="teletext__intro tt-cyan">
            Tap a title to read a post — or, like 1980s teletext, type its page number.
          </p>

          <label className="teletext__search">
            <span className="tt-green">SEARCH&gt;</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setFilter('q', e.target.value)}
              placeholder="avalanche, calibration…"
              aria-label="Search the blog"
            />
          </label>

          <ol ref={listRef} className="teletext__list">
            {shown.map((p) => (
              <li key={p.slug} className="teletext__item">
                <span className="teletext__page tt-yellow">{p.page}</span>
                <div>
                  <Link className="teletext__link" to={`/blog/${p.slug}`}>
                    {p.title}
                  </Link>
                  <p className="teletext__summary">{p.summary}</p>
                  <p className="teletext__meta">
                    <span className="tt-cyan">{formatDate(p.date)}</span>
                    <span className="tt-white">
                      {p.grade} · {signTime(p.minutes)}
                    </span>
                    {p.tags.map((t) => (
                      <button key={t} type="button" className="tt-green teletext__tag" onClick={() => setFilter('tag', t)}>
                        #{t}
                      </button>
                    ))}
                  </p>
                </div>
              </li>
            ))}
            {!posts.length && <li className="tt-red">NO ENTRIES ON THIS PAGE. TRY ANOTHER FILTER.</li>}
          </ol>

          {pages > 1 && (
            <nav className="teletext__pager" aria-label="More posts">
              <button type="button" className="tt-cyan" disabled={page === 1} onClick={() => goTo(page - 1)}>
                ◀ NEWER
              </button>
              <span className="tt-white" aria-live="polite">
                PAGE {page}/{pages}
              </span>
              <button type="button" className="tt-cyan" disabled={page === pages} onClick={() => goTo(page + 1)}>
                OLDER ▶
              </button>
            </nav>
          )}

          <p className="teletext__key">
            <span className="tt-yellow">KEY</span>
            <span className="tt-cyan">
              GRADE <span className="tt-white">F</span> EASY ▸ <span className="tt-white">ED</span> EXTREME, LIKE ALPINE CLIMBS
            </span>
            <span className="tt-cyan">
              <span className="tt-white">0h07</span> = A 7 MINUTE READ
            </span>
          </p>

          <nav className="fastext" aria-label="Filter by topic">
            {FASTEXT.map((color, i) => {
              const value = fastext[i]
              const active = tag === value || (!tag && !value)
              return (
                <button
                  key={color}
                  type="button"
                  className={`fastext__btn fastext__btn--${color}`}
                  aria-pressed={active}
                  onClick={() => setFilter('tag', value)}
                >
                  {value ? value.toUpperCase() : 'ALL'}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="tv__chin">
          <span className="tv__brand">BODNAR·TV</span>
          <span className="tv__led" aria-hidden="true" />
          <Link to="/" className="tv__knob">
            ◀ Back to the journey
          </Link>
        </div>
      </div>
    </div>
  )
}
