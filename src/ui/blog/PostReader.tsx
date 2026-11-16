/** A blog post, opened over the trail like a page of the hut's logbook. */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { markdownPath, plainPath } from '../../../shared/markdownAlternates.ts'
import { SCENE_BY_ID, type SceneId } from '../../content/trail.ts'
import { GRADES, GRADE_NAMES, POSTS, POSTS_BY_SLUG, formatDate, loadBody, relatedPosts, signTime, type Post as PostT } from '../../lib/logbook.ts'
import { game, useGame } from '../../lib/store.ts'
import { sound, useEngine } from '../engineContext.ts'
import { PLACEMENT, useDocumentTitle } from '../helpers.ts'
import { Panel } from '../Panel.tsx'
import { Markdown } from './Markdown.tsx'

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

function Meta({ post }: { post: PostT }) {
  return (
    <dl className="post-meta">
      <div>
        <dt>Time</dt>
        <dd>
          <abbr title={`About ${post.minutes} minute${post.minutes === 1 ? '' : 's'} to read, written like the walking times on Alpine signposts`}>{signTime(post.minutes)}</abbr>
        </dd>
      </div>
      <div>
        <dt>Grade</dt>
        <dd>
          <abbr title={`${GRADE_NAMES[post.grade]}. Graded like a climb, from F to ED: the longer the read and the more code or maths, the harder.`}>{post.grade}</abbr>
          <span className="grade-scale" aria-hidden="true">
            {GRADES.map((g) => (
              <i key={g} className={g === post.grade ? 'is-this' : ''} />
            ))}
          </span>
        </dd>
      </div>
      <div>
        <dt>Ascent</dt>
        <dd>
          <abbr title="One word, one metre: the climb from the first line to the last">↑ {post.words.toLocaleString('en-GB')} m</abbr>
        </dd>
      </div>
    </dl>
  )
}

