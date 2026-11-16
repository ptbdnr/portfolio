import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getConnInfo } from '@hono/node-server/conninfo'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import { contactSchema, type ContactResponse } from '../shared/contact.ts'
import { withBlogIndex } from '../shared/liveBlog.ts'
import { LLMS_TXT, MARKDOWN_TYPE, markdownAlternate, markdownPath, prefersMarkdown, withMarkdownLink } from '../shared/markdownAlternates.ts'
import { isSightingId } from '../shared/sightings.ts'
import type { Config } from './config.ts'
import { createLiveBlog } from './liveBlog.ts'
import type { Mailer } from './mailer.ts'
import { createMediaGate } from './mediaGate.ts'
import { createRateLimiter } from './rateLimit.ts'
import type { Store, StoredMessage } from './store.ts'

type Logger = Pick<Console, 'info' | 'warn' | 'error'>

export type AppDeps = {
  config: Config
  store: Store
  mailer: Mailer
  logger?: Logger
  now?: () => number
}

const MINUTE = 60_000

function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const SOUND_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg; codecs=opus',
}

/** The type to label a sound file with, by its name. */
export function soundType(path: string) {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase()
  return ext ? (SOUND_TYPES[ext] ?? null) : null
}

/** The blog's Markdown that the build wrote alongside the site (/llms.txt and /blog/<slug>.md), by address. */
function builtMarkdown(staticDir: string) {
  const files = new Map<string, string>()
  const llms = path.join(staticDir, 'llms.txt')
  if (existsSync(llms)) files.set(LLMS_TXT, readFileSync(llms, 'utf8'))
  const blog = path.join(staticDir, 'blog')
  if (existsSync(blog)) {
    for (const file of readdirSync(blog)) {
      if (file.endsWith('.md')) files.set(markdownPath(file.slice(0, -3)), readFileSync(path.join(blog, file), 'utf8'))
    }
  }
  return files
}

