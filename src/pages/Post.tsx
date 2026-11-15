import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { markdownPath, plainPath } from '../../shared/markdownAlternates.ts'
import { Hint } from '../components/Hint.tsx'
import { Markdown } from '../components/Markdown.tsx'
import { PixelSprite } from '../components/PixelSprite.tsx'
import { CLIMBER } from '../game/engine/sprites.ts'
import { worldBus } from '../game/worldBus.ts'
import { useDocumentTitle } from '../lib/hooks.ts'
import {
  GRADES,
  GRADE_NAMES,
  POSTS,
  POSTS_BY_SLUG,
  formatDate,
  loadBody,
  relatedPosts,
  signTime,
  type Grade,
  type Post as PostT,
} from '../lib/logbook.ts'
import { game, useGame } from '../lib/store.ts'
import NotFound from './NotFound.tsx'

/** Each season's stretch of the trail; the climber walks it as you read. */
const SEASON_SPAN: Record<PostT['season'], [number, number]> = {
  spring: [0.19, 0.24],
  summer: [0.1, 0.18],
  autumn: [0.56, 0.64],
  winter: [0.85, 0.93],
}

function HutStamp({ post }: { post: PostT }) {
  const id = `stamp-${post.slug}`
  return (
    <svg className="hut-stamp" viewBox="0 0 120 120" role="img" aria-label={`Hut stamp for page ${post.page}`}>
      <defs>
        <path id={id} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      <text fontFamily="'Press Start 2P', monospace" fontSize="8.5" fill="currentColor" letterSpacing="1">
        <textPath href={`#${id}`}>RIFUGIO · LOGBOOK · P{post.page} ·</textPath>
      </text>
      <text x="60" y="58" textAnchor="middle" fontFamily="'Press Start 2P', monospace" fontSize="11" fill="currentColor">
        {post.grade}
      </text>
      <text x="60" y="74" textAnchor="middle" fontFamily="'VT323', monospace" fontSize="13" fill="currentColor">
        {post.date.slice(0, 7)}
      </text>
    </svg>
  )
}

/** What the grade means, with the whole scale and this post's place on it. */
function GradeNote({ grade }: { grade: Grade }) {
  return (
    <>
      <span className="hint__title">Grade {grade}</span>
      <span className="hint__lead">{GRADE_NAMES[grade]}</span>
      <span>
        Posts are graded like alpine climbs: the longer the read, and the more code or maths in it, the harder the
        grade.
      </span>
      <span className="grade-scale" aria-hidden="true">
        {GRADES.map((g) => (
          <span key={g} className={`grade-scale__step grade-scale__step--${g.toLowerCase()}${g === grade ? ' is-this' : ''}`}>
            {g}
          </span>
        ))}
      </span>
      <span className="grade-scale__ends" aria-hidden="true">
        <span>easy</span>
        <span>extreme</span>
      </span>
      <span className="sr-only">From easiest to hardest, the grades are {GRADES.join(', ')}.</span>
    </>
  )
}

function ReadingAltimeter({ progress, words }: { progress: number; words: number }) {
  const metres = Math.round(progress * words)
  return (
    <div className="altimeter" aria-hidden="true">
      <span className="altimeter__label">
        ↑{metres.toLocaleString('en-GB')}
        <br />/{words.toLocaleString('en-GB')} m
      </span>
      <div className="altimeter__track">
        <div className="altimeter__fill" style={{ height: `${progress * 100}%` }} />
        <div className="altimeter__climber" style={{ bottom: `calc(${progress * 100}% - 6px)` }}>
          <PixelSprite sprite={CLIMBER.walk[Math.floor(progress * 40) % 4]} scale={2} />
        </div>
      </div>
    </div>
  )
}

/** The post's text, fetched when it's opened (the blog only ships every post's details up front). */
function useBody(slug: string) {
  const [state, setState] = useState<{ body?: string; failed?: boolean }>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    loadBody(slug).then(
      (body) => alive && setState({ body }),
      () => alive && setState({ failed: true }),
    )
    return () => {
      alive = false
    }
  }, [slug, attempt])
  return {
    ...state,
    retry: () => {
      setState({})
      setAttempt((n) => n + 1)
    },
  }
}