function PostView({ post, plain, onClose, onProgress }: { post: PostT; plain: boolean; onClose: () => void; onProgress?: (p: number) => void }) {
  useDocumentTitle(post.title)
  const { body, failed, retry } = useBody(post.slug)
  const [progress, setProgress] = useState(0)
  const report = useRef(onProgress)
  useEffect(() => {
    report.current = onProgress
  })
  useEffect(() => {
    report.current?.(progress)
  }, [progress])
  const article = useRef<HTMLElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const engine = useEngine()
  const stamped = useGame((s) => Boolean(s.progress.stamps[post.slug]))
  const sceneId = PLACEMENT.sceneOf.get(post.slug) as SceneId | undefined
  const scene = sceneId ? SCENE_BY_ID.get(sceneId) : undefined
  const related = relatedPosts(post, POSTS)
  const index = POSTS.findIndex((p) => p.slug === post.slug)
  const newer = index > 0 ? POSTS[index - 1] : null
  const older = index < POSTS.length - 1 ? POSTS[index + 1] : null

  // How far up the post you are, for the altimeter.
  useEffect(() => {
    const el = article.current
    if (!el) return
    const scroller = plain ? window : (el.closest('.panel__body') as HTMLElement | null)
    if (!scroller) return
    const onScroll = () => {
      const r = el.getBoundingClientRect()
      const total = Math.max(1, r.height - window.innerHeight * 0.7)
      setProgress(Math.min(1, Math.max(0, (window.innerHeight * 0.2 - r.top) / total)))
    }
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [plain, body])

  useEffect(() => {
    const el = end.current
    if (!body || !el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !game.get().progress.stamps[post.slug]) {
        game.stamp(post.slug)
        sound.ui('chime')
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [post, body])

  // A link to a section (#heading) can only scroll there once the text has arrived.
  useEffect(() => {
    if (!body || !window.location.hash) return
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView()
  }, [body])

  return (
    <article ref={article} className="post">
      {!plain && (
        <div className="altimeter" aria-hidden="true">
          <div className="altimeter__fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      <nav className="post__crumbs" aria-label="Breadcrumb and other versions">
        <Link to="/blog">← All posts</Link>
        <span>
          <a href={plainPath(post.slug)}>Plain version</a>
          <a href={markdownPath(post.slug)} type="text/markdown">
            Markdown
          </a>
        </span>
      </nav>
      <header className="post__header">
        <p className="kicker">
          <time dateTime={post.date}>{formatDate(post.date)}</time> · No. {post.page}
          {scene && !plain && (
            <>
              {' · pinned at '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  onClose()
                  engine?.jump(scene.id)
                }}
              >
                {scene.name}
              </button>
            </>
          )}
        </p>
        <h1 className="post__title">{post.title}</h1>
        {post.summary && <p className="post__summary">{post.summary}</p>}
        <Meta post={post} />
        {post.tags.length > 0 && (
          <ul className="tags" aria-label="Tags">
            {post.tags.map((t) => (
              <li key={t}>
                <Link to={`/blog?tag=${encodeURIComponent(t)}`}>#{t}</Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      {body !== undefined ? (
        <Markdown source={body} />
      ) : failed ? (
        <p className="post__loading" role="alert">
          Couldn’t load this post: the connection may have dropped.{' '}
          <button type="button" className="btn btn--ghost btn--small" onClick={retry}>
            Try again
          </button>
        </p>
      ) : (
        <p className="post__loading" role="status">
          Opening the logbook…
        </p>
      )}

      <div ref={end} className={`post__summit${stamped ? ' is-stamped' : ''}`}>
        <span className="post__stamp" aria-hidden="true">
          <b>{post.grade}</b>
          <small>{post.date.slice(0, 7)}</small>
        </span>
        <div>
          <p className="post__summit-title">Summit reached · ↑ {post.words.toLocaleString('en-GB')} m</p>
          <p>
            {stamped ? 'Stamped in your logbook. ' : ''}Thoughts, questions or a better route? <Link to="/contact">Drop me a message</Link>.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="post__related" aria-labelledby="related-title">
          <h2 id="related-title" className="kicker">
            You might also like
          </h2>
          <ul>
            {related.map(({ post: r, shared }) => (
              <li key={r.slug}>
                <Link to={`/blog/${r.slug}`}>
                  <span>{r.title}</span>
                  <small>
                    {signTime(r.minutes)} · {r.grade}
                    {shared.length ? ` · #${shared.join(' #')}` : ''}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="post__pager" aria-label="More posts">
        {older ? <Link to={`/blog/${older.slug}`}>← {older.title}</Link> : <span />}
        {newer && <Link to={`/blog/${newer.slug}`}>{newer.title} →</Link>}
      </nav>
      {!plain && (
        <p className="post__back">
          <button type="button" className="btn" onClick={onClose}>
            Back to the trail
          </button>
        </p>
      )}
    </article>
  )
}

export default function PostReader({ slug, onClose, plain = false }: { slug: string; onClose: () => void; plain?: boolean }) {
  const post = POSTS_BY_SLUG.get(slug)
  const [progress, setProgress] = useState(0)
  if (!post) return null
  if (plain) return <PostView key={post.slug} post={post} plain onClose={onClose} />
  // How high up the post you've climbed (one word, one metre), shown in the sheet's header.
  const kicker = (
    <>
      Blog
      <span className={`kicker__ascent${progress > 0.02 ? ' is-on' : ''}`} aria-hidden="true">
        {' · '}↑ {Math.round(progress * post.words).toLocaleString('en-GB')} / {post.words.toLocaleString('en-GB')} m
      </span>
    </>
  )
  return (
    <Panel id="post" kicker={kicker} title={<span className="sr-only">{post.title}</span>} onClose={onClose} layout="sheet" className="sheet--post">
      <PostView key={post.slug} post={post} plain={false} onClose={onClose} onProgress={setProgress} />
    </Panel>
  )
}