export function createApp({ config, store, mailer, logger = console, now = Date.now }: AppDeps) {
  const app = new Hono()
  const contactLimiter = createRateLimiter({ windowMs: 10 * MINUTE, max: 5, now })
  const statsLimiter = createRateLimiter({ windowMs: MINUTE, max: 60, now })
  // De-duplicate counters so a refresh-happy visitor doesn't inflate them.
  const visitSeen = createRateLimiter({ windowMs: 30 * MINUTE, max: 1, now })
  const sightingSeen = createRateLimiter({ windowMs: 60 * MINUTE, max: 1, now })

  app.use(
    '*',
    secureHeaders({
      // YouTube embeds need a referrer; keep it to the origin only.
      referrerPolicy: 'strict-origin-when-cross-origin',
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://player.vimeo.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    }),
  )

  if (config.corsOrigins.length) {
    app.use('/api/*', cors({ origin: config.corsOrigins, allowMethods: ['GET', 'POST'] }))
  }

  app.get('/api/health', (c) => c.json({ ok: true, mail: mailer.enabled }))

  app.post('/api/contact', bodyLimit({ maxSize: 16 * 1024 }), async (c) => {
    const ip = clientIp(c, config.trustProxy)
    if (!contactLimiter.hit(ip)) {
      return c.json<ContactResponse>(
        { ok: false, error: 'Too many messages from this rope team. Please try again in a few minutes.' },
        429,
      )
    }

    const body = await readJson(c)
    const parsed = contactSchema.safeParse(body)
    if (!parsed.success) {
      return c.json<ContactResponse>(
        { ok: false, error: 'Some fields need another look.', fieldErrors: z.flattenError(parsed.error).fieldErrors },
        422,
      )
    }

    const input = parsed.data
    const id = randomUUID()
    const tooFast = input.startedAt !== undefined && now() - input.startedAt < config.minFormMs
    if (input.website || tooFast) {
      // Pretend everything went fine so bots learn nothing.
      logger.warn(`[contact] dropped likely bot submission from ${ip}`)
      return c.json<ContactResponse>({ ok: true, id })
    }

    const message: StoredMessage = {
      id,
      receivedAt: new Date(now()).toISOString(),
      name: input.name,
      email: input.email,
      topic: input.topic,
      message: input.message,
      ip,
      userAgent: c.req.header('user-agent')?.slice(0, 300),
    }

    let saved = false
    try {
      await store.saveMessage(message)
      saved = true
    } catch (error) {
      logger.error('[contact] failed to store message', error)
    }

    let mailed = false
    if (mailer.enabled) {
      try {
        await mailer.send(message)
        mailed = true
      } catch (error) {
        logger.error('[contact] failed to send email', error)
      }
    }

    if (!saved && !mailed) {
      return c.json<ContactResponse>({ ok: false, error: 'The radio is down. Please try again later.' }, 503)
    }
    logger.info(`[contact] message ${id} received (stored=${saved}, mailed=${mailed})`)
    return c.json<ContactResponse>({ ok: true, id })
  })

  app.get('/api/stats', async (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json(await store.getStats())
  })

  app.post('/api/stats/visit', async (c) => {
    const ip = clientIp(c, config.trustProxy)
    if (!statsLimiter.hit(ip)) return c.json({ error: 'slow down' }, 429)
    const stats = await store.getStats()
    const visitors = visitSeen.hit(ip) ? await store.recordVisit() : stats.visitors
    return c.json({ visitors })
  })

  app.post('/api/stats/sighting', bodyLimit({ maxSize: 1024 }), async (c) => {
    const ip = clientIp(c, config.trustProxy)
    if (!statsLimiter.hit(ip)) return c.json({ error: 'slow down' }, 429)
    const body = (await readJson(c)) as { spot?: unknown } | undefined
    const spot = body?.spot
    if (!isSightingId(spot)) return c.json({ error: 'unknown spot' }, 400)
    const count = sightingSeen.hit(`${ip}:${spot}`) ? await store.recordSighting(spot) : ((await store.getStats()).sightings[spot] ?? 0)
    return c.json({ spot, count })
  })

  // The blog read live from the content folder (CONTENT_DIR), rather than the posts built into the site.
  const blog = config.contentDir ? createLiveBlog(path.join(config.contentDir, 'blog'), { now, logger }) : null
  const media = config.contentDir
    ? createMediaGate(path.join(config.contentDir, 'media'), path.join(config.dataDir, 'media-cache'), logger)
    : null

  if (blog) {
    // A post's text, for the site's post page.
    app.get('/api/blog/:slug', (c) => {
      const body = blog.body(c.req.param('slug'))
      if (body === null) return c.json({ error: 'not found' }, 404)
      c.header('Cache-Control', 'no-cache')
      return c.body(body, 200, { 'Content-Type': MARKDOWN_TYPE })
    })
  }

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

  const indexFile = config.staticDir ? path.join(config.staticDir, 'index.html') : null
  if (config.staticDir && indexFile && existsSync(indexFile)) {
    const indexHtml = readFileSync(indexFile, 'utf8')
    const built = blog ? new Map<string, string>() : builtMarkdown(config.staticDir)
    /** The Markdown at an address (a post's .md, or /llms.txt): live from the content folder, or as built. */
    const markdownAt = (href: string) => {
      if (!blog) return built.get(href)
      if (href === LLMS_TXT) return blog.llms()
      const slug = /^\/blog\/([^/]+)\.md$/.exec(href)?.[1]
      return (slug && blog.markdown(slug)) ?? undefined
    }
    const isPost = (slug: string) => (blog ? blog.has(slug) : built.has(markdownPath(slug)))
    /** The site's page: pointing tools to its Markdown version, and carrying the live blog's posts. */
    const shell = (markdownHref?: string) => {
      const html = markdownHref ? withMarkdownLink(indexHtml, markdownHref) : indexHtml
      return blog ? withBlogIndex(html, blog.posts()) : html
    }
    app.use('*', async (c, next) => {
      await next()
      if (!c.res.ok) return
      // Shown in the browser as text rather than downloaded (there's no .md in the usual list of types).
      if (c.req.path.endsWith('.md')) c.header('Content-Type', MARKDOWN_TYPE)
      // Sound files the static server has no type for (Safari won't play them unlabelled).
      const sound = soundType(c.req.path)
      if (sound) c.header('Content-Type', sound)
      if (c.req.path.startsWith('/assets/')) c.header('Cache-Control', 'public, max-age=31536000, immutable')
      else if (/^text\/(html|markdown|plain)/.test(c.res.headers.get('content-type') ?? '')) c.header('Cache-Control', 'no-cache')
    })
    if (blog && media) {
      // The live blog's plain versions and pictures (never the copies built into dist/, which may be out of date).
      app.on(['GET', 'HEAD'], '*', async (c, next) => {
        let pathname: string
        try {
          pathname = decodeURIComponent(c.req.path)
        } catch {
          return next()
        }
        if (pathname === LLMS_TXT) return c.body(blog.llms(), 200, { 'Content-Type': 'text/plain; charset=utf-8' })
        const md = /^\/blog\/([^/]+)\.md$/.exec(pathname)?.[1]
        if (md) {
          const text = blog.markdown(md)
          return text === null ? c.text('Not found', 404) : c.body(text, 200, { 'Content-Type': MARKDOWN_TYPE })
        }
        const plain = /^\/blog\/([^/.]+)\/plain\/?$/.exec(pathname)?.[1]
        if (plain) {
          const page = blog.plainPage(plain)
          return page === null ? c.text('Not found', 404) : c.html(page)
        }
        const rel = /^\/media\/(.+)$/.exec(pathname)?.[1]
        if (!rel) return next()
        const found = await media.resolve(rel)
        if (!found) return next()
        if ('blocked' in found) return c.text('Not found', 404)
        const modified = new Date(Math.floor(found.stats.mtimeMs / 1000) * 1000)
        const since = Date.parse(c.req.header('if-modified-since') ?? '')
        c.header('Cache-Control', 'no-cache')
        c.header('Last-Modified', modified.toUTCString())
        if (since >= modified.getTime()) return c.body(null, 304)
        const response = await serveStatic({ path: found.file })(c, next)
        // QuickTime and M4V movies are MP4 inside: labelled as such, browsers play them.
        if (/\.(mov|m4v)$/i.test(rel)) c.header('Content-Type', 'video/mp4')
        const sound = soundType(rel)
        if (sound) c.header('Content-Type', sound)
        return response
      })
    }
    // Pages with a Markdown version (a post, or /llms.txt for the home page and the blog index) say where
    // it is, for tools that read the page without running it, and hand it to AI tools that ask for Markdown.
    app.use('*', async (c, next) => {
      if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next()
      const href = markdownAlternate(c.req.path, isPost)
      const text = href ? markdownAt(href) : undefined
      if (!href || text === undefined) return next()
      c.header('Vary', 'Accept')
      if (prefersMarkdown(c.req.header('accept'))) return c.body(text, 200, { 'Content-Type': MARKDOWN_TYPE })
      return c.html(shell(href))
    })
    app.use('*', serveStatic({ root: config.staticDir }))
    // SPA fallback for client-side routes like /logbook/some-post; real files that are missing stay 404.
    app.get('*', (c) => {
      if (/\.[a-z0-9]{2,5}$/i.test(c.req.path)) return c.text('Not found', 404)
      return c.html(shell())
    })
  }

  app.onError((error, c) => {
    logger.error('[server] unhandled error', error)
    return c.json({ error: 'internal error' }, 500)
  })

  return app
}