function PostView({ post }: { post: PostT }) {
  useDocumentTitle(post.title)
  const { body, failed, retry } = useBody(post.slug)
  const [progress, setProgress] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLElement>(null)
  const stamped = useGame((s) => Boolean(s.stamps[post.slug]))
  const related = relatedPosts(post, POSTS)
  const index = POSTS.findIndex((p) => p.slug === post.slug)
  const newer = index > 0 ? POSTS[index - 1] : null
  const older = index < POSTS.length - 1 ? POSTS[index + 1] : null

  useEffect(() => {
    const [from, to] = SEASON_SPAN[post.season]
    const onScroll = () => {
      const el = bodyRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const total = Math.max(1, r.height - window.innerHeight * 0.6)
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.25 - r.top) / total))
      setProgress(p)
      worldBus.setTarget(from + (to - from) * p)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [post])

  useEffect(() => {
    const el = endRef.current
    if (!body || !el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) game.stamp(post.slug)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [post, body])

  // A link to a section of the post (#heading) can only scroll there once the text has arrived.
  useEffect(() => {
    if (!body || !window.location.hash) return
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView()
  }, [body])

  return (
    <div className="page page--post">
      <ReadingAltimeter progress={progress} words={post.words} />
      <article ref={bodyRef} className="post" data-solid>
        <div className="post__crumbs">
          <nav aria-label="Breadcrumb">
            <Link to="/blog">◀ All blog posts</Link>
          </nav>
          {/* The same post without the decoration: a plain page for people, and Markdown for AI tools. */}
          <nav className="post__versions" aria-label="Other versions">
            <a href={plainPath(post.slug)}>Plain version</a>
            <a href={markdownPath(post.slug)} type="text/markdown">
              Markdown
            </a>
          </nav>
          <span>P{post.page}</span>
        </div>
        <header className="post__header">
          <HutStamp post={post} />
          <p className="kicker post__kicker">
            Blog post · {formatDate(post.date)}
          </p>
          <h1 className="post__title">{post.title}</h1>
          <p className="post__summary">{post.summary}</p>
          <dl className="post__meta">
            <div>
              <dt>Time</dt>
              <dd>
                <Hint
                  note={
                    <>
                      <span className="hint__title">Time {signTime(post.minutes)}</span>
                      <span>
                        About {post.minutes} minute{post.minutes === 1 ? '' : 's'} to read, written the way trail signs in
                        the Alps give walking times.
                      </span>
                    </>
                  }
                >
                  {signTime(post.minutes)}
                </Hint>
              </dd>
            </div>
            <div>
              <dt>Grade</dt>
              <dd>
                <Hint note={<GradeNote grade={post.grade} />}>{post.grade}</Hint>
              </dd>
            </div>
            <div>
              <dt>Ascent</dt>
              <dd>
                <Hint
                  note={
                    <>
                      <span className="hint__title">Ascent ↑ {post.words.toLocaleString('en-GB')} m</span>
                      <span>
                        One word, one metre: the climb from the first line to the last. Reach the end to summit and get
                        this post’s hut stamp.
                      </span>
                    </>
                  }
                >
                  ↑ {post.words.toLocaleString('en-GB')} m
                </Hint>
              </dd>
            </div>
          </dl>
          <ul className="post__tags" aria-label="Tags">
            {post.tags.map((t) => (
              <li key={t}>
                <Link to={`/blog?tag=${encodeURIComponent(t)}`} className="blaze">
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </header>

        {body !== undefined ? (
          <Markdown source={body} date={post.date} />
        ) : failed ? (
          <p className="post__loading" role="alert">
            Couldn’t load this post — the connection may have dropped.{' '}
            <button type="button" className="btn btn--ghost" onClick={retry}>
              Try again
            </button>
          </p>
        ) : (
          <p className="post__loading" role="status">
            Searching for P{post.page}…
          </p>
        )}

        <div ref={endRef} className={`post__summit${stamped ? ' is-stamped' : ''}`}>
          <span className="post__summit-flag" aria-hidden="true">
            ⚑
          </span>
          <div>
            <p className="post__summit-title">Summit reached · ↑ {post.words.toLocaleString('en-GB')} m</p>
            <p>{stamped ? 'Hut stamp added to your pass. ' : ''}Thoughts, questions or a better route? <Link to="/#contact">Drop me a message</Link>.</p>
          </div>
        </div>

        {related.length > 0 && (
          <section className="post__related" aria-labelledby="related-title">
            <h2 id="related-title" className="kicker">
              You might also like
            </h2>
            <ul className="signs signs--paper">
              {related.map(({ post: r, shared }) => (
                <li key={r.slug}>
                  <Link className="sign" to={`/blog/${r.slug}`}>
                    <span className="sign__title">{r.title}</span>
                    <span className="sign__time">{signTime(r.minutes)}</span>
                    <span className="sign__meta">
                      {r.grade}
                      {shared.length ? ` · shares #${shared.join(' #')}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="post__pager" aria-label="More entries">
          {older ? (
            <Link to={`/blog/${older.slug}`}>◀ P{older.page} {older.title}</Link>
          ) : (
            <span />
          )}
          {newer && <Link to={`/blog/${newer.slug}`}>P{newer.page} {newer.title} ▶</Link>}
        </nav>
      </article>
    </div>
  )
}

export default function Post() {
  const { slug = '' } = useParams()
  const post = POSTS_BY_SLUG.get(slug)
  if (!post) return <NotFound />
  return <PostView key={post.slug} post={post} />
}
